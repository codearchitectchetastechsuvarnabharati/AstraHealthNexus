import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from python_dataset_loader import load_dataset, load_all, clear_cache, get_dataset_keys


def _send_json(handler, status_code, payload):
    handler.send_response(status_code)
    handler.send_header('Content-Type', 'application/json')
    handler.end_headers()
    handler.wfile.write(json.dumps(payload).encode('utf-8'))


def _current_time():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def _collect_telemetry():
    iss = load_dataset('iss')
    space_weather = load_dataset('spaceWeather')
    astronauts = load_dataset('astronauts')
    rocket = load_dataset('rocket')
    nasa = load_dataset('nasa')
    mission = load_dataset('mission')

    astronaut_count = len(astronauts)
    astronaut_health = round(sum(a['healthScore'] for a in astronauts) / astronaut_count) if astronaut_count else 0
    rocket_health = round(rocket['healthScore'])
    astronaut_status = 'Stable' if astronaut_health >= 92 else 'Monitor' if astronaut_health >= 84 else 'Attention'
    rocket_status = 'Stable' if rocket_health >= 92 else 'Monitor' if rocket_health >= 84 else 'Attention'

    primary_astronaut = astronauts[0] if astronaut_count else None
    astronaut_vitals = primary_astronaut.get('vitalSigns', {}) if primary_astronaut else {}
    rocket_systems = rocket.get('systems', {})

    return {
        'missionStatus': f"{mission['missionName']} • {mission['phase']}",
        'orbit': f"{iss['name']} / {iss['latitude']}°, {iss['longitude']}° • Alt: {iss['altitude']} km",
        'weather': f"{space_weather['status']} • {space_weather['description']}",
        'alerts': [
            f"NASA APOD: {nasa['apod']['title']} ({nasa['apod']['date']})",
            f"ISS position: {iss['latitude']}°N, {abs(iss['longitude'])}°W",
            nasa['asteroids']['summary'],
            f"Space weather KP index: {space_weather['kpIndex']}",
            f"Crew health average: {astronaut_health}%"
        ],
        'telemetry': [
            {'label': 'Orbital lock', 'value': max(0, min(100, round(100 - abs(iss['altitude'] - 408.5) * 0.75 - abs(iss['velocity'] - 27600) / 150)))},
            {'label': 'Space weather', 'value': max(0, min(100, round(100 - (space_weather['auroralPower'] / 6 + space_weather['kpIndex'] * 4))))},
            {'label': 'Crew health', 'value': astronaut_health},
            {'label': 'Vehicle status', 'value': rocket_health}
        ],
        'nasaHighlight': nasa['apod']['title'],
        'nasaAsteroidSummary': nasa['asteroids']['summary'],
        'nasaImage': nasa['apod'].get('url') or None,
        'lastUpdated': _current_time(),
        'spaceWeatherStatus': space_weather['status'],
        'missionObjectives': mission['objectives'],
        'missionCrew': mission['crewManifest'],
        'spaceWeatherKPIndex': space_weather['kpIndex'],
        'solarFlux': space_weather['solarFlux'],
        'crewAndVehicleHealth': {
            'astronautHealthScore': astronaut_health,
            'rocketHealthScore': rocket_health,
            'astronautStatus': astronaut_status,
            'rocketStatus': rocket_status,
            'astronautNarrative': f"Crew readiness is {astronaut_status.lower()}. {len(astronauts)} crew members are actively monitored.",
            'rocketNarrative': f"Rocket systems are {rocket_status.lower()}. Fuel, thrust and avionics are stable.",
            'astronautVitalSigns': {
                'oxygen': int(astronaut_vitals.get('oxygenSaturation', 0)),
                'heartRate': int(astronaut_vitals.get('heartRate', 0)),
                'cabinPressure': float(astronaut_vitals.get('cabinPressure', 0)),
                'temperature': float(astronaut_vitals.get('temperature', 0))
            },
            'rocketSystems': {
                'thrust': int(rocket_systems.get('thrust', 0)),
                'fuelPressure': int(rocket_systems.get('fuelPressure', 0)),
                'thermal': int(rocket_systems.get('thermalManagement', 0)),
                'avionics': int(rocket_systems.get('avionicsHealth', 0))
            }
        }
    }


class MissionHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        segments = [segment for segment in url.path.split('/') if segment]

        try:
            if url.path == '/health':
                _send_json(self, 200, {'status': 'ok', 'service': 'astrahealth-python'})
                return

            if url.path == '/api/dataset/keys':
                _send_json(self, 200, {'status': 'success', 'keys': get_dataset_keys()})
                return

            if url.path == '/api/dataset':
                all_data = load_all()
                _send_json(self, 200, {'status': 'success', 'message': 'Complete mission dataset loaded from local files', 'data': all_data})
                return

            if url.path == '/api/dataset/refresh':
                clear_cache()
                _send_json(self, 200, {'status': 'success', 'message': 'Python dataset cache refreshed'})
                return

            if url.path == '/api/telemetry/live':
                payload = _collect_telemetry()
                _send_json(self, 200, {'status': 'success', 'data': payload})
                return

            # SSE stream
            if url.path == '/api/nasa/stream':
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.end_headers()
                try:
                    while True:
                        snapshot = _collect_telemetry()
                        data = json.dumps(snapshot)
                        self.wfile.write(f"data: {data}\n\n".encode('utf-8'))
                        self.wfile.flush()
                        time.sleep(1)
                except BrokenPipeError:
                    return

            if len(segments) >= 2 and segments[0] == 'api' and segments[1] == 'dataset':
                if len(segments) == 3:
                    dataset_key = segments[2]
                    data = load_dataset(dataset_key)
                    _send_json(self, 200, {'status': 'success', 'data': data})
                    return
                if len(segments) == 4 and segments[2] == 'astronauts':
                    astronaut_id = segments[3]
                    astronauts = load_dataset('astronauts')
                    astronaut = next((item for item in astronauts if item.get('id') == astronaut_id), None)
                    if astronaut is None:
                        _send_json(self, 404, {'status': 'error', 'message': f'Astronaut {astronaut_id} not found'})
                        return
                    _send_json(self, 200, {'status': 'success', 'data': astronaut})
                    return

            _send_json(self, 404, {'status': 'error', 'message': 'Endpoint not found'})
        except Exception as error:
            _send_json(self, 500, {'status': 'error', 'message': str(error)})

    def log_message(self, format, *args):
        return


if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 5001), MissionHandler)
    print('Python backend listening on http://127.0.0.1:5001')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
