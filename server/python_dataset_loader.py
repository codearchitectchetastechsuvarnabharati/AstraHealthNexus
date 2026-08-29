import json
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


def load_dataset(key: str) -> Any:
    file_path = _file_path(key)
    if not file_path.exists():
        raise FileNotFoundError(f'Dataset file not found: {file_path}')

    mtime = file_path.stat().st_mtime
    if key in _cache and _mtime_cache.get(key) == mtime:
        # return deep copy to avoid accidental mutation
        return json.loads(json.dumps(_cache[key]))

    with file_path.open('r', encoding='utf-8') as f:
        data = json.load(f)

    _cache[key] = data
    _mtime_cache[key] = mtime
    return json.loads(json.dumps(data))


def load_all() -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for k in DATASET_FILES.keys():
        result[k] = load_dataset(k)
    return result


def clear_cache() -> None:
    _cache.clear()
    _mtime_cache.clear()
