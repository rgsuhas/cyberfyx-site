import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import process from "node:process";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const npmCommand = "npm";

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);
const repoRoot = dirname(scriptsDir);
const backendDir = join(repoRoot, "backend");
const frontendDir = join(repoRoot, "frontend-astro");
const backendEnvPath = join(backendDir, ".env");
const backendEnvExamplePath = join(backendDir, ".env.example");
const frontendEnvPath = join(frontendDir, ".env");
const frontendEnvExamplePath = join(frontendDir, ".env.example");
const backendVenvPython = isWindows
  ? join(backendDir, ".venv", "Scripts", "python.exe")
  : join(backendDir, ".venv", "bin", "python");

const workerLoopSource = `
import time
from app.worker import run_pending_outbox_batch

print("Worker loop started. Polling every 5 seconds.", flush=True)
while True:
    processed = run_pending_outbox_batch()
    print(f"Processed {processed} outbox event(s).", flush=True)
    time.sleep(5)
`.trim();

const runningChildren = [];
let shuttingDown = false;
const defaultCorsOrigins = [
  "http://127.0.0.1:4321",
  "http://localhost:4321",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

function log(message) {
  console.log(`[start] ${message}`);
}

function logError(message) {
  console.error(`[start] ${message}`);
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function quoteWindowsArg(arg) {
  if (!/[\s"]/u.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

function commandAvailable(command, args) {
  try {
    const result = spawnSync(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function detectSystemPython() {
  if (process.env.PYTHON) {
    return { command: process.env.PYTHON, baseArgs: [] };
  }

  if (commandAvailable("py", ["-3", "--version"])) {
    return { command: "py", baseArgs: ["-3"] };
  }

  if (commandAvailable("python", ["--version"])) {
    return { command: "python", baseArgs: [] };
  }

  throw new Error(
    "Python 3 was not found. Install Python 3.10+ or set the PYTHON environment variable."
  );
}

function attachPrefixedOutput(stream, label, writer) {
  if (!stream) {
    return;
  }

  const lines = createInterface({ input: stream });
  lines.on("line", (line) => writer(`[${label}] ${line}`));
}

function spawnProcess(label, command, args, options = {}) {
  let resolvedCommand = command;
  let resolvedArgs = args;
  let useShell = options.shell ?? false;

  if (isWindows && useShell) {
    resolvedCommand = "cmd.exe";
    resolvedArgs = ["/d", "/s", "/c", [command, ...args.map(quoteWindowsArg)].join(" ")];
    useShell = false;
  }

  const child = spawn(resolvedCommand, resolvedArgs, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: useShell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  attachPrefixedOutput(child.stdout, label, console.log);
  attachPrefixedOutput(child.stderr, label, console.error);

  child.on("error", (error) => {
    logError(`${label} failed to start: ${error.message}`);
  });

  return child;
}

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(label, command, args, options);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} exited with code ${code}. Command: ${formatCommand(command, args)}`
        )
      );
    });
  });
}

function startManagedProcess(label, command, args, options = {}) {
  const child = spawnProcess(label, command, args, options);
  runningChildren.push({ label, child });

  child.on("close", (code) => {
    if (shuttingDown) {
      return;
    }

    const normalizedCode = typeof code === "number" ? code : 1;
    logError(`${label} exited unexpectedly with code ${normalizedCode}.`);
    void shutdown(normalizedCode);
  });

  return child;
}

function ensureEnvFile(envPath, examplePath, label) {
  if (!existsSync(envPath) && existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    log(`Created ${label} .env from .env.example.`);
  }
}

function canListenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

async function resolvePreferredPort(preferredPort, label) {
  if (await canListenOnPort(preferredPort)) {
    return preferredPort;
  }

  for (let candidate = preferredPort + 1; candidate < preferredPort + 50; candidate += 1) {
    if (await canListenOnPort(candidate)) {
      log(`Port ${preferredPort} is unavailable for ${label}. Using ${candidate} instead.`);
      return candidate;
    }
  }

  throw new Error(`No free port found for ${label} near ${preferredPort}.`);
}

function stopChildProcess(entry) {
  return new Promise((resolve) => {
    const { child } = entry;

    if (!child.pid || child.exitCode !== null) {
      resolve();
      return;
    }

    if (isWindows) {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });

      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 1500).unref();
  });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log("Stopping child processes...");
  await Promise.allSettled([...runningChildren].reverse().map(stopChildProcess));
  process.exit(exitCode);
}

async function ensureBackendVirtualEnv(systemPython) {
  if (existsSync(backendVenvPython)) {
    return;
  }

  log("Creating backend virtual environment...");
  await runCommand(
    "backend:venv",
    systemPython.command,
    [...systemPython.baseArgs, "-m", "venv", ".venv"],
    { cwd: backendDir }
  );
}

async function ensureBackendDependencies() {
  log("Installing backend dependencies...");
  await runCommand(
    "backend:pip",
    backendVenvPython,
    ["-m", "pip", "install", "-e", ".[dev]"],
    { cwd: backendDir }
  );
}

async function ensureFrontendDependencies() {
  if (existsSync(join(frontendDir, "node_modules"))) {
    return;
  }

  log("Installing frontend dependencies...");
  await runCommand("frontend:install", npmCommand, ["install"], {
    cwd: frontendDir,
    shell: isWindows,
  });
}

async function runBackendBootstrap() {
  log("Running backend migrations...");
  await runCommand(
    "backend:migrate",
    backendVenvPython,
    ["-m", "alembic", "-c", "alembic/alembic.ini", "upgrade", "head"],
    { cwd: backendDir }
  );

  log("Seeding backend reference data...");
  await runCommand("backend:seed", backendVenvPython, ["-m", "app.db.seed"], {
    cwd: backendDir,
    allowFailure: true,
  });
}

async function main() {
  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));

  const backendPort = await resolvePreferredPort(8000, "backend");
  const frontendPort = await resolvePreferredPort(4321, "frontend");

  ensureEnvFile(backendEnvPath, backendEnvExamplePath, "backend");
  ensureEnvFile(frontendEnvPath, frontendEnvExamplePath, "frontend");

  const systemPython = detectSystemPython();
  await ensureBackendVirtualEnv(systemPython);
  await ensureBackendDependencies();
  await runBackendBootstrap();
  await ensureFrontendDependencies();

  log("Starting backend API, outbox worker, and Astro dev server...");

  const backendEnv = {};
  if (frontendPort !== 4321) {
    const corsOrigins = new Set(defaultCorsOrigins);
    corsOrigins.add(`http://127.0.0.1:${frontendPort}`);
    corsOrigins.add(`http://localhost:${frontendPort}`);
    backendEnv.CYBERFYX_CORS_ORIGINS = [...corsOrigins].join(",");
  }

  startManagedProcess(
    "backend",
    backendVenvPython,
    ["-m", "uvicorn", "app.main:app", "--reload", "--port", String(backendPort)],
    {
      cwd: backendDir,
      env: backendEnv,
    }
  );

  startManagedProcess("worker", backendVenvPython, ["-u", "-c", workerLoopSource], {
    cwd: backendDir,
  });

  startManagedProcess(
    "frontend",
    npmCommand,
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: frontendDir,
      env: {
        PUBLIC_API_BASE: `http://127.0.0.1:${backendPort}`,
        API_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
      },
      shell: isWindows,
    }
  );

  log(`Backend:  http://127.0.0.1:${backendPort}`);
  log(`Frontend: http://127.0.0.1:${frontendPort}`);
  log("Press Ctrl+C to stop everything.");
}

main().catch(async (error) => {
  logError(error.message);
  await shutdown(1);
});
