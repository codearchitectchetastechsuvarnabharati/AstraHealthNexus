import type { PaginationQuery } from '../schemas.js';

export function pageItems<T>(items: T[], { limit, offset }: PaginationQuery) {
  const data = items.slice(offset, offset + limit);
  return { data, pagination: { limit, offset, total: items.length, returned: data.length, hasMore: offset + data.length < items.length } };
}

// Keep existing data shapes and report a page for every nested collection.
export function pageCollections(value: unknown, query: PaginationQuery) {
  const collections: Record<string, ReturnType<typeof pageItems>['pagination']> = {};
  function visit(item: unknown, path: string): unknown {
    if (Array.isArray(item)) {
      const page = pageItems(item, query);
      collections[path] = page.pagination;
      return page.data.map((entry, index) => visit(entry, `${path}[${query.offset + index}]`));
    }
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, visit(child, path ? `${path}.${key}` : key)]));
    }
    return item;
  }
  return { data: visit(value, ''), collections };
}
