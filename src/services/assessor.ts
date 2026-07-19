/**
 * assessor.ts
 * Programmatic implementation of all 12 rubric rules.
 * Each check is pure TypeScript with no LLM dependency — deterministic and fast.
 * Severity weights: high=3, medium=2, low=1  →  max score = 23 pts → normalised to 0-100.
 */
import { loadSpec, listAvailableSpecs } from './specs.js';
import { SEVERITY_WEIGHTS, maxScore } from './rubric.js';
import type { AssessmentResult, RuleResult, Severity } from '../types/index.js';

type Spec = Record<string, unknown>;
type Op   = Record<string, unknown>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getOps(spec: Spec): Array<{ path: string; method: string; op: Op }> {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  const result: Array<{ path: string; method: string; op: Op }> = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      if (item?.[method]) result.push({ path, method, op: item[method] as Op });
    }
  }
  return result;
}

function rule(
  id: string, title: string, severity: Severity,
  issues: string[], suggestions: string[]
): RuleResult {
  return { ruleId: id, title, severity, passed: issues.length === 0, issues, suggestions };
}

// ── Documentation rules ──────────────────────────────────────────────────────

function DOC01(spec: Spec): RuleResult {
  const issues = getOps(spec)
    .filter(({ op }) => !op.summary || !op.description)
    .map(({ path, method, op }) => {
      const missing = (['summary', 'description'] as const).filter(k => !op[k]);
      return `${method.toUpperCase()} ${path}: missing ${missing.join(', ')}`;
    });
  return rule('DOC-01', 'Operations are documented', 'medium', issues,
    issues.length ? ['Add non-empty summary and description to every operation'] : []);
}

function DOC02(spec: Spec): RuleResult {
  const issues: string[] = [];
  for (const { path, method, op } of getOps(spec)) {
    for (const p of ((op.parameters ?? []) as Op[])) {
      if (!p.description)
        issues.push(`${method.toUpperCase()} ${path}: param '${String(p.name)}' has no description`);
    }
  }
  return rule('DOC-02', 'Parameters and properties are described', 'low',
    issues.slice(0, 8),
    issues.length ? ['Add a description field to every query/path/header parameter'] : []);
}

function DOC03(spec: Spec): RuleResult {
  const issues: string[] = [];
  const hasExample = (media: Op) =>
    media.example || media.examples || (media.schema as Op | undefined)?.example;

  for (const { path, method, op } of getOps(spec)) {
    const resps = (op.responses ?? {}) as Record<string, Op>;
    for (const [code, resp] of Object.entries(resps)) {
      if (!code.startsWith('2')) continue;
      for (const media of Object.values((resp.content ?? {}) as Record<string, Op>)) {
        if (!hasExample(media)) issues.push(`${method.toUpperCase()} ${path} ${code} response: no example`);
      }
    }
    if (op.requestBody) {
      for (const media of Object.values(((op.requestBody as Op).content ?? {}) as Record<string, Op>)) {
        if (!hasExample(media)) issues.push(`${method.toUpperCase()} ${path} requestBody: no example`);
      }
    }
  }
  return rule('DOC-03', 'Bodies provide examples', 'low',
    issues.slice(0, 8),
    issues.length ? ['Add an example or examples block to each request/response media type'] : []);
}

// ── Security rules ────────────────────────────────────────────────────────────

function SEC01(spec: Spec): RuleResult {
  const schemes = ((spec.components as Op | undefined)?.securitySchemes) as Record<string, unknown> | undefined;
  const ok = !!schemes && Object.keys(schemes).length > 0;
  return rule('SEC-01', 'Security schemes are defined', 'high',
    ok ? [] : ['No components.securitySchemes found'],
    ok ? [] : ['Define at least one scheme, e.g.: bearerAuth: { type: http, scheme: bearer }']);
}

function SEC02(spec: Spec): RuleResult {
  const globalSec = (spec.security as unknown[] | undefined) ?? [];
  // Global security covers all operations — pass immediately if present
  if (globalSec.length > 0)
    return rule('SEC-02', 'Operations require authentication', 'high', [], []);

  const issues = getOps(spec)
    .filter(({ op }) => !op.security || (op.security as unknown[]).length === 0)
    .map(({ path, method }) => `${method.toUpperCase()} ${path}: no security requirement`);
  return rule('SEC-02', 'Operations require authentication', 'high',
    issues.slice(0, 8),
    issues.length ? [
      'Add a root-level security array, or apply security on each operation',
      'Example: security: [{ bearerAuth: [] }]',
    ] : []);
}

function SEC03(spec: Spec): RuleResult {
  const servers = (spec.servers as Op[] | undefined) ?? [];
  const issues = servers
    .filter(s => (s.url as string | undefined)?.startsWith('http://'))
    .map(s => `Server URL uses HTTP: ${String(s.url)}`);
  return rule('SEC-03', 'Transport is safe (HTTPS)', 'medium', issues,
    issues.length ? ['Change all server URLs from http:// to https://'] : []);
}

// ── Design rules ────────────────────────────────────────────────────────────────

