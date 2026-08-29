import type { RocketData } from '../types/dataset.js';

export const ROCKET_DATA: RocketData = {
  id: 'rkt_001',
  name: 'Artemis I Launch Vehicle',
  status: 'Operational',
  healthScore: 97,
  currentStage: 'Orbital maintenance',
  lastCheck: '2024-09-15T11:50:00Z',
  systems: {
    thrust: 96,
    fuelPressure: 98,
    thermalManagement: 94,
    propulsionSystem: 97,
    avionicsHealth: 98
  }
};
