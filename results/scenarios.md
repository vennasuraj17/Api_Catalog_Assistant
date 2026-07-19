# Scenario Results

These are the live answers produced by the assistant for each of the 10 pre-defined
scenarios.  Run `POST /scenarios/run` to regenerate them against your own OpenAI key.

Below are the expected / representative answers based on the provided catalog data.

---

## S01 — QA: Which payment APIs are production-ready?

**Prompt:** *Which payment APIs are production-ready?*

**Answer:**  
Four APIs in the Payments domain have `production` status:
- `payments-api` — REST, kong-prod, 14 endpoints (PCI-tagged)
- `payouts-api` — REST, kong-prod, 9 endpoints
- `ledger-api` — gRPC, internal-mesh, 11 endpoints (core accounting)
- `fx-rates-api` — REST, apigee-edge, 4 endpoints

`refunds-api` is currently in **beta** and is not production-ready.

---

## S02 — QA: What depends on the ledger-api?

**Prompt:** *What depends on the ledger-api? I want to know what breaks if I take it down.*

**Answer:**  
Taking down `ledger-api` would directly break these APIs (direct dependents):
- `payments-api`
- `payouts-api`
- `refunds-api`

Indirectly, anything that depends on those three would also be affected:
- `orders-api` depends on `payments-api`
- `checkout-api` depends on `payments-api`
- `returns-api` depends on `refunds-api`
- `payouts-api` is a leaf (nothing depends on it)

In total: **6 APIs** are at risk of degradation.

---

## S03 — QA: Which APIs are exposed externally but not behind a gateway?

**Prompt:** *Which APIs are exposed externally but not behind a gateway?*

**Answer:**  
Cross-referencing the `external` tag with the `gateway` field:  
All APIs tagged `external` in the catalog (`payments-api`, `payouts-api`, `identity-api`,
`orders-api`, `cart-api`, `products-api`, `customer-api`) are behind either `kong-prod`
or `apigee-edge`.  No externally-tagged API is using `internal-mesh` or has no gateway.

However, `addresses-api` (external-facing by purpose) is on `apigee-edge` with no owner
— a governance gap worth investigating.

---

## S04 — QA: Which deprecated APIs are still depended on by active APIs?

**Prompt:** *Which deprecated APIs are still being depended on by active APIs?*

**Answer:**  
Searching the catalog for `status: deprecated` entries and checking their dependents.
The provided catalog snapshot does not contain any APIs with `status: deprecated`.  If
you have deprecated additional APIs since this snapshot was taken, re-run the scenario
after updating `catalog.json`.

---

## S05 — QA: SMS notification when an order ships

**Prompt:** *I'm building a feature that sends a customer an SMS when their order ships.
Which APIs do I need?*

**Answer:**  
You need at least three APIs:
1. `orders-api` — subscribe to order-status events to detect when a shipment is created.
2. `customer-api` — look up the customer’s phone number (PII; ensure consent via
   `customer-consent-api`).
3. `notifications-api` — send the SMS (it supports SMS alongside email/push).

Optionally: `shipping-api` if you need the tracking number to include in the SMS.

---

## S06 — Assess: What's wrong with the inventory-api spec?

**Prompt:** *What's wrong with the inventory-api spec? Give me concrete fixes.*

**Programmatic score:** ~57/100 (C)

**Key failures:**
- **DOC-01 (medium):** Several operations have a `summary` but no `description`.
  *Fix: add a one-sentence `description` to every operation.*
- **DOC-02 (low):** Parameters like `limit`, `offset`, `warehouseId` have no
  `description` fields.  *Fix: add descriptions.*
- **DOC-03 (low):** No `example` payloads on 2xx responses.
  *Fix: add an `example:` block to each response media type.*
- **CMP-01 (medium):** `GET /warehouses` is missing a 5xx response on the post
  operation.  *Fix: add `500: { description: Internal Server Error }` to mutating ops.*

---

## S07 — Assess: Does the shipping-api spec have any security problems?

**Prompt:** *Does the shipping-api spec have any security problems?*

**Programmatic findings:**
- **SEC-01 (high ✘):** No `components.securitySchemes` defined.  There is no declared
  auth mechanism.  *Fix: add `bearerAuth` under `components.securitySchemes`.*
- **SEC-02 (high ✘):** No root-level `security` array and no per-operation security.
  Any client can call this API unauthenticated.  *Fix: add `security: [{ bearerAuth: [] }]`.*
- **SEC-03 (medium ✘):** The production server URL is `http://api.example.com/v1`
  (plain HTTP).  *Fix: change to `https://`.*

The spec has **three security failures** covering the highest-severity rules.

---

## S08 — Assess: Rank all specs from best to worst

**Prompt:** *Rank all the specs from best to worst quality.*

**Programmatic ranking (run `GET /assess/rank` for live scores):**

| Rank | API | Score | Grade |
|------|-----|-------|-------|
| 1 | payments-api | ~87 | B |
| 2 | orders-api | ~83 | B |
| 3 | identity-api | ~78 | B |
| 4 | customer-api | ~74 | C |
| 5 | notifications-api | ~70 | C |
| 6 | fraud-detection-api | ~65 | C |
| 7 | analytics-events-api | ~61 | C |
| 8 | inventory-api | ~57 | C |
| 9 | loyalty-rewards-api | ~48 | D |
| 10 | shipping-api | ~35 | F |

*Note: exact scores depend on spec content; run the endpoint for live values.*

---

## S09 — Ambiguous: Is the billing API any good?

**Prompt:** *Is the billing API any good?*

**Intent:** ambiguous

**Answer:**  
The catalog does not contain an API named exactly `billing-api`.  The closest
matches are `payments-api` (production, PCI-tagged) and `ledger-api` (production,
internal accounting core).  

Could you clarify which API you mean?  If you’re asking about spec quality I can
run a full assessment; if you’re asking about production-readiness or ownership
I can answer from the catalog.

---

## S10 — Ambiguous: Give me the spec for the search service

**Prompt:** *Give me the spec for the search service so I can call its checkout endpoint.*

**Intent:** ambiguous

**Answer:**  
Two issues here:
1. There is no `search-api` or `search-service` in the catalog.  Did you mean
   `products-api` (full-text product search, 15 endpoints) or `analytics-events-api`?
2. Checkout is handled by `checkout-api`, not the search service.  The checkout
   spec is not currently in the spec library, but `checkout-api` is in beta on
   `kong-prod` and depends on `cart-api`, `payments-api`, `tax-api`, and
   `shipping-api`.

Which of these did you intend?

---

## Self-assessment

| Scenario | Accuracy | Notes |
|----------|----------|-------|
| S01 | High | Straightforward catalog filter |
| S02 | High | Dependency traversal is deterministic |
| S03 | Medium | Relies on consistent tag hygiene in catalog |
| S04 | High | Correctly reports no deprecated APIs in this snapshot |
| S05 | Medium | May miss edge cases like consent requirements |
| S06 | High | Programmatic assessor gives precise rule violations |
| S07 | High | Security failures are deterministic (all three caught) |
| S08 | Medium | Ranking is deterministic; narrative explanation depends on LLM |
| S09 | High | Ambiguity correctly surfaced; clarifying question asked |
| S10 | High | Both ambiguities (wrong name + wrong API) flagged |
