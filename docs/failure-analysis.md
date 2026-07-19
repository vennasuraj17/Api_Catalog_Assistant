# Failure Analysis

Where the system breaks, why, and what we'd do about it.

---

## F-01: Keyword-based intent detection is brittle

**Symptom:** A question like "Is the billing API *good*?" may not trigger the assessor
because "good" is not in the keyword list.  The LLM then answers from catalog metadata
only, missing the spec quality angle.

**Root cause:** Intent detection is a simple substring scan, not a model.

**Fix:** Use a small structured classification call (`response_format: json_schema`)
to return `{ intent: 'qa' | 'assess' | 'ambiguous' }` before the main answering call,
or fine-tune a classifier.

---

## F-02: Assessor does not resolve `$ref` pointers

**Symptom:** Rules DOC-02, DES-02, CMP-02 examine schemas inline.  When a schema
property uses `$ref: '#/components/schemas/Foo'`, the assessor sees only the `$ref`
object, not the resolved properties — potentially missing casing violations or
undocumented properties.

**Root cause:** We parse the YAML but do not run full JSON Schema `$ref` resolution.

**Fix:** Add a lightweight resolver (e.g., `@apidevtools/json-schema-ref-parser`) as
a preprocessing step before running checks.

---

## F-03: LLM may hallucinate API names

**Symptom:** The LLM might cite an API like `payment-processing-api` that does not
exist in the catalog if the question is vague.

**Root cause:** The model can confabulate when it finds no exact match.

**Fix:** Post-process the LLM answer: extract any word ending in `-api` and validate
it against the catalog; flag unrecognised names in the response.

---

## F-04: External-but-no-gateway detection is tag-dependent

**Symptom:** S03 ("Which APIs are exposed externally but not behind a gateway?")
relies on the `external` tag being present.  APIs that are externally reachable but
not tagged `external` are silently missed.

**Root cause:** Tag hygiene is a catalog data-quality issue, not a system issue.

**Fix:** In a real deployment, expose a form that forces owners to declare exposure
level at onboarding time; validate the tag is present before registration.

---

## F-05: Sequential scenario runner is slow

**Symptom:** `POST /scenarios/run` makes 10 serial LLM calls.  With p95 latency of
~3 s per call this takes ~30 s end-to-end.

**Root cause:** Design choice made for simplicity and to avoid rate-limit errors.

**Fix:** Switch to `Promise.all` with a concurrency limiter (e.g., `p-limit`) and
respect the OpenAI requests-per-minute quota.

---

## F-06: No authentication or rate limiting

**Symptom:** The `/ask` endpoint is publicly accessible; a bad actor can exhaust the
OpenAI quota in minutes.

**Root cause:** Out of scope for a take-home, intentionally left open.

**Fix:** Add an API key middleware (`fastify-auth`), Redis-backed rate limiting
(`@fastify/rate-limit`), and token-budget guardrails on the OpenAI call.

---

## F-07: `status` field casing is inconsistent across catalog entries

**Symptom:** Some entries have `"status": "Production"` (capital P), others
`"production"` (lowercase).  A case-sensitive filter would miss the capitalised ones.

**Root cause:** Catalog data quality issue observed in the provided `catalog.json`.

**Fix:** The LLM naturally normalises these.  For programmatic filters, always
apply `.toLowerCase()` before comparing status values.
