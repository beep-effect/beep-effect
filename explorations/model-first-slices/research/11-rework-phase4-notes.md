# Notes: phase 4 rework (follow-ups, deployment descriptors, web package, proof inventory)

Fifteen type-checked projects (fourteen workspace packages, now including `party/web`, plus
`scripts/`). From the prototype root, `bun run check`, `bun run test`, `bun run handlers:check`
and `bun run generated:check` all pass. `bun run test` runs 130 tests in 37 files:

| Package | Files | Tests |
| --- | --- | --- |
| shared/tooling | 1 | 2 |
| party/contract | 2 | 4 |
| runs/contract | 1 | 2 |
| party/model | 12 | 43 |
| authority/model | 4 | 11 |
| runs/model | 6 | 21 |
| authority/host | 2 | 7 |
| runs/host | 1 | 6 |
| party/host | 3 | 16 |
| party/web | 4 | 15 |
| apps/practice | 1 | 3 |

The run ends with the outcome-coverage check. Phase 3 ended at 98 tests in 28 files. Library:
`@alchemy.run/domain` 2.0.0-beta.87, effect 4.1.4. Added to the prototype's own workspace only:

- `@effect/atom-react` 4.1.4, `react` and `react-dom` 19.3.1, `@types/react` and
  `@types/react-dom` 19.3.0, `happy-dom` 21.0.4 and `@testing-library/react` 16.3.3, matching the
  monorepo root where it pins them.
- The monorepo's own `package.json` and `bun.lock` are unchanged.

## Decisions

### D36 tenant in a request key: built as decided

- The runs gateway derives command ids from the run's org (its grant's resource scope): the
  request's terms for `RequestRun`, and the live run's record for every report.
- The inbox uses the fact's org.
- `requestKey`'s documentation and example say so.

### D35 saga activity results: built as decided, with the in-flight check blocked upstream

- **Declared:** `ReviewAssistActivities` (`party/model/src/Review/ReviewAssist.saga.ts`) declares
  each activity's success and error schemas, and the saga uses them, so the stored format is in
  one place.
- **Frozen fixture:** `party/model/test/stored/ReviewAssist.activities.json` holds the activity
  results as the engine stores them: each Exit encoded with its schemas.
- **Compatible change:** `Usage.cachedUnits` was added with a decoding default. The frozen
  `assess` result reads `cachedUnits: 0`, and the bytes stay unchanged
  (`party/model/test/StoredFormat.test.ts`).
- **Incompatible change, a new saga version:** the library allows it. A saga's workflow name is
  its saga name, so `WorkV2` beside `WorkV1` in one model is a second workflow.
  `party/model/test/SagaVersions.test.ts` starts a V1 run and redeploys with both versions on the
  same platform. The V1 run resumes on V1 and replays its stored boolean result; a new run starts
  on V2 and stores a string.
- **Convention:** the next incompatible change to the review saga becomes `ReviewAssistV2`.
  `ReviewOnRequest` starts it, and `ReviewAssist` stays in the model until no V1 run is in flight.
- **Blocked:** "until no V1 run is in flight" cannot be checked. The saga client has only `start`
  and `get(key)` (`Saga.ts:135-142`); there is no way to list a saga's runs in flight. Upstream
  ask 1.

### A decision while the executor assesses: fixed, with two stories

- The runs gateway answers a report to an ended run (completed, cancelled, exhausted, rejected)
  with `RunEnded`. Party's port maps it to its own `RunEnded`, and the saga ends cleanly on it
  (`Effect.fn(..., Effect.catchTag("RunEnded", ...))`).
- A proposal on a claim that is already decided answers `ClaimNotPending`. The saga reads that
  as "already decided" and stops without recording a refusal.
- The `propose` activity's stored result type (`string | null`) is unchanged, per D35.
- Stories: "a decision that concluded the run while it was assessing ends the executor cleanly";
  "a claim decided before the proposal lands ends the executor cleanly, with nothing recorded".

### D13 deployment wiring: descriptors built as data; generated entry modules not built (cluster work)

