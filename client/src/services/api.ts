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
