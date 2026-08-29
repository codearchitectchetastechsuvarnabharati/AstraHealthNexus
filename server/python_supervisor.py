"""
Lightweight supervisor to run python_backend.py with automatic restart/backoff.
Run: python python_supervisor.py
This script is intended for local development to keep the Python backend running.
"""
import subprocess
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_SCRIPT = BASE_DIR / 'python_backend.py'
RESTART_BACKOFF = 1.0  # start with 1s
MAX_BACKOFF = 30.0


def start_and_monitor():
    backoff = RESTART_BACKOFF
    while True:
        try:
            print('Starting backend:', BACKEND_SCRIPT)
            p = subprocess.Popen([sys.executable, str(BACKEND_SCRIPT)], cwd=str(BASE_DIR))
            print('Backend pid', p.pid)
            # Wait for process to exit
            exit_code = p.wait()
            print('Backend exited with code', exit_code)

            # If exit code == 0, don't restart immediately
            if exit_code == 0:
                print('Backend exited cleanly, supervisor stopping.')
                break

            print(f'Restarting after backoff {backoff}s...')
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)
        except KeyboardInterrupt:
            print('Supervisor interrupted by user; terminating child and exiting')
            try:
                p.terminate()
            except Exception:
                pass
            break
        except Exception as e:
            print('Supervisor error:', e)
            time.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)


if __name__ == '__main__':
    start_and_monitor()
