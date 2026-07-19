# Scaling Plan

How to scale this system to thousands of APIs and hundreds of specs.

---

## Catalog growth: 60 → 10 000 APIs

**Problem:** Sending 10 000 catalog entries in a prompt exceeds context limits (~800 KB
of text) and is prohibitively expensive per request.

**Solution — semantic retrieval:**
1. Embed each API entry using `text-embedding-3-small` (1536 dims) at ingestion time.
2. Store vectors in **pgvector** (if already running Postgres) or **Pinecone**.
3. At query time, embed the user question and retrieve the top-k (e.g., 20) most
   relevant APIs via cosine similarity.
4. Inject only those k entries into the prompt.  For dependency-chain questions
   (S02, S04), also include the transitive dependents of retrieved APIs.

**Trigger point:** Swap at ~500 APIs when the prompt starts exceeding 20 K tokens.

---

## Spec growth: 10 → 500 specs

**Problem:** The programmatic assessor is fast (< 5 ms per spec) but re-runs on every
request.  With 500 specs and concurrent traffic, repeated YAML parsing is wasteful.

**Solution — assessment cache:**
1. Compute and store `AssessmentResult` in a key-value store (Redis or Postgres)
   keyed on `sha256(spec_content)`.
2. Re-assess only when the spec file changes (webhook from GitHub / GitLab).
3. Expose a `GET /assess/rank` endpoint that reads from the cache instead of
   recomputing.

---

## Latency: reducing per-request LLM cost

| Technique | Expected gain |
|-----------|---------------|
| Prompt caching (OpenAI Batch API) | 50% token cost reduction for repeated catalog context |
| `gpt-4o-mini` → smaller local model (Llama 3 8B) for routing | ~10x cheaper, ~2x faster |
| Response streaming (`stream: true`) | Perceived latency -60% for end users |
| Parallel scenario execution (`p-limit`) | Total scenario time from ~30 s → ~8 s |

---

## Reliability: making the service production-ready

1. **API key authentication** — `fastify-auth` plugin with Bearer token validation.
2. **Rate limiting** — `@fastify/rate-limit`, per-user and per-IP caps.
3. **Circuit breaker** — wrap the OpenAI call with `cockatiel` to fail fast if the
   upstream is degraded, and return a graceful error instead of hanging.
4. **Observability** — structured logging (already on with Fastify's `pino`),
   OpenTelemetry traces for each LLM call, latency/cost dashboards in Grafana.
5. **Spec ingestion pipeline** — replace the local filesystem approach with a
   Git-backed spec registry.  A CI job validates and injects new specs;
   the service never reads raw files in production.

---

## Quality: catching regressions at scale

1. Run the assessor as a **GitHub Actions check** on every spec PR.  Block merge
   if score drops below a configurable threshold (e.g., 70/100).
2. Alert the API owner via Slack/email when a previously-passing rule starts failing.
3. Track score history over time in a time-series DB to detect quality drift.
