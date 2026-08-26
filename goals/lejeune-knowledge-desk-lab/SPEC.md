# LeJeune Knowledge Desk Lab Spec

## Objective

Build a disposable customer-demo lab with the working title "LeJeune Knowledge Desk." In one
fixed 30-minute scenario, a reviewer turns a fragmented RFQ into a reviewed quote with exact
source spans, drafts a cited specification-clarification RFI, approves a time-bound veteran
correction that changes the rerun, and ends on an approval-gated supplier PO draft plus a
clearly non-executing receipt.

The lab is offline-capable and available only to named tailnet users through Tailscale Serve,
MagicDNS HTTPS, and `/health`. It consumes the deterministic
`lejeune/demo-corpus-and-ontology` capability from
[`lejeune-demo-corpus-and-ontology`](../lejeune-demo-corpus-and-ontology/README.md).

Provenance: graduated 2026-08-26 from
[`explorations/lejeune-bolt-agentic-demo`](../../explorations/lejeune-bolt-agentic-demo/README.md).

## Non-Goals

These are the source brief's no-gos and excluded rabbit holes.

- No external write, quote send, supplier order, portal action, or state that implies
  execution. Approve/edit/reject creates internal records only.
- No public endpoint. Access is tailnet-only for named users, and the scenario remains fully
  offline-capable.
- No scraped third-party content, real correspondence, or raw corpus payload in the repository.
- No claim that the assistant is an engineer of record or may approve substitutions,
  compliance, price, margin, or purchasing authority.
- No current price, availability, supplier, project, or certificate claim without a source and
  as-of date. Lunch offers and certificates are labeled `SYNTHETIC`.
- No "AI magic" claim. Every extraction, answer, remembered correction, and draft action
  exposes its source, review state, uncertainty, and stop point.
- No live supplier portal, API, punchout, EDI, browser automation, or seller connector.
- No real M365, PST, tenant consent, mailbox backfill, or attachment-ingest work.
- No full TrustGraph runtime and no copied code from the unlicensed TypeScript port.
- No Tauri implementation and no Semantica implementation.
- No general fastener, ERP, standards, or semantic-memory platform.
- No copied product catalog, copyrighted standard, or whole third-party technical document.
- No static-image graph stand-in if the browser-rendered graph misses its timebox.

## Source Hierarchy

1. The ratified
   [`DECISIONS.md`](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md), especially the
   2026-08-26 shape-review decisions.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture, lab-app, UI, schema-first, Effect-first, and browser-QA standards.
4. The source exploration's
   [`BRIEF.md`](../../explorations/lejeune-bolt-agentic-demo/BRIEF.md) and
   [`MAP.md`](../../explorations/lejeune-bolt-agentic-demo/MAP.md).
5. The sibling bundle packet's
   [`SPEC.md`](../lejeune-demo-corpus-and-ontology/SPEC.md).
6. This `SPEC.md`.
7. `PLAN.md`.
8. `GOAL.md`.
9. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Exactly one new workspace package: the proposed `lejeune-bolt-workbench` lab (under
  `apps/labs/`), created only with `bun run beep create-package`.
- The lab's beep-branded one-screen RFQ, evidence, specification, quote, veteran-claim, and PO
  review surface.
- Lab-local schemas, internal records, Effect API composition, fixtures, replay adapter,
  service packaging, and `/health`.
- One Tailscale Serve mapping to a MagicDNS HTTPS name for named tailnet users.
- `goals/lejeune-knowledge-desk-lab/` for contracts, browser-QA evidence pointers, service
  proof, and closeout history.

The lab exports no reusable public API. Any later promotion requires a separate decision and
goal.

## Constraints

### Lab lifecycle and repository law

- The lab is a full code-law citizen. Use the package generator; never create it with `mkdir`.
- Keep all customer-specific schemas, review behavior, operations, and UI lab-local.
- Budget roughly half a day for package gates, schema-first modeling, JSDoc requirements, and
  repository-quality work.
- The lab charter and mutable corpus carry a 2026-09-30 delete-or-promote date. Delete them then
  unless an explicit promotion or consented pilot grants a new disposition.

### Walking skeleton and graph timebox

- Land the one-screen scaffold on day 1.
- By the end of day 2, the complete 30-minute story is clickable end-to-end on stub data. Do not
  build isolated back-end depth while a story beat is absent.
- Give `@beep/cosmos` no more than half a day of browser time on day 2. If the demo graph does
  not render inside the timebox, ship the table-and-source view with no renegotiation.
- A static screenshot or other image stand-in does not satisfy the fallback.
- Replace stubs with bundle-backed results on days 3 and 4 without changing the fixed scenario.

### Review and action boundary

- Quote review, expert-claim review, and PO review expose approve, edit, and reject.
- Each decision creates an internal immutable or append-only review record with actor, time,
  source version, result, and supersession where applicable.
- A veteran correction records its source, reviewer, valid-from date, scope, and superseded
  claim. The source-veteran, active-successor, and appropriate technical or commercial roles
  are represented in the review evidence.
- The same RFQ rerun must show exactly what the approved correction changed.
- Quote send and PO submission are impossible: no connector, tool, route, button state, or
  receipt may imply that an external action occurred.
- The supplier closing beat shows neutral offer comparison, policy and evidence checks, a PO
  draft, and a receipt labeled as non-executing.

### Evidence and replay

- The RFQ view opens exact spans from the two fixed layouts and identifies missing facts rather
  than guessing.
