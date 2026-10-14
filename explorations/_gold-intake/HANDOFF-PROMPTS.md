# Gold-Intake — Plan-Mode Handoff Prompts

_Generated 2026-06-30 from the 13 gold-intake exploration packets + 9 folded goal research notes._
Provenance matrix: [`ROUTING.md`](./ROUTING.md) / [`routing.json`](./routing.json) (219/219 nuggets, user-approved). Runbook: [`HANDOFF.md`](./HANDOFF.md).

## How to use

Each block below is a **complete, self-contained prompt**. To advance a packet:

1. Open a fresh Claude Code (or Codex) session at the repo root.
2. **Enter plan mode.**
3. Copy **one** ```` ```markdown ```` block and paste it verbatim.
4. Approve the plan it produces; it executes the named pipeline step and stops at the named gate.

Prompts are ordered by readiness. Each names only the skills that actually apply, the real files to read first, the concrete next step + stop gate, and the binding constraints (non-invasive · capability-cited · ground-truth · codex gate · close-the-loop).

## Index

| # | Packet | Type | Wave | Next step |
|---|--------|------|------|-----------|
| 1 | `gov-legal-data-driver-codegen` | execute-goal | P1 | P0: repair @beep/govinfo manifest, add hand-authored Govinfo.service.ts/Govinfo.config.ts, incubate the transformer via HttpApiClient.make transformClient; prove offline. |
| 2 | `uspto-patent-driver-depth` | align-graduate | P1 | Run /grill-with-docs to close all 7 open DECISIONS one at a time, then advance shape -> decompose -> graduate. |
| 3 | `mcp-auth-gated-registration` | align-graduate | P1 | Run /grill-with-docs to close the 7 open DECISIONS, then shape -> decompose -> graduate. |
| 4 | `citation-grounding-hallucination-guard` | align-graduate | P1 | Run /grill-with-docs to close Q1–Q7, then advance research → align → shape → decompose → graduate. |
| 5 | `effect-orchestration-patterns` | resume-align | P2 | Run /grill-with-docs to close the 7 open DECISIONS forks, then advance research -> shape (BRIEF.md). |
| 6 | `agent-memory-tiers-bitemporal-edges` | resume-align | P2 | Run /grill-with-docs to close Q1-Q7 one at a time, then advance the packet to shape (BRIEF.md). |
| 7 | `deterministic-doc-structure-extraction` | resume-align | P2 | Run /grill-with-docs to resolve Q1-Q8 one fork at a time, then advance to shape (BRIEF.md). |
| 8 | `court-vocabulary-resolver` | resume-align | P2 | Run /grill-with-docs to close Q1–Q7, then advance research → shape (BRIEF.md). |
| 9 | `ingestion-security-secret-governance` | resume-align | P2 | Drive align via /grill-with-docs: close Q1-Q8 one at a time, recommended-answer-first, then advance to shape (BRIEF.md). |
| 10 | `multi-provider-llm-dispatch-fallback` | resume-align | P2 | Run /grill-with-docs to resolve Q1-Q7 one at a time, log each resolution, then advance research -> align -> shape (BRIEF.md). |
| 11 | `rag-retrieval-projection` | resume-align | P2 | Run /grill-with-docs to resolve Q1-Q7, then advance research -> shape (BRIEF.md). |
| 12 | `secure-document-download-proxy` | resume-align | P3 | Run /grill-with-docs to resolve the 8 open DECISIONS one at a time, then advance to shape (BRIEF.md). |
| 13 | `local-first-projection-sync` | resume-align | P3 | Resume align via /grill-with-docs: close DECISIONS Q1-Q7 one at a time, then advance to shape (BRIEF.md). |
| 14 | `file-processing-capability` | fold-note | P2 | Verify the folded note + close-the-loop bookkeeping; integrate only when the deferred OCR phase is scheduled. |
| 15 | `langextract-capability` | fold-note | P2 | During P4 Implement, fold the folded note's prompt-mode + scoring + chunking patterns into the Extraction and Alignment modules as schema-first inputs. |
| 16 | `law-practice-office-action-spike` | fold-note | P2 | When the law-practice slice deepens past the one-fixture spike, open a fresh goal/exploration (Case C) to land the deferred IP-domain entities — do not edit this completed SPEC. |
| 17 | `law-practice-office-action-extraction-rung` | fold-note | P2 | Open a successor persistence-rung exploration (document×column grid) that depends on this completed packet; do not amend this SPEC. |
| 18 | `ip-law-knowledge-graph` | fold-note | P2 | Goal owner reads the folded note and acts on it during P0 (S7 grounding) / P1 (ClassificationCode + CLASSIFIED_AS schema); no SPEC edit. |
| 19 | `agent-governance-control-plane` | fold-note | P2 | Owner decides the integration path (preferred: downstream consumer overlay over @beep/epistemic + @beep/observability) before any code lands. |
| 20 | `epistemic-claim-lifecycle-gate` | fold-note | P2 | Decide the downstream home for the additive net-new and draft a fresh goal/exploration packet; do not touch the shipped gate. |
| 21 | `workspace-thread-domain` | fold-note | P2 | Owner reviews the folded note and decides: land branchIndex as a tiny additive follow-up PR, or open a fresh extend packet. |
| 22 | `agentic-professional-runtime` | fold-note | P2 | Owner triages the 5 recommended-integration items in the folded note into PLAN backlog/phases without amending SPEC. |

---

## 1 · Wave-1 — Execute now (graduated goal)

Already through capture→research→align→shape→decompose→graduate. This one is execution-ready.

### `gov-legal-data-driver-codegen`

**Type:** execute-goal · **Wave:** P1 · **Stage:** P0 (govinfo-finish + transformer-incubate) — pending, not started

**Skills:** `/goal follow the instructions in goals/gov-legal-data-driver-codegen/GOAL.md` · `effect-services` · `onepassword-secret-refs` · `repo-symbol-discovery` · `yeet`

**Next:** P0: repair @beep/govinfo manifest, add hand-authored Govinfo.service.ts/Govinfo.config.ts, incubate the transformer via HttpApiClient.make transformClient; prove offline.

````markdown
# Handoff: gov-legal-data-driver-codegen  (execute-goal | Wave P1 | stage P0)

You are resuming the `gov-legal-data-driver-codegen` GOAL packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It already graduated and is execute-ready: stand up the gov/legal driver **substrate** — a tiered OpenAPI→Effect-Schema codegen path plus one shared hand-authored auth/retry/cache/rate-limit transport transformer — and prove it on two verticals: finish `@beep/govinfo` (keyed) and build one keyless driver (eCFR or FedReg). This session executes; it does not re-plan.

## Read first (ground-truth before acting)
- `goals/gov-legal-data-driver-codegen/GOAL.md` - compact `/goal` launcher + acceptance/stop conditions.
- `goals/gov-legal-data-driver-codegen/SPEC.md` - NORMATIVE contract: AC#1–AC#9, Verification Matrix, Q1–Q8 Decision Log, three auth families.
- `goals/gov-legal-data-driver-codegen/PLAN.md` - phases P0–P3 and exit criteria (P2 is GATED).
- `goals/gov-legal-data-driver-codegen/ops/manifest.json` - phase statuses (all `pending`) + `currentSourceOfTruth`.
- `packages/drivers/govinfo/src` (has `domain/` + `index.ts` — Search contract + value models EXIST; finish, do not restart).
- `packages/drivers/runpod/src` - precedent split: `_generated/` vs `Runpod.service.ts` / `Runpod.config.ts` + `generate.ts`. Also read `packages/drivers/acp/AGENTS.md` for offline-build law.
- `standards/architecture/07-non-slice-families.md` - the ≥2-consumer promotion gate.
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route/primaryTarget/cautions) for provenance.

## Skills to invoke
- `/goal follow the instructions in goals/gov-legal-data-driver-codegen/GOAL.md` - the execution launcher; read GOAL.md, then `AGENTS.md` + `CLAUDE.md`, then act.
- `repo-symbol-discovery` - before inventing any transformer/schema helper, cite govinfo's existing value models + runpod's generated/service/config split and reuse.
- `effect-services` - hand-author transport (Context.Service, Layer, `HttpApiClient.make` `transformClient`, `HttpClient.mapRequest`/`withRateLimiter`/`retryTransient`, `Cache.makeWith`) on `effect@4.0.0-beta.91`.
- `onepassword-secret-refs` - `Config.redacted("GOVINFO_API_KEY")` per-driver secret; absent key ⇒ omit auth gracefully, never log raw keys.
- `yeet` - at P3 closeout for repair/verify/publish.

## Task this session
Execute **P0**: repair `@beep/govinfo` manifest (add `@beep/identity` + `@beep/schema`); add hand-authored `Govinfo.service.ts` / `Govinfo.config.ts` (client/config/auth/retry/cache/rate-limit) over the existing `Search` contract + value models; **incubate the shared transformer inside govinfo** via `HttpApiClient.make`'s `transformClient`; api.data.gov `api_key` query-param auth via `Config.redacted`. STOP at the P0 exit gate: a recorded-response / fake-`HttpClient` test proves `X-RateLimit-*` parsing + limiter-state update + cache-hit-on-repeat (transport call-count == 1) **without live credentials**, and `bun run check --filter @beep/govinfo` is green offline. Do not begin P1/P2 in this session unless P0 is fully proven and you explicitly hand off.

## Constraints (binding)
- **Re-resolve every target against the live tree** (the gold catalog hints are stale). The user works in this same git tree — never revert unexplained out-of-scope working-tree changes; surface them.
- **Hand-authored transport boundary (Q2 / AC#5):** codegen emits ONLY Schema value models + operation descriptors into `src/_generated/*`; NO auth/retry/cache/rate-limit/`Context.Service`, no `transformClient`/`mapRequest` symbols there. Add `"./_generated/*": null` export.
- **Offline-build law (acp):** download is codegen-only; committed spec + `_generated/` make build/check network-free.
- **NO Orval/axios/Zod; do NOT vendor MPL-2.0 `fortanix/openapi-to-effect`.** Port the donor pattern only. Pin `effect` + `@effect/openapi-generator` at `4.0.0-beta.91`.
- **P2 (CourtListener + DOL) is DEFAULT-DENY** until a per-upstream data/source-terms matrix file exists (Q8): no committed CL/DOL fixtures, no persistent CL cache, no enabled CL/DOL exports. Token-header + `X-API-KEY` branches are designed-into the transformer but not exercised in P0–P1.
- **Transformer promotion is a P3 step** to `foundation/capability/<name>`, gated on ≥2 named importers (the `07-non-slice-families` rule) — incubate inside govinfo now; no `drivers/_shared`.
- **Close the loop:** at end of session update `ops/manifest.json` phase status, the packet `README.md` (Current Phase / Latest Evidence), and report evidence per the Verification Matrix. Reflection + `bun run beep lint reflection-artifacts` are required only at P3 Close.

## Done when
- govinfo manifest declares `@beep/identity` + `@beep/schema`; `Govinfo.service.ts` / `Govinfo.config.ts` exist with the incubated `transformClient` transformer; the offline recorded/fake-`HttpClient` test proves rate-limit parse + limiter update + cache hit (call-count == 1); `bun run check --filter @beep/govinfo` passes offline; `git diff --check -- goals/gov-legal-data-driver-codegen` clean; manifest P0 + README updated; no out-of-scope churn.
````


---

## 2 · Wave-1 — Align → graduate

Research-complete with codex gate-1 folded and a pre-drafted `DECISIONS.md`. Each needs an interactive `/grill-with-docs` to close its open decisions, then shape → decompose → graduate into a `goals/` packet (codex gate-2 on the SPEC).

### `uspto-patent-driver-depth`

**Type:** align-graduate · **Wave:** P1 · **Stage:** research

**Skills:** `/grill-with-docs uspto-patent-driver-depth` · `/explore uspto-patent-driver-depth` · `repo-symbol-discovery` · `onepassword-secret-refs`

**Next:** Run /grill-with-docs to close all 7 open DECISIONS one at a time, then advance shape -> decompose -> graduate.

````markdown
# Handoff: uspto-patent-driver-depth  (align-graduate | Wave P1 | stage research)

You are resuming the `uspto-patent-driver-depth` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). Mission: align and graduate an **in-place `@beep/uspto` depth goal** — a Lucene/ODP query-DSL surface (injection-safe escaping, friendly→API field map, confidence-scored identifier disambiguation), prosecution/status/document vocabularies, deeper endpoints, and a 403→source-PDF fallback — extend the existing driver, never restart it, **ODP only, never PatentsView**.

## Read first (ground-truth before acting)
- `explorations/uspto-patent-driver-depth/DECISIONS.md` - the 7 branch-closing questions, each with a RECOMMENDED answer and `Status: open`.
- `explorations/uspto-patent-driver-depth/RESEARCH.md` - read BOTH synthesis and the Unresolved/Constraints sections (locked decisions, auth/secret/offline boundaries, vocab-ownership boundary).
- `explorations/uspto-patent-driver-depth/reviews/2026-06-29-codex-research.md` - the folded gate-1 critique (3 blocking + 5 advisory) that the DECISIONS encode.
- `explorations/uspto-patent-driver-depth/CAPTURE.md` + `ops/manifest.json` - raw dump + machine state (stage, openQuestions).
- `packages/drivers/uspto/src/Uspto.service.ts` (+ `Uspto.config.ts`, `.models.ts`, `.errors.ts`) - the 5 hand-rolled files you extend in place; re-resolve all targets against the live tree (gold hints are STALE).
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route: mixed → EXTEND `packages/drivers/uspto`; cautions) for provenance.

## Skills to invoke
- `/grill-with-docs uspto-patent-driver-depth` - close ONE open DECISIONS question at a time, recommended answer first; this is the align driver.
- `/explore uspto-patent-driver-depth` - resume the pipeline (shape → decompose → graduate) once DECISIONS are resolved.
- `repo-symbol-discovery` - capability-cited reuse before inventing: confirm `assertAllowedRemoteUrl` (`@beep/schema`), `@beep/schema/Xml` + `fast-xml-parser`, `ClaimLifecycle`, `@beep/law-practice-domain`, runpod `_generated/*: null` precedent.
- `onepassword-secret-refs` - `op://` secret governance for the (follow-on) EPO/GCP/SerpApi credentialed tiers; missing Redacted secret → `Layer` fails fast / MCP toolkit → `Layer.empty`.

## Task this session
Drive `/grill-with-docs` to resolve every open DECISIONS branch, fold answers back into DECISIONS.md (Status: open → resolved log entry). Then advance the pipeline: shape (BRIEF.md), decompose (MAP.md), graduate the in-place depth goal. **STOP and await human sign-off after each DECISIONS resolution**, and STOP before graduating until BRIEF + MAP match the picture. Open questions to close, verbatim:
- Q1: Driver-wave scope — in-place `@beep/uspto` depth only, or fan out to net-new sibling drivers in this packet?
- Q2: First vertical slice — what is the smallest end-to-end proof that graduates first?
- Q3: `searchStructured` (POST structured body) — ship it in this packet, or keep it behind a spike?
- Q4: Status-code vocabulary — versioned generated artifact, or runtime `/status-codes` cache?
- Q5: Package placement — where do net-new drivers and the prosecution-phase overlay live?
- Q6: Source/consent matrix — how is the privilege-safe boundary encoded across all sources?
- Q7: MCP credential gating — which registration shape, and do we depend on `mcp-auth-gated-registration`?

## Constraints (binding)
- NON-INVASIVE: extend `packages/drivers/uspto` in place (zero restart, zero new package for the first slice). Net-new `epo`/`google-patents-bigquery`/`google-patents` drivers split into **separate follow-on goal packets**, not this one.
- Q7 depends on the **active** `explorations/mcp-auth-gated-registration` packet (verified present) — import its Shapes A/B/C + `api_key_required` helper; do NOT re-derive. `Layer.unwrapEffect`/`Layer.orElse` are NOT Effect v4 APIs — use `Layer.unwrap`/`Layer.catch` + a `reduce`-fold over `Array<Layer>`; land a dtslint spike first.
- Capability-cited reuse: own native USPTO vocab as faithfully-decoded data in `Uspto.vocab.ts`; opinionated overlays (litigation tiers, NEW `ProsecutionPhase`/`PatentAssetStatus`, OA→rejection) live in `@beep/law-practice-domain`. Do NOT overload shared-kernel `ClaimLifecycle`. Reuse `@beep/schema/Xml`, do NOT add a parser. Port EPO logic from Apache-2.0 `ip-tools/python-epo-ops-client`.
- Privilege/consent (Q6): ODP and ppubs free-text searches transmit query text externally — NOT privilege-safe by default; require matter-level consent; structural gate (missing `op://` secret → `Layer.empty`), never a runtime flag. Status-code vocab is a versioned generated artifact (225 codes, checksum); do NOT port the corrupted MCP status maps.
- searchStructured POST stays behind a documented spike until a real-browser Swagger/key-auth probe confirms `applications/search` accepts the structured body; GET `searchApplications?q=` remains the compatibility path.
- CLOSE-THE-LOOP: update `ops/manifest.json` stage, README Trail/Next-Open-Question, and `explorations/ATLAS.md` (single-writer). Re-resolve every target against the live filesystem; surface (never revert) unexplained out-of-scope working-tree changes.

## Done when
- All 7 DECISIONS carry a resolved log entry (or explicit deferral) with human sign-off, `ops/manifest.json` openQuestions drained, README Trail + Next-Open-Question + ATLAS updated, and the packet is shaped/decomposed ready to graduate the in-place depth goal — STOPPING before any `packages/**` execution.
````


### `mcp-auth-gated-registration`

**Type:** align-graduate · **Wave:** P1 · **Stage:** research

**Skills:** `/explore mcp-auth-gated-registration` · `/grill-with-docs mcp-auth-gated-registration` · `repo-symbol-discovery` · `effect-v4-imports`

**Next:** Run /grill-with-docs to close the 7 open DECISIONS, then shape -> decompose -> graduate.

````markdown
# Handoff: mcp-auth-gated-registration  (align-graduate | Wave P1 | stage research)

You are resuming the `mcp-auth-gated-registration` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It layers reusable *patterns* — credential-keyed conditional `Toolkit` composition, tier-gating write-vs-read tools, a structured `api_key_required` helper, and progressive-disclosure field tiers — onto beep's two existing Effect MCP servers, NOT a third server.

## Read first (ground-truth before acting)
- `explorations/mcp-auth-gated-registration/DECISIONS.md` - the 7 pre-drafted, still-OPEN align questions (recommendation + rationale each); your work this session.
- `explorations/mcp-auth-gated-registration/RESEARCH.md` - cited prior art + in-repo substrate; read the synthesis AND the per-theme `research/*.md` it links (effect v4 `Tool`/`Toolkit`/`McpServer` ground truth lives in `node_modules/effect/src/ai/`).
- `explorations/mcp-auth-gated-registration/CAPTURE.md` - 28 nuggets, netNew build list (#1-#5), alreadyCovered (do NOT re-scaffold), cautions (PatentsView sunset, licensing).
- `explorations/mcp-auth-gated-registration/ops/manifest.json` - stage `research`, `openQuestions`, links.
- `packages/drivers/nlp-mcp`, `packages/drivers/m365-mcp`, `packages/drivers/uspto` - the live hosts/driver to compose against (`@beep/uspto` is the Shape C `apiKey: Option<Redacted>` precedent).
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route=`new-exploration`, cautions) for provenance.

## Skills to invoke
- `/explore mcp-auth-gated-registration` - drive/resume the pipeline; closes the loop (manifest, README Trail, ATLAS).
- `/grill-with-docs mcp-auth-gated-registration` - the align engine: close ONE branch-closing question at a time, recommended answer first.
- `repo-symbol-discovery` - capability-cited reuse: verify `ClaimGate` (`@beep/epistemic-use-cases`), `UsageRecord` (`@beep/epistemic-tables`), `Config.redacted`/`Config.option`, and the `nlp-mcp` `Layer.mergeAll` seam before inventing.
- `effect-v4-imports` - v4 `Layer.unwrap`/`Layer.catch` dynamic layer folding + `effect/ai` import hygiene for the conditional-composition spike.

## Task this session
Run align: close the 7 open DECISIONS questions in order via `/grill-with-docs`, folding each resolution back into `DECISIONS.md` (Status: decided) and syncing manifest `openQuestions`. Then advance shape (`BRIEF.md`) -> decompose (`MAP.md`) -> graduate. STOP after the codex spec-gate folds back, before writing any product code. Open questions to close, verbatim:
- Q1: Patterns-only kit vs also building the gov-legal MCP host and drivers?
- Q2: New dedicated gov-legal/USPTO MCP package (reusing the seam) vs extending NLP/M365?
- Q3: Native `effect/ai` vs wrap a third-party MCP framework?
- Q4: Where the kit lives — new `@beep/mcp-kit` driver package vs `foundation/capability` vs inline?
- Q5: Per-source auth model (`gate none|soft|hard`) + tool-vanish (build-time) vs graceful-degrade (call-time)?
- Q6: `api_key_required` wire channel — success-with-error-JSON vs `tools/call` `isError:true` wrapper?
- Q7: Where the write-tool wall is enforced + how a gated call is audited (`Activity` vs `UsageRecord.metadata`)?

## Constraints (binding)
- NON-INVASIVE: do not edit `goals/nlp-adjunct-port`, `goals/m365-mcp`, or the `explorations/uspto-patent-driver-depth` / `explorations/gov-legal-data-driver-codegen` siblings; cross-link, never absorb. This packet is patterns-only per CAPTURE.
- CAPABILITY-CITED BEFORE INVENTING: compose existing bricks — the `nlp-mcp`/`m365-mcp` `Toolkit`+`layerStdio` scaffold, `@beep/uspto` Shape C, `ClaimGate` refusal-as-value, `UsageRecord` — confirmed via `repo-symbol-discovery`/`rg` before any net-new helper.
- GROUND-TRUTH at action time: the gold `finalBeepTarget` hint is STALE; re-resolve every path against the live tree. The user edits this same git tree in parallel — surface unexplained out-of-scope changes, never revert them.
- v4 substrate: build native to `effect@4.0.0-beta.91` `effect/ai`; the bundled `McpServer` speaks MCP `2025-06-18` (not `2025-11-25`) — any newer-spec reliance needs an effect-upgrade+reverify task first.
- Secrets are `op://` refs via `onepassword-secret-refs`; model auth off the optional-secret class (`Config.redacted(...).pipe(Config.option)`) — a missing key makes the host Layer fail-fast or the tool degrade, never a committed key.
- CLOSE THE LOOP: update `ops/manifest.json` (stage/openQuestions/updated), README Trail + Next-Open-Question, and `explorations/ATLAS.md` (single-writer) every session.
- Codex spec-gate via `codex:codex-rescue` after `SPEC.md`; fold critique before graduating.

## Done when
- All 7 DECISIONS carry a `decided` Status with logged rationale and manifest `openQuestions` is synced; `BRIEF.md` + `MAP.md` exist with every component capability-cited or marked `NET-NEW`; codex spec-gate folded; loop closed (manifest, README, ATLAS). No product code written.
````


### `citation-grounding-hallucination-guard`

**Type:** align-graduate · **Wave:** P1 · **Stage:** research

**Skills:** `/grill-with-docs citation-grounding-hallucination-guard` · `/explore citation-grounding-hallucination-guard` · `repo-symbol-discovery` · `schema-model-specialist`

**Next:** Run /grill-with-docs to close Q1–Q7, then advance research → align → shape → decompose → graduate.

````markdown
# Handoff: citation-grounding-hallucination-guard  (align-graduate | Wave P1 | stage research)

You are resuming the `citation-grounding-hallucination-guard` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). Mission: align then graduate the ground-before-cite / verbatim-citation guard — a legal/IP citation parser that emits exact char spans plus a verbatim-equality gate so the runtime may only *verify* a supplied cite, never *author* one from memory.

## Read first (ground-truth before acting)
- `explorations/citation-grounding-hallucination-guard/ops/manifest.json` - machine state: stage=`research`, status=`active`, the 7 `openQuestions`.
- `explorations/citation-grounding-hallucination-guard/DECISIONS.md` - the 7 pre-drafted Q blocks (recommended answer + rationale, all `Status: open`).
- `explorations/citation-grounding-hallucination-guard/RESEARCH.md` - synthesis + Genuine-gaps (netNew #1 parser, #2 persisted 5-state resolution) + Unresolved/Constraints; read both halves.
- `explorations/citation-grounding-hallucination-guard/CAPTURE.md` - raw spark (stage 0).
- `explorations/citation-grounding-hallucination-guard/reviews/2026-06-29-codex-research.md` - codex gate-1 critique already folded.
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route=`new-exploration`, cautions) for provenance.

## Skills to invoke
- `/grill-with-docs citation-grounding-hallucination-guard` - close one branch-closing DECISIONS question at a time, recommended-answer-first; log each resolution and sync manifest `openQuestions`.
- `/explore citation-grounding-hallucination-guard` - drive stage transitions research → align → shape (BRIEF) → decompose (MAP) → graduate.
- `repo-symbol-discovery` - capability-cited reuse: confirm the compose targets below still exist/exported before any MAP `NET-NEW`.
- `schema-model-specialist` - for the LiteralKit/tagged-union shapes in Q6 (`CitationResolution`) and the verified-`TextAnchor` constructor in Q3/Q7.

## Task this session
Resolve `Q1`–`Q7` in `DECISIONS.md` via `/grill-with-docs`, one at a time, recommended answer first (start with Q2 scope boundary — it conditions the rest). Then advance the packet: research → align → shape (`BRIEF.md`) → decompose (`MAP.md`) → graduate into `goals/`. STOP at each codex gate (spec gate after any SPEC) and STOP for user sign-off before graduating. Open questions to close, verbatim:
- Q1: Build-vs-buy — clean-room TS/Effect reimpl of the eyecite parser vs vendored `eyecite-js` port vs hosted CourtListener lookup as engine?
- Q2: Scope boundary — full guard vs grounding core + compose/defer the rest?
- Q3: First slice — which thin vertical proves the substrate end-to-end first?
- Q4: Vendor/auth — depend on hosted CourtListener Citation Lookup in v1, or local-only?
- Q5: Package placement — parser, guard/straddle, lifecycle, matter-scoped evidence model homes?
- Q6: Lifecycle modeling — one citation status type, or two (persisted resolution vs transient lookup)?
- Q7: Verbatim strictness — how strict is the "match" that lets a citation through the gate?

## Constraints (binding)
- NON-INVASIVE: do not edit the completed-retained epistemic/shared SPECs in place. The locked epistemic non-goal keeps citation/IP-law vocab OUT of the epistemic/shared slice; this packet is a downstream *consumer* composing `goals/epistemic-claim-lifecycle-gate` (`EvidenceSpan`, `ClaimGateResult`, `ClaimLifecycle` patterns) and `goals/provenance-shared-claim-kernel` (`TextAnchor`) via public surface — never by forking.
- CAPABILITY-CITED BEFORE INVENTING: re-resolve every target against the LIVE tree at action time (gold `finalBeepTarget` hints are stale). Confirmed compose bricks to verify: `packages/foundation/capability/langextract` (`Alignment`/`lowerWithSourceOffsets`), `packages/drivers/courtlistener` (skeleton, MIT, for Q4's hosted lane only), `packages/law-practice/domain` (existing IP entities). Sibling exploration `explorations/rag-retrieval-projection` exists — coordinate, don't absorb.
- SECRET/PRIVILEGE GATE: v1 is local-only on the privilege-safe path; the hosted CourtListener lookup leaks document text off-box and is an opt-in non-privileged lane only. Its token is a managed `op://` secret via `onepassword-secret-refs` (`Authorization: Token <token>`, literal Token NOT Bearer), a missing Redacted secret must fail the Layer fast. NO Orval/axios/Zod — codegen precedent is `packages/drivers/runpod`.
- ReDoS: eyecite-class regexes carry no worst-case guarantee on untrusted document text (OWASP LLM01) — any parser regex runs behind an `Effect` timeout/interrupt or RE2.
- CLOSE THE LOOP every session: update `ops/manifest.json` (stage/openQuestions/updated), the README Next-Open-Question + Trail line, and `explorations/ATLAS.md` (single-writer) on any stage/status change.

## Done when
- Each resolved Q has its resolution + rationale logged in `DECISIONS.md` with `Status` flipped from `open`, and `manifest.json` `openQuestions` shrunk to match; loop closed (manifest + README + ATLAS) and stopped at the next gate (further-grilling, shape sign-off, or codex spec gate) with the next step named.
````


---

## 3 · Wave-2/3 — Resume → align

Research-complete and queued. Resume with `/explore`, then `/grill-with-docs` when you promote one to align. Two singletons (`secure-document-download-proxy`, `local-first-projection-sync`) carry an attach-vs-standalone decision deferred to their `DECISIONS.md`.

### `effect-orchestration-patterns`

**Type:** resume-align · **Wave:** P2 · **Stage:** research

**Skills:** `/explore effect-orchestration-patterns` · `/grill-with-docs effect-orchestration-patterns` · `repo-symbol-discovery` · `effect-v4-imports`

**Next:** Run /grill-with-docs to close the 7 open DECISIONS forks, then advance research -> shape (BRIEF.md).

````markdown
# Handoff: effect-orchestration-patterns  (resume-align | Wave P2 | stage research)

You are resuming the `effect-orchestration-patterns` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It DRY-extracts a shared Effect `Schedule` retry-policy library plus a `Layer.unwrap` build-time provider selector out of retry/error code that today lives inline per-driver. Net-new is exactly two things (retry-policy module + provider selector) plus glue — NOT new laws (EF-25/26/27/31 already exist).

## Read first (ground-truth before acting)
- `explorations/effect-orchestration-patterns/DECISIONS.md` - 7 pre-drafted forks, each with a RECOMMENDED answer + grounded rationale; all `Status: open`. This is your work queue.
- `explorations/effect-orchestration-patterns/RESEARCH.md` - external landscape + in-repo capability inventory + Constraints; line refs cited in DECISIONS resolve here.
- `explorations/effect-orchestration-patterns/CAPTURE.md` - 8 gold nuggets + netNew/alreadyCovered/cautions seed.
- `explorations/effect-orchestration-patterns/reviews/2026-06-29-codex-research.md` - folded codex research-gate critique.
- `explorations/effect-orchestration-patterns/ops/manifest.json` - stage/openQuestions machine state.
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route=new-exploration, cautions) for provenance.

## Skills to invoke
- `/grill-with-docs effect-orchestration-patterns` - close one branch-closing DECISIONS question at a time, recommended-answer-first, grounded against repo law.
- `/explore effect-orchestration-patterns` - pipeline driver; advance research -> shape and close the loop.
- `repo-symbol-discovery` - capability-cited reuse: confirm the named reuse targets (`@beep/utils` `SqlTest.ts` `PgConnectRetryPolicy`, `@beep/schema` `TaggedErrorClass`/`CauseTaggedError`, anthropic `ExecutionPlan`, `ai-provider-cli` `LiteralKit`+`.$match`) BEFORE inventing any helper.
- `effect-v4-imports` - validate `Layer.unwrap` / `Config.literals` / `effect/persistence/RateLimiter` against the vendored beta.91 surface.

## Task this session
Drive `/grill-with-docs` to resolve all 7 open forks (capture each ruling back into `DECISIONS.md` as `Status: decided`), then advance the packet research -> shape (author `BRIEF.md`). STOP after BRIEF.md is shaped — await user sign-off before decompose (`MAP.md`). Open forks to close, verbatim:
- Q1: Scope boundary — pure-`Schedule` layer now vs also the stateful resilience stack
- Q2: Package placement — where the pure retry policies and selector live
- Q3: First slice — which driver migrates first to prove the shared retry module
- Q4: Vendor / auth — provider-selector scope and its secret boundary
- Q5: Build-vs-buy — circuit breaker clean-room vs adopt a dependency
- Q6: Degraded fan-out — generic tagged-status combinator vs per-call
- Q7: Rate limiter & stateful-resilience home — reuse v4 built-in, and where the stateful stack lives

## Constraints (binding)
- NON-INVASIVE: this is library-extraction/consolidation, not greenfield. Do NOT rebuild documented standards (EF-25/26/27/31) or rewrite working anthropic/m365 retry+error code — DRY-extract and prove byte-for-byte parity against existing tests.
- CAPABILITY-CITED REUSE: `Layer.unwrapEffect` (the CAPTURE seed name) has 0 usages and does NOT exist in v4 — use `Layer.unwrap`. The seed's `Effect.forEach` `mode:"either"|"validate"` is REMOVED in v4 — write the degraded-batch combinator against per-item `Effect.result`/`option`/`exit`. Re-resolve every target against the live tree; the gold `finalBeepTarget` hints are STALE.
- SECRET BOUNDARY: the `Layer.unwrap` selector must return ONLY the chosen provider's Layer and never read unused providers' `Config.redacted` keys. Keep build-time selection strictly distinct from runtime fallback/dispatch (that lives in the sibling `multi-provider-llm-dispatch-fallback` packet — verified present).
- SCOPE SPLIT: Q1 recommends deferring the stateful stack (circuit breaker / retry-budget / bulkhead / served-while-open cache / rate-limiter wiring) to a NOT-YET-CREATED sibling (provisional `resilience-stack-circuit-breaker-budget`). If the grilling confirms the split, open that sibling exploration rather than widening this packet.
- The user works the same git tree in parallel — never revert unexplained out-of-scope working-tree changes; surface them.

## Done when
- All 7 forks in `DECISIONS.md` carry a `Status: decided` ruling; `BRIEF.md` is authored from the decided scope; `ops/manifest.json` stage + README Trail/Next-Open-Question + `explorations/ATLAS.md` (single-writer) are updated; STOPPED awaiting sign-off before `MAP.md`.
````


### `agent-memory-tiers-bitemporal-edges`

**Type:** resume-align · **Wave:** P2 · **Stage:** research

**Skills:** `/explore agent-memory-tiers-bitemporal-edges` · `/grill-with-docs agent-memory-tiers-bitemporal-edges` · `repo-symbol-discovery` · `mcp-graphiti-memory`

**Next:** Run /grill-with-docs to close Q1-Q7 one at a time, then advance the packet to shape (BRIEF.md).

````markdown
# Handoff: agent-memory-tiers-bitemporal-edges  (resume-align | Wave P2 | stage research)

You are resuming the `agent-memory-tiers-bitemporal-edges` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It crystallizes a four-tier agent-memory schema (working/episodic/semantic/procedural) where every consolidated fact carries confidence + source links, memories decay/evict, and knowledge-graph edges are bitemporal + never-overwritten — the net-new capability the completed `epistemic-claim-lifecycle-gate` explicitly deferred. RESEARCH.md is synthesized and codex gate-1 is folded; the work this session is **align**, not research.

## Read first (ground-truth before acting)
- `explorations/agent-memory-tiers-bitemporal-edges/ops/manifest.json` - stage (`research`), the 7 `openQuestions`, links.
- `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md` - the 7 pre-drafted forks with RECOMMENDED answers + cited rationale; all `Status: open`. This is your grilling agenda.
- `explorations/agent-memory-tiers-bitemporal-edges/RESEARCH.md` - read BOTH the synthesis (Locked decisions, Routing cautions) and the Unresolved/Open-unverified + Constraints sections; decay tuning + acceptance-gate obligations are carried into shape.
- `explorations/agent-memory-tiers-bitemporal-edges/reviews/2026-06-29-codex-research.md` - gate-1 critique (bitemporal storage contract flagged must-settle → drives Q7).
- `explorations/agent-memory-tiers-bitemporal-edges/CAPTURE.md` - raw spark.
- `explorations/_gold-intake/ROUTING.md` - this cluster row (P2, new-exploration, RRF single-owner caution) for provenance.

## Skills to invoke
- `/grill-with-docs agent-memory-tiers-bitemporal-edges` - the align driver: close ONE branch-closing question at a time, recommended answer first, log each resolution.
- `/explore agent-memory-tiers-bitemporal-edges` - pipeline driver to sync state and advance research→shape when grilling completes.
- `repo-symbol-discovery` - capability-cited reuse: confirm `@beep/epistemic-tables`/`-domain`/`-use-cases`, `ClaimLifecycle`, `CandidateClaim`, `Evidence`, `EvidenceSpan`/`TextAnchorFields`, `BaseEntity.Class`, `LiteralKit`, `@beep/drizzle` before any new symbol is implied by a decision.
- `mcp-graphiti-memory` - reference-only grounding for bitemporal invalidation semantics (Graphiti supersede rule) the forks lean on.

## Task this session
Run `/grill-with-docs` and close the seven open forks below, in dependency order (Q2 is the keystone; resolve it early). Log each resolution in DECISIONS.md, flip its `Status` line, and sync manifest `openQuestions`. STOP when all 7 are resolved (or the user parks a branch) — do NOT write BRIEF.md/MAP.md or any code; await sign-off before advancing to shape.

Open DECISIONS to close (verbatim headers):
- Q1: How do we source the borrowed memory primitives — port-with-attribution, reference-only, or clean-room?
- Q2: What does this packet own versus consume or defer?
- Q3: What is the first shippable slice?
- Q4: Where does durable truth live, and do we admit any external graph vendor for it?
- Q5: Where does the new code live, and is the disposition axis shared-kernel or slice-local?
- Q6: Do we persist an explicit CONTRADICTS edge, or rely on implicit invalidation only?
- Q7: How are the bitemporal no-overlap / supersession invariants enforced, and how are open intervals represented?

## Constraints (binding)
- NON-INVASIVE: never edit the completed `goals/epistemic-claim-lifecycle-gate` SPEC in place; this packet graduates into a FRESH goal extending the epistemic slice. Do not widen the shared-kernel `ClaimLifecycle` enum — the disposition axis stays slice-local (Q5).
- RRF SINGLE-OWNER: `explorations/rag-retrieval-projection` is the sole owner of the 3-channel RRF fuser (k=60); this packet CONSUMES it and DEFERS FalkorDB/GraphRAG to `goals/trustgraph-port`. Build no second/third RRF (Q2). All three sibling packets verified to exist.
- CAPABILITY-CITED BEFORE INVENTING: durable truth is Postgres repo-native via `@beep/epistemic-tables` + `@beep/drizzle`; no external graph vendor is ever authoritative. Every fused/conflict hit must carry an `EvidenceSpan`/`TextAnchorFields` char-span anchor. Drop agentmemory's Anthropic-SDK extraction and `parseTemporalGraphXml` regex (no span grounding).
- LICENSE LANE (Q1): port-with-attribution only Apache-2.0 agentmemory shapes; clean-room (spec-first, never transcribe enums/columns, never launder via LLM) the AGPL-3.0 mike-derived states; idea-only for unverified/commercial donors. Require `live-repo verified` provenance before borrowing any shape.
- GROUND-TRUTH: re-resolve every package/file target against the live tree at action time (gold `finalBeepTarget` hints are stale). The user works this git tree in parallel — surface, never revert, unexplained out-of-scope changes.
- BITEMPORAL INVARIANT (Q7): lock the Graphiti supersede rule — set the superseded edge's `invalid_at` to the invalidating edge's `valid_at`, move `expired_at` to now; `invalid_at = now()` is a correctness bug. Open intervals use `Option`/half-open, never magic sentinels.

## Done when
- All 7 DECISIONS forks carry a logged resolution and a flipped `Status` line; manifest `openQuestions` is synced (emptied/updated), `stage`/`updated` reflect align progress, README "Next Open Question" + Trail are rewritten, and `explorations/ATLAS.md` reflects any stage change. Stop at sign-off before shaping.
````


### `deterministic-doc-structure-extraction`

**Type:** resume-align · **Wave:** P2 · **Stage:** research (align-ready: RESEARCH synthesized + codex gate-1 folded; 8 DECISIONS pre-drafted, all open)

**Skills:** `/grill-with-docs deterministic-doc-structure-extraction` · `/explore deterministic-doc-structure-extraction` · `repo-symbol-discovery` · `schema-first-development`

**Next:** Run /grill-with-docs to resolve Q1-Q8 one fork at a time, then advance to shape (BRIEF.md).

````markdown
# Handoff: deterministic-doc-structure-extraction  (resume-align | Wave P2 | stage research→align)

You are resuming the `deterministic-doc-structure-extraction` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It crystallizes a non-LLM-in-the-loop logic tier — deterministic regex span extractors (defined terms, cross-refs, parties, amendments, legal-entity catalog, entity/relationship graph) that emit verbatim text + char offsets as cheap pre-LLM candidate seeders — paired with a `Partial`(candidate)/`Complete`(authoritative) Effect-Stream gate. It is a Case B sibling of langextract because the streaming gate CONFLICTS the locked V1 streaming-deferral.

## Read first (ground-truth before acting)
- `explorations/deterministic-doc-structure-extraction/ops/manifest.json` - machine state: stage `research`, the 8 open questions.
- `explorations/deterministic-doc-structure-extraction/DECISIONS.md` - the 8 pre-drafted forks (each has a RECOMMENDED answer + rationale, all `open`) plus the 2026-06-29 DEFERRED streaming-lock entry. THIS is what you grill.
- `explorations/deterministic-doc-structure-extraction/RESEARCH.md` - synthesized prior art + capability inventory; read the `## Constraints` and the two `GAP`/`HARD GAP` blocks (uniqueness check, Tika char-level gap).
- `explorations/deterministic-doc-structure-extraction/CAPTURE.md` - raw spark (10 nuggets).
- `goals/langextract-capability/SPEC.md` (L88-89) - the LOCKED V1 streaming-deferral this packet must NOT reopen.
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route / primaryTarget / cautions) for provenance.

## Skills to invoke
- `/grill-with-docs deterministic-doc-structure-extraction` - primary: close Q1-Q8 one branch-closing fork at a time, recommended answer first, rewrite each Status + log the chosen branch.
- `/explore deterministic-doc-structure-extraction` - pipeline driver: sync manifest `openQuestions`, README Next-Open-Question + Trail, ATLAS.md on stage change; advance to shape when all 8 land.
- `repo-symbol-discovery` - re-verify the capability-cited reuse claims (alignment ladder, `UnitInterval`, `ClaimLifecycle`/`CandidateClaim`, `$NlpId`) against the LIVE tree before locking Q3/Q6.
- `schema-first-development` - sanity-check the schema-first stream surface (strict `S.Class` Complete + `S.optionalWith` Partial) referenced in Q7.

## Task this session
Run `/grill-with-docs` and resolve, in order (Q1 first — it gates Q2/Q3):
- Q1: Scope boundary — which of the 10 netNew themes does THIS packet own, vs route to neighbor goals?
- Q2: First slice — what is the first vertical slice shipped?
- Q3: Package placement — where do the deterministic extractor, unique-anchor resolver, and streaming gate physically live?
- Q4: Build-vs-buy on citations — reuse eyecite-js, re-port from Python, or treat as out-of-scope?
- Q5: Court-PDF extractor backend — pick now, and how do copyleft/auth boundaries land?
- Q6: Confidence type — canonical branded UnitInterval + shared-kernel cleanup, or adapt at the boundary?
- Q7: Streaming Complete payload — carry V1 LangExtractResult verbatim, or a projected subset?
- Q8: Heuristic→LLM cascade — escalation trigger and confidence-calibration posture?

STOP after the forks are resolved and the manifest/README/ATLAS loop is closed — await user sign-off before shaping `BRIEF.md`. Do NOT write product code.

## Constraints (binding)
- NON-INVASIVE: do not edit `goals/langextract-capability/SPEC.md` or any active goal in place. The Partial/Complete gate is net-new-CONFLICTING — keep it in THIS sibling; never reopen the V1 streaming lock. (The catalog `gapStatus=dup` tag is wrong for this nugget.)
- Routed-OUT scope (confirmed to exist): court-PDF layout → `goals/file-processing-capability`; court/reporter vocab → `goals/official-data-sync-foundation`; citation extraction → `explorations/citation-grounding-hallucination-guard`. Do NOT spin up parallel selection here.
- CAPABILITY-CITED reuse, re-resolved at action time (stale hints): extend `@beep/langextract` `Alignment` (add `ambiguous`/`not_found` + occurrence-count check) rather than a new resolver; canonical confidence is branded `@beep/schema/UnitInterval`; the gate feeds the existing `@beep/epistemic-domain` candidate→admitted lifecycle. Deterministic core is local/no-model/no-secret; only the LLM refinement stage is network/secret-bearing.
- Reconciliation: `Complete` carries V1's full five-field `LangExtractResult` verbatim; `Partial` is UI/transport-only, never persisted, never crosses into epistemic-domain.
- Treat DECISIONS recommendations as proposals, not settled; the user picks each branch. Verify the live filesystem and never revert the user's parallel out-of-tree edits — surface them.

## Done when
- All 8 DECISIONS Statuses are rewritten from `open` to a resolved branch with the chosen rationale logged.
- `ops/manifest.json` (`stage`, `openQuestions`, `updated`), README Next-Open-Question + Trail line, and `ATLAS.md` are synced; packet sits clean at the align→shape boundary awaiting sign-off.
````


### `court-vocabulary-resolver`

**Type:** resume-align · **Wave:** P2 · **Stage:** research (DECISIONS pre-drafted, codex gate-1 folded)

**Skills:** `/grill-with-docs court-vocabulary-resolver` · `/explore court-vocabulary-resolver` · `schema-model-specialist` · `repo-symbol-discovery`

**Next:** Run /grill-with-docs to close Q1–Q7, then advance research → shape (BRIEF.md).

````markdown
# Handoff: court-vocabulary-resolver  (resume-align | Wave P2 | stage research)

You are resuming the `court-vocabulary-resolver` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It owns the controlled court/reporter vocabulary + span-gated court-string resolver vertical — re-derived clean-room from Free Law Project `courts-db`/`reporters-db` (~2,809 courts, BSD-2), ingested through the existing sync engine. The packet is at `research` with all seven DECISIONS pre-drafted (codex gate-1 folded); your job is to close them, not redo research.

## Read first (ground-truth before acting)
- `explorations/court-vocabulary-resolver/DECISIONS.md` — the 7 pre-drafted forks (recommendation + rationale + `Status: open`) you will resolve one at a time.
- `explorations/court-vocabulary-resolver/RESEARCH.md` — synthesis + External Landscape + scope-discipline; note the live-file warnings (count the pinned dataset, model against live `courts.json` not the CAPTURE snippet; two distinct "jurisdiction" taxonomies).
- `explorations/court-vocabulary-resolver/research/` — five fully-cited subtopic notes (vocabulary-schema, citation-crosswalk, license-and-rederivation, ingestion-contract, resolver-algorithm).
- `explorations/court-vocabulary-resolver/ops/manifest.json` — stage / openQuestions / links (resume point).
- `explorations/_gold-intake/ROUTING.md` — the "Court / jurisdiction controlled vocabulary" cluster row (route `new-exploration`, 14 nuggets, cautions) for provenance.

## Skills to invoke
- `/grill-with-docs court-vocabulary-resolver` — the align driver: close ONE branch-closing DECISIONS question at a time, recommended answer first.
- `/explore court-vocabulary-resolver` — pipeline driver to log resolutions and advance research → shape after Q7.
- `schema-model-specialist` — pressure-test the Q5/Q6 `LiteralKit` vocab, `EntityId.factory("law_practice", $I)`, and the crosswalk codec against current Effect v4 beta.91 forms.
- `repo-symbol-discovery` — capability-cited reuse: confirm `LiteralKit`/`@beep/data` copy-pattern/`EntityId` before any "net-new" claim survives into shaping.

## Task this session
Resolve the seven open DECISIONS in order, recommendation-first, logging each outcome to `DECISIONS.md` (`Status:`) and syncing `ops/manifest.json` `openQuestions`. Then advance research → shape, drafting `BRIEF.md`. STOP after Q7 is resolved and BRIEF is drafted — do NOT decompose (MAP) or graduate without sign-off.
Open question headers to close (verbatim):
- Q1: Build-vs-buy — reimplement the courts-db resolver in Effect, or adopt an existing JS citation library?
- Q2: Scope boundary — confirm this packet stays the vocabulary + resolver vertical only, with the three-way ownership split?
- Q3: First slice — what ships in slice 1, and in what order do the rest land?
- Q4: Vendor/auth — which regex engine and fuzzy matcher, and confirm the acquire boundary?
- Q5: Package placement — which slice owns the court/reporter IDs, the vocabulary schemas, and the resolver module?
- Q6: Canonical taxonomy — how is the court `jurisdiction` field modeled, and which reporter-type enum is canonical?
- Q7: Attribution artifact — where does the Free Law Project BSD-2 notice live?

## Constraints (binding)
- NON-INVASIVE: this packet adds a 5th sync target and a value/ABox layer only. It must NOT edit/rebuild `goals/official-data-sync-foundation` (reuse `SyncDataTarget` + 4-field contract verbatim), MUST NOT touch the `_tag:"Court"/"Jurisdiction"` TBox nodes owned by `goals/ip-law-knowledge-graph`, and MUST NOT build the CourtListener API client — that is `explorations/gov-legal-data-driver-codegen`. `packages/drivers/courtlistener` is a bare `VERSION`-only stub today.
- GROUND-TRUTH at action time: re-resolve every target against the live tree (`packages/foundation/primitive/data`, `packages/shared/domain/src/identity`, `@beep/schema` `LiteralKit`); the gold `finalBeepTarget` hints are stale. The user works this tree in parallel — surface, never revert, unexplained out-of-scope changes.
- CAPABILITY-CITED BEFORE INVENTING: compose existing bricks — `LiteralKit` (`@beep/schema`), `EntityId.factory("law_practice", $I)` (`packages/shared/domain/src/identity/LawPractice.ts`), the `@beep/data` `CldrTerritories` copy-pattern, `Alignment`/`GroundedExtraction` (`@beep/langextract`), `Contract.Span` (`@beep/nlp`). Verify each export with `repo-symbol-discovery` before labeling NET-NEW.
- PROVENANCE/LICENSE law: re-derive data + reimplement logic + attribute FLP (BSD-2); do NOT copy eyecite/CourtListener AGPL server source. Pin the upstream commit SHA as both attribution anchor and re-derivation provenance. Any vendored dep (`re2js`, `fuzzball.js`) is net-new and needs SPDX + Bun-compat vetting; the sync `acquire` stays fetch-over-HTTP + SHA-256 only (no secrets, no ambient capability), resolver runtime fully offline.
- CLOSE THE LOOP before ending: update `ops/manifest.json` (stage/openQuestions/updated), rewrite the README Next-Open-Question + append a dated Trail line, and sync `explorations/ATLAS.md` (single-writer) on the stage change.

## Done when
- All 7 DECISIONS show a resolved `Status:` line and `ops/manifest.json` `openQuestions` reflects them; `BRIEF.md` is drafted at fat-marker fidelity (problem / appetite / sketch / rabbit holes / no-gos); manifest stage advanced to `shape`; README Trail + Next-Open-Question and `ATLAS.md` synced. STOP for sign-off before MAP/graduate.
````


### `ingestion-security-secret-governance`

**Type:** resume-align · **Wave:** P2 · **Stage:** research

**Skills:** `/grill-with-docs ingestion-security-secret-governance` · `/explore ingestion-security-secret-governance` · `repo-symbol-discovery` · `onepassword-secret-refs`

**Next:** Drive align via /grill-with-docs: close Q1-Q8 one at a time, recommended-answer-first, then advance to shape (BRIEF.md).

````markdown
# Handoff: ingestion-security-secret-governance  (resume-align | Wave P2 | stage research)

You are resuming the `ingestion-security-secret-governance` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). It gathers the defensive ingestion gate (prompt-injection detection, SSRF hardening, secret/PII scrub-before-LLM, failed-redaction PDF x-ray, HTML sanitizer) plus the secret-governance spine (ordered resolver chain + per-user vault) — capabilities that today have no home. RESEARCH.md is synthesized and codex gate-1 is folded; eight branch-closing DECISIONS are pre-drafted with recommendations and left OPEN. Your job is align.

## Read first (ground-truth before acting)
- `explorations/ingestion-security-secret-governance/ops/manifest.json` - machine state: stage `research`, the 8 `openQuestions`.
- `explorations/ingestion-security-secret-governance/DECISIONS.md` - the 8 pre-drafted forks (Recommended + Rationale + `Status: open`) you will close.
- `explorations/ingestion-security-secret-governance/RESEARCH.md` - external landscape + in-repo capability inventory; read BOTH the synthesis AND the Constraints / Locked-decisions / gaps sections (they ground every recommendation).
- `explorations/ingestion-security-secret-governance/CAPTURE.md` - gold-intake seed (10 nuggets, 6 net-new, donor-license cautions).
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route=`new-exploration`, primaryTarget, cautions) for provenance.

## Skills to invoke
- `/grill-with-docs ingestion-security-secret-governance` - the align driver: close ONE question at a time, recommended-answer-first, log each resolution, sync manifest.
- `/explore ingestion-security-secret-governance` - pipeline state/close-the-loop helper once questions are resolved and you advance to shape.
- `repo-symbol-discovery` - confirm reuse targets before any recommendation hardens (capability-cited-before-inventing).
- `onepassword-secret-refs` - grounding for Q3/Q6 (the `op://` resolver + `@beep/onepassword-cli` first provider).

## Task this session
Drive align: close Q1 through Q8 in `DECISIONS.md`, one branch-closing question at a time, recommended-answer-first. Rewrite each resolved entry to the resolved-log form (Question / Answer / Rationale), clear the matching manifest `openQuestions` entry as you go. STOP after the user signs off on all eight (or parks one) — do NOT write BRIEF.md / advance to shape without explicit go-ahead. Open question headers to close, verbatim:
- Q1: Scope boundary — one ingestion-security wedge vs split content-security gate + shared secret-governance spine
- Q2: First slice — which net-new capability to build first
- Q3: Package placement — secret resolver + per-user vault home (platform-adjacent, NOT `@beep/identity`)
- Q4: Package placement — content-security modules, HTML sanitizer, and scored-findings home
- Q5: Build-vs-buy — reimplement-not-copy (x-ray on pdf.js, deterministic injection, Presidio contract)
- Q6: Vendor/auth — 1Password first provider + ordered-resolution placeholder-rejection mechanism
- Q7: Per-user vault cryptography — AES-256-GCM per-user subkeys vs XChaCha20-Poly1305 + KDF floor
- Q8: SSRF — extend `SafeRemoteHost` range table + net-new `GuardedHttpClient` connect-time layer

## Constraints (binding)
- Non-invasive: this is an exploration; do NOT write product code and do NOT treat artifacts as spec. Q1 deliberately splits at the MAP into two graduated goals — do not pre-graduate.
- Coordinate the secret-resolution overlap with the sibling exploration `explorations/multi-provider-llm-dispatch-fallback` (verified to exist): the contract is "ONE secret resolver, not two" — Q3/Q6 must keep the resolver shared, not duplicated.
- Capability-cited reuse (re-resolve against the live tree, gold hints are STALE): SafeRemoteHost lives in `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` (keep it pure, extend range table only); 1Password substrate is `packages/drivers/onepassword-cli`; content-security home is `packages/foundation/capability/file-processing`; sanitizer candidate home `packages/foundation/modeling/html`; scored findings mirror `@beep/epistemic-domain` `EvidenceSpan`, NOT `@beep/provenance`; the vault/resolver go platform-adjacent, NOT `@beep/identity` (pure modeling pkg — no `node:crypto`).
- License/privilege gates (Q5): take ZERO AGPL or SaaS runtime deps — PyMuPDF/mupdf.js are AGPL, `mike`/`courtlistener` donors are AGPL/unknown → reimplement-not-copy; PATENT CAUTION US12118471B2 → stay deterministic/flag-side, no RL trusted/untrusted token classifier; injection findings are advisory char-spans (flag-not-block), never silent drops.
- Two routing cautions are flagged UNSETTLED in RESEARCH and must be explicitly confirmed in grill: the HTML sanitizer home (`@beep/html` `Html.sanitize` vs file-processing module — and the CRITICAL `SafeHtmlAttributes` subset that excludes `EventHandlerAttributes`/`style`), and the `GuardedHttpClient` home (platform-adjacent, permitted `node:dns`/`undici`, NOT `@beep/schema`).
- Close the loop before ending: update `ops/manifest.json` (stage/openQuestions/updated), the README Next-Open-Question + Trail line, and `explorations/ATLAS.md` (single-writer) on any stage/status change.

## Done when
- All eight DECISIONS entries are resolved (or explicitly parked with a dated reason) in resolved-log form, the manifest `openQuestions` is cleared to match, and the README/Trail/ATLAS are synced — with the packet staged to advance to shape pending user go-ahead.
````


### `multi-provider-llm-dispatch-fallback`

**Type:** resume-align · **Wave:** P2 · **Stage:** research (DECISIONS align seed drafted; 7 open questions)

**Skills:** `/explore multi-provider-llm-dispatch-fallback` · `/grill-with-docs multi-provider-llm-dispatch-fallback` · `repo-symbol-discovery` · `claude-api`

**Next:** Run /grill-with-docs to resolve Q1-Q7 one at a time, log each resolution, then advance research -> align -> shape (BRIEF.md).

````markdown
# Handoff: multi-provider-llm-dispatch-fallback  (resume-align | Wave P2 | stage research)

You are resuming the `multi-provider-llm-dispatch-fallback` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). The packet designs a thin shared Effect dispatch Layer ABOVE `ExecutionPlan` — provider registry, user>CLI>env key-precedence resolver, per-provider default-model resolution, and a multi-provider `ExecutionPlan` builder — over the four installed `@beep/{anthropic,openai-compat,xai,venice-ai}` drivers. RESEARCH is done and a codex research gate has run; the align DECISIONS seed is drafted but every question is still **open**.

## Read first (ground-truth before acting)
- `explorations/multi-provider-llm-dispatch-fallback/ops/manifest.json` - stage (`research`) + the 7 openQuestions = your resume point.
- `explorations/multi-provider-llm-dispatch-fallback/DECISIONS.md` - the 7 pre-drafted branch-closing questions, each with a RECOMMENDED answer + rationale (NOT decided).
- `explorations/multi-provider-llm-dispatch-fallback/RESEARCH.md` - read BOTH synthesis and the Unresolved/Constraints sections (ExecutionPlan vendored in `effect@4.0.0-beta.91`; `Layer.orElse` is stale v3 advice and absent; `@effect/ai-{openai,openrouter}` declared but NOT materialized in node_modules).
- `explorations/multi-provider-llm-dispatch-fallback/CAPTURE.md` - original dump (append-only).
- `explorations/multi-provider-llm-dispatch-fallback/reviews/2026-06-29-codex-research.md` - the codex research-gate critique; fold any unresolved points into the align answers.
- `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts` - the existing `Stream.withExecutionPlan(AnthropicTurnPlan, ...)` seam V1 swaps for a multi-provider plan (~line 129).
- `explorations/_gold-intake/ROUTING.md` - this cluster row (route: new-exploration; secondaryTargets incl. `effect-orchestration-patterns`, `packages/agents/server`, the four drivers) for provenance.

## Skills to invoke
- `/grill-with-docs multi-provider-llm-dispatch-fallback` - drive align: close ONE question at a time, recommended answer first, log each resolution.
- `/explore multi-provider-llm-dispatch-fallback` - pipeline driver: advance research -> align -> shape and close the loop.
- `repo-symbol-discovery` - re-verify each driver's real public barrel (`packages/drivers/*/src/index.ts`) before locking Q4's adapter-table claim that surfaces are non-uniform; do not trust stale hints.
- `claude-api` - authoritative Claude model ids/pricing/caching when resolving per-provider default-model resolution (Q4/Q7) and the #778-class non-portable model-id encodings.

## Task this session
Resolve the 7 open DECISIONS questions via `/grill-with-docs`, one branch-closing question at a time, recommended answer first; log each resolution in `DECISIONS.md` and sync `manifest.json` openQuestions. Then advance the stage to `align` (and into `shape`/`BRIEF.md` only if all 7 close cleanly). STOP and await user sign-off before drafting `BRIEF.md` if any answer diverges materially from the recommendation. Open questions to close (verbatim):
- Q1: dispatch/registry surface only vs also owning retry/Schedule + round-robin + circuit-breaker?
- Q2: buy vendored `ExecutionPlan` + four drivers + clean-room glue vs bespoke engine?
- Q3: first slice — Anthropic→single-fallback over the four installed drivers wired into `AnthropicTurnKernel` vs broader set?
- Q4: adapter table over four non-uniform driver surfaces vs uniform `driver.model()` registry?
- Q5: key precedence (user>CLI>env), advisory prefix detect, missing-primary-key advance-vs-fail-fast, broker `ApiKeyResolver`?
- Q6: new `@beep` driver-tier dispatch package vs `foundation/capability` vs inline in `agents/server`?
- Q7: ordered fallback only (defer round-robin + circuit-breaker) + reuse `generateObject` vs rebuild?

## Constraints (binding)
- NON-INVASIVE: this is an exploration packet — do not write product code and do not edit any `goals/` SPEC. Stay in `explorations/multi-provider-llm-dispatch-fallback/`.
- CAPABILITY-CITED before inventing: the engine is vendored `ExecutionPlan` (`Effect.withExecutionPlan`/`Stream.withExecutionPlan`), NOT `Layer.orElse` (absent/stale). The four `@beep` drivers, `AiError` retryable taxonomy with `retryAfter`, and `generateObject` + per-provider `CodecTransformer`s already exist — compose them; clean-room only the registry/resolver/model-resolution/plan-builder glue.
- Sequencing dependency, not an import: the shared `Schedule`/RetryPolicy library is owned by sibling exploration `explorations/effect-orchestration-patterns` (verified present) — coordinate the secret-resolution + Schedule overlap; do not absorb its scope into this P2 wedge.
- Secrets/privilege: `ApiKeyResolver` uses `op://` references (`@beep/onepassword-cli`) — never commit raw keys; prefix detection stays advisory, never a validity gate; a missing Redacted primary key must fail-fast or advance-to-fallback per Q5, never silently.
- GROUND-TRUTH at action time: re-resolve every target (`finalBeepTarget` hints are stale) and re-verify driver barrels live; the user works the same tree in parallel — surface, never revert, unexplained working-tree changes.

