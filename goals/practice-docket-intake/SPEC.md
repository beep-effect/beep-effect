# Practice Docket Intake Spec

## Objective

A service on the operator's workstation watches the solo attorney's Outlook
mailbox through an app-only Entra registration and, for every new message:

1. classifies it as a docket item or `not a docket item` (any sender, any
   deadline);
2. runs an adversarial two-agent pass — agent 1 enters the item like a
   paralegal, agent 2 reviews like a secretary and recomputes the due date from
   the source document itself (mail date + response period);
3. looks the matter up in the practice KG;
4. creates a TENTATIVE all-day Outlook calendar event on the due date in the
   category `Docket - unverified`, plus reminder events 30, 14, 7 and 1 days
   before.

The attorney confirms or corrects each entry in Outlook. Outlook stays the
system of record. A daily digest lists what was created and what was flagged.

## Non-Goals

- No docket of record. The service adds a vigilance overlay to the attorney's
  own calendar; it does not own, approve or reconcile deadlines.
- No legal rules engine. The service never derives a response period from a
  rule table; it only reads a period the source document states. The versioned
  rule fixtures stay with `goals/law-docketing-patent-spine`.
- No weekend, holiday or USPTO-closure roll-forward, and no extension-of-time
  arithmetic.
- No dead-man heartbeat, acknowledgment ladder or escalation channel. Those
  stay with `goals/law-docketing-reliability`.
- No durable workflow engine (`goals/effect-v4-workflow-engine-spike` owns that
  question).
- No mail send, no message creation, no mail move or delete.
- No matter tagging of mail and no attachment auto-filing (workstream B).
- No exposure of the write verbs through `@beep/m365-mcp`.
- No contacts verbs (`goals/practice-m365-contacts` keeps them).
- No two-way sync: the service never reads its own events back as truth.

## Source Hierarchy

1. The operator-ratified solo-practice alignment of 2026-10-06 (decisions 1-6
   recorded in the Decision Log below).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development).
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Relation To Existing Packets

| Packet | State | What this packet takes | What it leaves there |
| --- | --- | --- | --- |
| `goals/m365-driver` | completed-retained | The REST executor, schemas, error taxonomy and fake-HTTP test pattern of `@beep/m365`; its reserved `Calendars.ReadWrite` phase is opened here. | The delegated read lane, unchanged. |
| `goals/m365-mcp` | completed-retained | Nothing new is exposed. Its two `M365.of` test stubs gain the new verbs so they keep type-checking. | The MCP tool surface. |
| `goals/practice-m365-contacts` | active, P0 | Its auth-lane constraints, built here because this work needs them first: credential tagged union with the certificate primary, Graph `/.default` only, no `/me` on the app-only lane, non-idempotent writes never blind-replayed, Exchange RBAC for Applications scoped to the one mailbox. | Contacts verbs and the contact seeding job. It reuses the lane built here. |
| `goals/law-docketing-patent-spine` | active, P0 | Vocabulary only (candidate, evidence, operative date). No lifecycle contract or rule fixture exists there yet. | The approval spine, rule fixtures, durable approved records, reconciliation acknowledgment. |
| `goals/law-docketing-reliability` | active, P0 | The requirement that a poll records success only after a complete cycle and recovers from the last durable cursor. | Heartbeat, escalation, acknowledgment. |
| `goals/practice-kg-mcp` | active, P5-P6 | The `PracticeKgMatterLookup` contract (`unique`, `ambiguous`, `none`) through a port. | The bundle, the lookup implementation, the MCP host. |
| `goals/effect-v4-workflow-engine-spike` | active, P0 not started | Nothing. See decision D-3. | The engine feasibility question. |
| `explorations/solo-firm-docketing` | graduated | The overlay doctrine and the one-writer rule. Decision D-1 records where the 2026-10-06 alignment departs from it. | Everything else. |

## Target Surfaces

- `packages/drivers/m365` — app-only auth lane, per-lane scope configs,
  write-safe executor, calendar, category, message and attachment verbs.