- `DeploymentDescriptor` (`shared/kernel/src/Deployment.ts`) lists a context's models, processes
  (gateway, feed, poller, inbox, session), and the fact versions it publishes and consumes.
- Each host publishes one: `Authority.descriptor.ts`, `Party.descriptor.ts`,
  `Runs.descriptor.ts`. Each reads model names from `Model.modelName`, Party's published versions
  from `ClaimDecided.versions`, and runs' consumed version from the inbox's exported
  `ClaimDecidedVersion`, so a descriptor cannot drift from its code.
- `apps/practice/src/Deployment.ts` composes them. The existing cluster entry modules in
  `apps/practice/src/cluster/` still name models by hand; generating them from the descriptors is
  cluster work. The app still type-checks.

### D34 retiring a fact version: built as decided

- `checkFactRetirement` (`shared/tooling/src/FactRetirement.ts`) fails with `UnpublishedFact`
  when a composed descriptor consumes a version that no composed descriptor publishes.
  Otherwise it returns the published versions nobody consumes.
- `apps/practice/test/Deployment.test.ts`:
  - the practice deployment passes, with `ClaimDecided` v2 reported as retirable;
  - dropping v1 from Party fails, naming runs, and so does leaving Party out of the composition;
  - moving runs to v2 makes v1 retirable.

### D12 frontend default: built as decided, React kept

- **Bindings:** `party/web/scripts/bindings.ts` generates `src/Party.bindings.ts` from the
  Reviewer and Intake contract Apis; `--check` fails on drift. Each command, view and query the
  contract serves gets a binding, and each command and view an atom. The generic runtime is in
  `party/web/src/Bindings.ts`:
  - A command creates its command id (or takes one, for a retry) and always succeeds with a typed
    outcome: `Accepted` with the receipt; `Rejected` with a declared rejection; `Denied` for
    `MissingGrant`, `Unauthorized` or `Unaccountable`; or `Unknown` for transport failure and
    defects.
  - A view's `read` can wait for a receipt (read-after-write). Its `subscribe` is a snapshot
    (state and cursor), then `events` after that cursor, each state with its revision. On failure
    it reconnects up to five times on a backoff, with a new epoch and a fresh snapshot.
- **Import closure:** the web package imports the contract only. `party/web/test/Web.imports.test.ts`
  walks every web entry point. A screen that opts into `Aggregate.predict` must be listed in
  `predictExceptions` with the model files it may reach and why. The list is empty, and a
  negative control proves the mechanism with a fixture screen.
- **Plain screen:** `Directory/FindParties.screen.tsx` has one query (`FindParties`) and one
  command (`RegisterParty`), and a search that waits for the registration's receipt.
- **Machine-backed screen:** claim review and approval.
  - `ClaimReview.machine.ts` holds the `Screen` schema, the `Message` and `Intent` tagged unions,
    and a pure `update`.
  - `ClaimReview.controller.ts` runs intents through the bindings and feeds results back.
  - `ClaimReview.screen.tsx` renders it.
  - The machine correlates on command id, receipt and view revision. Committing and catching up
    are two moments, joined by a read that waits for the receipt.
- **Screen-story kit:** `party/web/test/ScreenStory.ts`. Seven machine stories
  (`party/web/test/ClaimReview.story.test.ts`), including all six required cases. The first is
  Astra's counterexample: a delayed snapshot after the command neither clears it nor lets a
  second command out.
- **Without a browser:** the stories; a binding-level test against the in-memory hosted Party,
  which drives the controller to an approval end to end and covers reconnect with a flaky fake
  client; and a render test per screen under happy-dom with fake clients.
- **Not covered (browser QA):** real input and focus, timing between real network replies,
  layout, accessibility beyond roles and labels, and the HTTP transport. The app has no browser
  entry or server for these screens yet.

### D8 laws and review: built as decided

- **Inventory:** `proofs/Proofs.data.ts` lists 22 invariants. `scripts/proofs.ts` renders
  `PROOFS.md`; `--check` fails on drift, and any run fails when a named checker file is missing.
  The document ends with the four semantic questions for an independent reviewer.
