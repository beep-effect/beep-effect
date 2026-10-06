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
- `apps/docket-intake` — the runnable service and its systemd user unit.
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
| `DocketNeedsReview` | A docket item with no usable date, the agents disagree on whether it is one, or the message could not be processed within the retry budget. | One event (`Docket - needs review`) the day after receipt, or today when that day has passed. |
| `IntakeFailed` | A step failed (model, Graph, decode). | None yet. Retried on the next poll. After the retry budget the message gets a needs-review entry (`processing-failed`) so it is not dropped; while the calendar itself is failing it keeps retrying and holds the cursor. |

`DocketEntered` carries flags: `dates-differ`, `matter-ambiguous`,
`matter-not-found`, `matter-unverified`, `matter-lookup-failed`,
`ladder-truncated`, `source-document-missing`, `due-date-past`.

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
| D-12 | Code placement: values and pure policy in `law-practice/domain`, ports and the pipeline in `law-practice/use-cases`, adapters in `law-practice/server`, the process in `apps/docket-intake`. | `standards/ARCHITECTURE.md` slice spine, and the `apps/practice-kg-mcp` precedent for a thin runnable host. The repo CLI may not import slice packages. |
| D-13 | Matter lookup is a port shaped to workstream D's `PracticeKgMatterLookup` contract. Anything other than a verified unique match is a flag on the entry, never a guess. | The contract is published but its PR has not merged; the port lets this packet proceed and swap in the live layer later. |
| D-14 | The time zone for all-day events is required configuration with no default. | An all-day event created in the wrong zone spans two days in Outlook. |
| D-15 | The reviewer returns the mail date and response period it read; the pipeline does the arithmetic. The "email's date" is the due date the message states, or failing that the paralegal's own mail date plus period. | A model that returns a finished date hides whether it read or computed it. Keeping the arithmetic in tested code is what makes "never guess" checkable. |
| D-16 | The idempotency key does not include the due date. | A message re-read with a different date must not produce a second entry beside the first. The attorney's edit of the existing entry stands. |
| D-17 | A message that still fails after the retry budget gets a needs-review entry. A failing matter lookup is a flag on the entry, not a failure of the message. | Alignment decision 3. A model outage or a lookup outage must not cost the attorney an entry. |
| D-18 | The cursor advances only over the leading run of settled messages. Ledger records are dropped once their message can no longer be listed again and their day is digested. | A message still failing must be read again on the next poll. The ledger would otherwise grow without bound. |
| D-19 | The driver verb `deleteEvent` exists for the live smoke's cleanup of its own test event. The intake service never calls it. | A smoke that leaves test entries on the attorney's calendar is worse than one extra verb. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
