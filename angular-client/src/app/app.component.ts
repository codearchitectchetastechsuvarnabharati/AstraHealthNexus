import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { StatCardComponent } from './stat-card.component';
import { HealthCardComponent } from './health-card.component';

interface HealthMetrics {
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
  };
  rocketSystems: {
    thrust: number;
    fuelPressure: number;
    thermal: number;
  };
}

interface DashboardSnapshot {
  missionStatus: string;
  orbit: string;
  weather: string;
  alerts: string[];
  telemetry: Array<{ label: string; value: number }>;
  nasaHighlight?: string;
  nasaImage?: string | null;
  liveVideoUrl?: string;
  lastUpdated: string;
  spaceWeatherStatus: string;
  crewAndVehicleHealth?: HealthMetrics;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, StatCardComponent, HealthCardComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  snapshot: DashboardSnapshot | null = null;
  apiUrl = '/api/telemetry/live';
  loading = true;
  error = '';
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.refreshTelemetry();
    this.refreshTimer = setInterval(() => this.refreshTelemetry(), 20000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  refreshTelemetry() {
    this.loading = true;
    this.error = '';

    this.http.get<DashboardSnapshot>(this.apiUrl).subscribe({
      next: (data) => {
        this.snapshot = {
          missionStatus: data.missionStatus ?? 'Live mission connected',
          orbit: data.orbit ?? 'Orbit unknown',
          weather: data.weather ?? 'Weather sync pending',
          alerts: data.alerts ?? [],
          telemetry: data.telemetry ?? [
            { label: 'Feed sync', value: 89 },
            { label: 'Orbital lock', value: 87 },
            { label: 'Space weather', value: 92 }
          ],
          nasaHighlight: data.nasaHighlight,
          nasaImage: data.nasaImage ?? null,
          liveVideoUrl: data.liveVideoUrl ?? 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1&controls=1',
          lastUpdated: new Date().toLocaleTimeString(),
          spaceWeatherStatus: data.spaceWeatherStatus ?? 'Synchronizing NASA feeds',
          crewAndVehicleHealth: data.crewAndVehicleHealth
        };
        this.loading = false;
      },
      error: (err) => {
        console.error('Telemetry request failed', err);
        this.error = 'Unable to load mission telemetry. Check the backend service.';
        this.loading = false;
      }
    });
  }
}
