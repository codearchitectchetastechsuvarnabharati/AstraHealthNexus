import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { logEvent, logServiceFailure } from '../middleware/logger.js';

export const AlertStatusSchema = z.enum(['open', 'acknowledged', 'resolved']);
export const AlertIdSchema = z.string().regex(/^alert_[a-f0-9]{64}$/, 'Invalid alert ID');
const AlertSchema = z.object({
  id: AlertIdSchema, message: z.string(), severity: z.string(), source: z.literal('dashboard'),
  status: AlertStatusSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(), resolvedAt: z.string().datetime().nullable()
}).strict().refine(alert => {
  if (alert.status === 'open') return alert.acknowledgedAt === null && alert.resolvedAt === null && alert.updatedAt === alert.createdAt;
  if (alert.acknowledgedAt === null || alert.acknowledgedAt < alert.createdAt) return false;
  if (alert.status === 'acknowledged') return alert.resolvedAt === null && alert.updatedAt === alert.acknowledgedAt;
  return alert.resolvedAt !== null && alert.resolvedAt >= alert.acknowledgedAt && alert.updatedAt === alert.resolvedAt;
}, 'Invalid lifecycle timestamps');
const StateSchema = z.object({ version: z.literal(1), alerts: z.array(AlertSchema) }).strict()
  .refine(state => new Set(state.alerts.map(alert => alert.id)).size === state.alerts.length, 'Duplicate alert IDs');
export type Alert = z.infer<typeof AlertSchema>;
type Snapshot = { summary: string; severity: string; events: { message: string; severity: string }[] };
type ListQuery = { limit: number; offset: number; status?: Alert['status'] };

export class AlertService {
  // One service instance per state file; operations are serialized within this process.
  private pending: Promise<unknown> = Promise.resolve();
  readonly storage = { readFile, writeFile, mkdir, rename, unlink };
  constructor(private readonly stateFile = fileURLToPath(new URL('../../runtime/alerts.json', import.meta.url))) {}

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation).catch(error => {
      if (!(error instanceof HttpError)) logServiceFailure('alert_storage_failed', { service: 'alerts', err: error });
      throw error;
    });
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async read(): Promise<Alert[]> {
    try {
      return StateSchema.parse(JSON.parse(await this.storage.readFile(this.stateFile, 'utf8'))).alerts;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error; // Never silently reset corrupt or unreadable lifecycle state.
    }
  }

  private async save(alerts: Alert[]): Promise<void> {
    await this.storage.mkdir(path.dirname(this.stateFile), { recursive: true });
    const temporary = `${this.stateFile}.${randomUUID()}.tmp`;
    try {
      await this.storage.writeFile(temporary, JSON.stringify({ version: 1, alerts }), { encoding: 'utf8', flag: 'wx' });
      await this.storage.rename(temporary, this.stateFile);
    } finally {
      await this.storage.unlink(temporary).catch(error => {
        if (error.code !== 'ENOENT') logServiceFailure('alert_temp_cleanup_failed', { service: 'alerts', err: error });
      });
    }
  }

  list(snapshot: Snapshot, query: ListQuery) {
    return this.run(async () => {
      const alerts = await this.read();
      const known = new Set(alerts.map(alert => alert.id));
      const added: Alert[] = [];
      for (const event of snapshot.events) {
        const id = `alert_${createHash('sha256').update(JSON.stringify(['dashboard', event.message, event.severity])).digest('hex')}`;
        if (known.has(id)) continue;
        const now = new Date().toISOString();
        const alert: Alert = { ...event, id, source: 'dashboard', status: 'open', createdAt: now, updatedAt: now, acknowledgedAt: null, resolvedAt: null };
        alerts.push(alert);
        added.push(alert);
        known.add(id);
      }
      if (added.length) {
        await this.save(alerts);
        for (const alert of added) logEvent('alert_opened', { alertId: alert.id, status: alert.status });
      }
      const filtered = query.status ? alerts.filter(alert => alert.status === query.status) : alerts;
      const events = filtered.slice(query.offset, query.offset + query.limit);
      const pagination = { limit: query.limit, offset: query.offset, total: filtered.length, returned: events.length, hasMore: query.offset + events.length < filtered.length };
      return { summary: snapshot.summary, severity: snapshot.severity, events, pagination, collections: { events: pagination } };
    });
  }

  get(id: string) {
    return this.run(async () => {
      const alert = (await this.read()).find(item => item.id === id);
      if (!alert) throw new HttpError(404, 'Alert not found');
      return alert;
    });
  }

  transition(id: string, status: 'acknowledged' | 'resolved', requestId?: string) {
    return this.run(async () => {
      const alerts = await this.read();
      const alert = alerts.find(item => item.id === id);
      if (!alert) throw new HttpError(404, 'Alert not found');
      if (alert.status === status) return alert; // Safe retry without changing timestamps.
      const from = alert.status;
      if (!((from === 'open' && status === 'acknowledged') || (from === 'acknowledged' && status === 'resolved'))) {
        throw new HttpError(409, `Cannot change alert from ${from} to ${status}`);
      }
      const now = new Date(Math.max(Date.now(), Date.parse(alert.updatedAt))).toISOString();
      alert.status = status;
      alert.updatedAt = now;
      if (status === 'acknowledged') alert.acknowledgedAt = now;
      else alert.resolvedAt = now;
      await this.save(alerts);
      logEvent('alert_status_changed', { alertId: id, from, to: status, requestId });
      return alert;
    });
  }
}

export const alertService = new AlertService();
