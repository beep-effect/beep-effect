# Dependency Sweep 1

## legal-document-intake

**Remaining phases**

- P4 — Extraction to KG loop (`pending`). (`goals/legal-document-intake/ops/manifest.json:77-79`)
- P5 — Retrieval + viewer (`pending`). (`goals/legal-document-intake/ops/manifest.json:82-84`)
- P6 — M365 write + dual DMS (`pending`). (`goals/legal-document-intake/ops/manifest.json:87-89`)
- P7 — Close (`pending`). (`goals/legal-document-intake/ops/manifest.json:92-94`)

**Proposed PR units**

Per-phase PRs: P4, P5, P6, and P7 should each ship separately. The PLAN states, “Each phase below ships as its own mergeable PR via `/yeet`,” and gives a distinct exit criterion for every remaining phase. (`goals/legal-document-intake/PLAN.md:8-9`, `goals/legal-document-intake/PLAN.md:19-22`)

**Frontend flag: yes**

P5 explicitly includes a “dock panel with span highlight” and the target surfaces name `apps/professional-desktop` for the viewer, Box setup UX, and RPC wiring. (`goals/legal-document-intake/PLAN.md:20`, `goals/legal-document-intake/SPEC.md:85-87`)

**dependsOn**

- `file-processing-capability` — “Extraction substrate (`@beep/file-processing`, Tika/libpff).” (`goals/legal-document-intake/README.md:50`)
- `m365-driver` — “Completed read-only driver; P6 adds write verbs behind the same DMS port.” (`goals/legal-document-intake/README.md:47`)
- `mcp-kit` and `mcp-host-retrofit`, conditional on shipping skills support — “In-flight MCP host infra; skills support (P4+) is gated on their merge.” (`goals/legal-document-intake/README.md:52`)

No other packet is treated as a prerequisite: the packet describes `agentic-professional-runtime` as a precedent rather than a gate, and the P4 skills portion may be deferred if the MCP packets block it. (`goals/legal-document-intake/README.md:51`, `goals/legal-document-intake/PLAN.md:110-111`)

**Special execution notes**

- Every phase PR needs an agent-run browser smoke over frontend + sidecar HTTP against a temporary vault. (`goals/legal-document-intake/PLAN.md:103-107`)
- The Box developer/test tenant remains unprovisioned. Clearing the P3 exception requires `CLOUD_BOX_TOKEN`, the env-gated live test, a live sync round-trip, and replacing the desktop env-token path with OAuth. (`goals/legal-document-intake/PLAN.md:95-102`)
- P6 must not improvise credentials or policy approval; Box/M365 test tenants must be arranged before execution. (`goals/legal-document-intake/SPEC.md:145-147`)
- Stop rather than inline blocked dependency work or expand into bidirectional sync, OCR, or a graph database. (`goals/legal-document-intake/SPEC.md:142-150`)

## agentic-professional-runtime

**Remaining phases**

- P1 — Product Interview Tightening (`pending`). (`goals/agentic-professional-runtime/ops/manifest.json:161-167`)
- P4 — Native First-Run Onboarding Design (`pending`). (`goals/agentic-professional-runtime/ops/manifest.json:199-202`)

**Proposed PR units**

Use separate PRs for P1 and P4. The PLAN separates product-interview outputs from the native onboarding design and assigns each its own exit criterion; combining them would couple independent product-document and app-flow decisions. (`goals/agentic-professional-runtime/PLAN.md:15-21`)

The separately tracked doctrine implementation rung (multi-reference section 103 plus section 101/112 handling) should also be its own implementation PR rather than being folded into either manifest phase. (`goals/agentic-professional-runtime/PLAN.md:56-69`)

**Frontend flag: yes**

P4 is a “Native first-run onboarding design,” and its remaining work explicitly covers the “first-run app flow” for dependency checks, runtime bootstrap, credentials, client connection, and workspace seed. (`goals/agentic-professional-runtime/PLAN.md:21`, `goals/agentic-professional-runtime/PLAN.md:68-75`)

**dependsOn**

None. The packet lists related surfaces as references and says they remain “source context and evidence,” not prerequisites. (`goals/agentic-professional-runtime/README.md:117-129`)

**Special execution notes**

- P1 remains open for user product-interview tightening; law is the sole active vertical and wealth is only a dormant proof fixture. (`goals/agentic-professional-runtime/README.md:19-27`, `goals/agentic-professional-runtime/README.md:131-137`)
- Keep deterministic test mode, synthetic/public fixtures, and the privilege wall while broadening doctrine handling. (`goals/agentic-professional-runtime/PLAN.md:63-66`)
- Real legal, financial, client, or private firm data must stay outside the repository. (`goals/agentic-professional-runtime/SPEC.md:62-63`)
- P4 must design credential and connector setup boundaries rather than silently assuming credentials. (`goals/agentic-professional-runtime/PLAN.md:68-75`)

