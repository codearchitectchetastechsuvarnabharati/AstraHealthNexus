/** Normalized external data used by AstraHealthNexus; provider fields stop at the adapter. */
export type NasaEndpoint = 'apod' | 'asteroids';
export interface AstronomyPicture {
  date: string;
  title: string;
  explanation: string;
  mediaType: 'image' | 'video' | 'iframe';
  url: string;
  hdUrl: string | null;
  thumbnailUrl: string | null;
  copyright: string | null;
}
export interface AsteroidSummary {
  date: string;
  trackedCount: number;
  hazardousCount: number;
  closestApproach: { id: string; name: string; distanceKm: number } | null;
}
export interface NasaDataByEndpoint {
  apod: AstronomyPicture;
  asteroids: AsteroidSummary;
}
export type NasaData = NasaDataByEndpoint[NasaEndpoint];
export interface ExternalDataResult<T> {
  data: T;
  source: 'NASA';
  endpoint: NasaEndpoint;
  date: string;
  fetchedAt: string;
  cacheStatus: 'fresh' | 'cached' | 'stale';
  warning?: string;
}
