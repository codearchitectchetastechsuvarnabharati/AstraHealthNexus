// codeauthor chetas karnam
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './middleware/logger.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import alertsRoutes from './routes/alertsRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startTelemetryIngestion } from './services/ingestionService.js';
import nasaRoutes from './routes/nasaRoutes.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

function spawnExternalBackends() {
  const startFlag = (process.env.START_EXTERNAL_BACKENDS ?? '').toLowerCase();
  if (startFlag !== 'true') return;

  const maxRetries = Number(process.env.BACKEND_MAX_RETRIES ?? 5);
  const baseDelayMs = Number(process.env.BACKEND_RESTART_BASE_MS ?? 1000);

  function startWithRestart(name: string, cmd: string, args: string[], opts: any) {
    let attempts = 0;
    let child: ReturnType<typeof spawn> | null = null;

    const start = () => {
      attempts += 1;
      logger.info(`Starting ${name}: ${cmd} ${args.join(' ')}`);
      child = spawn(cmd, args, opts);

      child.on('error', (err) => {
        logger.error(`${name} failed to start: ${String(err)}`);
      });

      child.on('exit', (code, signal) => {
        logger.warn(`${name} exited (code=${code} signal=${signal})`);
        if (attempts <= maxRetries) {
          const wait = baseDelayMs * attempts;
          logger.info(`Restarting ${name} in ${wait}ms (attempt ${attempts}/${maxRetries})`);
          setTimeout(start, wait);
        } else {
          logger.error(`${name} reached max restart attempts (${maxRetries}). Not retrying.`);
        }
      });
    };

    start();
    return () => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    };
  }

  try {
    const pythonScript = path.join(SERVER_ROOT, 'python_backend.py');
    logger.info(`Managing python backend: ${pythonScript}`);
    startWithRestart('python-backend', process.env.PYTHON_BIN ?? 'python', [pythonScript], { cwd: SERVER_ROOT, detached: false, stdio: 'inherit' });

    const javaSrc = path.join(SERVER_ROOT, 'JavaBackend.java');
    const javacCmd = process.env.JAVAC_BIN ?? 'javac';
    const javaCmd = process.env.JAVA_BIN ?? 'java';

    // compile once, then run with restart
    const compile = spawn(javacCmd, [javaSrc], { cwd: SERVER_ROOT, stdio: 'inherit' });
    compile.on('error', (err) => logger.error(`javac failed to start: ${String(err)}`));
    compile.on('exit', (code) => {
      if (code === 0) {
        logger.info('Java compiled successfully; managing java backend');
        startWithRestart('java-backend', javaCmd, ['-cp', SERVER_ROOT, 'JavaBackend'], { cwd: SERVER_ROOT, detached: false, stdio: 'inherit' });
      } else {
        logger.error(`javac exited with ${code}; java backend will not be started`);
      }
    });
  } catch (err) {
    logger.error(`Failed to manage external backends: ${String(err)}`);
  }
}

// Express proxy helpers: forward /api/external/python/* -> http://127.0.0.1:5001/*
async function forwardRequest(req: any, res: any, targetBase: string) {
  try {
    const url = new URL(req.originalUrl.replace(/^\/api\/external\/(python|java)/, ''), targetBase);
    const headers: Record<string, string> = { ...req.headers };
    // Remove host header to avoid issues
    delete headers.host;

    const init: any = { method: req.method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const body = req.body;
      if (body !== undefined) {
        if (typeof body === 'string') {
          init.body = body;
        } else if (Buffer.isBuffer(body)) {
          init.body = body;
        } else if (body instanceof ArrayBuffer) {
          init.body = body;
        } else if (ArrayBuffer.isView(body)) {
          init.body = body;
        } else if (typeof body === 'object') {
          init.body = JSON.stringify(body);
          if (!headers['content-type']) {
            headers['content-type'] = 'application/json';
          }
        } else {
          init.body = String(body);
        }
      }
    }

    const upstream = await fetch(url.toString(), init);

    // copy status and headers
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => res.setHeader(key, value));
    // pipe body
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    logger.error(`Proxy error to ${targetBase}: ${String(err)}`);
    res.status(502).json({ status: 'error', message: 'Bad gateway', error: String(err) });
  }
}


const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://0.0.0.0:5173']
  .filter((origin): origin is string => Boolean(origin));

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Proxy external backend routes so the frontend can use the Node host as a single API surface
app.use('/api/external/python', (req, res) => forwardRequest(req, res, 'http://127.0.0.1:5001'));
app.use('/api/external/java', (req, res) => forwardRequest(req, res, 'http://127.0.0.1:5002'));

app.get('/', (_, res) => {
  res.json({
    status: 'ok',
    service: 'astrahealth-nexus',
    frontend: 'http://localhost:5173',
    health: 'http://localhost:4000/api/health'
  });
});

app.use('/api', dashboardRoutes);
app.use('/api', alertsRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', nasaRoutes);
app.use('/api', datasetRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'astrahealth-nexus' }));
app.use(errorHandler);

startTelemetryIngestion();

// spawn external backends if START_EXTERNAL_BACKENDS=true
spawnExternalBackends();

app.listen(port, '0.0.0.0', () => {
  logger.info(`AstraHealth Nexus server listening on port ${port}`);
});