## Done when
- All 7 DECISIONS questions show a logged resolution (Status updated from `open`); `manifest.json` openQuestions, README Next-Open-Question + Trail line, and `ATLAS.md` are synced; stage advanced to `align` (or `shape` if clean) with any divergence-from-recommendation flagged for user sign-off.
````


### `rag-retrieval-projection`

**Type:** resume-align · **Wave:** P2 · **Stage:** research (DECISIONS pre-drafted, codex gate-1 folded; awaiting align resolution)

**Skills:** `/explore rag-retrieval-projection` · `/grill-with-docs rag-retrieval-projection` · `repo-symbol-discovery` · `schema-model-specialist`

**Next:** Run /grill-with-docs to resolve Q1-Q7, then advance research -> shape (BRIEF.md).

````markdown
# Handoff: rag-retrieval-projection  (resume-align | Wave P2 | stage research)

You are resuming the `rag-retrieval-projection` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). This packet is the single designated owner of the hybrid 3-channel weighted-RRF (k=60) retrieval/projection tier — embedding cosine + lexical FTS + literal-phrase, fused in-repo over a rebuildable pgvector HNSW projection, plus the offset-preserving char-span chunker that feeds it; `agent-memory-tiers-bitemporal-edges` and `goals/trustgraph-port` consume it, they do not rebuild it.

