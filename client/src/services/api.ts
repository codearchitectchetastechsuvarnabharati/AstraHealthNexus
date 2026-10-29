import { DatasetKeysResponse, DatasetResponse, DashboardSnapshot, DatasetKey, RefreshResponse } from '../types/api';
import type { AstronautData, Mission, MissionAlert } from '../types/mission';

const BASE_URL = window.location.origin;

async function apiJson<T>(resource: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${resource}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const result = await apiJson<DatasetResponse<DashboardSnapshot>>('/api/telemetry/live');
  if (result.status !== 'success') {
    throw new Error(result.message || 'Unable to load dashboard snapshot');
  }
  return result.data;
}

export async function getDatasetKeys(): Promise<DatasetKey[]> {
  const result = await apiJson<DatasetKeysResponse>('/api/dataset/keys');
  if (result.status !== 'success') {
    throw new Error('Unable to load dataset keys');
  }
  return result.keys;
}

export async function getDataset(key: DatasetKey): Promise<unknown> {
  const result = await apiJson<DatasetResponse<unknown>>(`/api/dataset/${key}`);
  if (result.status !== 'success') {
    throw new Error(result.message || `Unable to load dataset ${key}`);
  }
  return result.data;
}

export async function refreshDatasetCache(): Promise<string> {
  const result = await apiJson<RefreshResponse>('/api/dataset/refresh', { method: 'POST' });
  return result.message;
}

// Mission Operations API
type MissionDataset = {
  missionId: string;
  missionName: string;
  phase: string;
  duration: string;
  startDate: string;
  objectives: string[];
  crewManifest: string[];
};

type RocketDataset = {
  status: string;
  healthScore: number;
  systems: { thrust: number; fuelPressure: number; thermalManagement: number; avionicsHealth: number };
};

function missionStatus(rocketStatus: string): Mission['status'] {
  if (rocketStatus === 'Operational') return 'Operational';
  if (rocketStatus === 'Warning') return 'Warning';
  if (rocketStatus === 'Critical') return 'Critical';
  return 'Unknown';
}

export async function getMission(_missionId?: string): Promise<Mission> {
  try {
    const [missionData, astronauts, rocket, iss] = await Promise.all([
      getDataset('mission') as Promise<MissionDataset>,
      getAstronauts(),
      getRocket() as Promise<RocketDataset>,
      getISS(),
    ]);

    const crew = missionData.crewManifest.map((name, index) => {
      const astronaut = astronauts.find((candidate) => candidate.name === name);
      return astronaut ?? {
        id: `crew-${index + 1}`,
        name,
        role: 'Mission Specialist',
        missionSpecialty: 'Mission operations',
        healthScore: 0,
        vitalSigns: {},
      } satisfies AstronautData;
    });

    const objectives = missionData.objectives.map((description, index) => ({
      id: `objective-${index + 1}`,
      name: description,
      description: `Operational objective for ${missionData.missionName}.`,
      status: index === 0 ? 'In Progress' : 'Planned',
      completionPercentage: index === 0 ? 62 : 0,
      priority: index === 0 ? 'High' : 'Medium',
    } as const));

    const kpis = [
      { id: 'crew-health', label: 'Crew health', value: Math.round(crew.reduce((sum, member) => sum + (member.healthScore ?? 0), 0) / Math.max(crew.length, 1)), unit: '%', status: 'Nominal' as const, trend: 'Stable' as const, timestamp: new Date().toISOString() },
      { id: 'vehicle-health', label: 'Vehicle health', value: rocket.healthScore, unit: '%', status: rocket.healthScore >= 90 ? 'Nominal' as const : 'Warning' as const, trend: 'Stable' as const, timestamp: new Date().toISOString() },
      { id: 'altitude', label: 'Orbital altitude', value: iss.altitude, unit: 'km', status: 'Nominal' as const, trend: 'Stable' as const, timestamp: iss.timestamp },
      { id: 'velocity', label: 'Orbital velocity', value: iss.velocity, unit: 'km/h', status: 'Nominal' as const, trend: 'Stable' as const, timestamp: iss.timestamp },
    ];

    return {
      id: missionData.missionId,
      name: missionData.missionName,
      phase: missionData.phase as Mission['phase'],
      status: missionStatus(rocket.status),
      startDate: missionData.startDate,
      duration: missionData.duration,
      crew,
      objectives,
      kpis,
    };
  } catch (error) {
    throw new Error(`Unable to load mission: ${(error as Error).message}`);
  }
}

export async function getMissions(): Promise<Mission[]> {
  try {
    // For now return single mission, can be extended to support multiple
    const mission = await getMission();
    return [mission];
  } catch (error) {
    throw new Error(`Unable to load missions: ${(error as Error).message}`);
  }
}

export async function getISS(): Promise<{ name: string; latitude: number; longitude: number; altitude: number; velocity: number; timestamp: string }> {
  try {
    const data = await getDataset('iss');
    return data as { name: string; latitude: number; longitude: number; altitude: number; velocity: number; timestamp: string };
  } catch (error) {
    throw new Error(`Unable to load ISS data: ${(error as Error).message}`);
  }
}

export async function getAstronauts(): Promise<AstronautData[]> {
  try {
    const data = await getDataset('astronauts');
    return Array.isArray(data) ? data as AstronautData[] : [];
  } catch (error) {
    throw new Error(`Unable to load astronauts: ${(error as Error).message}`);
  }
}

export async function getSpaceWeather(): Promise<any> {
  try {
    const data = await getDataset('spaceWeather');
    return data;
  } catch (error) {
    throw new Error(`Unable to load space weather: ${(error as Error).message}`);
  }
}

export async function getRocket(): Promise<any> {
  try {
    const data = await getDataset('rocket');
    return data;
  } catch (error) {
    throw new Error(`Unable to load rocket data: ${(error as Error).message}`);
  }
}

// Telemetry and Alerts
export async function getTelemetry(metricIds?: string[], range?: string): Promise<any[]> {
  try {
    const qs = new URLSearchParams();
    if (metricIds && metricIds.length > 0) {
      metricIds.forEach((id) => qs.append('metricIds', id));
    }
    if (range) qs.set('range', range);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    // Use the telemetry series endpoint which returns TelemetrySeries[] in { status, data }
    const result = await apiJson<DatasetResponse<any[]>>(`/api/telemetry/series${query}`);
    if ((result as any).status === 'success') {
      return result.data;
    }
    throw new Error((result as any).message || 'Unable to load telemetry');
  } catch (error) {
    throw new Error(`Unable to load telemetry: ${(error as Error).message}`);
  }
}

export async function getTelemetryLive(): Promise<any> {
  try {
    const result = await apiJson<DatasetResponse<any>>('/api/telemetry/live');
    if ((result as any).status === 'success') return result.data;
    throw new Error((result as any).message || 'Unable to load live telemetry');
  } catch (error) {
    throw new Error(`Unable to load live telemetry: ${(error as Error).message}`);
  }
}

export async function getAlerts(): Promise<MissionAlert[]> {
  try {
    const result = await apiJson<DatasetResponse<any[]>>('/api/alerts');
    if (result.status === 'success') return result.data as MissionAlert[];
    throw new Error(result.message || 'Unable to load alerts');
  } catch (error) {
    throw new Error(`Unable to load alerts: ${(error as Error).message}`);
  }
}
