# API Catalog Assistant

A Fastify + TypeScript service that lets developers interact intelligently with an
API catalog.  It answers natural-language questions, assesses OpenAPI spec quality
against a 12-rule rubric, and handles ambiguous requests gracefully.

---

## Project structure

```
api-catalog-assistant/
├── src/
│   ├── server.ts              # Entry point; registers all routes
│   ├── types/
│   │   └── index.ts           # Shared TypeScript interfaces
│   ├── services/
│   │   ├── catalog.ts         # Loads catalog.json; serialises it for LLM prompts
│   │   ├── specs.ts           # Loads and caches YAML spec files
│   │   ├── rubric.ts          # Loads rubric.json; computes severity weights
│   │   ├── assessor.ts        # 12 deterministic rule checks (no LLM)
│   │   └── assistant.ts       # OpenAI-powered Q&A over the catalog
│   └── routes/
│       ├── ask.ts             # POST /ask
│       ├── assess.ts          # POST /assess, GET /assess/rank, GET /assess/specs
│       └── scenarios.ts       # POST /scenarios/run
├── data/                      # Provided by the assignment (copy here)
│   ├── catalog.json
│   ├── rubric.json
│   ├── scenarios.json
│   └── specs/
│       ├── payments-api.yaml
│       └── ... (9 more)
├── docs/
│   ├── decision-log.md        # What we built and why
│   ├── failure-analysis.md    # Where the system breaks and what to do
│   └── scaling-plan.md        # How to scale to thousands of APIs
├── results/
│   └── scenarios.md           # Pre-computed answers for all 10 scenarios
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

- Node.js ≥ 20
- An OpenAI API key with access to `gpt-4o-mini`

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-handle>/api-catalog-assistant.git
cd api-catalog-assistant

# 2. Copy the data directory from the assignment
cp -r path/to/ai-engineer-takehome/data ./data

# 3. Install dependencies
npm install

# 4. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 5. Start the server
npm run dev        # development (hot-reload via tsx watch)
# or
npm start          # production
```

The server listens on `http://localhost:3000` by default.

---

## API reference

### `GET /health`
Smoke-test endpoint.  Returns `{ status: 'ok', timestamp }`.  No auth required.

---

### `POST /ask`
Answer any natural-language question about the catalog or specs.

**Request body:**
```json
{ "question": "Which payment APIs are production-ready?" }
```

**Response:**
```json
{
  "answer": "Four APIs in the Payments domain are production-ready: ...",
  "intent": "qa"       // "qa" | "assess" | "ambiguous"
}
```

**Examples:**
```bash
curl -X POST http://localhost:3000/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "What breaks if I take down ledger-api?"}'

curl -X POST http://localhost:3000/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is wrong with the shipping-api spec?"}'
```

---

### `POST /assess`
Run all 12 rubric checks against a specific spec and return a structured report.

**Request body:**
```json
{ "apiName": "inventory-api" }
```

**Response:**
```json
{
  "apiName": "inventory-api",
  "score": 57,
  "grade": "C",
  "totalRules": 12,
  "passedRules": 7,
  "failedRules": 5,
  "results": [
    {
      "ruleId": "DOC-01",
      "title": "Operations are documented",
      "severity": "medium",
      "passed": false,
      "issues": ["GET /stock: missing description"],
      "suggestions": ["Add non-empty summary and description to every operation"]
    }
    // ... 11 more rules
  ]
}
```

---

### `GET /assess/rank`
Return all 10 specs ranked best-to-worst by quality score.  No LLM call — deterministic.

---

### `GET /assess/specs`
List all spec file names available for assessment.

---

### `POST /scenarios/run`
Run all 10 pre-defined scenarios through the assistant and return every prompt +
response pair.  Makes 10 sequential OpenAI calls; expect ~30–60 s.

---

## Packages used

| Package | Version | Why |
|---------|---------|-----|
| `fastify` | ^5.2.0 | Fast HTTP framework with built-in JSON Schema validation and TypeScript-first types |
| `openai` | ^4.77.0 | Official OpenAI Node SDK; handles retries, streaming, and token counting |
| `js-yaml` | ^4.1.0 | Battle-tested YAML parser for OpenAPI specs; handles anchors and complex types |
| `tsx` | ^4.19.0 | Zero-config TypeScript runner; no build step needed in development |
| `typescript` | ^5.7.0 | Static types across the whole codebase |
| `@types/js-yaml` | ^4.0.9 | Type stubs for js-yaml |
| `@types/node` | ^22.10.0 | Node.js built-in type stubs |

---

## Architecture overview

```
HTTP request
      │
      ▼
  Fastify router
      │
      ├── /ask  ───►  assistant.ts
      │           ├── load catalog (catalog.ts)         ─► [serialize to text]
      │           ├── detect intent (keyword scan)
      │           ├── if assess → run assessor.ts        ─► [12 rule checks]
      │           └── call OpenAI GPT-4o-mini            ─► answer
      │
      ├── /assess  ─►  assessor.ts
      │           ├── load spec (specs.ts + js-yaml)
      │           └── run 12 deterministic checks        ─► structured report
      │
      └── /assess/rank ► assessAllSpecs()               ─► sorted ranking
```

**Key design choices:**
- The full catalog (60 APIs, ~3 KB) is injected into every LLM prompt.  No vector
  search is needed at this scale (see `docs/scaling-plan.md` for when to switch).
- Spec assessment is fully deterministic — the LLM is only used to narrate results,
  not to decide pass/fail.  This makes scores reproducible and auditable.
- Scoring: `high=3 pts`, `medium=2 pts`, `low=1 pt`; max = 23 pts; normalised to 0–100.

---

## Deliverables checklist

- [x] Working system with setup instructions (this README)
- [x] Results against 10 scenarios (`results/scenarios.md`; live via `POST /scenarios/run`)
- [x] Decision log (`docs/decision-log.md`)
- [x] Failure analysis (`docs/failure-analysis.md`)
- [x] Scaling plan (`docs/scaling-plan.md`)
