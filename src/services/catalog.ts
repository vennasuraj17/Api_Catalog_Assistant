import { readFileSync } from 'fs';
import { join } from 'path';
import type { Catalog, ApiEntry } from '../types/index.js';

let _catalog: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (_catalog) return _catalog;
  const raw = readFileSync(join(process.cwd(), 'data', 'catalog.json'), 'utf-8');
  _catalog = JSON.parse(raw) as Catalog;
  return _catalog;
}

/**
 * Serialises the full catalog to a compact text block for inclusion in an
 * LLM prompt.  Keeps each API on one line to save tokens.
 */
export function getCatalogText(): string {
  return loadCatalog().apis.map(a =>
    `${a.name}: domain=${a.domain}, status=${a.status}, protocol=${a.protocol}, ` +
    `gateway=${a.gateway}, tags=[${a.tags.join(',')}], owner=${a.owner ?? 'unowned'}, ` +
    `endpoints=${a.endpoints}, deps=[${a.dependencies.join(',')}], onboarded=${a.onboardedDate}`
  ).join('\n');
}

/** Returns every API that lists `apiName` in its dependencies array. */
export function findDependents(apiName: string): ApiEntry[] {
  return loadCatalog().apis.filter(a => a.dependencies.includes(apiName));
}