- `packages/drivers/m365-mcp` — test stubs only.
- `packages/law-practice/domain` — docket intake values and pure policy (date
  computation, reminder ladder, idempotency keys).
- `packages/law-practice/use-cases` — ports and the intake pipeline.
- `packages/law-practice/server` — adapters: Graph mailbox and calendar,
  language-model agents, state store, matter lookup.
- the `docket-intake` service app — the runnable service and its systemd user unit.
- `docs/runbooks/docket-intake-entra-registration.md` — the operator-attended
  registration.
- The live tenant: one Entra app registration and one Exchange management
  scope (operator-attended).

## Constraints

- **Design order**: schema, then the `Context.Service` contract, then the
  implementation. Effect v4, `LiteralKit` for literal domains,
  `HashMap`/`HashSet`, `effect/http`, no `node:http`.
- **Never guess a date.** A due date exists only when a mail date and a
  response period are both read from a source, or when the message states the
  date outright. Otherwise the outcome carries no date.
- **Earlier date wins.** When the message's stated date and the reviewer's
  recomputed date differ, the event goes on the earlier one, the body shows
  both, and the entry is flagged.
- **Nominal dates.** `mail date + period` is not rolled forward. A nominal date
  is never later than the operative one, so it is the safe side for a
  vigilance overlay.
- **Missed is worse than wrong-tentative.** A docket item with no usable date,
  or one the two agents disagree on, still gets a calendar entry
  (`Docket - needs review`) the day after receipt, with no ladder.
- **Idempotent.** Re-processing the same message, after a crash or a replayed
  poll window, creates no second event. Outlook is asked first: every event
  carries its idempotency key, and the service looks the key up before
  creating.
- **Non-idempotent writes are never blind-replayed.** A transport failure after
  a `POST` surfaces as an ambiguous-write error; the caller reconciles by key.
- **One mailbox.** The app-only lane always addresses `/users/{id}`; the access
  grant is an Exchange RBAC-for-Applications assignment scoped to the
  attorney's mailbox. No tenant-wide application permission is consented.
- **Category namespace.** This service adds and removes only `Docket - *`
  categories. It never removes a category it did not add (workstream B owns
  `M: *` and `P: *`).
- **Attorney edits win.** The service updates an event only while it still
  carries `Docket - unverified` or `Docket - needs review`.
- **Hygiene.** No real client mail, addresses, tenant ids or tokens in
  fixtures, logs, spans or this repository. Spans record ids, counts and
  hashes only.
- **Runs unattended.** The service does not depend on the attorney's PC or on
  an interactive sign-in.

## Typed Outcomes

Every processed message ends in exactly one outcome:

| Outcome | Meaning | Calendar effect |
| --- | --- | --- |
| `NotDocketItem` | Both agents agree there is no deadline or required action. | None. |
| `DocketEntered` | A dated docket item both agents accept. | Due-date event (`Docket - unverified`) and ladder events (`Docket - reminder`). |
| `DocketNeedsReview` | A docket item with no usable date, one the agents disagree on, one the review loop flagged (`flagged-low-confidence`, `flagged-max-rounds`, `deterministic-failure`), or a message that could not be processed within the retry budget. | One event (`Docket - needs review`). A flagged item goes on its earliest candidate date when a date was read; otherwise the day after receipt, or today when that day has passed. No reminder ladder. |
| `IntakeFailed` | A step failed (model, Graph, decode). | None yet. Retried on the next poll. After the retry budget the message gets a needs-review entry (`processing-failed`) so it is not dropped; while the calendar itself is failing it keeps retrying and holds the cursor. |

`DocketEntered` is written only when the review loop ends `accepted`. Both
`DocketEntered` and `DocketNeedsReview` carry the review verdict (status,
rounds used, final score, threshold) and flags: `dates-differ`, `matter-ambiguous`,
`matter-not-found`, `matter-unverified`, `matter-lookup-failed`,
`ladder-truncated`, `source-document-missing`, `due-date-past`,
`junk-folder`, `deleted-folder`.