Stage is `research`: RESEARCH.md is synthesized, codex gate-1 is folded, and DECISIONS.md pre-drafts seven branch-closing forks with recommended answers. The next pipeline step is ALIGN.

## Read first (ground-truth before acting)
- `explorations/rag-retrieval-projection/DECISIONS.md` — the 7 pre-drafted forks (Q1-Q7), each with a RECOMMENDED answer + grounded rationale; these are NOT yet resolved.
- `explorations/rag-retrieval-projection/RESEARCH.md` — read the synthesis AND the `Genuine gaps`, `Locked decisions`, `Routing cautions`, and `UNVERIFIED` lines (HNSW build-memory under WASM, opclass/operator agreement, `pg_textsearch` BM25 in PGlite WASM all UNVERIFIED).
- `explorations/rag-retrieval-projection/CAPTURE.md` — raw spark + netNew list (dedup, citation BFS satellites).
- `explorations/rag-retrieval-projection/README.md` + `ops/manifest.json` — stage, Trail, `openQuestions` mirror.
- `explorations/_gold-intake/ROUTING.md` — this cluster row (`RAG ingestion + char-span chunking`, 14 nuggets) for provenance + routing cautions.

## Skills to invoke
- `/explore rag-retrieval-projection` — drive/resume the pipeline state machine and close the loop.
- `/grill-with-docs rag-retrieval-projection` — the align engine: close ONE question at a time, recommended answer first, rewriting each `**Status:** open` into a dated resolution.
- `repo-symbol-discovery` — before ratifying Q7's `@beep/retrieval` capability or any new helper, capability-cite existing exports (epistemic spine, `@beep/langextract`, `@beep/semantic-web`, `@beep/pglite`).
- `schema-model-specialist` — for Q7's `vector(768)` + `vector_cosine_ops` HNSW projection schema landing in `@beep/epistemic-tables`.

