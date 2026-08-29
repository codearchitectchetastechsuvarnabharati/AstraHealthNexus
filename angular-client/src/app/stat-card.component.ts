import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <article class="stat-card">
      <span class="stat-title">{{ label }}</span>
      <h3>{{ value }}</h3>
      <p>{{ detail }}</p>
    </article>
  `,
  styles: [
    `
      .stat-card {
        padding: 1.75rem;
        border-radius: 1.5rem;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(56, 189, 248, 0.15);
        box-shadow: 0 28px 60px rgba(15, 23, 42, 0.2);
      }

      .stat-title {
        display: inline-flex;
        padding: 0.35rem 0.75rem;
        border-radius: 9999px;
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }

      h3 {
        margin: 1rem 0 0.5rem;
        font-size: 2rem;
        line-height: 1.1;
      }

      p {
        margin: 0;
        color: #cbd5e1;
      }
    `
  ]
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() detail = '';
}
