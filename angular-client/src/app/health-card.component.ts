import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-health-card',
  standalone: true,
  template: `
    <article class="health-card">
      <div class="header-row">
        <div>
          <p class="health-title">{{ title }}</p>
          <h3>{{ status || 'Loading…' }}</h3>
        </div>
        <div class="score-pill">{{ score || 0 }}%</div>
      </div>

      <p class="health-copy">{{ narrative || 'Collecting biomedical and systems telemetry...' }}</p>

      <dl class="health-grid">
        <div *ngFor="let key of metricKeys">
          <dt>{{ key }}</dt>
          <dd>{{ normalizedMetrics[key] }}</dd>
        </div>
      </dl>
    </article>
  `,
  styles: [
    `
      .health-card {
        padding: 1.9rem;
        border-radius: 1.75rem;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(56, 189, 248, 0.14);
        min-height: 320px;
      }

      .header-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .health-title {
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.75rem;
        color: #7dd3fc;
        margin-bottom: 0.5rem;
      }

      h3 {
        margin: 0;
        font-size: 1.8rem;
        line-height: 1.1;
      }

      .score-pill {
        padding: 0.75rem 1rem;
        border-radius: 9999px;
        font-weight: 700;
        background: linear-gradient(135deg, #06b6d4, #22c55e);
        color: #020617;
      }

      .health-copy {
        margin: 1rem 0 1.5rem;
        color: #cbd5e1;
        line-height: 1.8;
      }

      .health-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      dt {
        margin: 0;
        font-size: 0.75rem;
        color: #94a3b8;
      }

      dd {
        margin: 0.25rem 0 0;
        font-size: 1.05rem;
        font-weight: 600;
      }
    `
  ]
})
export class HealthCardComponent {
  @Input() title = '';
  @Input() status?: string;
  @Input() score?: number;
  @Input() narrative?: string;
  @Input() metrics: Record<string, any> = {};

  get metricKeys() {
    return Array.isArray(this.metrics) ? [] : Object.keys(this.metrics || {});
  }

  get normalizedMetrics() {
    if (!this.metrics || typeof this.metrics !== 'object') {
      return {};
    }

    return Object.keys(this.metrics).reduce((acc, key) => {
      const value = this.metrics[key];
      acc[key] = typeof value === 'number' ? `${value}` : value;
      return acc;
    }, {} as Record<string, any>);
  }
}