## Task this session
Run `/grill-with-docs rag-retrieval-projection` and resolve, one at a time (Q2 first — it bounds everything), these verbatim open headers:
- Q1: Build vs buy — does beep own the RRF fusion service in-repo, or delegate fusion to pgvector / a vector DB's built-in hybrid ranker?
- Q2: First slice — what is the thin V1 vertical that graduates into a goals/ packet first?
- Q3: Scope boundary — do MinHash/LSH evidence-cluster dedup and citation-graph BFS live inside this packet's first graduating goal, or split into separate follow-on goal slices?
- Q4: Lexical channel — ship the generated-tsvector + GIN path (ts_rank_cd), or the external pg_textsearch BM25 extension?
- Q5: Vendor / license — which embedding model is the default, and is the projection column locked to vector(768) regardless?
- Q6: Vendor / runtime — does the embedding encoder run as webview-WASM (transformers.js / onnxruntime-web), or as a Rust-side ONNX sidecar (ort / Candle)?
- Q7: Package placement — where do the net-new pieces live in the repo topology?

STOP after the last question is resolved and the loop is closed. Do NOT write BRIEF.md or any product code this session — shape is the next step, gated on these resolutions.

## Constraints (binding)
- NON-INVASIVE: do not edit `goals/langextract-capability` or `goals/trustgraph-port` SPECs; the chunker is confirmed THIS packet's ownership (langextract SPEC non-goals decline standalone `chunk`/`window`). New/conflicting scope opens a sibling exploration.
- CAPABILITY-CITED BEFORE INVENTING: Q7 targets are net-new — re-resolve every target against the LIVE tree at action time (gold `finalBeepTarget` hints are STALE). Verified now: `packages/foundation/capability/` has NO `retrieval` yet; epistemic slice is `packages/epistemic/{domain,tables,server,use-cases}`; the driver is `packages/drivers/pglite` (pgvector extension NOT yet wired). Compose the existing Claim/Evidence/provenance spine, do not fork it.
- Literal-match floor is a HARD invariant: an exact literal-phrase hit must not be outscored by fuzzy consensus — needs a dedicated channel + hard tie-break, not weight alone (rationale Q1). Empty-channel weight renormalization is beep-owned (no vendor implements it).
- Substrate is UNVERIFIED: HNSW build-memory under PGlite WASM, opclass/operator agreement, and `pg_textsearch` BM25 stability are all flagged — keep the first slice (Q4) on the generated-`tsvector` + GIN fallback (`ts_rank_cd` is cover-density, NOT BM25; tests must not assert BM25). Encoder runs in-process, no API round-trip, no secret (privilege-safety wall).
- Dedup carries a clean-room obligation (courtlistener clustering policy is AGPL-3.0; math is clean from MIT `datasketch`); citation BFS must source from USPTO ODP `api.uspto.gov`, never the sunset PatentsView API (410 Gone since 2025-05-01).
- CLOSE THE LOOP: update `ops/manifest.json` (`stage`, `openQuestions`, `updated`), the README Next-Open-Question + Trail, and `explorations/ATLAS.md` (single-writer) on any stage/status change.

