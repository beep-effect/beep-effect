# Review Verdict Envelope Spec

_Date: 2026-10-14. Graduated from
[`explorations/attorney-review-workspace`](../../explorations/attorney-review-workspace/README.md)._

## Objective

Give every producer that needs the attorney's judgement one review envelope, and prove the
surface it will be judged in before anyone builds that surface. Observably:

1. **Evidence.** A spike report under `history/` records the attorney's answer to one plain
   question (which app he works in every day: Outlook, Word, Claude Code, or the Claude desktop
   app) and a pass/fail result with evidence for spikes S1, S3, S2, S4, S6 and S8 plus the
   one-hour Claude for Word check. S1 and S3 carry an explicit go/no-go.
2. **Schema.** `@beep/law-practice-domain` exports:
   - `ReviewItem`, a tagged union by `kind`: `kg-answer`, `claim-finding`, `oa-analysis`,
     `drawing`, `classification`, `draft-text`. The `claim-finding` member carries
     `claimId: CandidateClaimId` (from `@beep/shared-domain/identity/Epistemic`);
   - `SourceRef`: `boxFileId`, an optional `page`, and a `quote` in the W3C TextQuoteSelector
     shape (`exact`, optional `prefix`, optional `suffix`);
   - `VerdictRow`: `itemId`, `batchId` (the review batch, one sitting or queue run), `verdict`
     (`right | wrong | partly`), an optional `note`, `revision`, `recordedAt`
     (`DateTimeUtcFromMillis`), and an optional `lockedAt`. Rows are append-only, and undo is a
     superseding revision. **A lock closes one batch:** after a row with `lockedAt` for a given
     `batchId`, later writes to that batch fail with a typed error. New items get verdicts in a
     new batch with a fresh `batchId`. Earlier rows stay in the one log and remain grouped by
     their `batchId`, so history is never lost.
