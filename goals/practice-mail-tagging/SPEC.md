# Practice Mail Tagging Spec

## Objective

Tag the solo attorney's Outlook mailbox by matter through the practice KG and
auto-file email attachments into the Box client/matter tree. Outlook stays the
system of record: the only mailbox mutation is adding (and, on undo, removing)
Outlook categories this packet's ledger says it added.

Source: the operator-ratified solo-practice decisions of 2026-10-06 (decisions
8d and 9; workstream B).

## Non-Goals

- The decades PST backfill (`goals/practice-mail-backfill`): it needs a paid
  seat. This packet covers live mail and mail received on or after 2026-07-01.
- Moving, deleting, archiving, or flagging mail. No folder moves, ever.
- Docket entry, deadline classification, or calendar writes (workstream A).
- Adding Graph verbs to `@beep/m365`. Workstream A owns the write lane; this
  packet consumes it through its own ports.
- Box metadata templates or retention (`BlockedByEntitlement` on Business).
- A model-backed matcher. v1 matching is deterministic evidence scoring; no
  metered spend is introduced.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` — `values/MailTagging/*` schemas.
- `packages/law-practice/use-cases` — `MailTagging/*` ports, tagger, tagging
  job, attachment filer, undo.
- `packages/law-practice/server` — `MailTagging/*` adapters (file ledgers,
  Box document store, practice-KG matter directory, `@beep/m365` mailbox).
- Private operator state under `~/.local/state/beep/practice-mail-tagging/`
  (ledgers, checkpoint, matter-folder map). Never tracked.

## Design

Order: schema → `Context.Service` contract → implementation.

### Taxonomy (schema)

- `MatterKey`: the practice-KG docket-family natural key, `<client>.<family>`
  (SPEC D-11 of `practice-kg-mcp`). Bare families are not taggable matters.
- `MatterCategoryName`: `M: <MatterKey>` — one Outlook category per matter.
- `PracticeCategory` (closed `LiteralKit`): `P: USPTO`, `P: Client`,
  `P: Opposing counsel`, `P: Billing`, `P: Admin`, `P: Unmatched - review`.
- `MailCategoryName` = matter category | practice category. Workstream A keeps
  the `Docket - *` prefix; the prefixes never overlap.
- `OutlookCategoryPreset` (`preset0`..`preset24`) and `MasterCategoryIntent`
  (name + preset). Matter presets are derived deterministically from the key.
- `MailRuleIntent`: an Outlook-native inbox rule expressed as data (sender
  domain or address → assign category; never a move). Rules are rendered into
  the attorney how-to; they are not applied by the service in v1.
- `MailTaxonomy`: practice categories + matter categories + rule intents,
  with `masterCategories` as the single derived list the applier ensures.

### Matching (schema + pure function)

- `MatterIndexEntry`: `matterKey`, `clientKey`, docket numbers, application
  numbers, patent numbers, contact email addresses, contact domains.
- `MailEnvelope`: the message subset the tagger reads — ids, subject, sender,
  recipients, received instant, conversation id, current categories,
  `hasAttachments`, body preview. Bodies are never persisted.
- `MatterEvidenceKind` (`LiteralKit`): `application-number`, `patent-number`,
  `docket-number`, `conversation-carryover`, `contact-address`,
  `contact-domain`. Each kind has a fixed weight; a candidate's confidence is
  `1 - Π(1 - weight)` over its distinct evidence kinds.
- `TaggingPolicy`: `confidenceThreshold` (default 0.8) and `ambiguityMargin`
  (default 0.15).
- `TaggingDecision` (tagged union):
  - `MatterMatched { matterKey, confidence, evidence }`
  - `MatterUnmatched { reason: no-signal | below-threshold | ambiguous,
    candidates }` — never forced into a matter.
  Practice-level categories ride alongside either outcome.

### Ledgers (schema)

- `TagLedgerEntry { runId, messageId, internetMessageId, addedCategories,
  decision summary, recordedAt }` — append-only JSONL. Undo removes only
  `addedCategories` that are still present, and appends a `TagUndoEntry`.
- `FilingLedgerEntry { contentSha256, matterKey, folderId, fileId, fileName,
  messageId, attachmentId, byteLength, recordedAt }` — dedupe key is
  `(contentSha256, matterKey)`.
- `BackfillCheckpoint { since, lastReceivedAt, lastMessageId, processed }`.
- `TaggingRunReport`: counts only — scanned, matched, unmatched by reason,
  per-category adds, already-tagged skips, attachments filed / deduped /
  skipped by reason, and whether anything was written.

### Services (ports first)

Ports (`Context.Service`, implemented by adapters or test fakes):
`Mailbox` (page messages since an instant; set a message's categories; ensure
master categories; list and download attachments), `MatterDirectory`
(index snapshot), `MatterFolderDirectory` (matter → Box folder id),
`DocumentStore` (upload bytes into a folder; never overwrite or delete),
`TagLedger`, `FilingLedger`, `BackfillCheckpointStore`.

Use-cases: `MatterTagger.decide` (pure), `MailTaggingJob.run({ mode, since })`
with `mode: dry-run | apply`, `AttachmentFiler.file`, `MailTaggingUndo.run`.

- Dry-run performs every read, decision, and hash and returns the same report
  shape with `wrote: false`; no port write is invoked.
- The job is resumable: it pages ascending by received time, checkpoints after
  each page, and skips messages the tag ledger already covers. Live mode is
  the same job resuming from the checkpoint.
- Category writes are read-modify-write on the full category list: existing
  categories are preserved in order, ours are appended.
- Attachments are filed only for `MatterMatched` messages. Inline parts,
  non-file attachments, and zero-byte parts are skipped with a counted reason.
  A name collision with different content gets a short-hash suffix.

## Constraints

- No real client mail, names, matter keys, or document content in the repo:
  fixtures are synthetic. Logs and reports carry ids, counts, and hashes.
- Effect v4, schema-first, `LiteralKit` for literal domains, `HashMap` /
  `HashSet` (never native `Map` / `Set`), `Effect.fn` for effectful functions.
- Reversibility is a tested property, not a convention.

## Decision Log

| # | Date | Decision | Why |
| --- | --- | --- | --- |
| D-1 | 2026-10-06 | Extend the `law-practice` slice instead of creating a new slice or driver. | Matter and client are law-practice language; the slice already has domain / use-cases / server roles, CI lane placement, and the KG read model. A new slice adds three packages of governance for no boundary gain. |
| D-2 | 2026-10-06 | A matter is a client-keyed KG docket family; one Outlook category per matter named `M: <client>.<family>`. | It is the only stable matter identity the KG guarantees after the P6 repair, and it maps 1:1 onto the Box client/matter tree. |
| D-3 | 2026-10-06 | v1 matcher is deterministic evidence scoring with a 0.8 threshold and an explicit unmatched outcome. | Wrong tags erode trust faster than missing ones; identifiers in subjects (application, patent, docket numbers) carry most of the signal; no metered spend (only money escalates). A model adjudicator can later be a second `MatterTagger` behind the same decision schema. |
| D-4 | 2026-10-06 | No folders and no moves; categories only. Outlook rules are data rendered for the attorney, not applied by the service. | "Never move mail destructively" plus Outlook stays the system of record. Category-only tagging is fully reversible; a move is not. Rule application needs `MailboxSettings.ReadWrite`, which the Entra app does not need otherwise. |
| D-5 | 2026-10-06 | Consumer-side ports; `@beep/m365` is not edited here. | Workstream A owns the Graph write verbs; a port keeps this packet testable today and makes the adapter a thin follow-up. Contract request relayed through the orchestrator session. |
| D-6 | 2026-10-06 | Ledgers and checkpoint are append-only JSONL files in private operator state. | Single-writer service on one workstation; JSONL is inspectable and diffable for undo audits; nothing client-derived enters the public repo. |
| D-7 | 2026-10-06 | Unmatched mail with no practice-level signal receives no category. `P: Unmatched - review` is added only for `ambiguous` and `below-threshold` outcomes. | Tagging every newsletter "unmatched" turns the review category into noise; only near-misses deserve the attorney's eye. |
| D-8 | 2026-10-06 | Attachment dedupe is by SHA-256 of content per matter, recorded in the filing ledger. | The same office-action PDF arrives in forwards and replies; a ledger lookup is exact and costs no Box API calls. |

## Acceptance Criteria

- [ ] Taxonomy, matching, ledger, checkpoint, and report schemas exist in
      `@beep/law-practice-domain` with decode tests.
- [ ] `MatterTagger` matches on identifier evidence, returns an explicit
      unmatched outcome below threshold or on ambiguity, and never forces a
      matter (tested with synthetic fixtures).
- [ ] `MailTaggingJob` dry-run reports counts and invokes no write; apply
      writes categories, records the ledger, and is idempotent on re-run.
- [ ] The since-2026-07-01 backfill resumes from its checkpoint after an
      interruption without re-tagging (tested).
- [ ] Undo restores every tagged message's categories to their pre-run state
      while preserving categories added by anyone else (tested).
- [ ] The attachment filer dedupes by content hash and never overwrites
      (tested).
- [ ] Adapters: file ledgers, Box document store, practice-KG matter
      directory, `@beep/m365` mailbox (the last after workstream A lands).
- [ ] A live dry-run report (counts only) over mail since 2026-07-01 is
      recorded in `history/`, followed by an operator-attended apply.
- [ ] `bun run beep quality package-verify` passes for each touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-mail-tagging/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-mail-tagging/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-mail-tagging` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/law-practice-domain` (and `-use-cases`, `-server`) | Passes |
| Dry-run proof | counts-only report recorded in `history/` | Recorded |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Workstream A's verbs cannot express a category-only write (report to the
  orchestrator session; do not add a competing write lane).
- Verification requires cost, destructive side effects, or policy approval
  not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
