import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

const serverRoot = process.cwd();
const port = 4300 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;

let server: ChildProcess | undefined;
let output = '';

function getTsxCliPath(): string {
  return resolve(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Server did not start on port ${port}.\n${output}`);
}

beforeAll(async () => {
  server = spawn(process.execPath, [getTsxCliPath(), 'src/index.ts'], {
    cwd: serverRoot,
    env: { ...process.env, PORT: String(port), RATE_LIMIT_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000', START_EXTERNAL_BACKENDS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  server.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  server.stderr?.on('data', (chunk) => { output += chunk.toString(); });
  await waitForServer();
}, 20_000);

afterAll(() => {
  if (!server?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
});

describe('SCRUM-40 API rate limiting', () => {
  it('allows requests below the limit and returns 429 with headers and JSON after exceeding it', async () => {
    const first = await fetch(`${baseUrl}/api/health`);
    const second = await fetch(`${baseUrl}/api/health`);
    const third = await fetch(`${baseUrl}/api/health`);
    const fourth = await fetch(`${baseUrl}/api/health`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(first.headers.get('ratelimit-policy')).toBe('3;w=60');
    expect(first.headers.get('ratelimit-remaining')).toBe('2');
    expect(first.headers.get('ratelimit-reset')).toBeTruthy();
    expect(second.headers.get('ratelimit-remaining')).toBe('1');
    expect(third.headers.get('ratelimit-remaining')).toBe('0');
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get('ratelimit-policy')).toBe('3;w=60');
    expect(fourth.headers.get('ratelimit-remaining')).toBe('0');
    expect(fourth.headers.get('retry-after')).toBe('60');

    const body = await fourth.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds: 60
      }
    });
  });
});
