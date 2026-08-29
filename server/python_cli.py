"""
Simple CLI to manage the python backend for AstraHealthNexus.
Usage:
  python python_cli.py start    -> start backend (detached) and write pid file
  python python_cli.py stop     -> stop backend using pid file
  python python_cli.py restart  -> stop then start
  python python_cli.py refresh  -> call /api/dataset/refresh
  python python_cli.py status   -> check health endpoint
  python python_cli.py test     -> run pytest in server/tests

This CLI is intentionally lightweight and only depends on the requests library for HTTP calls.
"""
import os
import sys
import subprocess
import time
import json
from pathlib import Path

try:
    import requests
except Exception:
    requests = None

BASE_DIR = Path(__file__).resolve().parent
PID_FILE = BASE_DIR / 'python_backend.pid'
BACKEND_SCRIPT = BASE_DIR / 'python_backend.py'
HOST = '127.0.0.1'
PORT = 5001
HEALTH_URL = f'http://{HOST}:{PORT}/health'
REFRESH_URL = f'http://{HOST}:{PORT}/api/dataset/refresh'


def _write_pid(pid: int):
    PID_FILE.write_text(str(pid))


def _read_pid():
    if not PID_FILE.exists():
        return None
    try:
        return int(PID_FILE.read_text().strip())
    except Exception:
        return None


def start_backend():
    if _read_pid():
        print('PID file exists; backend may already be running. Use status to check or stop to terminate.')
        return

    if not BACKEND_SCRIPT.exists():
        print('Backend script not found:', BACKEND_SCRIPT)
        return

    python_exe = sys.executable or 'python'

    # Start detached on Windows
    creationflags = 0
    if os.name == 'nt':
        # DETACHED_PROCESS = 0x00000008, CREATE_NEW_PROCESS_GROUP = 0x00000200
        creationflags = 0x00000008 | 0x00000200

    p = subprocess.Popen([python_exe, str(BACKEND_SCRIPT)], cwd=str(BASE_DIR), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=creationflags)
    time.sleep(0.5)
    print('Started backend, pid=', p.pid)
    _write_pid(p.pid)


def stop_backend():
    pid = _read_pid()
    if not pid:
        print('No pid file found; backend may not be running.')
        return
    try:
        if os.name == 'nt':
            subprocess.check_call(['taskkill', '/PID', str(pid), '/F'])
        else:
            os.kill(pid, 15)
        print('Stopped backend pid', pid)
    except Exception as e:
        print('Failed to stop backend pid', pid, 'error:', e)
    finally:
        try:
            PID_FILE.unlink()
        except Exception:
            pass


def refresh_datasets():
    if requests is None:
        print('requests package not installed. See requirements.txt')
        return
    try:
        r = requests.get(REFRESH_URL, timeout=5)
        print('Refresh response:', r.status_code, r.text)
    except Exception as e:
        print('Failed to call refresh endpoint:', e)


def status():
    if requests is None:
        print('requests package not installed.')
        return
    try:
        r = requests.get(HEALTH_URL, timeout=3)
        print('Health:', r.status_code, r.text)
    except Exception as e:
        print('Health check failed:', e)


def run_tests():
    tests_dir = BASE_DIR / 'tests'
    if not tests_dir.exists():
        print('No tests directory found at', tests_dir)
        return
    python_exe = sys.executable or 'python'
    subprocess.call([python_exe, '-m', 'pytest', str(tests_dir)])


def main():
    if len(sys.argv) < 2:
        print('Usage: python python_cli.py [start|stop|restart|refresh|status|test]')
        return
    cmd = sys.argv[1].lower()
    if cmd == 'start':
        start_backend()
    elif cmd == 'stop':
        stop_backend()
    elif cmd == 'restart':
        stop_backend()
        time.sleep(0.5)
        start_backend()
    elif cmd == 'refresh':
        refresh_datasets()
    elif cmd == 'status':
        status()
    elif cmd == 'test':
        run_tests()
    else:
        print('Unknown command:', cmd)


if __name__ == '__main__':
    main()