- The specification beat opens the cited governing excerpt and drafts an advisory RFI. It never
  approves a substitution or compliance outcome.
- All supplier offers and certificates are dated and labeled `SYNTHETIC`.
- The lunch uses recorded provider output from the deterministic bundle. Any live provider call
  is an optional flourish only after a clean rehearsal.
- Every beat exposes source, review state, uncertainty, and stop point.
- A fixed-output path must run the full scenario with network and provider unavailable.

### Delivery boundary

- Run one web artifact and one Effect API process. Follow the repository's portless scripts;
  do not launch raw framework dev servers or depend on numeric localhost URLs.
- Expose `/health` without message bodies, raw corpus content, secrets, or customer data.
- Prove one Tailscale Serve mapping and MagicDNS HTTPS endpoint. No public listener or public
  tunnel is allowed.
- The day-5 fixed-scenario rehearsal is recorded through `bun run beep qa`; the evidence must
  cover every gesture-bearing beat and the offline fallback.

## Decision Log

Binding detail remains in the exploration; these rows identify what this goal executes.

| Decision | Packet consequence |
| --- | --- |
| [Demo architecture](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--demo-architecture) | Build the disposable beep-branded lab, not TrustGraph or Semantica. |
| [Lunch use cases](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--lunch-use-cases-and-closing-beat) | RFQ, cited RFI, veteran correction, then non-executing PO draft. |
| [Deployment](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--deployment-boundary) | Tailnet-only MagicDNS HTTPS with a fully offline scenario. |
| [PO boundary](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--how-should-the-draft-only-po-closing-beat-look) | Internal approve/edit/reject and explicit no-submit receipt. |
| [Claim review](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--who-reviews-veteran-memory-claims-in-a-pilot) | Record reviewer roles, validity, scope, source, and supersession. |
| [Single lab package](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--single-lab-package) | One generated package; bundle and app remain lab-local. |
| [Walking skeleton](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--walking-skeleton-schedule) | Full stubbed story by day 2; real data swaps in on days 3-4. |
| [Cosmos fallback](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--cosmos-timebox-and-fallback) | Half-day browser timebox, then table and source; never a static image. |
| [Governance and QA](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-26--governance-tax-and-recorded-qa) | Reserve half a day and record the day-5 rehearsal. |
| [Disposition date](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md#2026-08-25--what-deletion-date-governs-the-lab-and-corpus) | Delete or explicitly promote the lab and mutable corpus on 2026-09-30. |

## Acceptance Criteria

- [ ] The lab was created through `bun run beep create-package`, passes the Labs lane, obeys
      full repository law, and exposes no reusable shared API.
- [ ] By end of day 2, one screen runs every fixed story beat on stubs, including all review
      choices and the non-executing receipt.
- [ ] RFQ evidence opens exact spans from both layouts and shows at least one missing field per
      layout without invention.
- [ ] The cited specification check opens its source and revision and drafts an advisory RFI.
- [ ] The quote compares dated `SYNTHETIC` offers, exposes citations and uncertainty, and
      records approve/edit/reject without a send path.
- [ ] A reviewed, time-bound veteran correction records source, reviewer roles, scope,
      validity, and supersession; rerunning the RFQ visibly changes the warning.
- [ ] The supplier PO beat records approve/edit/reject and emits a visibly non-executing
      receipt; submission remains structurally impossible.
- [ ] `@beep/cosmos` either passes its half-day browser proof or is absent from the lunch path
      in favor of the working table-and-source fallback; no static image stands in.
- [ ] The same complete scenario runs from the fixed bundle with provider and network
      unavailable.
- [ ] One web artifact, one Effect API process, `/health`, Tailscale Serve, and MagicDNS HTTPS
      are proven for named tailnet users, with no public endpoint.
- [ ] The day-5 `bun run beep qa` recording covers the fixed scenario and offline fallback.
- [ ] The lab charter and mutable corpus expose the 2026-09-30 delete-or-promote date.
- [ ] All source-brief no-gos remain true and no unrelated refactors or formatting churn land.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/lejeune-knowledge-desk-lab/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lejeune-knowledge-desk-lab/ops/manifest.json` | Passes |
| Package provenance | Generator receipt and Labs lane | One generated lab; green |
| Stub story | Browser scenario on day 2 | Every beat clickable end-to-end |
| Bundle integration | Fixed-scenario tests | Both RFQs, RFI, quote, correction, rerun, PO receipt |
| Action boundary | Route, tool, and UI inventory plus tests | No quote-send or PO-submit path |
| Offline mode | Provider and network disabled | Complete fixed story passes |
| Tailnet delivery | `/health`, Serve status, and MagicDNS HTTPS evidence | Healthy for named users; no public endpoint |
| Gesture QA | Day-5 `bun run beep qa` record → extract → judge | Schema-valid evidence; zero required findings |
| Repository quality | `bun run beep yeet verify` | Green on the final tree |
| Whitespace | `git diff --check -- goals/lejeune-knowledge-desk-lab` | Passes |

## Stop Conditions

- The bundle capability is missing or materially contradicts this fixed scenario.
- Implementation creates the lab without the package generator or proposes another package.
- Any public endpoint, external write, quote-send path, PO-submit path, portal automation, or
  real customer data enters scope.
- A story beat cannot expose its source, review state, uncertainty, or stop point.
- Offline replay or the table-and-source fallback cannot complete the full scenario.
- Verification requires unnamed credentials, cost, destructive side effects, or policy
  approval.
- The work exceeds the five-day fixed-scenario appetite or the same blocker repeats after
  reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