## Acceptance Criteria

- [ ] `@beep/m365` has an app-only lane and the write verbs, fixture-proven
      for method, URL, headers, body, decoded response and non-retry of
      non-idempotent writes; no configuration shape mixes delegated scopes
      with app-only credentials.
- [ ] Date computation and ladder generation are property-tested (month-end
      clamping, earlier-of, ladder ordering, no rung on or after the due date,
      no rung in the past).
- [ ] The pipeline produces each typed outcome from fixtures and creates no
      duplicate event when a message is processed twice.
- [ ] The poller persists its cursor only after a complete cycle and resumes
      from it.
- [ ] A daily digest lists created and flagged items by message id and event
      id, without message content.
- [ ] The registration runbook is on the operator desk, and the live smoke
      (credential-gated, with a separate mutation opt-in and cleanup of its
      own uniquely marked events) has been run once.
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-docket-intake/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-docket-intake/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-docket-intake` | Passes |
| Driver handoff | `bun run beep quality package-verify @beep/m365` | Passes |
| MCP stubs | `bun run beep quality package-verify @beep/m365-mcp --quick` | Passes |
| Slice handoff | `bun run beep quality package-verify` for each touched `@beep/law-practice-*` package | Passes |
| Live smoke | receipt in `history/` (ids and counts only) | Recorded |

## Stop Conditions

- RBAC-for-Applications scoping cannot be established for the registration
  (report; never fall back to tenant-wide application roles).
- A step would cost money beyond existing subscriptions and already authorized
  API billing.
- Required source files are missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

## Adversarial Review Loop

Operator ruling of 2026-10-06: a single pass by two agents is not enough. The
review is a bounded back-and-forth between an extractor (the paralegal role)
and a critic (the secretary role), on top of the deterministic checks. It runs
until a confidence score reaches a threshold or the round limit is hit. An
item that does not reach the threshold is flagged and shown to the attorney;
it is neither accepted silently nor dropped. This section is the design for
slice 3b, and the "As built" notes at its end record where the
implementation is stricter than this text.

### Schemas

- `ReviewFindingSeverity`: literal domain `P0`, `P1`, `P2`, `P3`. `P0` and
  `P1` are material.
- `ReviewField`: literal domain `classification`, `title`, `mail-date`,
  `response-period`, `stated-due-date`, `due-date`, `matter-references`,
  `source-document`.
- `ReviewFinding`: `severity`, `field`, `reason` (one sentence, no message
  text quoted beyond the value in dispute).
- `DeterministicCheck`: `check` (literal domain, below) and `passed`.
- `FieldAgreement`: `field` and `agreed`, for each field both sides read.
- `ReviewRound`: `index` (1-based), `entry` (the extractor's entry for this
  round), `reading` (the critic's own reading for this round), `findings`,
  `extractorResponse` (per disputed field: `revised` or `defended`, with the
  span of source text it relies on), `checks`, `agreement`, `score`.
- `ReviewTerminalStatus`: literal domain `accepted`,
  `flagged-low-confidence`, `flagged-max-rounds`, `deterministic-failure`.
- `ReviewVerdict`: `status`, `rounds`, `finalScore`, `threshold`,
  `maxRounds`.
- `DocketReviewConfig`: `maxRounds` (integer 1 to 10, default 3) and
  `acceptThreshold` (unit interval, default 0.85). Both are typed
  configuration, never literals in the pipeline.

### Confidence

The score is built from things that can be measured. A model's own statement
of confidence is recorded for the attorney but is not part of the score.

1. **Deterministic gate.** Every check must pass: the due date equals the
   mail date plus the stated period; the due date is not before the mail
   date; every date and period the extractor reports appears in the text it
   cites; the cited span exists in the message or the attached document. If any check fails on the final
   round the status is `deterministic-failure`, whatever the score.
2. **Material findings** `M`: 1 when the critic raised no `P0` or `P1`
   finding in the final round, otherwise 0.
3. **Field agreement** `A`: the share of compared fields on which the two
   independent readings agree, over `classification`, `mail-date`,
   `response-period`, `due-date` and `matter-references` (only fields at
   least one side read are compared). The comparison is code, not a model
   judgement.

`score = 0.5 * M + 0.5 * A`. With the default threshold of 0.85 an item is
accepted only when the critic has no material finding left and the two
readings agree on at least 70 percent of the compared fields; with five
fields compared that means at most one disagreement.

### Loop

1. Round 1: the extractor enters the message; the critic reads the source
   document and the message for itself, without the extractor's dates.
2. The pipeline runs the deterministic checks, compares the fields, collects
   the critic's findings on what it was shown (classification, title,
   rationale), and scores the round.
3. If the gate passes and `score >= acceptThreshold`, the status is
   `accepted`.
4. Otherwise, while `index < maxRounds`: the extractor is given the disputed
   fields and the critic's reasons, not the critic's values, and must revise
   or defend each with the span of text it relies on. The critic then re-reads
   only the disputed fields against those spans. Go to step 2.
5. At `maxRounds` without acceptance the status is `flagged-max-rounds` when
   the last round still had a material finding or a failed comparison that
   never changed, and `flagged-low-confidence` when the score simply stayed
   under the threshold.

Each round is appended to the message's ledger record before the next round
starts. After a restart the loop continues from the next index; completed
rounds are read back, not run again.

### What the attorney sees

- `accepted`: the tentative entry as today (`Docket - unverified`).
- Any flagged status: an entry in `Docket - needs review`, with a subject that
  starts `[LOW CONFIDENCE]`, `[REVIEW LIMIT REACHED]` or `[CHECK FAILED]`. It
  goes on the earliest candidate date when any date was read, with no
  reminder ladder, and otherwise on the day after receipt. The body lists the
  score, the threshold, the rounds used and the open findings.
- The outcome is `DocketNeedsReview` with the terminal status as its reason,
  never `DocketEntered`, so the digest, the docket-sheet cross-check and the
  matter lookup of slice 4 cannot mistake a flagged item for an accepted
  deadline.

### As built (slice 3b)

- A field only one side read counts as a disagreement, and
  `stated-due-date` is compared when either side read one. With no material
  finding, acceptance at 0.85 tolerates one disagreement when four or more
  fields are compared and none when three or fewer are.
- The critic may read a due date the source states outright, next to the
  mail date and period, and may cite the text it read. When its stated date
  and its own mail date plus period differ, the pipeline writes a `P1`
  finding on `due-date`; such an item is flagged at the default threshold
  and goes on the earlier date.
- A dated entry from the extractor must cite its source text. The
  deterministic checks run on the extractor's entry and, when the critic
  cites, on the critic's reading; each check row records its side.
- A failed check becomes a dispute, so a gate-only failure gives the
  extractor something to revise in the next round.
- The critique is asked again in a later round only when what the critic was
  shown changed.
- A settled ledger record keeps the verdict and drops the rounds. While a
  loop is in progress its rounds, including quoted source text, sit in the
  local state file. Resuming an interrupted loop does not use the retry
  budget.
- Impossible dates are rejected when the model's answer is decoded, so they
  fail the step and are retried rather than reaching the gate.

## Known Limits

- The message listing has no page cap: an old start date on a large mailbox is
  read in one cycle.
- Only the previous day's digest is written. Days missed during a longer
  outage get no digest; their calendar entries still exist.
- The adapters do not extract text from PDF attachments, so the
  `cited-span-exists` check cannot fail for a citation into an attached
  document; it is checked against the message text only.
- The extractor's per-field citations in a revision are recorded and shown
  to the critic but not checked by code; only the entry's citation is.
- Only the connection smoke tests have run against the live mailbox (read and
  write passed on 2026-10-06); the pipeline itself has not processed live mail
  yet. The first run is operator-attended (D-41).
- No live model call has been made yet; the first one is in the attended
  first run.

## Decision Log

Decisions 1-6 of the 2026-10-06 alignment are operator-ratified and are not
restated. The entries below are the implementing decisions taken under the
autonomy charter.

| Id | Decision | Why |
| --- | --- | --- |
| D-1 | Tentative events are written before attorney approval. They are non-operative candidates: `showAs: tentative`, a subject that starts `[UNVERIFIED]`, category `Docket - unverified`. | The 2026-10-06 alignment (decision 3) supersedes the "Outlook is a projection of approved truth" wording in `explorations/solo-firm-docketing/DECISIONS.md` for this bridge only. The approval spine keeps that rule for its own approved records. |
| D-2 | The app-only lane of `goals/practice-m365-contacts` is built in this packet's first PR. | Nothing can write to the mailbox unattended without it, and that packet is at P0. Its constraints are adopted as written so it can reuse the lane. |
| D-3 | Durability for v1 is a persisted cursor plus idempotency keys held in Outlook. No workflow engine. | The engine spike has not started and forbids product workflows in its scope. Every step here is either a read or a keyed create: a crash at any point is repaired by replaying the poll window, because the key lookup makes the replay a no-op. The cursor advances only after a complete cycle. There are no timers to recover, since reminders are ordinary calendar events Exchange delivers. |
| D-4 | The idempotency key is a hash of mailbox, internet message id, entry kind and ladder offset. It is stored on the event as a single-value extended property and sent as `transactionId`. Lookup by the extended property is the authority; the local ledger is an optimisation. | `transactionId` alone only covers short client-retry windows. The extended property survives restarts and a lost state file, and keeps Outlook as the single record. |
| D-5 | The cursor is a `receivedDateTime` watermark with a fixed overlap and a processed-id ledger, not a Graph delta token. | Workstream B needs the same paged `receivedDateTime` listing, so one verb serves both. A watermark with overlap tolerates late-arriving mail; the ledger and the keys make the overlap harmless. |
| D-6 | The state file is JSON under `$XDG_STATE_HOME/beep/docket-intake`, written atomically. | It holds only the cursor, per-message outcome records (ids, hashes, outcome tag) and digest state. Losing it costs one replayed window. A database would add a second record of the same facts. |
| D-7 | Due dates are nominal: no weekend, holiday or closure roll. Month arithmetic clamps to the end of the month. | No approved rule fixture exists, and the docketing doctrine forbids generic date arithmetic as a stand-in for one. The nominal date is never later than the operative date. |
| D-8 | A docket item without a usable date still gets a `Docket - needs review` entry the day after receipt. | Alignment decision 3: missed is worse than wrong-tentative. An item that only appears in a digest can be missed. |
| D-9 | The reviewer also reviews messages agent 1 classified as not a docket item. This is on by default and can be switched off in configuration. | A single-agent negative is the one path where an item can vanish silently. The cost is one extra model call per message on existing API billing. |
| D-10 | The daily digest is an all-day calendar event (`Docket - digest`, shown as free) plus a markdown file in the state directory. | Sending mail would need `Mail.Send`, and no decision approves Graph message creation. The calendar is already where the attorney looks. |
| D-11 | Reminder ladder events are separate all-day events (`Docket - reminder`, shown as free). A rung dated today or earlier is not created; the entry is flagged `ladder-truncated`. | Alignment decision 6 asks for ladder events. A reminder in the past is noise. |
| D-12 | Code placement: values and pure policy in `law-practice/domain`, ports and the pipeline in `law-practice/use-cases`, adapters in `law-practice/server`, the process in the `docket-intake` service app. | `standards/ARCHITECTURE.md` slice spine, and the `apps/practice-kg-mcp` precedent for a thin runnable host. The repo CLI may not import slice packages. |
| D-13 | Matter lookup is a port shaped to workstream D's `PracticeKgMatterLookup` contract. Anything other than a verified unique match is a flag on the entry, never a guess. | The contract is published but its PR has not merged; the port lets this packet proceed and swap in the live layer later. |
| D-14 | The time zone for all-day events is required configuration with no default. | An all-day event created in the wrong zone spans two days in Outlook. |
| D-15 | The reviewer returns the mail date and response period it read; the pipeline does the arithmetic. The "email's date" is the due date the message states, or failing that the paralegal's own mail date plus period. | A model that returns a finished date hides whether it read or computed it. Keeping the arithmetic in tested code is what makes "never guess" checkable. |
| D-16 | The idempotency key does not include the due date. | A message re-read with a different date must not produce a second entry beside the first. The attorney's edit of the existing entry stands. |
| D-17 | A message that still fails after the retry budget gets a needs-review entry. A failing matter lookup is a flag on the entry, not a failure of the message. | Alignment decision 3. A model outage or a lookup outage must not cost the attorney an entry. |
| D-18 | The cursor advances only over the leading run of settled messages. Ledger records are dropped once their message can no longer be listed again and their day is digested. | A message still failing must be read again on the next poll. The ledger would otherwise grow without bound. |
| D-19 | The driver verb `deleteEvent` exists for the live smoke's cleanup of its own test event. The intake service never calls it. | A smoke that leaves test entries on the attorney's calendar is worse than one extra verb. |
| D-20 | Agent 2 is not shown agent 1's dates, only its classification, title, matter references and rationale. | Copying becomes impossible, so the two dates the pipeline compares are read independently. |
| D-21 | Model answers use plain wire structures and are decoded through the use-case models. A malformed date, a zero period or an untitled item fails the step instead of being dropped. `readFromSourceDocument` is forced false when no document was attached. | A dropped field would look like "the document states no date". A failed step is retried and then escalated. |
| D-22 | Both agent prompts say the message and its attachments are material to read, not instructions. Message bodies are cut at 60,000 characters and attachment file names sent to the model are neutral. | Mail from any sender reaches the agents. |
| D-23 | Source documents are PDF file attachments only, at most three per message and 15 MB each. | Office actions arrive as PDF. The cap bounds model cost per message. |
| D-24 | The practice time zone is a parsed IANA zone in configuration, and the receipt day of a message is computed in it. | An unknown zone cannot start the service, and a message received late in the evening is docketed on the attorney's day. |
| D-25 | The service app is a plain process with `poll`, `run` and `smoke` commands and a sample systemd user unit in its README. No installer is added to the repo CLI. | The repo CLI may not import slice packages. The operator installs one unit once. |
| D-26 | Until workstream D's `PracticeKgMatterLookup` merges, the matter lookup port is wired to a layer that always fails, so every entry carries `matter-lookup-failed`. | The entry still reaches the attorney; the flag says the matter was not checked. |
| D-27 | Entry titles use the vocabulary of the attorney's own docket sheet: a date type (`Due Date`, `Final Date`, `Reminder`), a colon, and a short phrase for what is due. | He reads the calendar beside that sheet; the same words make an entry recognisable at a glance. Only the vocabulary is taken; no row content enters the repository. |
| D-28 | Both agents are told the reference forms that sheet uses (firm docket number with country code and optional national-stage suffix, billing file number, application and patent numbers, a foreign associate's own reference with an optional `/ <firm docket>` tail) and copy each verbatim; a pair is two references. | These are the forms mail will carry, and the matter lookup accepts any of them. |
| D-29 | Cross-checking an extracted deadline against the sheet's tracked date for the same docket is slice 4, behind its own read-only port. The sheet's date joins the comparison under the standing rule: the earliest date wins and a mismatch is flagged. Slice 4 starts after slices 1-3 land. | It is a third, attorney-kept source and the best available check on both agents. It needs the matter lookup wired first to join a message to a docket, and it reads a private file that stays out of the repository. |
| D-30 | The service does not write rows back to the attorney's docket sheet. | Whether it should is the attorney's call at his first review; the sheet is his record. |
| D-31 | Operator ruling 2026-10-06: the review becomes a bounded extractor-versus-critic loop with a confidence threshold, as designed in "Adversarial Review Loop". It is slice 3b, built after slice 3 lands and before slice 4. Slice 3 is not reopened. | Slice 3 is a clean adapter slice already in review; the loop changes the use-case models and the pipeline, which is its own reviewable change. Slice 4 depends on the loop's outcomes, so the loop goes first. |
| D-32 | Confidence is `0.5 * M + 0.5 * A` behind a deterministic gate, where `M` is "no material critic finding in the final round" and `A` is the share of independently read fields that agree. The model's self-reported confidence is recorded but not scored. | The attorney can be told exactly why an item was or was not accepted. A self-reported number cannot be checked. |
| D-33 | Defaults: `maxRounds` 3, `acceptThreshold` 0.85, both typed configuration. | Three rounds is one revision and one defence beyond the first pass; later rounds rarely change a reading and each costs two model calls. 0.85 admits at most one disagreeing field out of five and no material finding. |
| D-34 | A flagged item still gets a calendar entry, in `Docket - needs review`, under the `DocketNeedsReview` outcome with the terminal status as its reason. It never produces `DocketEntered` and gets no reminder ladder. | Alignment decision 3 (missed is worse than wrong-tentative) still holds, and a flagged item must not look like an accepted deadline anywhere downstream. |
| D-35 | Each round is persisted in the message's ledger record before the next begins; the loop resumes from the next index after a restart. In the disputed rounds the extractor sees the critic's reasons but not the critic's values. | The workstation was killed twice by memory pressure on 2026-10-06; a loop that restarts from zero would repeat model calls. Showing the critic's values would let the extractor copy them, and agreement would stop meaning anything. |
| D-36 | The critic reads a stated due date for itself (never a computed one), and a stated date that differs from its own mail date plus period is a code-written `P1` finding. | Without it an item whose only date is stated outright could never be accepted, because the due date would always be read by one side only. A source that contradicts itself is exactly what the attorney must see. |
| D-37 | A field read by only one side is a disagreement, and the extractor must cite the text behind a dated entry. | "Agreement" between a reading and nothing is not confirmation. A date with no citation cannot be checked against the source. |
| D-38 | In-progress rounds are kept in the ledger under a placeholder outcome and dropped when the message settles; resumption does not consume the retry budget. | The loop must resume after a kill without repeating model calls, and an interruption is not a failed step. Settled records stay free of message text. |
| D-39 | Review round 3 findings on slice 3 (#1496) are fixed in slice 3b: a lock that cannot be written reports `store` / `lock`, and reminder entries carry the Junk or Deleted folder line. | Round rule: after round 2, P2 findings get a tracked follow-up instead of another push. |
| D-40 | The text the extractor quotes for each revised or defended field is checked in code (the field's value must appear in it and it must be in the source; a failure is a dispute on that field) and is never shown to the critic, which re-reads from its own earlier findings and the revised/defended actions only. The real-calendar-day check is removed from the gate: decoding the model's answer already rejects an impossible date. | Showing the extractor's quotes to the critic would let it copy them, the mirror of D-35. A gate check that decoding makes unreachable only looks like protection. |
| D-41 | The first live run is operator-attended and bounded: a dry run first, then mail since a fixed start (2026-10-01) and at most ten messages, in a state directory of its own. Runbook: `docs/runbooks/docket-intake-first-run.md`. | The first writes to a real attorney calendar must be small enough to check entry by entry, and the whole run must be disposable. |
| D-42 | Every calendar event created and every message marked is journaled per run. `undo --run` deletes only events that still carry a provisional `Docket - *` category, keeps anything the attorney verified or recategorised, removes the `Docket - entered` mark, clears those messages from the ledger and moves the cursor back. | A first run must be reversible without touching the attorney's own decisions, and a cleared message must be read again by the next run. |
| D-43 | Commands print one JSON line on standard output; logs go to standard error. Exit codes: 0 ok, 1 failure, 2 a write refused without `--yes`, 3 Graph throttled. | Same contract as the mail-tagging tool, so the operator and the orchestrator read both the same way. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
