export interface ISSData {
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  timestamp: string;
}

export interface SpaceWeatherData {
  status: string;
  auroralPower: number;
  plasmaDensity: number;
  solarWindSpeed: number;
  magneticFieldIntensity: number;
  description: string;
  kpIndex: number;
  solarFlux: number;
}

export interface VitalSigns {
  heartRate: number;
  oxygenSaturation: number;
  cabinPressure: number;
  temperature: number;
}

export interface AstronautData {
  id: string;
  name: string;
  role: string;
  missionSpecialty: string;
  healthScore: number;
  status: string;
  vitalSigns: VitalSigns;
  lastUpdate: string;
}

export interface RocketSystems {
  thrust: number;
  fuelPressure: number;
  thermalManagement: number;
  propulsionSystem: number;
  avionicsHealth: number;
}

export interface RocketData {
  id: string;
  name: string;
  status: string;
  healthScore: number;
  currentStage: string;
  lastCheck: string;
  systems: RocketSystems;
}

export interface NASAData {
  apod: {
    title: string;
    explanation: string;
    url: string;
    hdurl: string;
    date: string;
  };
  asteroids: {
    hazardousCount: number;
    closestAsteroid: string;
    closestDistance: number;
    trackedToday: number;
    summary: string;
  };
  solarActivity: {
    flareIndex: string;
    geomagneticStormLevel: string;
  };
}

export interface MissionData {
  missionId: string;
  missionName: string;
  phase: string;
  duration: string;
  startDate: string;
  objectives: string[];
  crewManifest: string[];
}

export interface DatasetBundle {
  iss: ISSData;
  spaceWeather: SpaceWeatherData;
  astronauts: AstronautData[];
  rocket: RocketData;
  nasa: NASAData;
  mission: MissionData;
}

export type DatasetKey = keyof DatasetBundle;