## Done when
- All seven `**Status:** open` entries in DECISIONS.md are rewritten as dated Question/Answer/Rationale resolutions; `ops/manifest.json` `openQuestions` is emptied/synced; stage is ready to advance to `shape`; README Trail + ATLAS reflect the align close.
````


### `secure-document-download-proxy`

**Type:** resume-align · **Wave:** P3 · **Stage:** research (align pre-drafted, awaiting grill)

**Skills:** `/explore secure-document-download-proxy` · `/grill-with-docs secure-document-download-proxy` · `repo-symbol-discovery` · `onepassword-secret-refs`

**Next:** Run /grill-with-docs to resolve the 8 open DECISIONS one at a time, then advance to shape (BRIEF.md).

````markdown
# Handoff: secure-document-download-proxy  (resume-align | Wave P3 | stage research/align)

You are resuming the `secure-document-download-proxy` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). Its mission: serve authoritative USPTO File-Wrapper PDFs to the local-first desktop UI through opaque, TTL-gated links so the LLM never sees raw bytes, identifiers stay hidden, and the API key never leaves the server — an edge-gated UUID-guarded resource route plus an encrypted, auto-expiring opaque-link store. RESEARCH is synthesized and Codex gate-1 is folded; 8 branch-closing DECISIONS are pre-drafted with recommendations but all OPEN.

## Read first (ground-truth before acting)
- `explorations/secure-document-download-proxy/ops/manifest.json` - stage (`research`) + the 8 `openQuestions` (the resume index).
- `explorations/secure-document-download-proxy/DECISIONS.md` - the 8 pre-drafted forks (Recommended + Rationale + `Status: open`); this is what you close.
- `explorations/secure-document-download-proxy/RESEARCH.md` - external landscape + in-repo capability inventory; read BOTH the synthesis and the Unresolved/Constraints/UNVERIFIED notes (the Q6 per-platform webview `no-store`/BFCache spike and the Q7 Tauri-vs-Electron runtime assumption are still flagged UNVERIFIED).
- `explorations/secure-document-download-proxy/CAPTURE.md` - the 2 convergent gold nuggets (edge-gated route + `SecureLinkCache`).
- `explorations/_gold-intake/ROUTING.md` - cluster row (route `new-exploration` singleton; secondaryTargets `apps/professional-desktop`, `packages/drivers/uspto`) for provenance.

## Skills to invoke
- `/explore secure-document-download-proxy` - drive/resume the pipeline; close the loop (manifest, README Next-Open-Question + Trail, ATLAS.md) every session.
- `/grill-with-docs secure-document-download-proxy` - the align engine: close ONE DECISIONS question at a time, recommended-answer-first, rewrite each to resolved-log form and clear the matching manifest `openQuestions` entry.
- `repo-symbol-discovery` - capability-cited reuse: re-resolve every cited symbol/path against the LIVE tree before any answer relies on it (the gold finalBeepTarget hints are stale).
- `onepassword-secret-refs` - the secret/`Redacted` + at-rest key-custody framing behind Q5/Q7.

## Task this session
Run align: resolve the 8 DECISIONS forks via `/grill-with-docs`, one at a time, recommended-answer-first, logging each resolution and syncing the manifest. Start at the highest-leverage fork (Q6, the serve boundary). STOP after the user signs off each question — do NOT self-resolve, and do NOT start BRIEF.md until all 8 are closed and the user approves advancing to shape.

Open question headers to close (verbatim):
- Q1: Scope boundary — stand-alone capability packet vs fold into an existing driver/goal
- Q2: Package placement — where the reusable mint+gate+seal logic lives
- Q3: First slice — which origin to gate first
- Q4: Token model — opaque reference vs stateless sealed token
- Q5: Token cryptography (build-vs-buy) — reuse the in-repo AES-256-GCM seal vs vendor a token library
- Q6: Serve boundary — existing sidecar HTTP route vs Tauri custom protocol vs IPC blob
- Q7: Key custody / at-rest wrapping (vendor/auth) — reuse M365 msal-node-extensions vs adopt tauri-plugin-keyring
- Q8: Backing store — extend the desktop PGlite/Drizzle runtime vs bespoke store

## Constraints (binding)
- NON-INVASIVE: this is align inside an exploration; never edit active/completed goal SPECs. Verified-existing deps `goals/m365-driver` and `goals/file-processing-capability` are out of scope to mutate — DECISIONS Q1 already rules out folding into either.
- Capability-cited before inventing: re-resolve each cited brick against the live tree (line numbers are stale) — `@beep/uspto downloadDocument` + `assertAllowedRemoteUrl` SSRF guard, the `archive.ts` AES-256-GCM/`Redacted` seal, `@beep/m365` msal-node-extensions persistence, the desktop `makeBundledPgliteLayer`/`Migrations` runtime, `EntityTable`/`EntityId`/`$I`. Compose these; add NO new crypto/token dep.
- Secret/credential boundary: API key stays server-side as `Redacted`; persist provider document refs/closures, never raw origin URLs (would regress the fail-closed SSRF guard); the Q6 sidecar `allowedOrigins: ["*"]` CORS tightening is a hard prerequisite, not optional.
- Carry the two UNVERIFIED flags into grill: per-platform webview `no-store`/BFCache honoring for custom-scheme responses (Q6) and the Tauri-vs-Electron/Next runtime assumption (Q7) — resolve or down-scope them, do not silently assume.
- The user works the same git tree in parallel; surface unexplained out-of-scope working-tree changes, never revert them.

## Done when
- All 8 DECISIONS entries are rewritten to resolved-log form (Question / Answer / Rationale) with `Status` cleared, manifest `openQuestions` emptied accordingly, and README Next-Open-Question + Trail + ATLAS.md updated; packet is staged to advance to `shape` (or explicitly parked) pending user approval — STOP before authoring BRIEF.md.
````


### `local-first-projection-sync`

**Type:** resume-align · **Wave:** P3 · **Stage:** research

**Skills:** `/explore local-first-projection-sync` · `/grill-with-docs local-first-projection-sync` · `repo-symbol-discovery` · `effect-v4-imports`

**Next:** Resume align via /grill-with-docs: close DECISIONS Q1-Q7 one at a time, then advance to shape (BRIEF.md).

````markdown
# Handoff: local-first-projection-sync  (resume-align | Wave P2 | stage research)

You are resuming the `local-first-projection-sync` exploration packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). After an authority write, push one typed event to a user's *other* live desktop connections so local-first UI (and a future FalkorDB) projection refreshes without polling — via an in-repo per-user `EventStreamHub`, not a sync engine.

## Read first (ground-truth before acting)
- `explorations/local-first-projection-sync/ops/manifest.json` - stage (`research`) + the 7 `openQuestions` (your resume point).
- `explorations/local-first-projection-sync/DECISIONS.md` - Q1-Q7 pre-drafted with RECOMMENDED answers; all `Status: open (for /grill-with-docs)`.
- `explorations/local-first-projection-sync/RESEARCH.md` - synthesis + External Landscape, In-Repo Capability Inventory, Constraints, Routing cautions, Unverified/carry-forward (read the last two sections in full).
- `explorations/local-first-projection-sync/README.md` - Next Open Question + Trail.
- `explorations/_gold-intake/ROUTING.md` - cluster row (route `new-exploration`, singleton, 1 nugget; secondaryTargets apps/professional-desktop, goals/desktop-chat-surface, packages/workspace/server) for provenance.

