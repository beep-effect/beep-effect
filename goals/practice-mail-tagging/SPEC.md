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
| D-17 | 2026-10-06 | Destination folders come from the private folder-id map emitted by the Box onboarding workstream (one row per safe matter), re-read at the start of every run; a matter absent from the map is not auto-filed. The destination stays a data lookup, never a path built in code. | The map is regenerated when a new KG bundle goes live, and the attorney's choice between the numbered template folders and his own mirrored folders is pending; a later switch must be a data change. Filing is reversible by a folder move with ids preserved. |
| D-18 | 2026-10-06 | The tagging job ships as its own `bin` subcommand with a sample user unit (`practice-mail-tagging.service`, nothing auto-installs it), reusing the docket-intake Entra registration and env file. Orchestrator ruling. | The docket-intake service is one loop wired to docket ports and is not installed yet; separate units give independent restarts and no merge dependency. A shared scheduler can follow once both jobs have run live. |
| D-19 | 2026-10-06 | Scan scope is enforced by `isDraft eq false` plus a configured list of excluded parent folder ids (Deleted Items, Junk) until the driver's well-known mail-folder lookup merges; then the ids are resolved at run start. | `@beep/m365` has no mail-folder verb today; workstream A is adding `getMailFolder` as a separate PR. |
| D-20 | 2026-10-06 | Client contact addresses come from an optional private attorney-curated overlay (family key → addresses and domains) until the KG carries a contact → matter relation. Without it, v1 matches on identifiers only and files only USPTO mail. An address is one weighted signal that never tags or files by itself, and an address listed under more than one matter never routes an attachment to `from-client`; the planned KG `matter_correspondents` relation returns ranked candidates under the same rule. | The current bundle has no message-level contact table; a wrong client attribution is worse than an unfiled attachment. |
| D-21 | 2026-10-06 | Adapters fail closed: a missing or undecodable folder map or known-documents index fails the run before any write, and one invalid row makes the contacts overlay corrupt. Only the contacts overlay may be absent. | A silently empty folder map would tag everything and file nothing; a silently empty known-documents index would re-upload the migrated tree. |
| D-22 | 2026-10-06 | A stale-category write (HTTP 412) is retried once from a fresh read as "server categories, minus what this write removed, plus what it added"; a second 412 or a vanished message fails the write. | A concurrent edit by the attorney or the docket service must never be overwritten by a full-list replace. |
| D-23 | 2026-10-06 | Provider throttling (Graph or Box 429, Box limit or quota codes) is a distinct port failure that aborts the run. The Box call count is flushed as one ledger line when the run's scope closes, also on failure; a run with zero Box calls writes no line. | D-16; the count must survive an aborted run to keep the shared ledger honest. |
| D-24 | 2026-10-06 | A docket reference whose leading `<client>.<family>` equals a matter key is docket evidence even when that country stage is not in the index; a bare family never selects a taggable matter. | A new national stage of a known family belongs to that family; bare family numbers are recycled across clients. |
| D-25 | 2026-10-06 | A message without a usable id or received time is skipped and counted nowhere. | The job orders, checkpoints, and ledgers by those two values. |

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
      directory, `@beep/m365` mailbox, folder map, known-documents index,
      Box call metering, composed behind one service layer.
- [ ] A `bin` subcommand (dry-run, apply, undo) with a sample user unit.
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
