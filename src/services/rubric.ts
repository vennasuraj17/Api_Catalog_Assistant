import { readFileSync } from 'fs';
import { join } from 'path';
import type { Rubric, Severity } from '../types/index.js';

let _rubric: Rubric | null = null;

export function loadRubric(): Rubric {
  if (_rubric) return _rubric;
  _rubric = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'rubric.json'), 'utf-8')
  ) as Rubric;
  return _rubric;
}

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Maximum achievable score given the loaded rubric (used for normalisation). */
export function maxScore(): number {
  return loadRubric()
    .categories
    .flatMap(c => c.rules)
    .reduce((s, r) => s + SEVERITY_WEIGHTS[r.severity as Severity], 0);
}