3. **Services.** `@beep/law-practice-use-cases` exports `ReviewQueue` and `VerdictProjector` as
   `Context.Service` contracts with implementations. The projector takes the `VerdictRow`s and
   a `resolvedBy: Principal`. For each `claim-finding` item whose latest verdict is final, it
   returns a `ClaimDispositionProjection` value, not the persisted entity: `claimId`, `status`,
   `reason`, `resolvedAt` (the deciding row's `recordedAt`), `resolvedBy`, `violations: []`.
   The epistemic owner completes it into a `ClaimDispositionAppend`. The mapping:
   - `right` → `active`, reason "Attorney confirmed the finding";
   - `wrong` → `rejected`, with the note as the reason, or "Attorney rejected the finding"
     when no note was given;
   - `partly` → no projection (`Option.none`). The claim stays unresolved and returns to the
     queue.
4. **Verify (spike S5).** One `claim-finding` fixture travels the
   [first vertical slice](../../explorations/attorney-review-workspace/MAP.md#first-vertical-slice)
   in a unit test: decode, queue, `wrong` with a note, undo (superseding revision), re-judge
   `right`, lock, project to a `ClaimDispositionProjection` with `status: active`.
5. **Handoff.** The `practice-claude-mod` owner has received the written amendment
   ([`AMENDMENT-practice-claude-mod.md`](../../explorations/attorney-review-workspace/research/AMENDMENT-practice-claude-mod.md)):
   the review-queue phase and the D9 widening to Box read tools plus `$.prompt.fill`. If S1
   failed, the delivered text is the row-only fallback and the exploration is reopened at
   `decompose`.

## Non-Goals

From the brief's no-gos ([`BRIEF.md`](../../explorations/attorney-review-workspace/BRIEF.md#no-gos)):

- No annotation-workspace core, no artifact or Claude Doc review surface, no tailnet review pages.
- No Box writes from review: no comments, no metadata.
- No `$.prompt.submit` and no `$.model.*`.
- No second surface for any one work-product type.
- No client files in spikes, fixtures, or the repo.
- No edits to the `practice-claude-mod` packet or plugin code; its owner applies the amendment.

Also out of scope here:

- Building the `/review` pane, band count, or any mod code beyond the throwaway spike mods.
- The gated re-entry points kept in the exploration's
  [`MAP.md`](../../explorations/attorney-review-workspace/MAP.md#candidate-goal-packets):
  `drawing-review-pins` (spike S7), `draft-review-in-word`, and a mod-owned side chat.
- Wiring `claim-element-graph` producers to emit `ReviewItem`s; that goal consumes this one.
- Persisting `ClaimDisposition` rows. The projector returns values; storage stays with the
  epistemic owner.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict. The source exploration is evidence,
not contract: where it and this file disagree, this file wins and the gap is logged below.

## Target Surfaces

| Surface | Path | Role | HAVE / NET-NEW |
| --- | --- | --- | --- |
| Spike report | `goals/review-verdict-envelope/history/spikes-<YYYY-MM-DD>.md` | P0 evidence | NET-NEW |
| `SourceRef` | `packages/law-practice/domain/src/values/SourceRef/SourceRef.model.ts` | `.model.ts` | NET-NEW |
| `ReviewItem` tagged union + kind literals | `packages/law-practice/domain/src/values/ReviewItem/ReviewItem.model.ts` | `.model.ts` | NET-NEW |
| `VerdictRow` + verdict literals | `packages/law-practice/domain/src/values/VerdictRow/VerdictRow.model.ts` | `.model.ts` | NET-NEW |
| Domain barrel | `packages/law-practice/domain/src/values/index.ts` | export | EDIT |
| Domain tests | `packages/law-practice/domain/test/ReviewVerdict.test.ts` | decode/encode proof | NET-NEW |
| `ReviewQueue` contract + impl | `packages/law-practice/use-cases/src/ReviewQueue/ReviewQueue.{ports,service}.ts` | `.ports.ts` / `.service.ts` | NET-NEW |
| `VerdictProjector` contract + impl | `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.{ports,service}.ts` | `.ports.ts` / `.service.ts` | NET-NEW |
| Use-cases barrel | `packages/law-practice/use-cases/src/index.ts` (and `public.ts` if that is where services surface) | export | EDIT |
| S5 round-trip test | `packages/law-practice/use-cases/test/ReviewVerdict.roundtrip.test.ts` | unit proof | NET-NEW |
| Changeset | `.changeset/<name>.md` (minor for both packages) | release note | NET-NEW |
| Quote shape reference | `DurableLocator` quote struct in `packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts`; `TextQuoteSelector` in `@beep/rdf` (`Evidence.ts`) | reuse or align | HAVE |
| `ClaimDispositionProjection` schema | `packages/law-practice/use-cases/src/VerdictProjector/VerdictProjector.model.ts` (this packet; not `@beep/epistemic-domain`, which keeps its persisted `ClaimDisposition`) | `.model.ts` | NET-NEW |
| Projection target | `ClaimDisposition` and `ClaimDispositionStatus` in `@beep/epistemic-domain` | projection target | HAVE (already a use-cases dependency) |
| Service pattern | `packages/law-practice/use-cases/src/DocketIntake/`, `PatentClaimCandidate/` | ports/service layout | HAVE |

No other path is touched. `@beep/law-practice-domain` gains no new package dependency.

## Constraints

From the brief's rabbit holes and the repo laws:

- **Design order:** schema (P1) → `Context.Service` contract → implementation (P2). Helpers are
  extracted only after the contract is fixed.
- **Effect v4 only.** Import each module from `effect/<Module>`. Validate APIs against the Effect
  reference checkout, not memory.
- **Schema style:** `S.Class` / tagged-union schemas with `$I` identity annotations; `LiteralKit`
  for the `kind` and `verdict` literal domains; no exported `interface`/`type` data models; schema
  defaults where safe.
- **Collections:** `effect/HashMap`, `effect/HashSet`, `MutableHashMap`, `MutableHashSet`; never
  native `Map` or `Set`.
- **JSDoc** on every export follows `.patterns/jsdoc-documentation.md` (titled `**Example**`
  sections, no `@example`/`@remarks`).
- **Reuse before inventing:** `SourceRef.quote` reuses or matches the existing `DurableLocator`
  quote struct (same `exact`/`prefix`/`suffix` field names and optionality). Search the barrels
  before adding any helper.
- **Append-only log:** no operation edits or deletes a `VerdictRow`. Undo appends a row with a
  higher `revision` for the same `itemId`. After a row with `lockedAt` closes a batch, writes to that
  `batchId` fail with a typed error; other batches stay writable.
- **Projection is pure and deterministic:** same rows and same `resolvedBy` in, same
  `ClaimDispositionProjection` values out. It never invents ids and never reads the clock, because
  `resolvedAt` comes from `VerdictRow.recordedAt`. It has no write capability and does not reach
  the epistemic tables. `ClaimDisposition` is a persisted `ProductEntity`, and completing a
  projection into `ClaimDispositionAppend` stays with the epistemic owner.
- **Spikes (S1, S3, S2, S4, S6, S8, Word check):** non-client test files only, operator access
  to the attorney's PC only, throwaway sample mods only (not the firm plugin). Record versions
  (the Claude Code version, 2.1.295 at shaping time, and the desktop app build).
- **Spike S1** is the pane go/no-go: an unasked pane open needs 144 columns, but an open from
  `/review` counts as asked. **Spike S3** is the Box go/no-go: record the connector's server
  name, whether `get_preview_page` works outside a `get_file_preview` context, latency, and bytes.
- **Mod API drift:** the amendment pins the minimum mod API version and falls back to `next(e)`
  on unknown shapes.
- **`$.store` races and the 100,000-character tree cap:** the amendment windows long passages
  and treats get-then-set as racy; the envelope's append-only rows keep a race from losing a
  verdict.
- **Sibling reconciliation:** `claim-element-graph` keeps its practice MCP read tool as the
  computation path; this envelope is where its findings are rendered and judged.
- **Public repo:** never name the attorney, clients, matters, machines, or home paths in packet
  text, fixtures, or the spike report.

## Acceptance Criteria

- [ ] **P0** The spike report under `history/` records the one-app answer, S1 and S3 go/no-go
      with evidence (screenshots kept out of the repo, described in text; S1 records pane
      placement, whether resizing works, and whether it coexists with the Browser pane), and results for S2,
      S4, S6, S8 and the Word check. **S3's gate is the text read:** a successful
      `get_file_content` with p95 latency under 3 s gates the text review queue.
      `get_preview_page` is recorded separately: latency, whether an image block came back, and
      any failure, which counts as an image limitation, not a queue blocker. If the text read
      itself fails, the handoff falls back to producers embedding the passage text in
      `SourceRef.quote`, so the pane needs no Box call, and the amendment says so. S2 records whether a 10-pt claim line is legible at the largest size.
- [ ] **P1** `ReviewItem` decodes all six `kind` members; an unknown `kind` fails to decode.
      `SourceRef` round-trips with and without `page`, `prefix` and `suffix`. A `claim-finding`
      round-trips its `claimId`. `VerdictRow` round-trips `batchId` and `recordedAt`, and
      rejects a verdict outside `right | wrong | partly`.
- [ ] **P2** `ReviewQueue` and `VerdictProjector` exist as `Context.Service` contracts with
      typed errors (including a locked-batch write error) and Layer implementations.
- [ ] **P2 / S5** The round-trip test passes: decode → queue → `wrong` + note → undo (a
      superseding revision, the original row still present) → `right` → lock the batch → a write to that
      batch fails with the typed error, while a write in a new batch succeeds → projection yields a `ClaimDispositionProjection` with
      `status: active`, the fixed confirm reason, `resolvedAt` equal to the deciding row's
      `recordedAt`, and the supplied `resolvedBy`. A second case projects a final `wrong` to
      `rejected` with the note as `reason`; a third case uses `wrong` without a note and gets the
      fixed reject reason. A fourth case, a final `partly`, yields no projection. Projecting the
      same rows twice gives equal results.
- [ ] **P3** The amendment is delivered to the `practice-claude-mod` owner (link or PR comment
      recorded in `README.md`), in its S1-pass form or its row-only fallback form. On S1 fail,
      the exploration's manifest is back at `decompose`.
- [ ] `bun run beep quality package-verify` passes for both touched packages.
- [ ] The PR is mergeable through Yeet, and a closeout reflection exists under
      `history/reflections/`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/review-verdict-envelope/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/review-verdict-envelope/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/review-verdict-envelope` | Passes |
| Packet health | `bun run beep goals doctor` | No finding names this packet |
| P0 evidence | `ls goals/review-verdict-envelope/history/spikes-*.md` | Report exists with every spike row filled |
| P1 schema | `bunx --bun vitest run packages/law-practice/domain/test/ReviewVerdict.test.ts` | Green |
| P2 / S5 | `bunx --bun vitest run packages/law-practice/use-cases/test/ReviewVerdict.roundtrip.test.ts` | Green |
| Domain package | `bun run beep quality package-verify @beep/law-practice-domain` | Passes |
| Use-cases package | `bun run beep quality package-verify @beep/law-practice-use-cases` | Passes |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

Seeded from
[`explorations/attorney-review-workspace/DECISIONS.md`](../../explorations/attorney-review-workspace/DECISIONS.md)
(all 2026-10-14). Read the entry there for the full rationale and rejected options.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Queue-first review: agents evaluate first; the attorney sees unresolved items one at a time with Right / Wrong / Note, undo, and "Open in Box". | Every failed attempt spread across apps or used a long deck (R1, R2). | Reopen the exploration at `align` with evidence that a queue fails the attorney. |
| 2026-10-14 | The review surface is a phase of `practice-claude-mod`, not a new app or sibling plugin. | One install and one release path; that goal's D12 already argued against splitting. | Owner decision in `practice-claude-mod`; this envelope is surface-agnostic. |
| 2026-10-14 | One append-only `VerdictRow` log (undo, lock) is the write path; `VerdictProjector` maps claim findings to `ClaimDisposition` (`right` → `active`, `wrong` → `rejected` with the note). The schema is promoted out of the app here (practice-claude-mod D10 second-consumer rule). | Keeps D8's local write path and honours claim-element-graph's verdict storage. | Delete the projector; producers fall back to their own verdict storage. |
| 2026-10-14 | Ask the attorney which app he lives in before spike S1. | If it is not the Code tab, a pane is still a new place and the Outlook-category pattern needs weighing. | None needed; it is one question. |
| 2026-10-14 | Widen `practice-claude-mod` D9 to Box read tools (`get_file_content`, `get_preview_page`) via `$.mcp.call` and to `$.prompt.fill`; exclude Box writes, `$.prompt.submit`, `$.model.*`. | `$.mcp.call` raises no permission prompt, so writes stay out; drafting keeps the attorney as sender. | The owner declines the amendment; the pane shows passages from practice-kg only. |
| 2026-10-14 | Sources show as an extracted passage with key words highlighted and a location label; "Open in Box" opens the whole document; page images only if S2 passes; page jump via S8. | Box documents no URL parameter for page, line, or text. | Drop S2/S8 results; text passages remain. |
| 2026-10-14 | Side chat is the desktop's built-in (Ctrl+;); a mod side chat only if the attorney asks for saved answers. | Built-in costs nothing; `$.model.fork` is one-shot and toolless. | Gated re-entry point in the exploration MAP. |
| 2026-10-14 | Drawings get whole-sheet verdicts in the same queue; artifact pins (S7) only if flattened markup keeps arriving. | One surface; artifact comments need a watching session. | Gated `drawing-review-pins` in the exploration MAP. |
| 2026-10-14 | One surface per work-product type; drafts go to Word only if the one-hour check shows it reaches practice-kg or Box, otherwise through the queue. | Word is natural for drafts but must see the firm's knowledge. | Re-run the Word check after a Word release; gated `draft-review-in-word`. |
| 2026-10-14 | No Box writes from review. | Connector comments are whole-file, 1,000 chars, unanchored, visible to all collaborators. | Reopen the exploration; would need a confirmation design. |
| 2026-10-14 | Handoff by written amendment plus this one goal; neither session edits the other's packet. | Owners keep execution scope. | Fold the amendment into this goal only with the owner's agreement. |
| 2026-10-14 | Shape accepted: a queue-first review phase in `practice-claude-mod` applied by its owner from the amendment, plus this goal (schema, projector, spikes S1–S8); drawing pins, draft review in Word, and a mod side chat stay gated re-entry points. | Operator confirmed `BRIEF.md` and `MAP.md` match the picture. | Reopen the exploration at `shape`. |
| 2026-10-14 | The projector returns a `ClaimDispositionProjection` value (`claimId`, `status`, `reason`, `resolvedAt`, `resolvedBy`, `violations: []`), not the persisted `ClaimDisposition` entity. `claim-finding` items carry `claimId`, `VerdictRow` gains `recordedAt`, and the caller supplies `resolvedBy`. Fixed reasons cover `right` and a `wrong` row without a note. | `ClaimDisposition` is a `ProductEntity` with ids, audit fields and a required non-empty reason. Building it inside the projector would mean inventing ids and reading the clock. Completion stays with the epistemic owner via `ClaimDispositionAppend`. | Have the projector depend on the epistemic append service and return entities. |
| 2026-10-14 | A final `partly` verdict produces no disposition. The claim stays unresolved and returns to the queue. | `ClaimDispositionStatus` (`active / rejected / superseded`) has no partial state, and forcing one would misrecord the attorney's judgement. | Map `partly` to `rejected` with the note as the reason. |
| 2026-10-14 | `requires`/`provides` stay empty in the manifest. | Other manifests use capability tokens, and no capability token exists yet for the dependency on `practice-claude-mod`; it is tracked in `PLAN.md` instead. | Add tokens when a matching `provides` exists. |
| 2026-10-14 | `VerdictRow` gains `batchId`, and the lock closes one batch, not the whole log. New items get verdicts in a new batch; earlier rows stay grouped by `batchId`. | A log-wide lock would stop every later producer after the first sitting (PR #1712 review). | Drop `batchId` and start a fresh log file per sitting. |
| 2026-10-14 | S3's gate is the `get_file_content` text read (p95 under 3 s). `get_preview_page` results are recorded as an image capability, not a gate. If the text read fails, producers embed passage text in `SourceRef.quote`. | Text review must not depend on page images, which are optional (PR #1712 review). | Gate on page images again if the pane comes to depend on them. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