## file-processing-capability

**Remaining phases**

- P2 — Tika Driver Completion (`pending`). (`goals/file-processing-capability/ops/manifest.json:268-271`)
- P3 — libpff Driver Completion (`pending`). (`goals/file-processing-capability/ops/manifest.json:274-277`)
- P4 — Repo CLI Proof Completion (`pending`). (`goals/file-processing-capability/ops/manifest.json:280-283`)
- P5 — Quality And Handoff (`pending`). (`goals/file-processing-capability/ops/manifest.json:286-289`)

**Proposed PR units**

Use per-phase PRs: P2 Tika, P3 libpff, P4 CLI/corpus proof, then P5 quality and handoff. The PLAN gives each phase an independent package boundary, implementation list, exit criteria, and package-local checks. (`goals/file-processing-capability/PLAN.md:118-180`, `goals/file-processing-capability/PLAN.md:182-236`)

**Frontend flag: no**

The remaining PLAN targets driver packages, the repo CLI, generated/operator-local corpus profiling, and quality evidence; it names no `apps/**`, `packages/**/ui/**`, or `.tsx` surface. (`goals/file-processing-capability/PLAN.md:118-180`, `goals/file-processing-capability/PLAN.md:182-236`)

**dependsOn**

None. The remaining phases build on this packet’s already-complete P1 vertical proof, not on another goal packet. (`goals/file-processing-capability/PLAN.md:51-57`, `goals/file-processing-capability/SPEC.md:73-88`)

**Special execution notes**

- P2 needs a reachable/configured Tika Server and must cover every non-PST V1 family. (`goals/file-processing-capability/PLAN.md:122-149`)
- P3 needs libpff executable discovery and either generated synthetic PST coverage or a documented public sample fallback. (`goals/file-processing-capability/PLAN.md:154-180`)
- Operator-local corpus profiling is optional; private corpus content must not become committed fixtures. (`goals/file-processing-capability/SPEC.md:84-88`)
- Stop product semantics, driver imports, native execution, Box, or product slices from leaking into `@beep/file-processing`. (`goals/file-processing-capability/PLAN.md:111-116`)

## ai-metrics-stack

**Remaining phases**

- P6 — Seven-Day Proof And Hardening (`in-progress`). (`goals/ai-metrics-stack/ops/manifest.json:112-114`)
- P6c — Pre-May-16 Readiness Ledger (`in_progress`). (`goals/ai-metrics-stack/ops/manifest.json:130-132`)
- P7 — Topology-First Productionization (`in-progress`). (`goals/ai-metrics-stack/ops/manifest.json:138-140`)
- P7c — Provider And Gateway Metrics (`pending`, non-V1-blocking). (`goals/ai-metrics-stack/ops/manifest.json:156-160`)
- P7d — Dashboard And Backend Expansion (`pending`, non-V1-blocking). (`goals/ai-metrics-stack/ops/manifest.json:163-167`)
- P7f — Forwarder Durability (`pending`, V1-blocking). (`goals/ai-metrics-stack/ops/manifest.json:170-176`)
- P7e — Production Readiness Closeout (`pending`, V1-blocking). (`goals/ai-metrics-stack/ops/manifest.json:178-183`)

**Proposed PR units**

Use three classes of PR unit: (1) a dedicated P7f durability PR; (2) a P6c/P7e proof-and-closeout PR after the final scorecard and confirmed mirror sync/status; and (3) separate optional P7c and P7d follow-up PRs. The PLAN explicitly makes P7f gate P7e, defines P7e’s final proof/mirror work, and marks P7c/P7d as non-blocking follow-ups. (`goals/ai-metrics-stack/PLAN.md:220-242`)

**Frontend flag: no**

No remaining work is assigned to `apps/**`, `packages/**/ui/**`, or `.tsx`. The named proof surfaces are `@beep/repo-ai-metrics`, `@beep/repo-cli`, `@beep/infra`, the proof runner, Pulumi, and operator CLI workflows; P7d says only “dashboard/backend expansion” without naming a repo frontend surface. (`goals/ai-metrics-stack/PLAN.md:240-257`)

**dependsOn**

None. P7f gates P7e, but both are phases of this same packet; no other packet slug is documented as a prerequisite. (`goals/ai-metrics-stack/PLAN.md:220-240`)

**Special execution notes**

