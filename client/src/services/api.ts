import { DatasetKeysResponse, DatasetResponse, DashboardSnapshot, DatasetKey, RefreshResponse } from '../types/api';

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
export async function getMission(missionId?: string): Promise<any> {
  try {
    const data = await getDataset('mission');
    return data;
  } catch (error) {
    throw new Error(`Unable to load mission: ${(error as Error).message}`);
  }
}

export async function getMissions(): Promise<any[]> {
  try {
    // For now return single mission, can be extended to support multiple
    const mission = await getMission();
    return [mission];
  } catch (error) {
    throw new Error(`Unable to load missions: ${(error as Error).message}`);
  }
}

export async function getISS(): Promise<any> {
  try {
    const data = await getDataset('iss');
    return data;
  } catch (error) {
    throw new Error(`Unable to load ISS data: ${(error as Error).message}`);
  }
}

export async function getAstronauts(): Promise<any[]> {
  try {
    const data = await getDataset('astronauts');
    return Array.isArray(data) ? data : [];
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
    const result = await apiJson<DatasetResponse<any[]>>(`/api/telemetry${query}`);
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

export async function getAlerts(): Promise<any[]> {
  try {
    const result = await apiJson<DatasetResponse<any[]>>('/api/alerts');
    if ((result as any).status === 'success') return result.data;
    throw new Error((result as any).message || 'Unable to load alerts');
  } catch (error) {
    throw new Error(`Unable to load alerts: ${(error as Error).message}`);
  }
}
