export type DatasetKey = 'iss' | 'weather' | 'spaceWeather' | 'astronauts' | 'rocket' | 'nasa' | 'mission';

export interface CrewAndVehicleHealth {
  astronautHealthScore: number;
  rocketHealthScore: number;
  astronautStatus: string;
  rocketStatus: string;
  astronautNarrative: string;
  rocketNarrative: string;
  astronautVitalSigns: {
    oxygen: number;
    heartRate: number;
    cabinPressure: number;
    temperature: number;
  };
  rocketSystems: {
    thrust: number;
    fuelPressure: number;
    thermal: number;
    avionics: number;
  };
}

export interface DashboardSnapshot {
  missionStatus: string;
  orbit: string;
  weather: string;
  alerts: string[];
  telemetry: Array<{ label: string; value: number }>;
  nasaHighlight?: string;
  nasaAsteroidSummary?: string;
  nasaImage?: string | null;
  lastUpdated: string;
  spaceWeatherStatus: string;
  missionObjectives: string[];
  missionCrew: string[];
  spaceWeatherKPIndex: number;
  solarFlux: number;
  crewAndVehicleHealth: CrewAndVehicleHealth;
}

export interface DatasetResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data: T;
}

export interface DatasetKeysResponse {
  status: 'success';
  keys: DatasetKey[];
}

export interface RefreshResponse {
  status: 'success';
  message: string;
}

export interface ApiError {
  status: 'error';
  message: string;
}