- Preserve the pinned proof runner, timer budgets, source window, privacy contract, and active data root until the credited window closes. (`goals/ai-metrics-stack/PLAN.md:129-156`, `goals/ai-metrics-stack/PLAN.md:192-198`)
- P7f must repair Parquet export before the sanitized mirror is built, expose swallowed causes, add ingest-time deduplication, and chunk large derived writes; a pre-backfill DuckDB snapshot is preserved for the final scorecard. (`goals/ai-metrics-stack/PLAN.md:224-239`)
- Live closeout needs the dankserver tailnet/SSH route, confirmed mirror mutation, and remote status verification. (`goals/ai-metrics-stack/PLAN.md:206-223`)
- Secret-bearing operations use the existing 1Password references and injected runtime values; do not print or inline raw keys. (`goals/ai-metrics-stack/SPEC.md:141-145`)
- The final report is creditable only with at least one real outcome label and one benchmark run for the scored config snapshot. (`goals/ai-metrics-stack/SPEC.md:119-123`)

## semantic-foundation

**Remaining phases**

- M1 — Intake-Serving Semantic Seed (`pending`). (`goals/semantic-foundation/ops/manifest.json:60-62`)
- M2 — Classification Schemes (`pending`). (`goals/semantic-foundation/ops/manifest.json:65-67`)
- M3 — Docketing and Party Roles (`pending`). (`goals/semantic-foundation/ops/manifest.json:70-72`)
- M4 — ClaimGate Shapes (`pending`). (`goals/semantic-foundation/ops/manifest.json:75-77`)
- P3 — Yeet: PR to mergeable (`pending`). (`goals/semantic-foundation/ops/manifest.json:80-82`)
- P4 — Close (`pending`). (`goals/semantic-foundation/ops/manifest.json:85-87`)

**Proposed PR units**

Ship M1 as the current implementation PR, followed by P3/P4 closeout in that final-work PR if M2-M4 remain gated. If later gates open, ship M2, M3, and M4 as separate milestone PRs because the PLAN gives each a distinct gate and exit criterion. (`goals/semantic-foundation/PLAN.md:9-22`, `goals/semantic-foundation/PLAN.md:43-54`)

**Frontend flag: no**

The target surfaces are modeling/capability packages under `packages/foundation/**`; the PLAN names RDF, ontology, identity, semantic-web, seed data, and fixture proof only, with no app, UI package, or `.tsx` target. (`goals/semantic-foundation/SPEC.md:53-70`, `goals/semantic-foundation/PLAN.md:24-41`)

**dependsOn**

None. M1 starts now; M2-M4 are gated by product/research conditions within this packet, not by another goal packet completing first. (`goals/semantic-foundation/SPEC.md:82-83`, `goals/semantic-foundation/SPEC.md:96-101`)

**Special execution notes**

- M1 is the only open implementation slice; do not pull M2-M4 forward without their named gates. (`goals/semantic-foundation/PLAN.md:9-11`, `goals/semantic-foundation/SPEC.md:82-83`)
- M2 waits for the August 5 first-user metric or demo-day pull; M3 waits for M2 readiness plus explicit product pull; M4 waits for proven M1 consumer need and stable-enough M3 vocabulary. (`goals/semantic-foundation/SPEC.md:99-101`)
- Vendor TTL/OWL must remain in the gitignored exploration asset pack; only manifest/fetch metadata and repo-owned seed data are committed. (`goals/semantic-foundation/PLAN.md:61-64`)
- Stop if licensing/manifest safety fails or the work requires law-practice entities, intake workflow code, a graph store, SPARQL wiring, unnamed credentials, cost, or destructive approval. (`goals/semantic-foundation/SPEC.md:141-155`)

## harness-otel-adoption

**Remaining phases**

- P2 — Verify (`in-progress`). (`goals/harness-otel-adoption/ops/manifest.json:58-60`)
- P3 — Yeet: PR to mergeable + Close (`pending`). (`goals/harness-otel-adoption/ops/manifest.json:63-65`)

**Proposed PR units**

One final PR should contain P2 verification evidence and P3 closeout. The PLAN requires packet status updates and the reflection “in the same PR as the final work.” (`goals/harness-otel-adoption/PLAN.md:13-14`, `goals/harness-otel-adoption/PLAN.md:23-31`)

**Frontend flag: no**

Remaining work is a one-day coverage note, payload privacy spot-check, reflection, and packet status update; no remaining `apps/**`, `packages/**/ui/**`, or `.tsx` target is named. (`goals/harness-otel-adoption/README.md:35-40`, `goals/harness-otel-adoption/PLAN.md:13-14`)

**dependsOn**

None. The packet cites `ai-metrics-stack` for privacy and ownership contracts, but does not state that another packet must complete before P2/P3. (`goals/harness-otel-adoption/SPEC.md:15-23`, `goals/harness-otel-adoption/SPEC.md:44-46`)