## Skills to invoke
- `/explore local-first-projection-sync` - drive/resume the pipeline (research -> align -> shape); owns the close-the-loop bookkeeping.
- `/grill-with-docs local-first-projection-sync` - the align engine: close ONE branch-closing DECISIONS question at a time, recommended answer first.
- `repo-symbol-discovery` - before ratifying any "build" answer, re-confirm the cited reuse targets still exist (`EventStreamHub`/`notifyUser` NOT FOUND; `SynchronizedRef` NOT FOUND in any `src`; `MutableHashMap` proven; `ChatRpcs` streaming RPC; `ThreadStore` write boundary).
- `effect-v4-imports` - the fan-out primitive is Effect `4.0.0-beta.91`: there is NO `effect/Mailbox`; map to `Queue` + `Stream.fromQueue`, `effect/rpc` imports.

## Task this session
Resume ALIGN. Walk Q1-Q7 in order, recommended answer first; on each ratify/amend/reject flip its `Status` to `resolved <date>` with final Answer + Rationale (incl. rejected options) and clear it from `manifest.json` openQuestions. STOP after the open questions are resolved (or the user signs off) — do NOT write `BRIEF.md` / advance to shape until align is closed and the user approves.
Open DECISIONS to close (verbatim):
- Q1: Build the in-repo per-user fan-out hub, or buy a sync engine?
- Q2: Attach as a spike, or graduate a standalone goal packet?
- Q3: What does the first slice nail?
- Q4: What is the core fan-out primitive under Effect v4 beta?
- Q5: Where does the subscription RPC contract live? (placement)
- Q6: How does a live connection resolve identity, and who may subscribe? (auth)
- Q7: Does the first event contract anticipate a FalkorDB projection, and how is SSPL handled?

## Constraints (binding)
- NON-INVASIVE: this is an exploration packet — resolve decisions in DECISIONS.md; never edit the `goals/desktop-chat-surface` or `goals/workspace-thread-domain` SPECs in place (both exist; the hub coordinates with them). Net-new/conflicting scope opens a sibling exploration.
- CAPABILITY-CITED: compose existing bricks — hub *service* home is `@beep/workspace-server` (settled); the write hook is `ThreadStore` in `@beep/workspace-use-cases`; transport reuses `ChatRpcs` streaming RPC (`@beep/agents-use-cases`) + `RpcClient.layerProtocolSocket` (`apps/professional-desktop`). Cite before inventing.
- GROUND-TRUTH: gold target hints are STALE — re-resolve every package path against the live tree at action time. The user edits this same git tree in parallel; never revert unexplained out-of-scope changes, surface them.
- Q5 is a standard-owned routing fork (subscription RPC contract: `@beep/agents-use-cases` vs `@beep/workspace-use-cases`) — flagged UNRESOLVED; do not pre-commit, ratify the home explicitly.
- Q7 SSPL gate: FalkorDB is SSPLv1 (strong copyleft). Ship NO FalkorDB runtime in this wedge; design the event so a future projection could consume it, but require explicit legal/architecture review before bundling/hosting/distributing any FalkorDB-backed projection (privilege-sensitive legal-AI context).
- Effect v4 beta.91 API drift: `Mailbox` is dead; pin the `Queue` done-signal / single-vs-multi-consumer semantics against the live `effect/Queue` source before committing the hub to it (carry-forward unverified item).

## Done when
- Q1-Q7 each carry a `resolved <date>` Status with Answer + Rationale (rejected options noted), and manifest.json openQuestions is emptied of every resolved item.
- README Next-Open-Question + Trail updated (dated line), manifest `stage`/`updated` synced, and `explorations/ATLAS.md` reflects any stage/status change (single-writer).
- Session stops at the align gate with the next step (shape -> BRIEF.md) named; no product code, no goal-SPEC edits.
````


---

## 4 · Folded research notes — non-invasive (Case A)

These are **not** new packets — each is a dated research note folded into an existing active goal, host SPEC untouched. The handoff folds the note into the host goal's next relevant phase. **`epistemic-claim-lifecycle-gate` is completed-retained (Case C):** its note is reference-only; deferred scope graduates as a *fresh* goal via the public surface, never an in-place SPEC reopen.

### `file-processing-capability`

**Type:** fold-note · **Wave:** P2 · **Stage:** goal-active (P2/P3 pending); OCR phase deferred

**Skills:** `/explore file-processing-capability` · `repo-symbol-discovery` · `schema-first-development` · `effect-services`

**Next:** Verify the folded note + close-the-loop bookkeeping; integrate only when the deferred OCR phase is scheduled.

````markdown
# Handoff: file-processing-capability  (fold-note | Wave P2 | stage goal-active, OCR phase deferred)

You are resuming the `file-processing-capability` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). A dated Case-A research note folding 13 gold nuggets (OCR-need gating, layout-aware extraction, MIME/mojibake/encoding repair, graded input-quality gating) into the goal's already-deferred OCR strategy + future-driver phase has landed; this session confirms the fold is clean and the loop is closed — it does NOT start execution.

## Read first (ground-truth before acting)
- `goals/file-processing-capability/research/gold-intake-ocr-pdf-diagnostics.md` - the folded note (FULL): net-new patterns, recommended non-invasive seams, Cautions.
- `goals/file-processing-capability/SPEC.md` - skim "Public Surface", `Strategy`/`Extraction`/`Artifact`, and the OCR deferral language (do not edit).
- `goals/file-processing-capability/PLAN.md` - P2 (Tika) and P3 (libpff) are the active pending phases; OCR is none of them.
- `goals/file-processing-capability/ops/manifest.json` - locked `ocr-deferred` + `driver-boundaries` decisions, `skipReasons` (`ocr-disabled`), engine matrix (future `@beep/poppler`/Docling/Tesseract seam), `reportDirectory: research`.
- `explorations/_gold-intake/ROUTING.md` - cluster "Layout-aware PDF extraction + OCR-need gating" (route `extend-goal`, primaryTarget `goals/file-processing-capability`, wave P2) for provenance.

## Skills to invoke
- `/explore file-processing-capability` - resume/close-the-loop the packet; this packet is a graduated goal, so treat `/explore` as the bookkeeping driver only.
- `repo-symbol-discovery` - before proposing any integration symbol, confirm live reuse targets (`classifyFormatFromExtension`, `@beep/schema` `MimeType`/`FileExtension`, `ContentDigest`, `Strategy`, `Extraction`, `@beep/provenance` TextAnchor/EvidenceSpan).
- `schema-first-development` - if/when the deferred phase integrates pure gates (`page_needs_ocr`, text-quality scorer, graded verdict) into the `Strategy`/`Extraction` schemas.
- `effect-services` - for the future OCR/diagnostics driver boundary (Tika JVM-sidecar precedent) if that phase is scheduled.

## Task this session
Verify the folded note reads correctly against the LIVE tree (paths in the note may cite stale targets — re-resolve each `@beep/*` path before trusting it), then close the loop: confirm `ops/manifest.json` lists this note under research, the packet README Trail/Next-Open-Question reflects the fold, and `explorations/ATLAS.md` (single-writer) is current. STOP after the loop is closed — do NOT integrate the heuristics, do NOT reopen SPEC/PLAN/GOAL, do NOT disturb P2/P3. Integration waits until the deferred OCR phase is explicitly scheduled.

## Constraints (binding)
- NON-INVASIVE Case-A only: never edit SPEC.md/PLAN.md/GOAL.md or the active P2 (Tika) / P3 (libpff) phases. The goal owner integrates this note when the OCR phase is picked up.
- External runtimes (Tesseract, pdfplumber/Poppler, Magika, pdfjs) belong behind a NEW future OCR/diagnostics driver (privilege-safe local sidecar, like `@beep/tika`), per locked `ocr-deferred` + `driver-boundaries`. Only pure decision heuristics (gates/scorers/verdicts) may ever live in `@beep/file-processing` core.
- Capability-cited reuse: `doctor#7` hash normalization must COMPOSE with existing `Artifact`/`ContentDigest`; `doctor#6` MIME repair must EXTEND `classifyFormatFromExtension` + `@beep/schema` `MimeType` — no parallel hashing/typing paths. OCR lineage flag + license-tagged source record land in `@beep/provenance` (`packages/foundation/modeling/provenance`), feeding `goals/langextract-capability`'s claim/evidence gate.
- Licensing: `doctor` is BSD-2-Clause, pdfplumber MIT — clean-room port with attribution, never lift source; `legalmind-ai`/`lawyergpt`/`harvest-mcp` licenses UNVERIFIED. Mojibake/confidence tables are empirical data tuned to other producers/CJK corpora — re-derive, retune thresholds for English legal text.
- Retrieval/logic-wall: low-confidence OCR or low-quality input must surface as a typed warning / non-authoritative evidence (e.g. additive `ocr-low-confidence`/`low-quality-source` skipReason), never a silent success or candidate claim.

## Done when
- The folded note's `@beep/*` references are re-resolved green against the live tree (or discrepancies surfaced, not silently fixed), and `ops/manifest.json` + packet README Trail/Next-Open-Question + `explorations/ATLAS.md` reflect the fold; zero edits to SPEC/PLAN/GOAL and zero disturbance to P2/P3; no heuristic integration performed.
````


### `langextract-capability`

**Type:** fold-note · **Wave:** P2 · **Stage:** P4 Implement (in-progress)

**Skills:** `/goal follow the instructions in goals/langextract-capability/GOAL.md` · `schema-first-development` · `effect-first-development` · `repo-symbol-discovery`

**Next:** During P4 Implement, fold the folded note's prompt-mode + scoring + chunking patterns into the Extraction and Alignment modules as schema-first inputs.

````markdown
# Handoff: langextract-capability  (fold-note | Wave P2 | stage P4 Implement)

You are resuming the `langextract-capability` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). A Case-A pure-extend research note has already been folded into this active goal; your job is to carry its anti-inference prompt-mode, candidate-scoring, and chunking patterns into the P4 `Extraction` and `Alignment` implementation surfaces of `@beep/langextract` WITHOUT amending the packet contract.

## Read first (ground-truth before acting)
- `goals/langextract-capability/research/gold-intake-anti-inference-prompt-mode.md` - the folded note (FULL): net-new patterns, exact folding points, and Cautions. This is your spec for what to fold.
- `goals/langextract-capability/SPEC.md` - L77-89 Accepted Proposal Contract; note L88-89 streaming LOCK and L5-8 half-open span guarantee.
- `goals/langextract-capability/research/synthesis.md` - accepted proposal: the `Extraction` prompt/output contract and `Alignment` chunk/score steps you attach to; subpaths `/Target` `/Extraction` `/Alignment` `/Service`.
- `goals/langextract-capability/PLAN.md` - P4 Implement is the in-progress phase these patterns fold into.
- `goals/langextract-capability/ops/manifest.json` - `researchReports[]`, phases, target surfaces (`packages/foundation/capability/langextract/**`).
- `explorations/_gold-intake/ROUTING.md` - rows ~239-263 (route `mixed`, primaryTarget `goals/langextract-capability`, streaming-lock conflict caution) for provenance.

## Skills to invoke
- `/goal follow the instructions in goals/langextract-capability/GOAL.md` - drive the P4 Implement execution this folds into.
- `schema-first-development` - express adopted prompt/record shapes as `effect/Schema` (SPEC L60-63), not free-text prompt strings.
- `effect-first-development` - `Extraction`/`Alignment`/`Service` module + typed-error wiring over the injected `LanguageModel`.
- `repo-symbol-discovery` - capability-cite before inventing: confirm existing `@beep/langextract` Extraction/Alignment surfaces and `@beep/nlp` primitives before adding new public ones.

## Task this session
Fold the four patterns from the note into the relevant P4 surfaces as schema-first inputs: (1) the `TalentScore#1` "extract exactly as written; never infer; absent->empty/null" clause into the `Extraction` prompt/output-contract module as a reusable prompt-section template; (2) the `LegalEase#1`/`legalmind-ai#1` strict-JSON record shapes as reference structure for `Extraction` targets/examples plus a decode-or-fail step (replacing manual required-field loops); (3) `Legal-AI_Project#2` n-best + null-score-diff abstain path as an optional `Alignment` scoring/diagnostics reference feeding the candidate->approved gate; (4) `stenoai#1` context-budget overlapping chunking as a port target for the `Alignment` "chunk text with source offsets" step, ADDING char-offset tracking. STOP before building any module the accepted proposal has not yet scheduled - attach only to surfaces as they are implemented; do not pre-empt unbuilt modules.

## Constraints (binding)
- NON-INVASIVE: do NOT edit `SPEC.md`/`PLAN.md`/`GOAL.md`/phases/scope. These are refinements of already-accepted surfaces only.
- STREAMING LOCK untouched: SPEC L88-89 defers streaming. The Partial/Complete streaming gate and deterministic regex extractors are the cluster's netNewIds and live in the SIBLING exploration `explorations/deterministic-doc-structure-extraction` (verified to exist) - never pull them here, never reopen the lock.
- PROVENANCE WALL: prompt nuggets emit no char offsets; every adopted prompt+schema must be aligned to a `GroundedExtraction.span` via the existing `Alignment` step (SPEC L5-8). Keep adoption DOWNSTREAM of alignment.
- PORT, DO NOT VENDOR: sources are BAML (Apache-2.0), Python, and TS-Taiwan (`legalmind-ai` is adjacent reference only). Reimplement patterns in Effect + `effect/Schema`; the foundation package stays provider-neutral and BAML-free. Adopt structure/output-contract, not field sets verbatim.
- Re-resolve targets against the live tree (stale gold hints); the user works the same git tree in parallel - surface, never revert, out-of-scope changes.

## Done when
- The folded patterns are wired into the corresponding P4 `Extraction`/`Alignment` modules as schema-first inputs (or explicitly queued against them where the module is not yet built), with char-offset preservation on any ported chunker.
- `ops/manifest.json` stage + packet `README.md` Trail/Next-Open-Question + `explorations/ATLAS.md` are updated to reflect the fold, and the streaming lock + sibling routing are left intact.
````


### `law-practice-office-action-spike`

**Type:** fold-note · **Wave:** P2 · **Stage:** completed-retained (all four phases complete; gold-intake note folded 2026-06-29)

**Skills:** `/explore law-practice-ip-domain-depth` · `repo-symbol-discovery` · `schema-model-specialist` · `schema-first-development`

**Next:** When the law-practice slice deepens past the one-fixture spike, open a fresh goal/exploration (Case C) to land the deferred IP-domain entities — do not edit this completed SPEC.

````markdown
# Handoff: law-practice-office-action-spike  (fold-note | Wave P2 | stage completed-retained)

