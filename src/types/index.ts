// ── Catalog ──────────────────────────────────────────────────────────────────
export interface ApiEntry {
  name: string;
  domain: string;
  status: string;
  tags: string[];
  endpoints: number;
  onboardedDate: string;
  owner: string | null;
  dependencies: string[];
  protocol: string;
  gateway: string;
}

export interface Catalog {
  apis: ApiEntry[];
}

// ── Rubric ────────────────────────────────────────────────────────────────────
export type Severity = 'low' | 'medium' | 'high';

export interface RubricRule {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  example: string;
}

export interface RubricCategory {
  id: string;
  name: string;
  rules: RubricRule[];
}

export interface Rubric {
  version: string;
  description: string;
  categories: RubricCategory[];
}

// ── Assessment ────────────────────────────────────────────────────────────────
export interface RuleResult {
  ruleId: string;
  title: string;
  severity: Severity;
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

export interface AssessmentResult {
  apiName: string;
  score: number;          // 0-100
  grade: string;          // A / B / C / D / F
  totalRules: number;
  passedRules: number;
  failedRules: number;
  results: RuleResult[];
}

// ── API Contracts ─────────────────────────────────────────────────────────────
export interface AskRequest {
  question: string;
}

export interface AskResponse {
  answer: string;
  intent: 'qa' | 'assess' | 'ambiguous';
}

export interface AssessRequest {
  apiName: string;
}

export interface ScenarioResult {
  id: string;
  type: string;
  prompt: string;
  response: AskResponse;
}
