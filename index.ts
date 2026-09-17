import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { app } from './app.js';
// codeauthor chetas karnam
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, logServiceFailure } from './middleware/logger.js';
import { startTelemetryIngestion } from './services/ingestionService.js';

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
      logger.info('external_backend_starting', { event: 'service_event', backend: name, attempt: attempts });
      child = spawn(cmd, args, opts);

      child.on('error', (err) => {
        logServiceFailure(`${name} failed to start`, {
          service: name,
          context: 'external_backend_spawn',
          err
        });
      });

      child.on('exit', (code, signal) => {
        logger.warn('external_backend_exit', {
          event: 'external_backend_exit',
          service: name,
          code,
          signal,
          attempts
        });
        if (attempts <= maxRetries) {
          const wait = baseDelayMs * attempts;
          logger.info('external_backend_restart', {
            event: 'external_backend_restart',
            service: name,
            attempt: attempts,
            maxRetries,
            waitMs: wait
          });
          setTimeout(start, wait);
        } else {
          logServiceFailure(`${name} reached max restart attempts`, {
            service: name,
            context: 'external_backend_restart_exhausted',
            err: new Error(`max retries (${maxRetries}) exhausted`)
          });
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
    logger.info('external_backend_management_started', { event: 'service_event', backend: 'python' });
    startWithRestart('python-backend', process.env.PYTHON_BIN ?? 'python', [pythonScript], { cwd: SERVER_ROOT, detached: false, stdio: 'inherit' });

    const javaSrc = path.join(SERVER_ROOT, 'JavaBackend.java');
    const toolRoot = path.resolve(SERVER_ROOT, '..', '.tools', 'java');
    const executableSuffix = process.platform === 'win32' ? '.exe' : '';
    const localJava = existsSync(toolRoot) ? readdirSync(toolRoot).map(name => path.join(toolRoot, name, 'bin')).find(bin => existsSync(path.join(bin, `javac${executableSuffix}`))) : undefined;
    const javaBin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin') : localJava;
    const javacCmd = process.env.JAVAC_BIN ?? (javaBin ? path.join(javaBin, `javac${executableSuffix}`) : 'javac');
    const javaCmd = process.env.JAVA_BIN ?? (javaBin ? path.join(javaBin, `java${executableSuffix}`) : 'java');
    const javaOutput = path.join(SERVER_ROOT, '.java-build');
    mkdirSync(javaOutput, { recursive: true });

    // compile once, then run with restart
    const compile = spawn(javacCmd, ['-encoding', 'UTF-8', '-d', javaOutput, javaSrc], { cwd: SERVER_ROOT, stdio: 'inherit' });
    compile.on('error', (err) => {
      logServiceFailure('javac failed to start', {
        service: 'java-backend',
        context: 'javac_spawn',
        err
      });
    });
    compile.on('exit', (code) => {
      if (code === 0) {
        logger.info('java_compiled', {
          event: 'java_compiled',
          service: 'java-backend'
        });
        startWithRestart('java-backend', javaCmd, ['-cp', javaOutput, 'JavaBackend'], { cwd: SERVER_ROOT, detached: false, stdio: 'inherit' });
      } else {
        logServiceFailure(`javac exited with ${code}; java backend will not be started`, {
          service: 'java-backend',
          context: 'javac_exit',
          err: new Error(`javac exited with code ${code}`)
        });
      }
    });
  } catch (err) {
    logServiceFailure('Failed to manage external backends', {
      service: 'external_backends',
      context: 'external_backends_manage',
      err
    });
  }
}

const port = Number(process.env.PORT ?? 4000);
startTelemetryIngestion();

// spawn external backends if START_EXTERNAL_BACKENDS=true
spawnExternalBackends();

app.listen(port, '0.0.0.0', () => {
  logger.info('server_started', { event: 'service_event', port });
});