You are resuming the `law-practice-office-action-spike` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). The spike landed green (PR #262, 2026-06-18; all four phases complete) and is `completed-retained`; a Gold-Intake research note now sits folded under it, capturing deferred IP-law domain depth for when the slice grows past the one-fixture office-action loop.

## Read first (ground-truth before acting)
- `goals/law-practice-office-action-spike/research/gold-intake-ip-domain-depth.md` — the folded note (READ FULL): the eight nuggets, net-new capabilities, non-invasive integration plan, and cautions.
- `goals/law-practice-office-action-spike/SPEC.md` — the shipped spike scope + Non-Goals/Decision Log (what is deliberately deferred).
- `goals/law-practice-office-action-spike/PLAN.md` + `README.md` — the four landed phases and the Trail/Notes (BINDING sequencing, slice-ownership invariant).
- `packages/law-practice/domain/src/entities/**` — the live domain surface (`OfficeAction`, `Claim`, `Rejection`, `PriorArtReference`, `Distinction`) the note builds on — re-resolve against disk, the note's paths may have drifted.
- `explorations/_gold-intake/ROUTING.md` — cluster `IP-law domain depth (claim-chart, PTAB, clause taxonomy, prior-art)` (route `extend-goal`, primaryTarget this packet, wave P3) for provenance.

## Skills to invoke
- `/explore law-practice-ip-domain-depth` — drive a NEW sibling exploration if/when this deferred growth is picked up (this packet is completed-retained; it cannot be reopened).
- `repo-symbol-discovery` — capability-cited reuse: confirm what `packages/law-practice/domain` + `@beep/provenance` (`TextAnchor`/`Evidence`) + epistemic public surface already export before proposing any `ClaimElement`/PTAB/clause schema.
- `schema-model-specialist` / `schema-first-development` — model any new value object/entity as `effect/Schema` with provenance spans (never vendor source shapes).

## Task this session
This is a FOLD-NOTE: the note is already written, folded, and README/manifest already reference it. Default action is to ASSIMILATE only — read it, confirm it still maps to the live tree, surface anything stale. STOP there unless the user explicitly asks to start the deferred work; if they do, that work is a fresh goal/exploration, not an edit to this SPEC.

## Constraints (binding)
- NON-INVASIVE / Case C: this goal is `completed-retained` — do NOT edit its SPEC.md, PLAN.md, GOAL.md, phases, or scope. New depth lands only via a fresh goal (e.g. `goals/law-practice-office-action-extraction-rung`, which EXISTS) or a new sibling exploration.
- Scope wall: SPEC Non-Goals defer multi-ref §103, §101/§112 breadth, the §132 ladder, court/jurisdiction vocab, and the 7-source ontology grounding (`goals/ip-law-knowledge-graph` stays PENDING). PTAB/clause/risk/court items must NOT be smuggled into the one-fixture loop.
- Slice ownership: any new domain entity stays `foundation` + shared-kernel only — zero `@beep/epistemic-*` at the domain tier; the candidate/gate mechanism (incl. the risk-verdict "AI rationale separable from sound signals" pattern) is composed only at use-cases/server via the existing candidate-vs-authoritative wall.
- Licensing: reimplement, do not copy. `patent-search-mcp-server` (MIT) shapes → re-express as Schema; CUAD is CC BY 4.0 → attribute The Atticus Project if labels ship; `LegalEase#6` is a pattern only (retarget Indian IPC/BNS → WIPO-IPC/CPC). CBM is sunset (2020-09-16) → model as historical, not an active PTAB filing type.
- Dependency reality: pair lineage/PriorArt enrichment with the driver tier — `explorations/uspto-patent-driver-depth` and `explorations/court-vocabulary-resolver` are still EXPLORATIONS (no graduated goal yet); `packages/drivers/uspto` + `packages/drivers/nlp-mcp` exist. Do not model lineage in the domain before a real dated-CLM source exists.
- Privilege wall: any PTAB/contract/claim-evolution fixtures stay synthetic/public — never a real client matter in this public repo.

## Done when
- The folded note is read and reconciled against the live `packages/law-practice/domain` surface; any stale path/symbol drift is surfaced to the user; no edits made to the completed SPEC; and the deferred-growth path (fresh goal vs `extraction-rung`) is named back to the user if they want to proceed.
````


### `law-practice-office-action-extraction-rung`

**Type:** fold-note · **Wave:** P2 · **Stage:** complete (P0-P3, PR #265); Case-A research note folded

**Skills:** `/explore law-practice-extraction-grid` · `schema-model-specialist` · `repo-symbol-discovery`

**Next:** Open a successor persistence-rung exploration (document×column grid) that depends on this completed packet; do not amend this SPEC.

````markdown
# Handoff: law-practice-office-action-extraction-rung  (fold-note | Wave P2 | stage complete)

You are resuming the `law-practice-office-action-extraction-rung` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). The packet itself is **complete** (P0-P3, PR #265); a Case-A research note has been folded in capturing the `mike#13` relational grounded-extraction *grid* (document×column cells, each with per-cell citations + approval status) as a successor persistence axis — your job is to act on that capture without reopening the closed SPEC.

## Read first (ground-truth before acting)
- `goals/law-practice-office-action-extraction-rung/research/gold-intake-relational-extraction-grid.md` — the folded note (READ FULL): source, what this packet already owns (per-cell unit), net-new (the grid), recommended non-invasive integration, cautions.
- `goals/law-practice-office-action-extraction-rung/SPEC.md` — skim Non-Goals + Constraints (span-fidelity rule, typed-failure gate, epistemic-public-surface-only).
- `goals/law-practice-office-action-extraction-rung/PLAN.md` + `ops/manifest.json` — `knownGaps` (doctrine breadth is the packet's *named* next frontier — distinct from this grid axis), `requiredPublicSurfaces`.
- `packages/law-practice/domain` + `packages/epistemic/domain` barrels — existing `OfficeAction`/`Rejection`/`Claim` + Evidence/Claim spine to reuse, not duplicate.
- `explorations/_gold-intake/ROUTING.md` (rows ~56/70/459) — this cluster row (route `extend-goal`, primaryTarget, cautions) for provenance.

## Skills to invoke
- `/explore law-practice-extraction-grid` — stand up the successor persistence-rung exploration (capture from this note → research → align). This is the recommended home (note option 1), NOT a reopen of the complete packet.
- `schema-model-specialist` — model `columns_config` (review template) + `tabular_cells` (document×column) as first-party schema-first entities: `content` text, `citations` over `@beep/provenance` `TextAnchor`, `status` as a `LiteralKit` closed lifecycle enum.
- `repo-symbol-discovery` — dup-check any grid/cell entity against the law-practice + epistemic barrels before declaring net-new.

## Task this session
Confirm the folded note is intact, then **decide and record the home** for the grid axis: open a sibling/successor exploration that `dependsOn` this completed packet (note's preferred option). Do NOT amend this packet's SPEC/PLAN/GOAL. STOP after the new exploration is captured (RESEARCH skeleton + routing provenance) and the loop is closed — await user sign-off before any schema authoring.

## Constraints (binding)
- **Non-invasive:** packet is `complete`; this is Case-A/Case-B only. Never edit the completed SPEC/PLAN/GOAL in place — the grid lives in a fresh exploration/goal.
- **License (hard):** sole source `mike#13` is **AGPL-3.0** — reimplement the `tabular_cells`/per-cell-citation shape first-party from the spec description; never copy/port source.
- **Span-fidelity locked:** route per-cell citations through span-bearing `GroundedExtraction` / `TextAnchor`; never the span-lossy nlp `AnnotatedDocument` envelope.
- **Typed-failure gate:** model `status` as a closed literal lifecycle; keep the invariant that missing/unaligned required labels yield a typed failure and never fabricate spans.
- **Capability-cited reuse:** compose `@beep/langextract` (per-cell engine, keep grid concerns out of it), `@beep/provenance` `TextAnchor`, and the epistemic `ClaimGate`/`ClaimLifecycle` + Evidence spine; seed `columns_config` from the four proven labels (`office_action`, `claim`, `rejection_reference`, `distinction`).
- **Scope discipline:** `mike#13` is `recommend: study` / P2 — do not conflate with the packet's still-deferred doctrine-breadth gap.

## Done when
- The folded note is verified intact and a successor exploration (depends-on this packet) is captured with routing provenance, OR a recorded decision to defer — and `ops/manifest.json` stage, the packet README Trail/Next-Open-Question, and `explorations/ATLAS.md` are updated. No edits to the completed SPEC/PLAN/GOAL.
````


### `ip-law-knowledge-graph`

**Type:** fold-note · **Wave:** P2 · **Stage:** research-note-folded

**Skills:** `/explore ip-law-knowledge-graph` · `schema-model-specialist` · `repo-symbol-discovery` · `ontology-scout`

**Next:** Goal owner reads the folded note and acts on it during P0 (S7 grounding) / P1 (ClassificationCode + CLASSIFIED_AS schema); no SPEC edit.

````markdown
# Handoff: ip-law-knowledge-graph  (fold-note | Wave P2 | stage research-note-folded)

You are resuming the `ip-law-knowledge-graph` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). A non-invasive Case-A research note seeding the **CPC/IPC classification taxonomy as a SKOS vocabulary** for the already-reserved **S7 `ClassificationCode` node + `CLASSIFIED_AS` edge** has been folded into this goal; this session decides how the goal owner acts on it inside the SPEC's existing phases — without rewriting the SPEC.

## Read first (ground-truth before acting)
- `goals/ip-law-knowledge-graph/research/gold-intake-cpc-ipc-skos-seed.md` — the folded note (FULL): source nugget `patents-mcp-server#7`, recommended P0/P1/P2 integration, and cautions.
- `goals/ip-law-knowledge-graph/research/ontology-grounding-corpus.md` — the sibling note holding the open **FalkorDB-vs-rebuildable-projection (P0)** storage question any seed-loading must respect.
- `goals/ip-law-knowledge-graph/SPEC.md` — confirm S7 WIPO IPC source-of-truth, node type #9 `ClassificationCode`, edge #4 `CLASSIFIED_AS`, ADR-005 (Cypher-only runtime, OWL design-time-only), and the scope-out of bulk corpus ingestion.
- `goals/ip-law-knowledge-graph/PLAN.md` + `ops/manifest.json` — which phase (P0 Ontology Research / P1 Schema Design) this folds into; all phases are PENDING.
- `packages/foundation/modeling/rdf/src/Vocab/Skos.ts` — the existing SKOS host (`broader`/`narrower`); reuse, do not rebuild.
- `explorations/_gold-intake/ROUTING.md` (row "IPC/CPC classification SKOS taxonomy seed", line ~57/71) — route `extend-goal`, primaryTarget `goals/ip-law-knowledge-graph`, cautions.

## Skills to invoke
- `/explore ip-law-knowledge-graph` — resume/track the packet and close the loop (manifest + README Trail + ATLAS).
- `repo-symbol-discovery` — confirm `@beep/rdf` SKOS/Vocab exports + the existing `ClassificationCode`/`CLASSIFIED_AS` surface before inventing any helper.
- `schema-model-specialist` — shape the `ClassificationCode` node + `CLASSIFIED_AS` edge from the `code → subclass → class → section` resolver as SKOS `broader`/`narrower`.
- `ontology-scout` — re-derive the authoritative WIPO IPC / EPO-USPTO CPC vocabulary from public master files (the hand-rolled subset is illustrative only).

## Task this session
Fold the note's recommendations into actionable P0/P1 guidance: (1) cite the CPC standards grounding + A–H+Y section map as the worked S7 example in P0; (2) encode the resolver walk onto the existing node #9 / edge #4 in P1 using `@beep/rdf` SKOS — no new node/edge types; (3) record the A–H+Y AI/ML+comms subset as a starter seed for P2/P3. STOP at the fold decision — do NOT edit `SPEC.md`/`PLAN.md`/`GOAL.md` or begin P0 execution; await goal-owner sign-off.

## Constraints (binding)
- **Non-invasive only.** This is a Case-A note; never modify the locked SPEC/PLAN/GOAL/manifest phases. Capture any actionable delta as note/README updates, not SPEC edits.
- **Capability-cited reuse.** Reuse `@beep/rdf` `Vocab/Skos.ts` + the already-reserved `ClassificationCode`/`CLASSIFIED_AS` types; do not introduce parallel vocab/host. Re-resolve every target against the live tree (gold hints are stale; `@beep/semantic-web` is not at `packages/foundation/modeling/semantic-web`).
- **Reimplement, don't copy.** `patents-mcp-server` license is unverified — treat upstream TS as pattern reference only; re-derive the CPC/IPC vocabulary from WIPO/EPO/USPTO master data and pin a scheme edition/date.
- **CPC ≠ IPC.** S7 is named "WIPO IPC"; the gold is CPC (the EPO/USPTO IPC extension, adds section Y). Model the relationship (`broadMatch`/`exactMatch`), don't conflate.
- **No SPARQL/OWL runtime (ADR-005).** Hierarchy resolution is a plain Cypher traversal; OWL/SKOS stays design-time authored vocabulary, a rebuildable projection — never a second source of truth (respect the P0 FalkorDB open question).
- **Dependencies are siblings, not blockers.** `court-vocabulary-resolver` is an *exploration* (not yet a goal); the `patents://cpc/{code}` MCP resource is a deferred downstream idea for `packages/drivers/nlp-mcp` — out of this packet's "no UI/endpoint" scope.

## Done when
- The note's P0/P1/P2 recommendations are confirmed actionable against the live SPEC surface and `@beep/rdf`, the CPC≠IPC + license + projection cautions are restated for the goal owner, and the loop is closed (manifest stage note + README Trail/Next-Open-Question + `explorations/ATLAS.md`) — with zero SPEC/PLAN/GOAL edits.
````


### `agent-governance-control-plane`

**Type:** fold-note · **Wave:** P2 · **Stage:** spec-package-bootstrap (P0 pending)

**Skills:** `/goal follow the instructions in goals/agent-governance-control-plane/GOAL.md` · `repo-symbol-discovery` · `effect-services` · `schema-first-development`

**Next:** Owner decides the integration path (preferred: downstream consumer overlay over @beep/epistemic + @beep/observability) before any code lands.

````markdown
# Handoff: agent-governance-control-plane  (fold-note | Wave P2 | stage spec-package-bootstrap, P0 pending)

You are resuming the `agent-governance-control-plane` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). A dated Case-A research note has folded in two deferred runtime governance primitives — a previewable, filter-gated bulk-mutation op and a tamper-evident agent/LLM+tool-call audit trace — surfaced by the gold-intake pass; your job is to help the owner decide how (and whether) to act on them, NOT to splice them into the SPEC.

## Read first (ground-truth before acting)
- `goals/agent-governance-control-plane/research/gold-intake-governance-controls.md` — the folded note (FULL): the two nuggets, net-new contribution, the 3 recommended non-invasive folds, and the cautions (tamper-evidence, ethical-wall, altitude).
- `goals/agent-governance-control-plane/SPEC.md` — skim: this packet owns the **agent-development process** law-canon (13 Core Governance Laws, ADR-003/005), NOT a runtime data-plane.
- `goals/agent-governance-control-plane/PLAN.md` + `ops/manifest.json` — phases P0–P5 all `pending`; note `researchReports`/openQuestions and that P4 is "Enforcement And Verification Contract".
- `goals/agent-governance-control-plane/ops/prompt-assets/CONSUMER_SPEC_BOOTSTRAP_TEMPLATE.md` — the inherit-this-packet contract the preferred fold routes through.
- `explorations/_gold-intake/ROUTING.md` (line ~413 / row "Governance control plane") — route `extend-goal`, secondary targets, cautions.

## Skills to invoke
- `/goal follow the instructions in goals/agent-governance-control-plane/GOAL.md` — if/when the owner greenlights real execution of this packet's phases.
- `repo-symbol-discovery` — confirm the live substrate before inventing: `@beep/epistemic` `ApprovalGate`/`ClaimGate`/`ClaimLifecycle` (the stub the bulk-mutation primitive extends) and `@beep/observability` OTel spans (the trace source). Re-resolve every target against the live tree; the catalog hints are stale.
- `effect-services` / `schema-first-development` — only when a consumer overlay actually specs the two primitives (Effect v4 services, schema-first decode-at-boundary; the sources are plain TS / Effect v3 — port patterns, do not copy).

## Task this session
Confirm the fold is correctly placed and pick the integration path. The note recommends (1, preferred) a **downstream consumer overlay** inheriting this packet via the bootstrap template — bulk-mutation primitive landing in `packages/epistemic/server`, audit trace in `packages/foundation/capability/observability`, paired with `goals/agentic-professional-runtime`; (2) an additive design slice or P4 enforcement-evidence inside this packet without touching SPEC; (3) map to the Core Governance Laws when specced. STOP at the owner's decision — do NOT write a new SPEC, open a consumer packet, or edit this packet's SPEC/phases/scope this session.

## Constraints (binding)
- NON-INVASIVE: this is a Case-A note. Never edit this packet's SPEC/PLAN/GOAL/phases in place. Net-new or conflicting runtime scope = a sibling exploration or a dedicated consumer goal, not edits here.
- Altitude separation: this packet governs the agent-development **process**; bulk-mutation/audit are **runtime data-plane** primitives. Resist pulling data-plane implementation scope into the law-canon SPEC.
- Capability-cited before inventing: compose `@beep/epistemic` `ApprovalGate`/`ClaimGate` and `@beep/observability` spans; do not reinvent. No HAR `.har` parser — reconstruct from beep's own OTel/Effect spans, provider-neutral across the four drivers (`anthropic`, `openai-compat`, `xai`, `venice-ai`).
- Tamper-evidence is a hard requirement (routing caution): an append-only table does NOT satisfy it — flag hash-chaining (minimum) vs Merkle inclusion proofs as an open design decision, do not assume the source's "append-only" trail meets the bar.
- Ethical-wall awareness: the audit trace must be per-tenant/per-matter scoped (CurrentUser/RpcMiddleware identity) and never leak cross-matter activity.
- Licensing: `agentmemory` Apache-2.0, `research-squad` MIT — reimplement patterns with attribution, do not copy source.
- Close-the-loop: if you change anything, update `ops/manifest.json` stage, the packet README Trail/Next-Open-Question, and `explorations/ATLAS.md` (single-writer). Surface, never revert, any out-of-scope working-tree changes from the user's parallel session.

## Done when
- The owner has an explicit recommendation (path 1 vs 2 vs 3) with the tamper-evidence design decision flagged, the fold is confirmed non-invasive (SPEC untouched), and no new packet/SPEC was created without sign-off.
````


### `epistemic-claim-lifecycle-gate`

**Type:** fold-note · **Wave:** P2 · **Stage:** completed-retained (P0–P3 complete); research note folded under research/

**Skills:** `/explore epistemic-claim-lifecycle-gate` · `repo-symbol-discovery` · `schema-model-specialist` · `effect-services`

**Next:** Decide the downstream home for the additive net-new and draft a fresh goal/exploration packet; do not touch the shipped gate.

````markdown
# Handoff: epistemic-claim-lifecycle-gate  (fold-note | Wave P2 | stage completed-retained)

You are resuming the `epistemic-claim-lifecycle-gate` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). This goal is **completed-retained (Case C)** — all four phases shipped (11 epistemic tests green). A gold-intake research note is already folded under `research/`; it surfaces a small additive net-new (SHACL severity-aware admit policy + non-blocking warnings, source-span/provenance on validation results, a deterministic scoring/dealbreaker tier). Your job is to confirm that note and route its net-new into a **fresh** packet — the shipped SPEC/gate is reference-only and is never reopened in place.

## Read first (ground-truth before acting)
- `goals/epistemic-claim-lifecycle-gate/research/gold-intake-claim-gate-shacl.md` — the folded note (read FULL): what is already shipped vs. the genuine net-new, the four integration options, and the Cautions.
- `goals/epistemic-claim-lifecycle-gate/SPEC.md` — skim Non-Goals + locked decisions (bounded SHACL, federation invariant, zero source-domain vocab).
- `goals/epistemic-claim-lifecycle-gate/ops/manifest.json` — `lifecycle: completed-retained`, `consumedBy: law-practice-office-action-spike`.
- `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` (`toVerdict`) + `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts` — the live `admitted | rejected` shape + `ClaimGateSeverity`.
- `packages/foundation/capability/semantic-web/src/adapters/shacl-engine.ts` — the adapter that hardcodes `severity: "violation"` (the bounded-change point).
- `explorations/_gold-intake/ROUTING.md` (line ~54/75) — this cluster row: route `mixed`, primaryTarget this packet, caution "Do NOT reopen the completed gate; severity reporting attaches as an additive validation-result field."

## Skills to invoke
- `/explore epistemic-claim-lifecycle-gate` — drive/resume the routing decision and (if approved) scaffold the fresh downstream packet.
- `repo-symbol-discovery` — before inventing any `ClaimScore` / warning field, confirm `ShaclSeverity`, `ClaimGateViolation`, `Evidence.span`, `ShaclValidationViolation` actually exist and reuse them.
- `schema-model-specialist` — for the additive `ClaimGateResult` warnings field / span-carrying violation (LiteralKit, tagged-union additivity).
- `effect-services` — if the scoring/dealbreaker tier lands as a new `packages/epistemic/use-cases` service composed after the gate.

## Task this session
Confirm the folded note is accurate against the live tree, then **decide the downstream home** for the net-new and draft a fresh goal/exploration packet (do NOT extend this SPEC). STOP at the routing decision / packet skeleton — await user sign-off before any implementation. Do not edit `SPEC.md`, `PLAN.md`, `GOAL.md`, phases, or the `completed-retained` status.

## Constraints (binding)
- **Case C only**: net-new graduates as a FRESH goal via the public surface (`packages/epistemic/{domain,use-cases}` are the named secondary targets). No in-place reopen of the shipped `admitted | rejected` contract.
- **Federation invariant (locked)**: any new result/score is a read-only value object; the projection/verdict never gains a write capability.
- **Bounded SHACL stays bounded (locked)**: engine limited to `targetClass / minCount / maxCount / datatype`. Emitting real `warning`/`info` (changing the hardcoded `severity: "violation"`) is itself a deliberate bounded change to weigh, not a free side effect. Non-blocking warnings are a **beep-side admit policy** over `sh:conforms` (W3C: severity is display-only, conforms iff zero results).
- **Zero IP-law AND zero source-domain (recruiting) vocabulary** in the epistemic slice: port the *shape* of `TalentScore#5` (typed dimensions → weight matrix → explainable score → dealbreakers), never its domain terms.
- Re-resolve every target against the live filesystem; the gold `finalBeepTarget` hints are stale. The user works the same tree in parallel — surface, never revert, out-of-scope changes.

## Done when
- The folded note's claims are verified against live `ClaimGate`/`semantic-web` source; the downstream home is chosen (new goal vs. sibling exploration) and a skeleton/routing decision is drafted with the four integration options weighed; `ops/manifest.json`, packet README Trail/Next-Open-Question, and `explorations/ATLAS.md` are updated; STOP for user sign-off before implementation.
````


### `workspace-thread-domain`

**Type:** fold-note · **Wave:** P2 · **Stage:** completed-retained (P0-P3 complete); advisory research note folded

**Skills:** `schema-model-specialist` · `repo-symbol-discovery`

**Next:** Owner reviews the folded note and decides: land branchIndex as a tiny additive follow-up PR, or open a fresh extend packet.

````markdown
# Handoff: workspace-thread-domain  (fold-note | Wave P2 | stage completed-retained)

You are resuming the `workspace-thread-domain` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). The packet is **completed-retained** (P0-P3 all green); a gold-intake research note has been folded in proposing one additive refinement: a `branchIndex` sibling-variant discriminator on the `Turn` entity. Your job is to help the owner decide whether (and how) to land it — NOT to reopen the closed goal.

