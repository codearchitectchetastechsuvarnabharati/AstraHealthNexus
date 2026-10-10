import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export const seedMissions = [{ id: 'seed_demo_orbit' }, { id: 'seed_demo_training' }];
const sources = [
  ['iss', 'orbit', { latitude: 12.5, longitude: -45, altitude: 408.5, velocity: 27600 }],
  ['spaceWeather', 'space-weather', { kpIndex: 3, solarFlux: 140, solarWindSpeed: 420 }],
  ['astronauts', 'crew', { crewCount: 4, averageHealthScore: 95 }],
  ['rocket', 'vehicle', { healthScore: 94, thrust: 90, fuelPressure: 85 }],
  ['nasa', 'nasa', { hazardousCount: 1, trackedToday: 7 }],
  ['mission', 'mission', { phase: 'Monitoring', crewCount: 4, objectiveCount: 3 }]
] as const;
export const seedTelemetry: Prisma.MissionTelemetryCreateManyInput[] = seedMissions.flatMap((mission, missionIndex) =>
  Array.from({ length: 3 }, (_, batch) => sources.map(([source, category, values]) => ({
    id: `seed_v1_${mission.id}_${source}_${batch}`,
    mission: mission.id, source, category, values: { ...values },
    origin: batch % 2 ? 'submitted' as const : 'collected' as const,
    timestamp: new Date(Date.UTC(2026, 0, 1, missionIndex, batch)),
    receivedAt: new Date(Date.UTC(2026, 0, 1, missionIndex, batch, 2))
  }))).flat());
const id = (name: string) => 'alert_' + createHash('sha256').update('astra-seed-v1:' + name).digest('hex');
export const seedAlerts: Prisma.AlertEventCreateManyInput[] = [
  { id: id('open'), source: 'dashboard', message: 'Demo cabin pressure requires review', severity: 'warning', status: 'open', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'), acknowledgedAt: null, resolvedAt: null },
  { id: id('acknowledged'), source: 'dashboard', message: 'Demo solar activity under review', severity: 'info', status: 'acknowledged', createdAt: new Date('2026-01-01T00:01:00Z'), updatedAt: new Date('2026-01-01T00:02:00Z'), acknowledgedAt: new Date('2026-01-01T00:02:00Z'), resolvedAt: null },
  { id: id('resolved'), source: 'dashboard', message: 'Demo vehicle check completed', severity: 'info', status: 'resolved', createdAt: new Date('2026-01-01T00:03:00Z'), updatedAt: new Date('2026-01-01T00:05:00Z'), acknowledgedAt: new Date('2026-01-01T00:04:00Z'), resolvedAt: new Date('2026-01-01T00:05:00Z') },
  // Same event outside the default five-minute suppression window is legitimate.
  { id: id('repeat-after-window'), source: 'dashboard', message: 'Demo cabin pressure requires review', severity: 'warning', status: 'open', createdAt: new Date('2026-01-01T00:06:00Z'), updatedAt: new Date('2026-01-01T00:06:00Z'), acknowledgedAt: null, resolvedAt: null }
];