- **Primary-export law** (`shared/tooling/src/PrimaryExport.ts`): a rule table per role suffix.
  Each rule names the primary from the noun, or matches it where names vary (adapters, gateways),
  and gives a value predicate for the kind (domain `kind`, Layer, service, schema). Domain kinds
  allow only one export of the kind.
  - `.rules.ts` is exempt, with a reason. An unknown suffix fails.
  - The workspace test imports all 160 role files at run time and finds none in violation.
  - Two changes made the law hold: the generator now emits `PartyBindings`, and
    `Authority.capabilities.ts` gained `AuthorityCapabilities`.
- **Outcome coverage, counted at run time:** the library already counts each decided command in
  its `domain.commands` metric, by aggregate, command and outcome (accepted or the rejection's
  tag). A vitest setup file writes each test file's counts. `bun run outcomes --check` compares
  them with every command's declared outcomes.
  - This phase's stories closed 33 gaps (party and runs). 94 of 109 outcomes now execute.
  - The 15 left are authority refusal paths, listed with reasons in `proofs/Outcomes.allow.ts`.
  - The check fails on a new gap, and on a listed gap that has since been covered.

## Library facts from this phase

- **Command outcome metric:** `Kernel.ts:1193-1197` records `Telemetry.commands`
  (`Telemetry.ts:73-77`) for every decide, with the rejection's tag as the outcome. `MetricRegistry`
  is a `Context.Reference` whose default map is shared by every Effect in the process
  (effect `Metric.ts:1665-1668`), so a test file's counts can be read after it runs.
- **What it does not count:** a receipt-reuse answer skips decide, and middleware refusals happen
  before it.
- **Activity results:** stored as an Exit encoded with `toCodecJson(success)` and
  `toCodecJson(error)` (effect `workflow/Activity.ts:168-186`). The in-memory engine keys them by
  workflow, execution, activity and attempt, and replays a stored result instead of running the
  activity (`InMemoryWorkflows.ts:182-208`).
- **Saga versions:**
  - The workflow behind a saga is named after the saga (`Saga.ts:281-291`), so two names are two
    workflows.
  - The saga client offers `start` and `get(key)` only (`Saga.ts:135-142`).
  - A `Domain.Model` needs an `aggregates` key even when it is empty.
- **Api client:** a command call takes `{ commandId, headers }` (`Api.ts:249`, `913-921`).
  - A view client has `snapshot` (state and cursor), `events({ after })` with `CaughtUp` frames,
    and `get` or `snapshot` with `atLeast` a receipt (`Api.ts:122-184`, `Read.ts:15-29`).
  - A receipt's `version` counts the aggregate's events. A view's cursor counts the view key's
    events. They match for `ClaimReview` only because it folds every Claim event, so the machine
    correlates through a read that waits for the receipt, never by comparing the two numbers.
- **Atoms:** `runtime.layer` is itself an atom (`Atom.ts:749`), so a test sets it through
  `RegistryProvider` `initialValues`. Stream retry schedules need `it.live`: under the test clock
  a backoff never elapses.
- **Story:**
  - `given` events run no policy.
  - A `when` may run while a saga waits on a stubbed port call, which is how a decision lands
    mid-assessment.

## Where the sketches did not match

- **D13** says the app names no model or process. The descriptors make that possible, but
  `apps/practice/src/cluster/*.ts` still names models until entry modules are generated.
- **D12 and Kimi's list** include cache clearing on logout and tenant change. Not built: the
  credentials are fixed headers per runtime.
- **The receipt is not a view revision.** Astra's "server acceptance receipt, read checkpoint" pair
  holds only through `atLeast`. A screen that compares a receipt's version with a view revision is
  wrong in general.
- **D34's rule makes the newest version retirable** when nobody consumes it yet (v2 today). The
  checker reports it faithfully; whether a producer may retire its newest version is a policy
  question.
- **The primary-export law needs per-kind rules,** not one naming scheme: adapters are named for
  what they adapt (`PartyAuthority`, `RunsGatewayLive`), and a cluster process's handler is a
  Layer factory (`mailboxPollerLive`).