## Read first (ground-truth before acting)
- `goals/workspace-thread-domain/research/gold-intake-conversation-branching.md` - the FULL folded note: what already ships, what `branchIndex` adds, the non-invasive integration shape, and the cautions. Read this end-to-end first.
- `goals/workspace-thread-domain/SPEC.md` - Constraints + Non-Goals; note the "No candidate-state gating of thread content" Non-Goal that bounds this change.
- `packages/workspace/domain/src/entities/Turn/Turn.model.ts` - the live `Turn` (`BaseEntity.Class`): existing `parentTurnId` (lineage edge) and `turnIndex` (linear position). Re-resolve this path at action time; the field set may have shifted.
- `packages/workspace/use-cases/src/aggregates/Thread/ThreadTimeline.ts` + `packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts` - the lineage-walking read surfaces, the natural (optional, later) consumers of sibling-aware traversal.
- `explorations/_gold-intake/ROUTING.md` - the "Conversation branching (branchIndex sibling ordering)" row (route `extend-goal`, primaryTarget `goals/workspace-thread-domain`, secondary `packages/workspace/domain`) for provenance.

## Skills to invoke
- `repo-symbol-discovery` - confirm `NonNegativeInt` (from `@beep/schema`) and the `EntitySchema.persist.int` descriptor pattern are still the canonical bricks before touching `Turn.model.ts`. Capability-cite, do not invent.
- `schema-model-specialist` - if the owner greenlights landing the field: add `branchIndex` schema-first on `BaseEntity.Class`, regenerate the table column, and author the additive `db-admin` migration.

## Task this session
Present the folded note's recommendation to the owner and get an explicit GO / NO-GO. STOP and await that decision before writing any code. If GO, the minimal increment is: (1) `branchIndex: NonNegativeInt` (default `0`) + matching `EntitySchema.persist.int({ columnName: "branch_index" })` on `Turn`, with a composite `(parent_turn_id, branch_index)` index intent; (2) regenerate `Turn.table.ts` + an additive `db-admin` migration (`NOT NULL DEFAULT 0`, PGlite-safe); (3) read-surface traversal is explicitly deferred. Do NOT do (1)-(3) speculatively — they are gated on the owner's call.

## Constraints (binding)
- **Non-invasive (Case A).** The packet is completed-retained: do NOT edit `SPEC.md`, `PLAN.md`, `GOAL.md`, phases, or `ops/manifest.json` lifecycle/status. Landing the field is a *new* increment (fresh follow-up PR or tiny extend packet), not a reopen of P0-P3.
- **Respect the candidate-gating Non-Goal.** `branchIndex` is structural sibling ordering ONLY — never an approval/candidate-state field. Candidate lifecycle lives in the epistemic claim-gate / deferred `ProposeCandidateOutputSet` packet, not here.
- **Do not conflate `turnIndex` and `branchIndex`.** `turnIndex` = linear position in the thread; `branchIndex` = which variant among siblings sharing a `parentTurnId`. Document both.
- **Reimplement, do not copy (licensing).** The `LegalEase#7` nugget is a 2-line SQLAlchemy pattern from an external repo with unverified license; re-express it schema-first in Effect. No code port.
- **Ground-truth at action time.** The user works the same tree in parallel; re-resolve every path against the live filesystem and surface (do not revert) any unexplained out-of-scope working-tree changes.

## Done when
- The owner has an explicit GO/NO-GO on landing `branchIndex`, with the non-invasive path (new increment, not reopen) and the candidate-gating boundary made clear. If NO-GO, the note stays as the advisory record and nothing else changes.
````


### `agentic-professional-runtime`

**Type:** fold-note · **Wave:** P2 · **Stage:** goal-active (P1/P4 pending; research note folded as Case-A extend)

**Skills:** `repo-symbol-discovery` · `schema-model-specialist` · `effect-services`

**Next:** Owner triages the 5 recommended-integration items in the folded note into PLAN backlog/phases without amending SPEC.

````markdown
# Handoff: agentic-professional-runtime  (fold-note | Wave P2 | stage goal-active, research note folded)

You are resuming the `agentic-professional-runtime` goal packet (Gold-Intake initiative; provenance in `explorations/_gold-intake/ROUTING.md`). A gold-intake research note (agent Skills + cost-tiered routing + ethical-wall identity) has already been folded as a non-invasive Case-A extend; this session triages its recommended integrations into the packet's own PLAN/phase process — it does NOT rewrite SPEC.

## Read first (ground-truth before acting)
- `goals/agentic-professional-runtime/research/gold-intake-agent-skills-ethical-wall.md` - the folded note (FULL): net-new items, the 5 recommended-integration folding points, and Cautions. This is your work surface.
- `goals/agentic-professional-runtime/SPEC.md` - skim the "Non-Negotiable Contract", "Autonomy Boundary", "Initial Slice Topology" (do not edit).
- `goals/agentic-professional-runtime/PLAN.md` + `ops/manifest.json` - phase order (P1/P4 pending, P2/P3 complete), `activeVerticalNotes` rung-0→LLM-extraction next step, `approvalPolicy: strict-candidate-review`.
- `packages/agents/domain/src/entities/Skill/Skill.model.ts` - the `{ fixtureKey, name }` Skill stub the note proposes to grow.
- `packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts` - the hardcoded `orgId: 1` the ethical-wall `CurrentUser` swap targets.
- `explorations/_gold-intake/ROUTING.md` - cluster row (line ~39/379): route `mixed`, primaryTarget this packet, secondary targets + cautions.

## Skills to invoke
- `repo-symbol-discovery` - re-verify the live state of every named stub/symbol (`Skill`, `Agent`, `ProfessionalRuntime`, `RuntimeApprovalGate`, `CurrentUser`) before proposing anything; the note's path hints may be stale.
- `schema-model-specialist` - if growing the `Skill` entity (prompt body, tool allowlist, cost-tier/disclaimer fields) is sequenced into a phase.
- `effect-services` - for the `CurrentUser` `Context.Tag` + `RpcMiddleware.Tag` ethical-wall identity shape (cross-cutting, coordinate-only).

## Task this session
Triage the note's 5 "Recommended integration" items into PLAN backlog entries / candidate phases, ranked by the packet's active law vertical. STOP at owner sign-off on the sequencing — do NOT amend SPEC, do NOT land the `CurrentUser`/`RpcMiddleware` ethical-wall change (it is a cross-cutting standards decision spanning workspace, law-practice, iam, and the `tenancy` slice). Record outcomes in PLAN + README Trail + `ops/manifest.json`; update `explorations/ATLAS.md` (single-writer).

## Constraints (binding)
- NON-INVASIVE: extend via PLAN/phase sequencing and this folded note only; never edit SPEC/GOAL/locked decisions in place. Re-resolve every target path against the live tree (note hints are stale); never revert unexplained out-of-tree changes.
- The disclaimer / not-legal-advice gate is a compliance INVARIANT (enforced output contract), not optional UX; it reinforces the locked strict candidate→approval boundary. The triage gate (`research-squad#13`) must PRECEDE and never weaken that gate.
- Capability-cited reuse: compose `@beep/provenance` TextAnchor spans, the epistemic candidate-gate spine, `@beep/uspto`, and the anthropic kernel; reimplement gold prompts natively (port-by-reimplementation) and re-ground all "sources" on real provenance spans — confirm each source repo's license before lifting text.
- Ethical-wall identity belongs at the shared server boundary and must stay consistent with org-first tenancy; coordinate with siblings `explorations/mcp-auth-gated-registration`, `goals/agent-governance-control-plane`, and (USPTO depth) `explorations/uspto-patent-driver-depth` — do not unilaterally land it here.

## Done when
- The 5 integration items are sequenced into PLAN (phase or labeled backlog) with the ethical-wall item flagged coordinate-only, SPEC untouched, and PLAN + README Trail + manifest + ATLAS updated; owner has signed off on the sequencing.
````

