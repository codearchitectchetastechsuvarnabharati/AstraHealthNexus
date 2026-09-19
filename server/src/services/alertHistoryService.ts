import { PrismaClient, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { logger } from '../middleware/logger.js';

export type AlertHistoryEvent = {
  severity: string;
  message: string;
  source?: string;
  createdAt?: Date;
};

export type AlertHistoryFilters = {
  severity?: string;
  source?: string;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
};

export type AlertHistoryItem = {
  id: string;
  severity: string;
  message: string;
  source: string;
  createdAt: Date;
  isAcknowledged: boolean;
};

export type AlertHistoryResult = {
  items: AlertHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

interface AlertHistoryRepository {
  append(events: AlertHistoryEvent[]): Promise<void>;
  list(filters: AlertHistoryFilters): Promise<AlertHistoryResult>;
}

class InMemoryAlertHistoryRepository implements AlertHistoryRepository {
  private readonly items: AlertHistoryItem[] = [];

  async append(events: AlertHistoryEvent[]): Promise<void> {
    for (const event of events) {
      this.items.push({
        id: randomUUID(),
        severity: event.severity,
        message: event.message,
        source: event.source ?? 'dashboard',
        createdAt: event.createdAt ?? new Date(),
        isAcknowledged: false
      });
    }
  }

  async list(filters: AlertHistoryFilters): Promise<AlertHistoryResult> {
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    const filtered = this.items
      .filter((item) => {
        if (filters.severity && item.severity !== filters.severity) return false;
        if (filters.source && item.source !== filters.source) return false;
        if (filters.search && !item.message.toLowerCase().includes(filters.search.toLowerCase())) {
          return false;
        }
        if (filters.from && item.createdAt < filters.from) return false;
        if (filters.to && item.createdAt > filters.to) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset
    };
  }

  clear(): void {
    this.items.length = 0;
  }
}

class PrismaAlertHistoryRepository implements AlertHistoryRepository {
  private readonly prisma = new PrismaClient();

  async append(events: AlertHistoryEvent[]): Promise<void> {
    if (events.length === 0) return;

    await this.prisma.alertEvent.createMany({
      data: events.map((event) => ({
        severity: event.severity,
        message: event.message,
        source: event.source ?? 'dashboard',
        ...(event.createdAt ? { createdAt: event.createdAt } : {})
      }))
    });
  }

  async list(filters: AlertHistoryFilters): Promise<AlertHistoryResult> {
    const limit = normalizeLimit(filters.limit);
    const offset = normalizeOffset(filters.offset);

    const where: Prisma.AlertEventWhereInput = {};

    if (filters.severity) where.severity = filters.severity;
    if (filters.source) where.source = filters.source;
    if (filters.search) {
      where.message = { contains: filters.search, mode: 'insensitive' };
    }
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      this.prisma.alertEvent.count({ where })
    ]);

    return { items, total, limit, offset };
  }
}

const memoryRepository = new InMemoryAlertHistoryRepository();
let prismaRepository: PrismaAlertHistoryRepository | null = null;

function normalizeLimit(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(value)));
}

function normalizeOffset(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function getRepository(): AlertHistoryRepository {
  if (process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL) {
    return memoryRepository;
  }

  prismaRepository ??= new PrismaAlertHistoryRepository();
  return prismaRepository;
}

export async function recordAlertHistory(events: AlertHistoryEvent[]): Promise<void> {
  if (events.length === 0) return;

  try {
    await getRepository().append(events);
  } catch (error) {
    logger.warn(
      `Alert history persistence failed; retaining an in-memory copy: ${String(error)}`
    );
    await memoryRepository.append(events);
  }
}

export async function getAlertHistory(
  filters: AlertHistoryFilters = {}
): Promise<AlertHistoryResult> {
  try {
    return await getRepository().list(filters);
  } catch (error) {
    logger.warn(
      `Alert history lookup failed; returning in-memory history: ${String(error)}`
    );
    return memoryRepository.list(filters);
  }
}

export function resetAlertHistoryForTests(): void {
  memoryRepository.clear();
  prismaRepository = null;
}
