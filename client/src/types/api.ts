// codeauthor chetas karnam
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

export interface ApiMetadata {
  timestamp: string;
}

export interface ApiPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
  metadata: ApiMetadata;
  pagination: ApiPagination | null;
}

export type DatasetResponse<T> = ApiResponse<T>;
export type DatasetKeysResponse = ApiResponse<DatasetKey[]>;
export type RefreshResponse = ApiResponse<null>;

export interface ApiError {
  status: 'error';
  message: string;
  code?: string;
  data?: null;
  metadata?: ApiMetadata;
  pagination?: null;
}
