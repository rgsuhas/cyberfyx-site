# Cyberfyx Website

Building the Cyberfyx site with an Astro frontend and a FastAPI backend.

## Overview

The repository is a decoupled web app with three local runtime parts:

- `frontend-astro/` for the Astro site
- `backend/` for the FastAPI API and database
- a backend outbox worker for background notification processing

## Navigation

- [Architecture](docs/architecture.md)
- [Backend Guide](docs/backend.md)
- [Frontend Guide](docs/frontend.md)
- [Getting Started](docs/getting-started.md)

## Project Structure

```text
/
|-- backend/
|-- frontend-astro/
|-- docs/
|-- package.json
`-- scripts/
```

## Quick Start

Use the root-level starter when you want to bring up everything at once.
Run this from the repository root:
The command must be run from the top-level folder that contains the root `package.json`.

```bash
npm start
```

That single command prepares the local environment and starts:

- the FastAPI backend on `http://localhost:8000`
- the Astro frontend on `http://localhost:4321`
- the backend outbox worker

Do not run `npm start` inside `frontend-astro/` or `backend/`. Run it only from the repository root.

Open `http://localhost:8000/docs` for the API docs.
If either default port is already busy, the starter automatically picks the next free local port and prints it in the terminal.

## What `npm start` does

The root starter script:

- ensures backend and frontend `.env` files exist
- creates the backend virtual environment if needed
- installs backend and frontend dependencies when needed
- runs backend migrations and seed data
- starts the API, worker, and frontend in one terminal

Stop everything with `Ctrl+C`.

## Frontend Scripts

Inside `frontend-astro/`, these scripts are still available:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run astro -- <args>`

## Legacy Bash Helpers

If you want the older shell-based flow, these helpers remain available:

- `./runall.sh`
- `./kill.sh`
