# Decision Log

What we built, the alternatives considered, and why we made each choice.

---

## 1. Framework — Fastify over Express / Hono

**Choice:** Fastify v5  
**Alternatives:** Express 4, Hono, raw `http`

Fastify ships with JSON Schema body validation, TypeScript-first types, and a plugin
system that keeps routes isolated.  Express is ubiquitous but requires extra packages
for validation and has looser typing.  Hono is excellent but its ecosystem is smaller;
we may need Fastify-specific plugins (rate limiting, multipart) later.

---

## 2. LLM — OpenAI GPT-4o-mini

**Choice:** `gpt-4o-mini` via the official `openai` Node SDK  
**Alternatives:** `gpt-4o`, Anthropic Claude 3.5 Haiku, local Ollama (Llama 3)

`gpt-4o-mini` hits the sweet spot of accuracy vs cost for catalog Q&A.  The catalog
is factual, low-ambiguity text; we don't need a frontier model.  A local model would
eliminate cost and latency concerns but requires significant infrastructure for a
take-home project.  The model is configurable via `OPENAI_MODEL` env var so callers
can upgrade without code changes.

---

## 3. Retrieval strategy — full catalog in context (no vector search)

**Choice:** Serialise all 60 APIs into the prompt (~3 KB)  
**Alternatives:** Embed APIs, store in pgvector / Pinecone, retrieve top-k at query time

At 60 APIs the catalog fits in ~3 KB — well inside the 128 K token window of GPT-4o-mini.
Vector search adds infra, a second I/O hop, and chunking complexity for marginal gain
at this scale.  The scaling plan (docs/scaling-plan.md) covers when to switch.

---

## 4. Spec assessment — programmatic rules + LLM narrative

**Choice:** Deterministic TypeScript checks for scoring; LLM for human-readable suggestions  
**Alternatives:** LLM-only assessment, spectral/vacuum rule engine, JSON Schema linting

Programmatic rules give reproducible, auditable scores.  We can unit-test them, and
they don't burn tokens.  The LLM layer converts the structured pass/fail output into
plain-English suggestions that are actionable by a developer.  A dedicated linter like
Spectral could replace the programmatic rules in production but adds another dependency.

---

## 5. YAML parsing — js-yaml

**Choice:** `js-yaml` v4  
**Alternatives:** `yaml` (eemeli), manual regex

`js-yaml` is the most widely used OpenAPI YAML parser in the Node.js ecosystem, with
mature handling of anchors, multi-document files, and complex types.  `yaml` (eemeli)
is equally capable; either works.  We chose `js-yaml` for familiarity and the large
body of Stack Overflow answers around OpenAPI parsing issues.

---

## 6. Module system — ESM (`"type": "module"`)

**Choice:** Native ES modules  
**Alternatives:** CommonJS, esbuild bundle

The starter `package.json` already set `"type": "module"`.  ESM is the direction of
the Node.js ecosystem; keeping it avoids introducing a second module format.  `tsx`
handles the TypeScript → JS transpilation at runtime without a build step, keeping
the developer loop fast.

---

## 7. Ambiguity handling — detect via LLM reply patterns

**Choice:** Regex on the LLM's reply to detect clarifying-question signals  
**Alternatives:** Explicit intent-classification call before answering, structured output

Adding a separate classification call doubles latency for every request.  Instead, we
prompt the LLM to surface ambiguity naturally and then inspect the reply for phrases
like "could you clarify" or "did you mean".  This is sufficient for the 10 demo
scenarios; a production system would use structured output (`response_format: json_schema`)
for a stricter contract.
