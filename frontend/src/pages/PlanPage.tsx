import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../api/client";
import { TopicRow } from "../components/plan/TopicRow";
import { AppFooter } from "../components/ui/AppFooter";
import { AppHeader } from "../components/ui/AppHeader";
import { Modal } from "../components/ui/Modal";
import { usePlanSession } from "../hooks/usePlanSession";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { fmtDate, formatMinutes, iso, pad } from "../lib/dates";
import { planMonthNow } from "../lib/planModel";
import { normalizeProgress, topicStatus } from "../lib/progress";
import { aggregateStats, heatLevels, monthStats } from "../lib/stats";
import type { FilterKey, UiTopic } from "../types/models";

export function PlanPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const session = usePlanSession(slug, toast);
  const { toggleTheme } = useTheme((theme) => {
    session.setProgress((prev) => ({
      ...prev,
      settings: { ...prev.settings, theme },
    }));
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newModuleId, setNewModuleId] = useState("");
  const [sectionHeading, setSectionHeading] = useState("");
  const [sectionPeriod, setSectionPeriod] = useState("");
  const [sectionGoal, setSectionGoal] = useState("");
  const [sectionTech, setSectionTech] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [focusMins, setFocusMins] = useState(25);
  const [clockMs, setClockMs] = useState(25 * 60000);
  const [focusRunning, setFocusRunning] = useState(false);
  const focusEnd = useRef(0);
  const focusTimer = useRef<number | undefined>(undefined);
  const stickyHead = useRef<HTMLDivElement>(null);

  const selectedTopic: UiTopic | undefined = useMemo(
    () => session.allTopics.find((z) => z.id === session.selectedTopicId),
    [session.allTopics, session.selectedTopicId],
  );

  useEffect(() => {
    if (!selectedTopic) setNotesOpen(false);
  }, [selectedTopic]);

  useEffect(() => {
    if (session.modules.length && !newModuleId) {
      setNewModuleId(session.modules[0].moduleId);
    }
  }, [session.modules, newModuleId]);

  useEffect(() => {
    const sync = () => {
      if (stickyHead.current) {
        document.documentElement.style.setProperty(
          "--sticky-toolbar-top",
          `${stickyHead.current.offsetHeight}px`,
        );
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        document.getElementById("search")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(
    () => aggregateStats(session.allTopics, session.progress),
    [session.allTopics, session.progress],
  );

  const upNext = useMemo(() => {
    const up: Array<[string, UiTopic]> = [];
    session.allTopics.forEach((x) => {
      const s = session.progress.items[x.id] || {};
      if (s.date && topicStatus(s) !== "done") up.push([s.date, x]);
    });
    up.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return up.slice(0, 8);
  }, [session.allTopics, session.progress]);

  const showClock = useCallback((ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    setClockMs(s * 1000);
  }, []);

  const toggleFocus = () => {
    if (focusRunning) {
      window.clearInterval(focusTimer.current);
      setFocusRunning(false);
      showClock(focusMins * 60000);
      return;
    }
    focusEnd.current = Date.now() + focusMins * 60000;
    setFocusRunning(true);
    focusTimer.current = window.setInterval(() => {
      const rem = focusEnd.current - Date.now();
      showClock(rem);
      if (rem <= 0) {
        window.clearInterval(focusTimer.current);
        setFocusRunning(false);
        session.logMin(focusMins);
        toast("Focus session logged");
        showClock(focusMins * 60000);
      }
    }, 500);
  };

  const focusCurrentModule = () => {
    const mn = planMonthNow(session.slug, session.modules);
    session.setProgress((prev) => {
      const collapsed = { ...(prev.settings.collapsed || {}) };
      session.modules.forEach((m) => {
        collapsed[`m${m.n}`] = m.n !== mn;
      });
      return { ...prev, settings: { ...prev.settings, collapsed } };
    });
    window.location.hash = `month-${mn}`;
  };

  const addTopic = async () => {
    if (!newTitle.trim()) return;
    if (!session.apiOnline) {
      toast("Start Docker / server to add topics");
      return;
    }
    try {
      await api.createTopic(slug, {
        module_id: newModuleId,
        title: newTitle.trim(),
        url: newUrl.trim(),
        kind: "Custom",
      });
      setNewTitle("");
      setNewUrl("");
      await session.reloadPlan();
      toast("Topic added");
    } catch {
      toast("Could not add topic");
    }
  };

  const addSection = async () => {
    if (!sectionHeading.trim()) {
      toast("Enter a section title");
      return;
    }
    try {
      await api.createModule(slug, {
        heading: sectionHeading.trim(),
        period_label: sectionPeriod.trim(),
        goal: sectionGoal.trim(),
        tech: sectionTech,
      });
      setSectionModal(false);
      await session.reloadPlan();
      toast("Section added");
    } catch {
      toast("Could not add section");
    }
  };

  const clockLabel = `${pad(Math.floor(clockMs / 60000))}:${pad(Math.floor((clockMs / 1000) % 60))}`;

  if (!session.plan) {
    return (
      <div className="page-shell">
        <AppHeader backTo="/" backLabel="All domains" />
        <div className="home-shell">
          <p className="sub">Loading plan…</p>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="page-shell">
    <AppHeader backTo="/" backLabel="All domains">
      <button type="button" className="icon-btn" title="Toggle theme" aria-label="Toggle theme" onClick={toggleTheme}>
        ◐
      </button>
    </AppHeader>
    <div
      className={`app${selectedTopic ? " has-selected-topic" : ""}${notesOpen && selectedTopic ? " notes-open" : ""}`}
    >
      <aside className={`sidebar${sidebarOpen ? " mobile-open" : ""}`} aria-label="Plan navigation">
        <p className="brand">{session.plan.title}</p>
        <p className="brand-sub">{session.plan.subtitle || ""}</p>
        <nav>
          <ul className="nav-months">
            {session.modules.map((m) => {
              const st = monthStats(m.n, session.allTopics, session.progress);
              return (
                <li key={m.moduleId}>
                  <a href={`#month-${m.n}`} onClick={() => setSidebarOpen(false)}>
                    <span className="ring-nav" style={{ ["--p" as string]: st.pct }} data-n={m.n} />
                    <span>
                      <span>{m.h}</span>
                      <span className="meta">{m.t}</span>
                    </span>
                    <span className="pct">{st.pct}%</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link to="/" className="btn btn-ghost" style={{ marginTop: 16, width: "100%" }}>
          ← All domains
        </Link>
      </aside>

      <div className="main">
        <div className="main-sticky-head" ref={stickyHead}>
          <header className="topbar">
            <button
              type="button"
              className="menu-btn btn"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              Menu
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              id="notesBtn"
              style={{ display: "none" }}
              disabled={!selectedTopic}
              onClick={() => selectedTopic && setNotesOpen((v) => !v)}
            >
              Notes
            </button>
            <div className="search-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                id="search"
                placeholder="Search topics, notes…"
                autoComplete="off"
                aria-label="Search topics"
                value={session.search}
                onChange={(e) => session.setSearch(e.target.value.trim())}
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={focusCurrentModule}>
              This module
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setSectionModal(true)}>
              New section
            </button>
          </header>
        </div>

        <section className="hero">
          <h1>{session.plan.title}</h1>
          <p className="lead">{session.plan.lead || ""}</p>
        </section>

        <div className="stats" aria-live="polite">
          <div className="stat-card accent">
            <div className="label">Topics done</div>
            <div className="value">
              {stats.done} / {stats.total}
            </div>
            <div className="sub">
              {stats.pct}% complete · {stats.doing} in progress
            </div>
            <div className="bar">
              <i style={{ width: `${stats.pct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="label">This week</div>
            <div className="value">{formatMinutes(stats.weekMins)}</div>
            <label className="goal-row">
              Goal
              <input
                type="number"
                min={1}
                max={80}
                value={session.progress.goal}
                aria-label="Weekly study goal in hours"
                onChange={(e) => {
                  const g = Math.max(1, +e.target.value || 8);
                  session.setProgress((prev) => ({ ...prev, goal: g }));
                }}
              />
              hrs / week
            </label>
            <div className="bar">
              <i
                style={{
                  width: `${Math.min(100, (stats.weekMins / (session.progress.goal * 60)) * 100)}%`,
                }}
              />
            </div>
          </div>
          {[
            {
              l: "Study streak",
              v: `${stats.streak}${stats.streak === 1 ? " day" : " days"}`,
              sub: "Days in a row with logged time",
              warn: false,
            },
            { l: "Scheduled", v: String(stats.sch), sub: "Topics with a planned date", warn: false },
            { l: "Starred", v: String(stats.star), sub: "Priority topics", warn: false },
            {
              l: "Overdue",
              v: String(stats.od),
              sub: stats.od ? "Needs attention" : "On track",
              warn: stats.od > 0,
            },
          ].map((c) => (
            <div key={c.l} className={`stat-card${c.warn ? " warn" : ""}`}>
              <div className="label">{c.l}</div>
              <div className="value">{c.v}</div>
              <div className="sub">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="dash">
          <section className="panel">
            <h2>Study activity</h2>
            <p className="heat-legend">Last 12 weeks — darker = more minutes logged</p>
            <div className="heat" aria-label="Daily study heatmap">
              {heatLevels(session.progress).map((cell) => (
                <i
                  key={cell.key}
                  data-l={cell.level}
                  title={cell.title}
                  style={cell.hidden ? { visibility: "hidden" } : undefined}
                />
              ))}
            </div>
            <div className="timer">
              <span className="clock" aria-live="polite">
                {clockLabel}
              </span>
              <select
                aria-label="Focus session length"
                value={focusMins}
                onChange={(e) => {
                  const v = +e.target.value;
                  setFocusMins(v);
                  if (!focusRunning) showClock(v * 60000);
                }}
              >
                <option value={15}>15 min</option>
                <option value={25}>25 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
              <button type="button" className="btn btn-primary" onClick={toggleFocus}>
                {focusRunning ? "Stop" : "Start focus"}
              </button>
            </div>
          </section>
          <section className="panel">
            <h2>Up next</h2>
            <ol className="schedule-list">
              {!upNext.length ? (
                <li>Nothing scheduled yet — set dates or use Auto-schedule.</li>
              ) : (
                upNext.map(([d, x]) => (
                  <li key={x.id}>
                    <span className={`date${d < iso(new Date()) ? " overdue" : ""}`}>{fmtDate(d)}</span>
                    {x.t}
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>

        <div className="toolbar main-scroll-toolbar">
          <label>
            Filter
            <select
              aria-label="Filter topics"
              value={session.filter}
              onChange={(e) => session.setFilter(e.target.value as FilterKey)}
            >
              <option value="all">All topics</option>
              <option value="todo">To do</option>
              <option value="doing">Learning</option>
              <option value="open">Open only</option>
              <option value="done">Completed</option>
              <option value="starred">Starred</option>
              <option value="scheduled">Scheduled</option>
              <option value="unscheduled">Unscheduled</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={session.autoSchedule}>
            Auto-schedule
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setImportText(JSON.stringify(session.progress, null, 2));
              setImportModal(true);
            }}
          >
            Export
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setImportText("");
              setImportModal(true);
            }}
          >
            Import
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              session.setProgress((prev) => ({ ...prev, settings: { ...prev.settings, collapsed: {} } }));
              toast("All months expanded");
            }}
          >
            Expand all
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              session.setProgress((prev) => {
                const collapsed = { ...(prev.settings.collapsed || {}) };
                session.modules.forEach((m) => {
                  if (monthStats(m.n, session.allTopics, session.progress).pct === 100) {
                    collapsed[`m${m.n}`] = true;
                  }
                });
                return { ...prev, settings: { ...prev.settings, collapsed } };
              });
            }}
          >
            Collapse done months
          </button>
          <span className="sub" style={{ marginLeft: "auto", fontSize: ".85rem", color: "var(--muted)" }}>
            {session.savedLabel}
          </span>
        </div>

        <ul className="chips" aria-label="Filter by technology">
          {session.techTags.map((t) => (
            <li
              key={t}
              className={session.techFlt === t ? "active" : ""}
              onClick={() => session.setTechFlt(session.techFlt === t ? "" : t)}
            >
              {t}
            </li>
          ))}
        </ul>

        <div id="months">
          {session.modules.map((m) => {
            const st = monthStats(m.n, session.allTopics, session.progress);
            const collapsed = session.isCollapsed(m.n);
            const topics = session.visibleTopics(m.n);
            return (
              <section className="month-block" id={`month-${m.n}`} key={m.moduleId}>
                <div
                  className={`month-head${collapsed ? " is-collapsed" : ""}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,input,button,textarea")) return;
                    session.toggleCollapse(m.n);
                  }}
                >
                  <span className="badge">{m.n}</span>
                  <span className="ring-nav" style={{ ["--p" as string]: st.pct }} data-n={m.n} />
                  <div className="titles">
                    <h2>{m.h}</h2>
                    <p className="when">{m.t}</p>
                    <p className="goal">{m.g}</p>
                  </div>
                  <div className="month-meta">
                    <span className="sub">
                      {st.done}/{st.total} done
                    </span>
                  </div>
                  <span className="chevron">▼</span>
                </div>
                {!collapsed ? (
                  <div className="month-body">
                    <div className="month-progress">
                      <span>
                        {st.done} / {st.total} topics done
                      </span>
                      <div className="bar">
                        <i style={{ width: `${st.pct}%` }} />
                      </div>
                    </div>
                    <ul className="month-tech">
                      {m.tech.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <ul className="topic-list">
                      {topics.length ? (
                        topics.map((x) => (
                          <TopicRow
                            key={x.id}
                            topic={x}
                            progress={session.progress}
                            selected={session.selectedTopicId === x.id}
                            onSelect={() => {
                              session.setSelectedTopicId(x.id);
                              setNotesOpen(true);
                            }}
                            onCycleStatus={() => session.cycleStatus(x.id)}
                            onPatch={(patch) => session.patchTopic(x.id, patch)}
                            onLog={(mins) => {
                              session.logMin(mins, x.id);
                              toast(`Logged ${mins}m`);
                            }}
                            onRemove={() => {
                              session.removeTopic(x.id).then(() => {
                                if (session.selectedTopicId === x.id) {
                                  session.setSelectedTopicId(null);
                                  setNotesOpen(false);
                                }
                              });
                            }}
                          />
                        ))
                      ) : (
                        <li className="empty-filter">No topics match your filters.</li>
                      )}
                    </ul>
                    {m.p ? (
                      <div className="project-box">
                        <b>Project</b> {m.p}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <section className="panel add-form">
          <h2>Add a topic</h2>
          <div className="row">
            <input
              type="text"
              placeholder="Title"
              aria-label="Topic title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              type="url"
              placeholder="Link (optional)"
              aria-label="Link"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <select aria-label="Month" value={newModuleId} onChange={(e) => setNewModuleId(e.target.value)}>
              {session.modules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>
                  {(m.t ? `${m.t}: ` : "") + m.h}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={addTopic}>
              Add
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (resetConfirm) {
                session.setProgress(() => normalizeProgress(null));
                setResetConfirm(false);
              } else setResetConfirm(true);
            }}
          >
            {resetConfirm ? "Click again to erase progress, logs and notes" : "Reset all progress"}
          </button>
        </section>
      </div>

      {notesOpen && selectedTopic ? (
        <aside
          className="right-panel glass notes-visible"
          id="rightPanel"
          aria-label="Topic notes"
        >
          <div className="right-panel-head">
            <h2>Notes</h2>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              aria-label="Close notes"
              onClick={() => setNotesOpen(false)}
            >
              ×
            </button>
          </div>
          <h3 id="notesTopicTitle">{selectedTopic.t}</h3>
          <p className="hint" id="notesMeta">
            {selectedTopic.k}
            {selectedTopic.u ? ` · ${selectedTopic.u}` : ""}
          </p>
          <textarea
            id="notesEditor"
            aria-label="Topic notes"
            value={session.progress.items[selectedTopic.id]?.note || ""}
            onChange={(e) => session.patchTopic(selectedTopic.id, { note: e.target.value })}
          />
        </aside>
      ) : null}

      <Modal
        open={sectionModal}
        title="New section"
        onClose={() => setSectionModal(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setSectionModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={addSection}>
              Add section
            </button>
          </>
        }
      >
        <div className="add-form">
          <input
            type="text"
            placeholder="Section title"
            value={sectionHeading}
            onChange={(e) => setSectionHeading(e.target.value)}
          />
          <input
            type="text"
            placeholder="Period label (e.g. Phase 2)"
            value={sectionPeriod}
            onChange={(e) => setSectionPeriod(e.target.value)}
          />
          <textarea
            placeholder="Goal for this section"
            rows={2}
            value={sectionGoal}
            onChange={(e) => setSectionGoal(e.target.value)}
          />
          <input
            type="text"
            placeholder="Tags, comma-separated"
            value={sectionTech}
            onChange={(e) => setSectionTech(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={importModal}
        title="Import / export"
        onClose={() => setImportModal(false)}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                navigator.clipboard.writeText(importText).then(() => toast("Copied"));
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                try {
                  session.setProgress(() => normalizeProgress(JSON.parse(importText)));
                  setImportModal(false);
                  toast("Import applied");
                  showClock(focusMins * 60000);
                } catch {
                  toast("Invalid JSON");
                }
              }}
            >
              Apply import
            </button>
            <button type="button" className="btn" onClick={() => setImportModal(false)}>
              Close
            </button>
          </>
        }
      >
        <textarea aria-label="Plan JSON" value={importText} onChange={(e) => setImportText(e.target.value)} />
      </Modal>
    </div>
    <AppFooter />
    </div>
  );
}
