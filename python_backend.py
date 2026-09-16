import json
import re
import uuid
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict
from urllib.parse import urlparse, parse_qs

from python_dataset_loader import _log, clear_cache, get_dataset_keys, load_all, load_dataset


def _send_json(handler: BaseHTTPRequestHandler, status_code: int, payload: Dict[str, Any]) -> None:
    if status_code == 200 and hasattr(handler, 'page_query'):
        payload = _page_payload(payload, handler.page_query)
    body = json.dumps(payload, allow_nan=False).encode('utf-8')
    try:
        handler.send_response(status_code)
        handler.send_header('X-Request-Id', getattr(handler, 'request_id', ''))
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.send_header('Content-Length', str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
    except (BrokenPipeError, ConnectionResetError):
        handler.log_error('Client disconnected before response could be sent.')


def _current_time() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _format_lat_lon(latitude: float, longitude: float) -> str:
    lat_hemisphere = 'N' if latitude >= 0 else 'S'
    lon_hemisphere = 'E' if longitude >= 0 else 'W'
    return f'{abs(latitude):.2f}°{lat_hemisphere}, {abs(longitude):.2f}°{lon_hemisphere}'


def _collect_telemetry() -> Dict[str, Any]:
    iss = load_dataset('iss') or {}
    space_weather = load_dataset('spaceWeather') or {}
    astronauts = load_dataset('astronauts') or []
    rocket = load_dataset('rocket') or {}
    nasa = load_dataset('nasa') or {}
    mission = load_dataset('mission') or {}

    if not isinstance(astronauts, list):
        astronauts = []

    astronaut_count = len(astronauts)
    astronaut_health_sum = sum(_safe_float(a.get('healthScore', 0)) for a in astronauts if isinstance(a, dict))
    astronaut_health = round(astronaut_health_sum / astronaut_count) if astronaut_count > 0 else 0
    rocket_health = round(_safe_float(rocket.get('healthScore', 0)))

    astronaut_status = 'Stable' if astronaut_health >= 92 else 'Monitor' if astronaut_health >= 84 else 'Attention'
    rocket_status = 'Stable' if rocket_health >= 92 else 'Monitor' if rocket_health >= 84 else 'Attention'

    primary_astronaut = astronauts[0] if astronaut_count > 0 and isinstance(astronauts[0], dict) else {}
    astronaut_vitals = primary_astronaut.get('vitalSigns', {}) if isinstance(primary_astronaut.get('vitalSigns'), dict) else {}
    rocket_systems = rocket.get('systems', {}) if isinstance(rocket.get('systems'), dict) else {}

    nasa_apod = nasa.get('apod', {}) if isinstance(nasa.get('apod'), dict) else {}
    nasa_asteroids = nasa.get('asteroids', {}) if isinstance(nasa.get('asteroids'), dict) else {}

    latitude = _safe_float(iss.get('latitude'))
    longitude = _safe_float(iss.get('longitude'))
    altitude = _safe_float(iss.get('altitude'))
    velocity = _safe_float(iss.get('velocity'), 27600)
    position = _format_lat_lon(latitude, longitude)

    return {
        'missionStatus': f"{mission.get('missionName', 'N/A')} • {mission.get('phase', 'N/A')}",
        'orbit': f"{iss.get('name', 'N/A')} / {position} • Alt: {altitude} km",
        'weather': f"{space_weather.get('status', 'Unknown')} • {space_weather.get('description', 'No data.')}",
        'alerts': [
            f"NASA APOD: {nasa_apod.get('title', 'N/A')} ({nasa_apod.get('date', 'N/A')})",
            f"ISS position: {position}",
            nasa_asteroids.get('summary', 'Asteroid data unavailable.'),
            f"Space weather KP index: {space_weather.get('kpIndex', 0)}",
            f"Crew health average: {astronaut_health}%"
        ],
        'telemetry': [
            {'label': 'Orbital lock', 'value': max(0, min(100, round(100 - abs(altitude - 408.5) * 0.75 - abs(velocity - 27600) / 150)))},
            {'label': 'Space weather', 'value': max(0, min(100, round(100 - (_safe_float(space_weather.get('auroralPower')) / 6 + _safe_float(space_weather.get('kpIndex')) * 4))))},
            {'label': 'Crew health', 'value': astronaut_health},
            {'label': 'Vehicle status', 'value': rocket_health}
        ],
        'nasaHighlight': nasa_apod.get('title', 'N/A'),
        'nasaAsteroidSummary': nasa_asteroids.get('summary', 'N/A'),
        'nasaImage': nasa_apod.get('url') or None,
        'lastUpdated': _current_time(),
        'spaceWeatherStatus': space_weather.get('status', 'Unknown'),
        'missionObjectives': mission.get('objectives', []),
        'missionCrew': mission.get('crewManifest', []),
        'spaceWeatherKPIndex': space_weather.get('kpIndex', 0),
        'solarFlux': space_weather.get('solarFlux', 0),
        'crewAndVehicleHealth': {
            'astronautHealthScore': astronaut_health,
            'rocketHealthScore': rocket_health,
            'astronautStatus': astronaut_status,
            'rocketStatus': rocket_status,
            'astronautNarrative': f"Crew readiness is {astronaut_status.lower()}. {astronaut_count} crew members are actively monitored.",
            'rocketNarrative': f"Rocket systems are {rocket_status.lower()}. Fuel, thrust and avionics are stable.",
            'astronautVitalSigns': {
                'oxygen': int(_safe_float(astronaut_vitals.get('oxygenSaturation'))),
                'heartRate': int(_safe_float(astronaut_vitals.get('heartRate'))),
                'cabinPressure': float(_safe_float(astronaut_vitals.get('cabinPressure'))),
                'temperature': float(_safe_float(astronaut_vitals.get('temperature')))
            },
            'rocketSystems': {
                'thrust': int(_safe_float(rocket_systems.get('thrust'))),
                'fuelPressure': int(_safe_float(rocket_systems.get('fuelPressure'))),
                'thermal': int(_safe_float(rocket_systems.get('thermalManagement'))),
                'avionics': int(_safe_float(rocket_systems.get('avionicsHealth')))
            }
        }
    }


def _page_payload(payload, query):
    limit, offset = query
    collections = {}
    def visit(value, path):
        if isinstance(value, list):
            page = value[offset:offset + limit]
            collections[path] = dict(limit=limit, offset=offset, total=len(value), returned=len(page), hasMore=offset + len(page) < len(value))
            return [visit(item, f'{path}[{offset + index}]') for index, item in enumerate(page)]
        if isinstance(value, dict):
            return {key: visit(item, f'{path}.{key}' if path else key) for key, item in value.items()}
        return value
    result = visit(payload, '')
    if collections:
        result['collections'] = collections
    return result


class MissionHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        self.request_id = str(uuid.uuid4())
        try:
            url = urlparse(self.path)
            if url.path != '/api/dataset/refresh':
                _send_json(self, 404, {'status': 'error', 'message': 'Endpoint not found'})
                return
            if url.query or self.headers.get('Transfer-Encoding'):
                _send_json(self, 400, {'status': 'error', 'message': 'Invalid request'})
                return
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 <= length <= 102400:
                _send_json(self, 413, {'status': 'error', 'message': 'Request body too large'})
                return
            if length and self.headers.get_content_type() != 'application/json':
                _send_json(self, 415, {'status': 'error', 'message': 'Content-Type must be application/json'})
                return
            if length and json.loads(self.rfile.read(length)) != {}:
                _send_json(self, 400, {'status': 'error', 'message': 'Refresh expects an empty object'})
                return
            clear_cache()
            _send_json(self, 200, {'status': 'success', 'message': 'Python dataset cache refreshed'})
        except (ValueError, UnicodeError):
            _send_json(self, 400, {'status': 'error', 'message': 'Malformed request'})
        except Exception as error:
            self.log_error('Refresh failed: %s', error)
            _send_json(self, 500, {'status': 'error', 'message': 'Internal server error'})

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self) -> None:
        self.request_id = str(uuid.uuid4())
        self.started_at = time.monotonic()
        url = urlparse(self.path)
        segments = [segment for segment in url.path.split('/') if segment]

        try:
            params = parse_qs(url.query, keep_blank_values=True)
            if set(params) - {'limit', 'offset'}:
                _send_json(self, 400, {'status': 'error', 'message': 'Unknown query parameter'})
                return
            values = []
            for key, default in [('limit', '20'), ('offset', '0')]:
                entries = params.get(key, [default])
                if len(entries) != 1 or not re.fullmatch(r'[0-9]{1,16}', entries[0]):
                    _send_json(self, 400, {'status': 'error', 'message': f'Invalid {key}'})
                    return
                values.append(int(entries[0]))
            if not 1 <= values[0] <= 100 or values[1] > 9007199254740991:
                _send_json(self, 400, {'status': 'error', 'message': 'Pagination out of range'})
                return
            self.page_query = values
            if url.path == '/health':
                _send_json(self, 200, {'status': 'ok', 'service': 'astrahealth-python'})
                return

            if url.path == '/api/dataset/keys':
                _send_json(self, 200, {'status': 'success', 'keys': get_dataset_keys()})
                return

            if url.path == '/api/dataset':
                all_data = load_all()
                _send_json(self, 200, {
                    'status': 'success',
                    'message': 'Complete mission dataset loaded from local files',
                    'data': all_data
                })
                return

            if url.path == '/api/dataset/refresh':
                clear_cache()
                _send_json(self, 200, {'status': 'success', 'message': 'Python dataset cache refreshed'})
                return

            if url.path == '/api/telemetry/live':
                _send_json(self, 200, {'status': 'success', 'data': _collect_telemetry()})
                return

            if url.path == '/api/nasa/stream':
                self._handle_sse_stream()
                return

            if len(segments) >= 2 and segments[0] == 'api' and segments[1] == 'dataset':
                if len(segments) == 3:
                    self._handle_get_dataset(segments[2])
                    return
                if len(segments) == 4 and segments[2] == 'astronauts':
                    self._handle_get_astronaut(segments[3])
                    return

            _send_json(self, 404, {'status': 'error', 'message': 'Endpoint not found'})
        except KeyError as error:
            self.log_error('Dataset lookup failed: %s', error)
            _send_json(self, 404, {'status': 'error', 'message': 'Requested dataset was not found.'})
        except (IndexError, TypeError, ValueError) as error:
            self.log_error('Data processing error: %s', error)
            _send_json(self, 500, {'status': 'error', 'message': 'Internal Server Error: Incomplete or malformed data.'})
        except Exception as error:
            self.log_error('Unhandled exception: %s', error)
            _send_json(self, 500, {'status': 'error', 'message': 'An unexpected internal server error occurred.'})

    def _handle_sse_stream(self) -> None:
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            while True:
                snapshot = _page_payload(_collect_telemetry(), self.page_query)
                self.wfile.write(f"data: {json.dumps(snapshot)}\n\n".encode('utf-8'))
                self.wfile.flush()
                time.sleep(1)
        except (BrokenPipeError, ConnectionResetError):
            self.log_error('Client disconnected from SSE stream.')
        except Exception as error:
            self.log_error('SSE processing failure: %s', error)

    def _handle_get_dataset(self, dataset_key: str) -> None:
        valid_keys = get_dataset_keys()
        if dataset_key not in valid_keys:
            _send_json(self, 400, {
                'status': 'error',
                'message': 'Invalid dataset key'
            })
            return

        data = load_dataset(dataset_key)
        _send_json(self, 200, {'status': 'success', 'data': data})

    def _handle_get_astronaut(self, astronaut_id: str) -> None:
        if not re.fullmatch(r'ast_[0-9]{3}', astronaut_id):
            _send_json(self, 400, {'status': 'error', 'message': 'Invalid astronaut id'})
            return
        astronauts = load_dataset('astronauts')
        if not isinstance(astronauts, list):
            _send_json(self, 500, {'status': 'error', 'message': 'Astronaut dataset is malformed.'})
            return

        astronaut = next((item for item in astronauts if isinstance(item, dict) and item.get('id') == astronaut_id), None)
        if astronaut is None:
            _send_json(self, 404, {'status': 'error', 'message': f'Astronaut with ID {astronaut_id} not found'})
            return
        _send_json(self, 200, {'status': 'success', 'data': astronaut})

    def log_message(self, format: str, *args: Any) -> None:
        _log('request', requestId=getattr(self, 'request_id', None), method=self.command, path=urlparse(self.path).path, message=format % args)

    def log_error(self, format: str, *args: Any) -> None:
        _log('service_failure', requestId=getattr(self, 'request_id', None), message=format % args)


if __name__ == '__main__':
    HOST, PORT = '127.0.0.1', 5001
    server = ThreadingHTTPServer((HOST, PORT), MissionHandler)
    _log('service_started', port=PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        _log('service_stopping')
    finally:
        server.server_close()
        _log('service_stopped')
