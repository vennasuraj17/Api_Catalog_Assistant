import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export type Spec = Record<string, unknown>;

const _cache = new Map<string, Spec>();

/** Load and parse a YAML spec by its catalog name (without .yaml extension). */
export function loadSpec(apiName: string): Spec | null {
  if (_cache.has(apiName)) return _cache.get(apiName)!;
  const p = join(process.cwd(), 'data', 'specs', `${apiName}.yaml`);
  if (!existsSync(p)) return null;
  const spec = yaml.load(readFileSync(p, 'utf-8')) as Spec;
  _cache.set(apiName, spec);
  return spec;
}

/** Returns names of all specs found under data/specs/ (without extension). */
export function listAvailableSpecs(): string[] {
  const dir = join(process.cwd(), 'data', 'specs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}