**Special execution notes**

- Instrumentation is already live; P2 still needs one day of native telemetry versus transcript counts plus a trace-payload content spot-check. (`goals/harness-otel-adoption/README.md:35-40`)
- Content capture must stay off, and sampled spans/metrics must contain no prompt/response text. (`goals/harness-otel-adoption/SPEC.md:50-59`, `goals/harness-otel-adoption/SPEC.md:91-92`)
- Dankserver operator actions require confirmation; if further operator changes become necessary, propose exact commands and wait. (`goals/harness-otel-adoption/SPEC.md:106-113`)
- The PLAN’s phase statuses are stale (`pending`), while the manifest and README show P0/P1 complete and P2 active; use the manifest for execution status. (`goals/harness-otel-adoption/PLAN.md:9-14`, `goals/harness-otel-adoption/README.md:35-40`)

## professional-desktop-adversarial-qa

**Remaining phases**

- P1 — Adversarial QA and repair (`in-progress`). (`goals/professional-desktop-adversarial-qa/ops/manifest.json:43-45`)
- P2 — Convergence proof (`pending`). (`goals/professional-desktop-adversarial-qa/ops/manifest.json:48-50`)
- P3 — Yeet: PR to mergeable (`pending`). (`goals/professional-desktop-adversarial-qa/ops/manifest.json:53-55`)
- P4 — Close (`pending`). (`goals/professional-desktop-adversarial-qa/ops/manifest.json:58-60`)

**Proposed PR units**

One campaign PR at convergence. The charter specifies one commit per round and “Yeet publish at convergence,” while the manifest requires two consecutive clean rounds before the campaign ships. (`goals/professional-desktop-adversarial-qa/README.md:29`, `goals/professional-desktop-adversarial-qa/ops/manifest.json:20-24`)

**Frontend flag: yes**

The campaign explicitly covers the entire `apps/professional-desktop` frontend and uses browser/screenshots plus Tauri/native QA. (`goals/professional-desktop-adversarial-qa/README.md:5-9`, `goals/professional-desktop-adversarial-qa/README.md:22-26`)

**dependsOn**

None. No other packet slug is named as a prerequisite in the packet’s source-of-truth README or manifest.

**Special execution notes**

- Standing-campaign exit criterion: two consecutive full rounds with zero unwaived findings; findings require screenshots and reproduction steps, and a user waiver veto reopens the loop. (`goals/professional-desktop-adversarial-qa/README.md:5-9`, `goals/professional-desktop-adversarial-qa/README.md:18-19`)
- The packet has no `SPEC.md` or `PLAN.md`; its manifest anchors on `README.md`, which points to an external plan of record. (`goals/professional-desktop-adversarial-qa/ops/manifest.json:3-10`, `goals/professional-desktop-adversarial-qa/README.md:11-12`)
- Live QA requires real Anthropic, a narrowly fenced real Box mirror root, a dedicated Chrome profile, 1Password-injected environment values, and available browser/Tauri runtime services. (`goals/professional-desktop-adversarial-qa/README.md:20-25`, `goals/professional-desktop-adversarial-qa/README.md:31-45`)
- Browser and Tauri lanes must alternate because concurrent sidecars risk pglite contention; browser lanes are serialized. (`goals/professional-desktop-adversarial-qa/README.md:25`, `goals/professional-desktop-adversarial-qa/README.md:45-48`)
- Stop if required QA credentials/runtime services are unavailable or a finding requires destructive/out-of-scope external changes. (`goals/professional-desktop-adversarial-qa/ops/manifest.json:68-71`)

## Group summary

| slug | remaining | prUnits | frontend | dependsOn |
| --- | --- | --- | --- | --- |
| legal-document-intake | P4, P5, P6, P7 | per-phase PRs | yes | file-processing-capability; m365-driver; mcp-kit + mcp-host-retrofit (skills only) |
| agentic-professional-runtime | P1, P4 | per-phase PRs; doctrine rung separate | yes | none |
| file-processing-capability | P2, P3, P4, P5 | per-phase PRs | no | none |
| ai-metrics-stack | P6/P6c, P7/P7c/P7d/P7f/P7e | P7f; P6c+P7e closeout; P7c/P7d separately | no | none |
| semantic-foundation | M1, M2, M3, M4, P3, P4 | M1 now; gated milestones separately; close with final work | no | none |
| harness-otel-adoption | P2, P3 | one final verification + closeout PR | no | none |
| professional-desktop-adversarial-qa | P1, P2, P3, P4 | one campaign PR at convergence | yes | none |
