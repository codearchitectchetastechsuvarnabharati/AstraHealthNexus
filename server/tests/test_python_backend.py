import json
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'src' / 'data-files'
HOST = '127.0.0.1'
PORT = 5001
BASE_URL = f'http://{HOST}:{PORT}'


def test_health():
    r = requests.get(f'{BASE_URL}/health', timeout=3)
    assert r.status_code == 200
    payload = r.json()
    assert payload.get('status') == 'ok'


def test_dataset_keys():
    r = requests.get(f'{BASE_URL}/api/dataset/keys', timeout=3)
    assert r.status_code == 200
    payload = r.json()
    assert 'keys' in payload and isinstance(payload['keys'], list)


def test_telemetry_live_contains_mission_name():
    r = requests.get(f'{BASE_URL}/api/telemetry/live', timeout=3)
    assert r.status_code == 200
    payload = r.json()
    assert 'data' in payload
    data = payload['data']
    assert 'missionStatus' in data


def test_mtime_reload():
    # This test temporarily modifies mission.json missionName and checks the backend sees the change
    mission_file = DATA_DIR / 'mission.json'
    original = mission_file.read_text(encoding='utf-8')
    try:
        obj = json.loads(original)
        original_name = obj.get('missionName')
        test_name = f"TEST-MISSION-{int(time.time())}"
        obj['missionName'] = test_name
        mission_file.write_text(json.dumps(obj, indent=2), encoding='utf-8')

        # Allow file mtime to change and backend to detect it
        time.sleep(1.2)

        # call refresh endpoint (best-effort) then query telemetry
        try:
            requests.get(f'{BASE_URL}/api/dataset/refresh', timeout=3)
        except Exception:
            pass

        r = requests.get(f'{BASE_URL}/api/telemetry/live', timeout=3)
        assert r.status_code == 200
        payload = r.json()
        mission_status = payload.get('data', {}).get('missionStatus', '')
        assert test_name in mission_status
    finally:
        mission_file.write_text(original, encoding='utf-8')
        time.sleep(0.5)
