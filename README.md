<!-- codeauthor chetas karnam -->
# AstraHealth Nexus

A production-ready aerospace operations platform for real-time spacecraft and crew health monitoring.

## Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, Framer Motion
- Backend: Express + TypeScript
- Data: public aerospace APIs including Open Notify / ISS and NOAA space weather

## Development setup (Windows)

Prerequisites
- Node.js (recommended v18+; Node 24 is supported). Verify with `node --version` and `npm --version`.
- Git (optional) — `git --version`.
- Python 3.10+ (only if running the Python backend) — `python --version` and `pip --version`.
- Java JDK (only if running the Java backend) — `javac -version` and `java -version`.

Quick start
1. Open PowerShell and change to the project root:
   ```powershell
   cd "C:\Users\dell\OneDrive\Documents\SOCIAL MEDIA\AstraHealthNexus"
   ```
2. Install dependencies (root + workspaces):
   ```powershell
   npm install
   npm --prefix server install
   npm --prefix client install
   ```
3. Copy and edit environment file:
   ```powershell
   copy .env.example .env
   # Edit .env to set CLIENT_URL and optionally START_EXTERNAL_BACKENDS=true
   ```

Run in development
- Start both client and server (root convenience script):
  ```powershell
  npm run dev
  ```
  This runs the Vite client and the server watcher in parallel.

- Start client only:
  ```powershell
  npm --prefix client run dev
  ```

- Start server only (two options):
  - Default watcher (tsx):
    ```powershell
    npm --prefix server run dev
    ```
  - Alternate watcher (recommended on Windows if you see a "spawn UNKNOWN" error):
    ```powershell
    npm --prefix server run dev:alt
    ```
    `dev:alt` uses `ts-node-dev --respawn --transpile-only src/index.ts` and is included as a dev script in `server/package.json`. You must have run `npm --prefix server install` to install the devDependency.

Start optional external backends
- Python backend (manual):
  ```powershell
  npm --prefix server run start:python
  ```
- Java backend (manual):
  ```powershell
  npm --prefix server run start:java
  ```

Build for production
- From the repo root:
  ```powershell
  npm run build
  ```
- Run compiled server code:
  ```powershell
  node server\dist\index.js
  ```

Important ports
- Frontend (Vite): 5173
- Node server: 4000
- Python backend: 5001
- Java backend: 5002

Troubleshooting: "spawn UNKNOWN"
- Symptom: server watcher crashes with `Error: spawn UNKNOWN` when running the default `tsx watch` script.
- Quick fixes:
  1. Use the alternate watcher: `npm --prefix server run dev:alt`.
  2. Move the project outside OneDrive (e.g., `C:\dev\AstraHealthNexus`) — OneDrive file-locking and antivirus interactions can cause spawn failures.
  3. Run the server using the compiled output as a temporary workaround:
     ```powershell
     npm --prefix server run build
     node server\dist\index.js
     ```
  4. Ensure Node and required binaries are on the PATH and try running the watcher via `npx`:
     ```powershell
     npx tsx watch src/index.ts
     ```

Notes
- If you enable `START_EXTERNAL_BACKENDS=true` in `.env`, the Node server will attempt to manage the Python and Java backends; otherwise start them manually.
- If you encounter CORS issues, set `CLIENT_URL` in `.env` to `http://localhost:5173` and restart the server.

Project overview
- Frontend: React + Vite + Tailwind CSS
- Backend: Express + TypeScript
- Local datasets: stored in `server/src/data-files` for offline mission scenarios

For a more complete step-by-step developer guide, see `DEV_SETUP.txt` in the project root.
