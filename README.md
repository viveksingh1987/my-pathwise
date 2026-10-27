# AI engineer roadmap (Docker)

    docker compose up --build

Open http://localhost:8000. Dates, notes, ticks and added topics are saved in PostgreSQL (volume `pgdata`).

- Text-file mode: set `STORAGE: file` in docker-compose.yml. Everything is then saved to `./data/plan.json`.
- Backup: use Export in the page, or `docker compose exec db pg_dump -U roadmap roadmap > backup.sql`.
- Change the built-in curriculum: edit the `M` array in `app/static/index.html`, then `docker compose up --build`.
- Stop: `docker compose down` (add `-v` to also delete the database volume).