function DES01(spec: Spec): RuleResult {
  const paths = Object.keys((spec.paths ?? {}) as Op);
  const issues: string[] = [];
  for (const p of paths) {
    const seg = p.split('?')[0]; // ignore query strings in path key
    if (seg !== '/' && seg.endsWith('/')) issues.push(`'${p}' has a trailing slash`);
    if (seg !== seg.toLowerCase())        issues.push(`'${p}' contains uppercase characters`);
    if (seg.includes('_'))                issues.push(`'${p}' uses underscores (prefer hyphens)`);
    if (/\/(get|post|create|update|delete|fetch|list|add|remove)\b/i.test(seg))
      issues.push(`'${p}' appears to contain a verb in the path`);
  }
  return rule('DES-01', 'Consistent path naming', 'medium',
    issues.slice(0, 8),
    issues.length ? ['Use lowercase, hyphenated, plural-noun segments; remove trailing slashes and verbs'] : []);
}

function DES02(spec: Spec): RuleResult {
  const schemas = ((spec.components as Op | undefined)?.schemas as Record<string, Op> | undefined) ?? {};
  const camel  = /^[a-z][a-zA-Z0-9]*$/;
  const issues: string[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    const props = Object.keys((schema.properties as Op | undefined) ?? {});
    if (props.length < 2) continue;
    const ccCount = props.filter(p => camel.test(p) && !p.includes('_')).length;
    const scCount = props.filter(p => p.includes('_')).length;
    if (ccCount > 0 && scCount > 0)
      issues.push(`Schema '${name}' mixes camelCase and snake_case: [${props.join(', ')}]`);
  }
  return rule('DES-02', 'Consistent property casing', 'low', issues,
    issues.length ? ['Standardise all schema property names to camelCase'] : []);
}

function DES03(spec: Spec): RuleResult {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const { path, method, op } of getOps(spec)) {
    if (!op.operationId) {
      issues.push(`${method.toUpperCase()} ${path}: missing operationId`);
    } else {
      const id = op.operationId as string;
      if (seen.has(id)) issues.push(`Duplicate operationId '${id}' at ${method.toUpperCase()} ${path}`);
      seen.add(id);
    }
  }
  return rule('DES-03', 'Unique operationIds', 'medium', issues,
    issues.length ? ['Add a unique camelCase operationId to every operation (e.g. listOrders, createPayment)'] : []);
}

// ── Completeness rules ────────────────────────────────────────────────────────

function CMP01(spec: Spec): RuleResult {
  const mutating = new Set(['post', 'put', 'patch', 'delete']);
  const issues: string[] = [];
  for (const { path, method, op } of getOps(spec)) {
    const codes = Object.keys((op.responses as Op | undefined) ?? {});
    if (!codes.some(c => c.startsWith('4')))
      issues.push(`${method.toUpperCase()} ${path}: no 4xx error response declared`);
    if (mutating.has(method) && !codes.some(c => c.startsWith('5')))
      issues.push(`${method.toUpperCase()} ${path}: mutating op missing 5xx response`);
  }
  return rule('CMP-01', 'Error responses are declared', 'medium',
    issues.slice(0, 8),
    issues.length ? [
      'Add 400/401/404 responses to every operation',
      'Add 500 to POST/PUT/PATCH/DELETE operations',
    ] : []);
}

function CMP02(spec: Spec): RuleResult {
  const issues: string[] = [];
  for (const { path, method, op } of getOps(spec)) {
    const resps = (op.responses as Record<string, Op> | undefined) ?? {};
    for (const [code, resp] of Object.entries(resps)) {
      if (!code.startsWith('2') || code === '204') continue;
      if (!resp.content) {
        issues.push(`${method.toUpperCase()} ${path} ${code}: no content defined`);
      } else {
        for (const media of Object.values(resp.content as Record<string, Op>)) {
          if (!media.schema)
            issues.push(`${method.toUpperCase()} ${path} ${code}: response body has no schema`);
        }
      }
    }
  }
  return rule('CMP-02', '2xx responses reference a schema', 'high',
    issues.slice(0, 8),
    issues.length ? ['Add a schema (inline or $ref) to every 2xx response that returns a body'] : []);
}

function CMP03(spec: Spec): RuleResult {
  const info = (spec.info as Op | undefined) ?? {};
  const issues: string[] = [];
  if (!info.version) issues.push('info.version is missing');
  if (!info.title)   issues.push('info.title is missing');
  if (!info.contact) issues.push('info.contact is missing');
  if (!spec.servers || (spec.servers as unknown[]).length === 0)
    issues.push('servers[] is empty or absent');
  return rule('CMP-03', 'Spec metadata is complete', 'low', issues,
    issues.length ? ['Add info.title, info.version, info.contact, and at least one servers entry'] : []);
}

// ── Public API ───────────────────────────────────────────────────────────────────

export function assessSpec(apiName: string): AssessmentResult | null {
  const spec = loadSpec(apiName);
  if (!spec) return null;

  const checks: RuleResult[] = [
    DOC01(spec), DOC02(spec), DOC03(spec),
    SEC01(spec), SEC02(spec), SEC03(spec),
    DES01(spec), DES02(spec), DES03(spec),
    CMP01(spec), CMP02(spec), CMP03(spec),
  ];

  const max     = maxScore();
  const earned  = checks.reduce((s, r) => r.passed ? s + SEVERITY_WEIGHTS[r.severity] : s, 0);
  const score   = Math.round((earned / max) * 100);
  const grade   = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const passed  = checks.filter(r => r.passed).length;

  return {
    apiName, score, grade,
    totalRules: checks.length,
    passedRules: passed,
    failedRules: checks.length - passed,
    results: checks,
  };
}

export function assessAllSpecs(): AssessmentResult[] {
  return listAvailableSpecs()
    .map(assessSpec)
    .filter((r): r is AssessmentResult => r !== null)
    .sort((a, b) => b.score - a.score);
}
