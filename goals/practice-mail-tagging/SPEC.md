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
  with `masterCategories` deriving the master-list intents. A matter's
  master category is created the first time a message is tagged to it (D-9).

### Matching (schema + pure function)

- `MatterIndexEntry`: `matterKey`, `clientKey`, docket numbers, application
  numbers, patent numbers, contact email addresses, contact domains.
- `MatterIndex.unattributed`: identifier sets of matters that cannot be
  tagged (no client number, or `recycled-unverified`). A hit on one of these
  without a taggable match is `MatterUnmatched needs-attorney` (D-11).
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
  - `MatterUnmatched { reason: no-signal | below-threshold | ambiguous |
    needs-attorney, candidates }` — never forced into a matter.
  Practice-level categories ride alongside either outcome.

### Ledgers (schema)

- `TagLedgerEntry { runId, messageId, internetMessageId, addedCategories,
  decision summary, recordedAt }` — append-only JSONL. Undo removes only
  `addedCategories` that are still present, and appends a `TagUndoEntry`.
- `FilingDestination` (`LiteralKit`): `uspto-incoming`
  (`05 USPTO Correspondence/01 Incoming`) and `from-client`
  (`90 Client Exchange/01 From Client`) inside the matter folder (D-10).
- `FilingLedgerEntry { contentSha256, matterKey, destination, folderId,
  fileId, fileName, messageId, attachmentId, byteLength, recordedAt }` —
  dedupe key is `(contentSha256, matterKey)`.
- `BackfillCheckpoint { since, lastReceivedAt, lastMessageId, processed }`.
- `TaggingRunReport`: counts only — scanned, matched, unmatched by reason,
  per-category adds, already-tagged skips, attachments filed / deduped /
  skipped by reason, and whether anything was written.

### Services (ports first)

Ports (`Context.Service`, implemented by adapters or test fakes):
`Mailbox` (page messages since an instant; set a message's categories; ensure
master categories; list and download attachments), `MatterDirectory`
(index snapshot), `MatterFolderDirectory` (matter + destination → Box folder
id, resolved by family key and never by client name),
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
  categories are preserved in order, ours are appended. The ledger entry is
  written before the category write; a message counts as already tagged only
  when its ledgered categories are present, so an interrupted write is
  repaired on the next run without a second ledger entry.
  Repair applies only to messages received after the checkpoint the run
  started from: a ledgered message the checkpoint already covers is never
  rewritten, so a category the attorney removed by hand stays removed.
- The `Mailbox` port covers the inbox, its subfolders, and Sent Items; Drafts,
  Deleted Items, and Junk are excluded by the adapter (D-12).
- Live `Layer` values for the use-cases live in `law-practice/server`; the
  use-cases package stops at contracts and constructors
  (`standards/architecture/05-layer-composition.md`).
- Attachments are filed only for `MatterMatched` messages, and only from
  routable senders: a `uspto.gov` sender files to `uspto-incoming`, a known
  contact address of that matter files to `from-client`, and any other sender
  is tagged but not filed (`sender-not-routable`). Inline parts, non-file
  attachments, and zero-byte parts are skipped with a counted reason.
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
| D-9 | 2026-10-06 | A matter's master category is created on its first tagged message; practice categories are created up front. Operator-ratified. | 143 taggable matters would make the Outlook category picker unusable; most matters have no mail since 2026-07-01. |
| D-10 | 2026-10-06 | File attachments only from USPTO senders and known contacts of the matched matter, into the two destination subfolders named by the Box onboarding workstream. Operator-ratified. | Filing opposing-counsel or third-party attachments under "From Client" mislabels documents; a tagged-but-unfiled message is recoverable, a misfiled one is not obvious. |
| D-11 | 2026-10-06 | Matters with no client number (27) and `recycled-unverified` matters (4) are never tag targets; a reference to one yields `needs-attorney` and `P: Unmatched - review`. A message that names both a taggable matter and one of these also goes to review. | The practice-KG matter-lookup contract: bare family numbers are recycled across clients, so only the client-keyed family key is a safe identity. |
| D-12 | 2026-10-06 | Tag the inbox, its subfolders, and Sent Items; skip Drafts, Deleted Items, and Junk. Operator-ratified. | Tagging the attorney's replies keeps a conversation's category consistent in Outlook's conversation view. |
| D-13 | 2026-10-06 | Ledger-first category writes with presence-checked idempotency. | A category write that succeeds before a failed ledger append would be outside undo's reach; writing the ledger first makes the worst case a harmless entry that the next run completes. |
| D-14 | 2026-10-06 | Adapter rules adopted from the Box onboarding workstream (PR 2): resolve folders by family key through the private onboarding map or by Box folder id, never by building a path from a client number or name; check an attachment's SHA-256 against the private index of files already in Box before uploading; one upload call per new attachment with cached folder ids and no listing sweeps; matters without a provisioned folder are not auto-filed. | Client folders are being renamed in place, the migration already placed files in the tree, and Box API calls are a watched monthly budget. |
| D-15 | 2026-10-06 | Reference extraction in the practice-KG adapter goes through `extractPracticeKgReferences` and the `PracticeKgMatterLookup` contract; the tagger's own identifier extraction stays as the port-level fallback for tests and for mail the KG helper does not cover. | One owner for the attorney's docket reference grammar (`<client>.<family><CC><nn>`, national-stage suffixes, foreign-agent references). |
| D-16 | 2026-10-06 | Every run that calls Box appends one line to the shared private Box API-call ledger (workstream, run label, call count, UTC time, exact flag), and stops on any 429 or quota response. | Box usage is not visible in the console on this plan; the orchestrator meters all workstreams against a shared monthly ceiling, and no extra volume is purchased. |
| D-26 | 2026-10-06 | Filing is two-phase in the ledger: an intent line before the upload, a completion line after. An intent with no completion is reconciled on the next run by retrying under the intent's own folder and name; a name the store reports as present with a file id is recorded as the earlier upload. A fresh upload that finds its name taken abandons that intent in the ledger and retries once under a short-hash name. Review round 1. | An upload that lands without a ledger line would be invisible to dedupe and to manual reversal, and a store that refuses an existing name would wedge the job on every rerun. |
| D-27 | 2026-10-06 | The checkpoint records the message ids processed at its boundary instant. A ledgered message is covered, and never rewritten, when it was received before the checkpoint instant or is in that set; any other ledgered message with missing categories is repaired. Review round 1; refines D-13. | Graph received times have second precision, so a page boundary can split messages that share an instant. |
| D-28 | 2026-10-06 | An undone message is settled: it is never re-decided automatically, and is counted as skipped. Re-tagging an undone run is a deliberate later operation. Review round 1. | The live job re-lists the boundary message on every poll; without this rule an operator's undo would be partly reverted on the next tick. |
| D-29 | 2026-10-06 | There is no automatic removal of filed documents: the document port has no delete verb, undo restores categories only, and the filing ledger lists stored files for manual reversal. | "Never delete" applies to Box as much as to mail; a wrongly filed PDF is moved by a person, with the ledger as the list. |

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
