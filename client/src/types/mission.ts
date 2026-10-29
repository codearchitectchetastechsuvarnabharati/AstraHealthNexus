// Mission Operations Types and Interfaces

// Minimal astronaut data used by mission components
export interface AstronautData {
  id: string;
  name: string;
  role?: string;
  country?: string;
  profileUrl?: string;
  missionSpecialty?: string;
  healthScore?: number;
  vitalSigns?: {
    heartRate?: number;
    oxygenSaturation?: number;
    cabinPressure?: number;
    temperature?: number;
  };
}

// Extended mission types for operations
export interface Mission {
  id: string;
  name: string;
  phase: 'Planning' | 'Pre-Launch' | 'Active Orbital Operations' | 'Return Preparation' | 'Completed' | 'Cancelled';
  status: 'Operational' | 'Nominal' | 'Warning' | 'Critical' | 'Offline' | 'Unknown';
  startDate: string;
  endDate?: string;
  duration: string;
  crew: AstronautData[];
  objectives: MissionObjective[];
  kpis: MissionKPI[];
}

export interface MissionObjective {
  id: string;
  name: string;
  description: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Blocked';
  completionPercentage: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate?: string;
  endDate?: string;
}

export interface MissionKPI {
  id: string;
  label: string;
  value: number | string;
  unit: string;
  status: 'Nominal' | 'Warning' | 'Critical';
  trend?: 'Up' | 'Down' | 'Stable';
  timestamp: string;
}

export interface MissionEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'System' | 'Crew' | 'Navigation' | 'Science' | 'Maintenance' | 'Alert';
  status: 'Completed' | 'In Progress' | 'Pending';
  severity: 'Info' | 'Warning' | 'Critical';
}

export interface MissionTimeline {
  events: MissionEvent[];
  startTime: string;
  endTime: string;
}

export interface StationInfo {
  name: string;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  lastUpdated: string;
  status: 'Operational' | 'Offline' | 'Limited';
}

export interface TelemetryMetric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  minValue?: number;
  maxValue?: number;
  average?: number;
  status: 'Nominal' | 'Warning' | 'Critical';
}

export interface TelemetryDataPoint {
  timestamp: string;
  value: number;
}

export interface TelemetrySeries {
  metric: TelemetryMetric;
  dataPoints: TelemetryDataPoint[];
}

export interface MissionAlert {
  id: string;
  title: string;
  description: string;
  severity: 'Info' | 'Warning' | 'Critical';
  timestamp: string;
  source: string;
  affectedSubsystem: string;
  status: 'Active' | 'Resolved' | 'Acknowledged';
}

export interface MissionOperationsState {
  mission: Mission | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export type TimeRange = 'last15m' | 'last1h' | 'last6h' | 'last24h' | 'last7d' | 'custom';
