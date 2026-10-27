"""Plan curriculum and user progress storage (PostgreSQL or JSON files)."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
DEFAULT_PROGRESS: dict[str, Any] = {"items": {}, "log": {}, "goal": 8, "settings": {}}


def get_dsn() -> str:
    """Return PostgreSQL connection string from environment."""
    import os

    return os.getenv("DATABASE_URL", "postgresql://roadmap:roadmap@db:5432/roadmap")


def storage_mode() -> str:
    """Return ``postgres`` or ``file`` from environment."""
    import os

    return os.getenv("STORAGE", "postgres")


def data_root() -> Path:
    """Root directory for file-based storage."""
    import os

    return Path(os.getenv("DATA_FILE", "/data/plan.json")).parent


def pg_connect():
    """Open a PostgreSQL connection with autocommit."""
    import psycopg

    return psycopg.connect(get_dsn(), autocommit=True)


def init_schema() -> None:
    """
    Create tables if missing and seed plans from ``app/seed/*.json``.

    Raises:
        RuntimeError: If PostgreSQL is unreachable in postgres mode.
    """
    if storage_mode() == "file":
        data_root().mkdir(parents=True, exist_ok=True)
        (data_root() / "plans").mkdir(exist_ok=True)
        (data_root() / "progress").mkdir(exist_ok=True)
        seed_all_plans_file()
        migrate_legacy_file_state()
        logger.info("File storage initialized at %s", data_root())
        return

    for attempt in range(30):
        try:
            with pg_connect() as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS plans (
                        slug TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        subtitle TEXT,
                        lead TEXT,
                        created_at TIMESTAMPTZ DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS plan_modules (
                        id TEXT PRIMARY KEY,
                        plan_slug TEXT NOT NULL REFERENCES plans(slug) ON DELETE CASCADE,
                        sort_order INT NOT NULL,
                        period_label TEXT,
                        heading TEXT,
                        goal TEXT,
                        project TEXT,
                        tech JSONB NOT NULL DEFAULT '[]'::jsonb
                    );
                    CREATE TABLE IF NOT EXISTS plan_topics (
                        id TEXT PRIMARY KEY,
                        module_id TEXT NOT NULL REFERENCES plan_modules(id) ON DELETE CASCADE,
                        plan_slug TEXT NOT NULL REFERENCES plans(slug) ON DELETE CASCADE,
                        sort_order INT NOT NULL DEFAULT 0,
                        title TEXT NOT NULL,
                        url TEXT,
                        kind TEXT,
                        description TEXT
                    );
                    CREATE TABLE IF NOT EXISTS plan_progress (
                        plan_slug TEXT PRIMARY KEY REFERENCES plans(slug) ON DELETE CASCADE,
                        data JSONB NOT NULL DEFAULT '{}'::jsonb,
                        updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    CREATE TABLE IF NOT EXISTS legacy_state (
                        id INT PRIMARY KEY,
                        data JSONB NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT now()
                    );
                    """
                )
            seed_all_plans_postgres()
            migrate_legacy_postgres_state()
            logger.info("PostgreSQL schema ready and seeds applied")
            return
        except Exception as exc:
            logger.warning("Database not ready (attempt %s): %s", attempt + 1, exc)
            time.sleep(1)
    raise RuntimeError("database not reachable")


def _seed_files() -> list[Path]:
    """List JSON seed files under ``app/seed``."""
    return sorted(SEED_DIR.glob("*.json"))


def seed_all_plans_postgres() -> None:
    """Upsert every seed file into PostgreSQL."""
    for path in _seed_files():
        payload = json.loads(path.read_text())
        upsert_plan_postgres(payload)
        logger.info("Seeded plan %s from %s", payload.get("slug"), path.name)


def seed_all_plans_file() -> None:
    """Copy seed JSON into file storage when a plan file is missing."""
    plans_dir = data_root() / "plans"
    for path in _seed_files():
        payload = json.loads(path.read_text())
        slug = payload["slug"]
        dest = plans_dir / f"{slug}.json"
        if not dest.exists():
            dest.write_text(json.dumps(payload, indent=2))
            logger.info("Wrote plan file %s", dest)


def upsert_plan_postgres(plan: dict[str, Any]) -> None:
    """
    Insert or update a plan, its modules, and topics.

    Existing topics are updated by id; topics removed from seed are not deleted
    automatically (user deletes via API).
    """
    slug = plan["slug"]
    with pg_connect() as conn:
        conn.execute(
            """
            INSERT INTO plans (slug, title, subtitle, lead)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET
                title = EXCLUDED.title,
                subtitle = EXCLUDED.subtitle,
                lead = EXCLUDED.lead
            """,
            (slug, plan["title"], plan.get("subtitle"), plan.get("lead")),
        )
        for mod in plan.get("modules", []):
            conn.execute(
                """
                INSERT INTO plan_modules (id, plan_slug, sort_order, period_label, heading, goal, project, tech)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    period_label = EXCLUDED.period_label,
                    heading = EXCLUDED.heading,
                    goal = EXCLUDED.goal,
                    project = EXCLUDED.project,
                    tech = EXCLUDED.tech
                """,
                (
                    mod["id"],
                    slug,
                    mod["sort_order"],
                    mod.get("period_label"),
                    mod.get("heading"),
                    mod.get("goal"),
                    mod.get("project"),
                    json.dumps(mod.get("tech") or []),
                ),
            )
            for topic in mod.get("topics", []):
                conn.execute(
                    """
                    INSERT INTO plan_topics (id, module_id, plan_slug, sort_order, title, url, kind, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        module_id = EXCLUDED.module_id,
                        sort_order = EXCLUDED.sort_order,
                        title = EXCLUDED.title,
                        url = EXCLUDED.url,
                        kind = EXCLUDED.kind,
                        description = EXCLUDED.description
                    """,
                    (
                        topic["id"],
                        mod["id"],
                        slug,
                        topic.get("sort_order", 0),
                        topic["title"],
                        topic.get("url") or "",
                        topic.get("kind"),
                        topic.get("description"),
                    ),
                )


def migrate_legacy_postgres_state() -> None:
    """Move old single-table ``state`` row into ``ai-engineer`` progress if present."""
    with pg_connect() as conn:
        row = conn.execute("SELECT to_regclass('public.state')").fetchone()
        if not row or not row[0]:
            return
        legacy = conn.execute("SELECT data FROM state WHERE id = 1").fetchone()
        if not legacy:
            return
        data = _normalize_progress(legacy[0])
        conn.execute(
            """
            INSERT INTO plan_progress (plan_slug, data)
            VALUES ('ai-engineer', %s::jsonb)
            ON CONFLICT (plan_slug) DO NOTHING
            """,
            (json.dumps(data),),
        )
        logger.info("Migrated legacy state row to ai-engineer progress")


def migrate_legacy_file_state() -> None:
    """Migrate ``/data/plan.json`` into progress file when needed."""
    legacy = data_root() / "plan.json"
    progress = data_root() / "progress" / "ai-engineer.json"
    if legacy.exists() and not progress.exists():
        raw = json.loads(legacy.read_text())
        progress.write_text(json.dumps(_normalize_progress(raw), indent=2))
        logger.info("Migrated legacy plan.json to progress/ai-engineer.json")


def _normalize_progress(raw: Any) -> dict[str, Any]:
    """Convert old combined state blobs to progress-only shape."""
    if not isinstance(raw, dict):
        return dict(DEFAULT_PROGRESS)
    if "items" in raw:
        out = dict(DEFAULT_PROGRESS)
        out["items"] = raw.get("items") or {}
        out["log"] = raw.get("log") or {}
        out["goal"] = raw.get("goal") or 8
        out["settings"] = raw.get("settings") or {}
        return out
    items = {k: {"done": 1} for k in raw.keys()} if raw else {}
    return {"items": items, "log": {}, "goal": 8, "settings": {}}


def _slugify(title: str) -> str:
    """Build a URL-safe slug from a title."""
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
    return base or f"plan-{uuid.uuid4().hex[:8]}"


def _unique_slug(title: str) -> str:
    """Return a slug that does not collide with an existing plan."""
    base = _slugify(title)
    slug = base
    n = 2
    while get_plan(slug):
        slug = f"{base}-{n}"
        n += 1
    return slug


def _progress_stats(slug: str, plan: dict[str, Any]) -> dict[str, Any]:
    """Compute topic completion stats for a plan."""
    progress = get_progress(slug)
    items = progress.get("items") or {}
    topic_ids = [
        t["id"]
        for mod in plan.get("modules") or []
        for t in mod.get("topics") or []
    ]
    done = 0
    for tid in topic_ids:
        raw = items.get(tid) or {}
        if raw.get("st") == "done" or raw.get("done"):
            done += 1
    total = len(topic_ids)
    return {
        "topics_total": total,
        "topics_done": done,
        "percent_done": round(done / total * 100) if total else 0,
        "sections": len(plan.get("modules") or []),
    }


def list_plans() -> list[dict[str, str]]:
    """Return summary metadata for all plans."""
    return [
        {
            "slug": p["slug"],
            "title": p["title"],
            "subtitle": p.get("subtitle") or "",
        }
        for p in list_plans_overview()
    ]


def list_plans_overview() -> list[dict[str, Any]]:
    """Return plans with progress overview for the home page."""
    if storage_mode() == "file":
        out = []
        for path in sorted((data_root() / "plans").glob("*.json")):
            plan = json.loads(path.read_text())
            stats = _progress_stats(plan["slug"], plan)
            out.append(
                {
                    "slug": plan["slug"],
                    "title": plan["title"],
                    "subtitle": plan.get("subtitle") or "",
                    "lead": plan.get("lead") or "",
                    **stats,
                }
            )
        return out

    with pg_connect() as conn:
        rows = conn.execute(
            "SELECT slug, title, COALESCE(subtitle, ''), COALESCE(lead, '') FROM plans ORDER BY title"
        ).fetchall()
    out = []
    for row in rows:
        plan = get_plan(row[0])
        if not plan:
            continue
        stats = _progress_stats(row[0], plan)
        out.append(
            {
                "slug": row[0],
                "title": row[1],
                "subtitle": row[2],
                "lead": row[3],
                **stats,
            }
        )
    return out


def _write_plan_file(plan: dict[str, Any]) -> None:
    """Persist a plan dict to file storage."""
    path = data_root() / "plans" / f"{plan['slug']}.json"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(plan, indent=2))
    tmp.replace(path)


def create_plan(body: dict[str, Any]) -> dict[str, Any]:
    """
    Create a new learning domain (plan).

    Args:
        body: ``title`` required; optional ``slug``, ``subtitle``, ``lead``.

    Returns:
        The created plan record (modules may be empty).
    """
    title = (body.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")
    slug = (body.get("slug") or "").strip() or _unique_slug(title)
    if get_plan(slug):
        raise ValueError("slug already exists")
    plan = {
        "slug": slug,
        "title": title,
        "subtitle": (body.get("subtitle") or "").strip(),
        "lead": (body.get("lead") or "").strip(),
        "modules": [],
    }
    if storage_mode() == "file":
        _write_plan_file(plan)
    else:
        with pg_connect() as conn:
            conn.execute(
                """
                INSERT INTO plans (slug, title, subtitle, lead)
                VALUES (%s, %s, %s, %s)
                """,
                (slug, title, plan["subtitle"], plan["lead"]),
            )
    save_progress(slug, dict(DEFAULT_PROGRESS))
    logger.info("Created plan %s", slug)
    return plan


def delete_plan(slug: str) -> bool:
    """
    Delete a learning domain and its stored progress.

    Args:
        slug: Plan identifier.

    Returns:
        True if a plan was removed, False if the slug was not found.
    """
    if not get_plan(slug):
        logger.debug("Delete plan skipped; slug=%s not found", slug)
        return False
    if storage_mode() == "file":
        plan_path = data_root() / "plans" / f"{slug}.json"
        progress_path = data_root() / "progress" / f"{slug}.json"
        if plan_path.exists():
            plan_path.unlink()
        if progress_path.exists():
            progress_path.unlink()
        logger.info("Deleted plan slug=%s (file storage)", slug)
        return True

    with pg_connect() as conn:
        row = conn.execute(
            "DELETE FROM plans WHERE slug = %s RETURNING slug",
            (slug,),
        ).fetchone()
    if row:
        logger.info("Deleted plan slug=%s (postgres)", slug)
    return bool(row)


def add_module(slug: str, body: dict[str, Any]) -> dict[str, Any]:
    """
    Add a section (module) to a plan.

    Args:
        slug: Plan identifier.
        body: ``heading`` required; optional labels and ``tech`` list.

    Returns:
        The created module record.
    """
    plan = get_plan(slug)
    if not plan:
        raise LookupError("plan not found")
    heading = (body.get("heading") or "").strip()
    if not heading:
        raise ValueError("heading is required")
    sort_order = body.get("sort_order")
    if sort_order is None:
        sort_order = max([m.get("sort_order", 0) for m in plan.get("modules") or []], default=0) + 1
    module_id = body.get("id") or f"{slug}-m{sort_order}"
    tech = body.get("tech") or []
    if isinstance(tech, str):
        tech = [t.strip() for t in tech.split(",") if t.strip()]
    module = {
        "id": module_id,
        "sort_order": int(sort_order),
        "period_label": (body.get("period_label") or "").strip(),
        "heading": heading,
        "goal": (body.get("goal") or "").strip(),
        "project": (body.get("project") or "").strip(),
        "tech": tech,
        "topics": [],
    }
    if storage_mode() == "file":
        plan.setdefault("modules", []).append(module)
        plan["modules"].sort(key=lambda m: m["sort_order"])
        _write_plan_file(plan)
    else:
        with pg_connect() as conn:
            conn.execute(
                """
                INSERT INTO plan_modules (id, plan_slug, sort_order, period_label, heading, goal, project, tech)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    module_id,
                    slug,
                    module["sort_order"],
                    module["period_label"],
                    module["heading"],
                    module["goal"],
                    module["project"],
                    json.dumps(module["tech"]),
                ),
            )
    logger.info("Added module %s to plan %s", module_id, slug)
    return module


def get_plan(slug: str) -> dict[str, Any] | None:
    """Load full plan curriculum for ``slug``."""
    if storage_mode() == "file":
        path = data_root() / "plans" / f"{slug}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text())

    with pg_connect() as conn:
        plan_row = conn.execute(
            "SELECT slug, title, subtitle, lead FROM plans WHERE slug = %s", (slug,)
        ).fetchone()
        if not plan_row:
            return None
        modules = conn.execute(
            """
            SELECT id, sort_order, period_label, heading, goal, project, tech
            FROM plan_modules WHERE plan_slug = %s ORDER BY sort_order
            """,
            (slug,),
        ).fetchall()
        topics = conn.execute(
            """
            SELECT id, module_id, sort_order, title, url, kind, description
            FROM plan_topics WHERE plan_slug = %s ORDER BY sort_order, id
            """,
            (slug,),
        ).fetchall()

    by_mod: dict[str, list] = {m[0]: [] for m in modules}
    for t in topics:
        by_mod[t[1]].append(
            {
                "id": t[0],
                "title": t[3],
                "url": t[4] or "",
                "kind": t[5] or "Topic",
                "description": t[6] or "",
                "sort_order": t[2],
            }
        )

    return {
        "slug": plan_row[0],
        "title": plan_row[1],
        "subtitle": plan_row[2],
        "lead": plan_row[3],
        "modules": [
            {
                "id": m[0],
                "sort_order": m[1],
                "period_label": m[2],
                "heading": m[3],
                "goal": m[4],
                "project": m[5],
                "tech": m[6] if isinstance(m[6], list) else json.loads(m[6] or "[]"),
                "topics": by_mod.get(m[0], []),
            }
            for m in modules
        ],
    }


def get_progress(slug: str) -> dict[str, Any]:
    """Load user progress for a plan."""
    if storage_mode() == "file":
        path = data_root() / "progress" / f"{slug}.json"
        if path.exists():
            return _normalize_progress(json.loads(path.read_text()))
        return dict(DEFAULT_PROGRESS)

    with pg_connect() as conn:
        row = conn.execute(
            "SELECT data FROM plan_progress WHERE plan_slug = %s", (slug,)
        ).fetchone()
    if not row:
        return dict(DEFAULT_PROGRESS)
    return _normalize_progress(row[0])


def save_progress(slug: str, data: dict[str, Any]) -> None:
    """Persist user progress for a plan."""
    payload = _normalize_progress(data)
    if storage_mode() == "file":
        path = data_root() / "progress" / f"{slug}.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        tmp.replace(path)
        return

    with pg_connect() as conn:
        conn.execute(
            """
            INSERT INTO plan_progress (plan_slug, data)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (plan_slug) DO UPDATE SET
                data = EXCLUDED.data,
                updated_at = now()
            """,
            (slug, json.dumps(payload)),
        )


def add_topic(slug: str, module_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """
    Add a user topic to a module.

    Returns:
        The created topic record.
    """
    topic_id = body.get("id") or f"t{uuid.uuid4().hex[:12]}"
    title = (body.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")

    topic = {
        "id": topic_id,
        "title": title,
        "url": (body.get("url") or "").strip(),
        "kind": (body.get("kind") or "Custom").strip(),
        "description": (body.get("description") or "").strip(),
        "sort_order": int(body.get("sort_order") or 9999),
    }

    if storage_mode() == "file":
        plan = get_plan(slug)
        if not plan:
            raise LookupError("plan not found")
        mod = next((m for m in plan["modules"] if m["id"] == module_id), None)
        if not mod:
            raise LookupError("module not found")
        mod.setdefault("topics", []).append(topic)
        _write_plan_file(plan)
        return topic

    with pg_connect() as conn:
        exists = conn.execute(
            "SELECT 1 FROM plan_modules WHERE id = %s AND plan_slug = %s",
            (module_id, slug),
        ).fetchone()
        if not exists:
            raise LookupError("module not found")
        conn.execute(
            """
            INSERT INTO plan_topics (id, module_id, plan_slug, sort_order, title, url, kind, description)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                topic_id,
                module_id,
                slug,
                topic["sort_order"],
                topic["title"],
                topic["url"],
                topic["kind"],
                topic["description"],
            ),
        )
    logger.info("Added topic %s to plan %s module %s", topic_id, slug, module_id)
    return topic


def delete_topic(slug: str, topic_id: str) -> bool:
    """Delete a topic from a plan. Returns False if not found."""
    if storage_mode() == "file":
        plan = get_plan(slug)
        if not plan:
            return False
        found = False
        for mod in plan["modules"]:
            before = len(mod.get("topics") or [])
            mod["topics"] = [t for t in mod.get("topics") or [] if t["id"] != topic_id]
            if len(mod["topics"]) < before:
                found = True
        if not found:
            return False
        _write_plan_file(plan)
        return True

    with pg_connect() as conn:
        cur = conn.execute(
            "DELETE FROM plan_topics WHERE plan_slug = %s AND id = %s RETURNING id",
            (slug, topic_id),
        ).fetchone()
    if cur:
        logger.info("Deleted topic %s from plan %s", topic_id, slug)
    return bool(cur)


def plan_to_frontend_modules(plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Map API plan shape to legacy ``M`` array used by the UI."""
    modules = []
    for mod in plan.get("modules", []):
        modules.append(
            {
                "n": mod["sort_order"],
                "moduleId": mod["id"],
                "t": mod.get("period_label") or "",
                "h": mod.get("heading") or "",
                "g": mod.get("goal") or "",
                "p": mod.get("project") or "",
                "tech": mod.get("tech") or [],
                "topics": [
                    {
                        "id": t["id"],
                        "t": t["title"],
                        "u": t.get("url") or "",
                        "k": t.get("kind") or "Topic",
                        "note": t.get("description") or "",
                    }
                    for t in sorted(mod.get("topics") or [], key=lambda x: x.get("sort_order", 0))
                ],
            }
        )
    return sorted(modules, key=lambda x: x["n"])
