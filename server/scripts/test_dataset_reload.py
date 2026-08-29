"""
Python version of the dataset reload test (mirrors the PowerShell script). It updates mission.json, queries endpoints and restores the file.
Run: python scripts/test_dataset_reload.py
"""
import json
import time
from pathlib import Path
import requests

BASE = Path(__file__).resolve().parent.parent
DATA_DIR = BASE / 'src' / 'data-files'
BASE_URL = 'http://127.0.0.1:5001'

MISSION_FILE = DATA_DIR / 'mission.json'


def run():
    print('Reading original mission file...')
    original = MISSION_FILE.read_text(encoding='utf-8')
    try:
        obj = json.loads(original)
        test_name = f"AUTOTEST-{int(time.time())}"
        print('Setting missionName ->', test_name)
        obj['missionName'] = test_name
        MISSION_FILE.write_text(json.dumps(obj, indent=2), encoding='utf-8')

        print('Sleeping briefly to allow mtime change...')
        time.sleep(1.2)

        try:
            print('Calling /api/dataset/refresh')
            r = requests.get(f'{BASE_URL}/api/dataset/refresh', timeout=4)
            print('refresh response', r.status_code)
        except Exception as ex:
            print('refresh call failed:', ex)

        print('Querying /api/telemetry/live')
        r = requests.get(f'{BASE_URL}/api/telemetry/live', timeout=4)
        print('status', r.status_code)
        if r.status_code == 200:
            payload = r.json()
            ms = payload.get('data', {}).get('missionStatus')
            print('missionStatus:', ms)
            if test_name in (ms or ''):
                print('SUCCESS: backend observed new mission name')
            else:
                print('FAIL: backend did not pick up new mission name')
        else:
            print('telemetry request failed with', r.status_code)
    finally:
        print('Restoring original mission file')
        MISSION_FILE.write_text(original, encoding='utf-8')


if __name__ == '__main__':
    run()
