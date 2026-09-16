import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'src' / 'data-files'

DATASET_FILES = {
    'iss': 'iss.json',
    'spaceWeather': 'spaceWeather.json',
    'weather': 'spaceWeather.json',
    'astronauts': 'astronauts.json',
    'rocket': 'rocket.json',
    'nasa': 'nasa.json',
    'mission': 'mission.json'
}

_cache: Dict[str, Any] = {}
_mtime_cache: Dict[str, float] = {}


def get_dataset_keys() -> List[str]:
    return list(DATASET_FILES.keys())


def _file_path(key: str) -> Path:
    if key not in DATASET_FILES:
        raise KeyError(key)
    return DATA_DIR / DATASET_FILES[key]


def _log(event, **context):
    print(json.dumps(dict(timestamp=datetime.now(timezone.utc).isoformat(), service='astrahealth-python', event=event, **context)), file=sys.stderr)


def _validate(key, data):
    key = 'spaceWeather' if key == 'weather' else key
    fields = {
        'iss': {'name': str, 'latitude': float, 'longitude': float, 'altitude': float, 'velocity': float, 'timestamp': str},
        'spaceWeather': {'status': str, 'description': str, **{k: float for k in ['auroralPower', 'plasmaDensity', 'solarWindSpeed', 'magneticFieldIntensity', 'kpIndex', 'solarFlux']}},
        'rocket': {'id': str, 'name': str, 'status': str, 'healthScore': float, 'currentStage': str, 'lastCheck': str, 'systems': {k: float for k in ['thrust', 'fuelPressure', 'thermalManagement', 'propulsionSystem', 'avionicsHealth']}},
        'mission': {'missionId': str, 'missionName': str, 'phase': str, 'duration': str, 'startDate': str, 'objectives': [str], 'crewManifest': [str]},
        'astronauts': [{'id': str, 'name': str, 'role': str, 'missionSpecialty': str, 'healthScore': float, 'status': str, 'lastUpdate': str, 'vitalSigns': {k: float for k in ['heartRate', 'oxygenSaturation', 'cabinPressure', 'temperature']}}],
        'nasa': {'apod': {k: str for k in ['title', 'explanation', 'url', 'hdurl', 'date']}, 'asteroids': {'hazardousCount': float, 'closestAsteroid': str, 'closestDistance': float, 'trackedToday': float, 'summary': str}, 'solarActivity': {'flareIndex': str, 'geomagneticStormLevel': str}}
    }
    def check(value, spec, path):
        if isinstance(spec, dict):
            if not isinstance(value, dict):
                raise TypeError(f'{path} must be an object')
            for field, child in spec.items():
                check(value.get(field), child, f'{path}.{field}')
        elif isinstance(spec, list):
            if not isinstance(value, list):
                raise TypeError(f'{path} must be an array')
            for item in value:
                check(item, spec[0], path)
        elif spec is float:
            if type(value) not in (int, float) or not math.isfinite(value):
                raise TypeError(f'{path} must be a finite number')
        elif not isinstance(value, spec):
            raise TypeError(f'{path} has incorrect type')
    check(data, fields[key], key)


def load_dataset(key: str) -> Any:
    file_path = _file_path(key)
    if not file_path.exists():
        raise FileNotFoundError(f'Dataset file not found: {file_path}')

    info = file_path.stat()
    if info.st_size > 2 * 1024 * 1024:
        raise ValueError('Dataset exceeds 2 MB limit')
    mtime = info.st_mtime_ns
    if key in _cache and _mtime_cache.get(key) == mtime:
        # return deep copy to avoid accidental mutation
        return json.loads(json.dumps(_cache[key]))

    with file_path.open('r', encoding='utf-8-sig') as f:
        data = json.load(f)

    _validate(key, data)
    _log('dataset_loaded', key=key)
    _cache[key] = data
    _mtime_cache[key] = mtime
    return json.loads(json.dumps(data))


def load_all() -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for k in DATASET_FILES.keys():
        result[k] = load_dataset(k)
    return result


def clear_cache() -> None:
    _log('dataset_cache_cleared')
    _cache.clear()
    _mtime_cache.clear()