## Upstream changes wanted (new this phase)

1. **List a saga's runs in flight** (or count them by saga name), so an old saga version can be
   removed once none remain (D35).
2. **Map a receipt to view progress:** let a view client say which cursor a receipt's write
   reached, so a client correlates without a second read.
3. **Count refusals made before decide** (middleware, receipt reuse) in the commands metric, or a
   separate metric, so coverage can include them.
4. Carried over: check a reused command id against a request fingerprint and re-authorise before
   answering from a receipt; a top-level event field rename; record batch-flush defects; Progress
   that reports "handled".

## Open questions for the owner

- **Newest-version retirement:** may D34 report a producer's newest fact version as retirable
  when nobody consumes it yet, or should the newest version be exempt?
- **Authority outcome gaps:** cover the 15 listed authority refusal paths now, or in the cluster
  phase?
- **Generated entry modules:** do they live in the app (generated from the composed descriptors)
  or in each host? D13 has not yet checked that the cluster loader accepts generated `main`
  modules.
- **Web session:** where do credentials and tenant come from in the browser, and what clears the
  atom caches on logout or tenant change?

## Defects left for later

- **The inbox** is still a polled loop over a memory store, and the app does not run it.
- **The cluster entry modules** are hand-written.
- **The screens** have no browser entry, HTTP server wiring or browser QA. The HTTP client paths
  (`/api/reviewer`, `/api/intake`) are placeholders.
- **The fact feed and the gateways** poll with bounded waits.
- **Phase 3 items not touched:** re-admission trusts its provenance (D25); internal commands are
  unguarded in process; a client choosing its own command id is answered from the receipt.

## D16 graduation gate, as of phase 4

| Gate item | In memory | Proved by | Left for the cluster phase |
| --- | --- | --- | --- |
| Two contexts exchanging an integration fact through an outbox and inbox | Yes | `party/host/test/ReviewRun.test.ts` (approval and direct decision conclude the run through Party's fact and the runs inbox); `runs/host/test/RunsHost.test.ts` (duplicates, crash before checkpoint, v1 beside v2); `party/model/test/Facts.story.test.ts`; `party/contract/test/ClaimDecided.snapshot.test.ts` | Durable inbox store, singleton poller, feed over the network |
| A parent and child agent run, with budget exhaustion | Yes | `runs/model/test/Runs.story.test.ts` ("a child that runs out of budget is exhausted, and its parent resumes with what the child left"; "a child that finishes resumes its parent"); `runs/model/test/Outcomes.story.test.ts` (refused child returns its share) | Children across runners |
| Approval through the authenticated command boundary | Yes | `party/host/test/ReviewRun.test.ts` (Session, agent-rooted approval refused); `party/model/test/Review.story.test.ts`; `party/web/test/Bindings.test.ts` (Denied without the grant) | Real authentication on the cluster |
| A projection rebuild with no side effects | Yes | `party/model/test/Rebuild.test.ts`; `party/model/test/PartyDirectory.sink.test.ts` | Cluster backfill, a database sink's transaction |
| A stored-format compatibility test (state, events, receipts, saga payloads) | Yes, plus activity results | `party/model/test/StoredFormat.test.ts`, `runs/model/test/StoredFormat.test.ts`, `party/model/test/SagaVersions.test.ts` | Fixtures captured from a running store; cluster engine replay |
| The conformance suite on the Postgres swarm host, restore included | No | — | All of it |
| One plain screen on generated bindings and one machine-backed screen | Yes, without a browser | `party/web/test/ClaimReview.story.test.ts`, `party/web/test/Bindings.test.ts`, `party/web/test/Screens.render.test.tsx`, `party/web/test/Web.imports.test.ts` | Browser QA, HTTP wiring |
| The proof inventory for each invariant (D8) | Yes | `PROOFS.md` (generated and checked by `bun run generated:check`); `shared/tooling/test/PrimaryExport.test.ts`; `scripts/outcomes.ts --check` | Entries for the cluster's conformance cases |
