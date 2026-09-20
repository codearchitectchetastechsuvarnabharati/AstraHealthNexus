import json
import time
from pathlib import Path

import requests
import pytest
import shutil
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import python_backend
import python_dataset_loader as loader

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / 'src' / 'data-files'
HOST = '127.0.0.1'
PORT = 5001
BASE_URL = f'http://{HOST}:{PORT}'


@pytest.fixture(scope='module', autouse=True)
def backend(tmp_path_factory):
    global BASE_URL, DATA_DIR
    original_dir = loader.DATA_DIR
    isolated = tmp_path_factory.mktemp('datasets')
    for source in original_dir.glob('*.json'):
        shutil.copy2(source, isolated / source.name)
    loader.DATA_DIR = DATA_DIR = isolated
    loader.clear_cache()
    server = python_backend.ThreadingHTTPServer(('127.0.0.1', 0), python_backend.MissionHandler)
    BASE_URL = f'http://127.0.0.1:{server.server_port}'
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield
    server.shutdown()
    server.server_close()
    thread.join()
    loader.DATA_DIR = original_dir
    loader.clear_cache()


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


@pytest.mark.parametrize('query', ['limit=0', 'limit=101', 'limit=x', 'limit=1&limit=2', 'offset=', 'offset=-1', 'limit[]=1', 'unknown=x'])
def test_invalid_pagination(query):
    response = requests.get(f'{BASE_URL}/api/dataset?{query}', timeout=3)
    assert response.status_code == 400


def test_nested_pagination():
    response = requests.get(f'{BASE_URL}/api/dataset?limit=1&offset=1', timeout=3)
    assert response.status_code == 200
    payload = response.json()
    assert len(payload['data']['astronauts']) == 1
    assert len(payload['data']['mission']['objectives']) == 1
    assert payload['collections']['data.astronauts']['offset'] == 1


@pytest.mark.parametrize('path', ['/api/dataset/unknown', '/api/dataset/astronauts/bad'])
def test_invalid_identifiers(path):
    assert requests.get(BASE_URL + path, timeout=3).status_code == 400


@pytest.mark.parametrize('contents', ['{bad json', '{}', '{"name":123}', '[]'])
def test_invalid_dataset_file(contents):
    target = DATA_DIR / 'iss.json'
    original = target.read_text()
    try:
        target.write_text(contents)
        loader.clear_cache()
        response = requests.get(f'{BASE_URL}/api/dataset/iss', timeout=3)
        assert response.status_code == 500
        assert str(DATA_DIR) not in response.text
    finally:
        target.write_text(original)
        loader.clear_cache()


def test_storage_failure(monkeypatch):
    def fail(_key):
        raise OSError('private storage path')
    monkeypatch.setattr(python_backend, 'load_dataset', fail)
    response = requests.get(f'{BASE_URL}/api/dataset/iss', timeout=3)
    assert response.status_code == 500
    assert 'private storage path' not in response.text


def test_structured_logging(capsys):
    response = requests.get(f'{BASE_URL}/health', timeout=3)
    assert response.headers['X-Request-Id']
    records = [json.loads(line) for line in capsys.readouterr().err.splitlines()]
    assert any(record['event'] == 'request' and record['requestId'] == response.headers['X-Request-Id'] for record in records)


@pytest.mark.parametrize('body', ['{bad', '[]', '{"unexpected":true}'])
def test_malformed_refresh(body):
    response = requests.post(f'{BASE_URL}/api/dataset/refresh', data=body, headers={'Content-Type': 'application/json'}, timeout=3)
    assert response.status_code == 400


def test_refresh_post():
    assert requests.post(f'{BASE_URL}/api/dataset/refresh', json={}, timeout=3).status_code == 200


@pytest.mark.parametrize('path', ['/health', '/api/dataset/iss', '/api/dataset/keys'])
def test_interface_headers_and_request_id(path):
    response = requests.get(BASE_URL + path, headers={'X-Request-Id': 'node_request-123', 'X-Astra-Interface-Version': '1'}, timeout=3)
    assert response.status_code == 200
    assert response.headers['X-Request-Id'] == 'node_request-123'
    assert response.headers['X-Astra-Interface-Version'] == '1'


def test_interface_version_rejected_before_refresh(monkeypatch):
    def fail():
        raise AssertionError('must not refresh')
    monkeypatch.setattr(python_backend, 'clear_cache', fail)
    response = requests.post(BASE_URL + '/api/dataset/refresh', json={}, headers={'X-Astra-Interface-Version': '2'}, timeout=3)
    assert response.status_code == 400
    assert response.json()['message'] == 'Unsupported interface version'


def test_invalid_correlation_id_is_replaced():
    response = requests.get(BASE_URL + '/health', headers={'X-Request-Id': 'bad id'}, timeout=3)
    assert response.status_code == 200
    assert response.headers['X-Request-Id'] != 'bad id'
