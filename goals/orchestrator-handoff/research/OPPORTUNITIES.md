# Friction receipts

## 2026-10-06: `package-verify` green, five hosted lanes red

- Doing: handing off P1 after `bun run beep quality package-verify @beep/repo-cli` reported
  `ok audit`, `ok docgen` and both `yeet publish` cheap-gate runs were green.
- Evidence: hosted run on PR #1488 failed Heavy / Check and Heavy / Lint Policy
  (`quality:test-tsgo`: TS377032 `Effect.provide with a Layer` in two new test files, and
  `knowledge:refs-check`: one home-relative path in a skill), Heavy / Docgen (`docgen:local`:
  `Unknown @category value rendering`), JSDoc Ratchet (`missingExportExamples: 14 > 5`), and
  Heavy / Coverage Regression (two baseline rows). All introduced; none surfaced locally.
- Would have prevented it: a `package-verify --hosted-parity` mode (or the default) that also runs
  `quality test-tsgo`, `docgen local --base origin/main`, `ci lane jsdoc-ratchet`,
  `knowledge refs --check` on the commit, and a scoped per-file coverage read for baseline rows the
  diff touches. Until then the orchestrate skill tells owners to run those five before "final".

## 2026-10-06: `gh pr ready` refused while `rate_limit` showed quota

- Doing: flipping PR #1488 ready after calling it final.
- Evidence: `gh pr ready` and `gh pr view` returned `API rate limit already exceeded` while
  `gh api rate_limit` reported `graphql 4984/5000`; `yeet ready` then reported `no open pull
  request was found for this branch`.
- Would have prevented it: `yeet ready` distinguishing "GraphQL refused" from "no pull request",
  and falling back to REST for the lookup as `yeet publish` does since #1468.

## 2026-10-06: a stacked base changed a reader's `--jq` output under a scripted test

- Doing: merging the review-window branch's new head into this lane.
- Evidence: five `yeet-merge-gate` tests failed because the reader's timeline query changed from
  one instant per line to `<event>\t<instant>`; the scripted `gh` answered the old shape.
- Would have prevented it: a shared scripted-`gh` fixture for the review-window reads, exported
  from the review-window test kit, so dependants do not re-encode its wire shape.

## 2026-10-06: JSDoc Ratchet red on `main` from three `LiteralKit` schemas without a type alias

- Doing: burning down the inherited reds after the relaxed-gate merges (operator ruling: merge
  with failing jobs, fix once on `main`). `bun run beep ci lane jsdoc-ratchet` on `main`
  (`6491294645`) reproduced `schemaAnnotationFindings: 3 > 0 (+3)`.
- Evidence: inventory rows `missing-schema-runtime-type-alias` for
  `PracticeKgAttorneyLinkSource`, `PracticeKgInferredLinkSource`
  (`packages/law-practice/use-cases/src/PracticeKg.correspondent-lookup.ts`) and
  `PracticeKgContactOrigin` (`packages/law-practice/server/src/PracticeKg.contacts.ts`), all
  introduced by #1519 (`cf106e28a7`). The sibling `PracticeKgContactLinkSource` in the same file
  carries the alias, so the pattern was known; the three were added without it.
- Cost: one five-minute inventory run to locate three one-line gaps; `bun run beep quality
  jsdoc-ratchet --inventory …` alone dies with `Error: null` when the inventory file is absent
  instead of saying the inventory has to be generated first.
- Would have prevented it: `lint:schema-first` (or the laws scanner) flagging an exported
  non-class schema without a same-name type alias in the touched package at cheap-gate time;
  and `quality jsdoc-ratchet` reporting a missing `--inventory` path as a named error.

## 2026-10-06: Heavy / Lint Policy red on `main` from one `effect-fn` finding in `@beep/repo-cli`

- Doing: same burn-down; `bun run --cwd packages/tooling/tool/cli lint:laws` reproduced
  `effect-fn; findings=1` at `src/internal/github/GraphqlBudget.ts:294` ("Reusable function
  'callback' directly returns Effect.gen(function*). Use Effect.fnUntraced instead.").
- Evidence: `git blame` puts the lines on #1508 (`3c65e30092`, 12:39 local), which predates the
  `2d52bdd1ad` attribution window the orchestrator named, so the red is older than the
  relaxed-gate merges; the hosted job on #1514 (`job 112435770160`) shows the same finding.
- Cost: the finding sits inside a curried `(operation, policy) => <A, E, R>(self) => Effect.gen`;
  the repair is `Effect.fnUntraced(function* <A, E, R>(self) …)`, and the package typecheck in a
  fresh lane cannot confirm it until dependency dists exist (13k `TS6305` not-built errors).
- Would have prevented it: `lint:laws` in the cheap gates for the touched package (it is
  package-local and runs in seconds), so a #1508-sized PR cannot publish with it red.

## 2026-10-06: `knowledge:refs-check` red on #1514 was a stale merge ref, not `main`

- Doing: attributing the second `Heavy / Lint Policy` failure on #1514 (`//#knowledge:refs-check`).
- Evidence: the hosted run gated on one `external-mirror-reference` row,
  `docs/runbooks/agent-pools.md:50` (a home-relative proxy path introduced by #1494). #1507
  (`9817708af0`, 14:06 local) already rewrote it to `$HOME/…`; #1514's merge-base
  (`9a42554f55`) predates #1507, and the hosted checkout (`e605043f2a`) carried the old text.
  `bun run knowledge:refs-check` on `main` reports `check: 0 live gated observation(s)`.
- Cost: a full hosted log read plus a local refs run to prove a non-red.
- Would have prevented it: the Lint Policy summary naming the gated observation rows (the
  classification table lists `external-mirror-reference 1` but the gate line is buried under
  42k observation rows); and the readiness monitor re-running Heavy lanes after a base merge
  when the PR's merge-base is behind a `main` fix to the same file.

## 2026-10-14: S11 takeover found an unreachable cancellation recovery branch

- Doing: qualifying the unfinished S11 merge-gate and ready-flip change after integrating main.
- Evidence: `quality package-verify @beep/repo-cli` failed with TS377009 at
  `MergeGate.ts`: the cancellation routine partitions every error internally, so its outer
  `Effect.catch` can never run. Removed the redundant recovery and reran package verification.
- Would have prevented it: compiling the complete post-merge workflow before handing it off.

## 2026-10-14: Package qualification needs an explicit heavy wrapper

- Doing: running the full CLI package audit during the S11 takeover.
- Evidence: the first takeover run was launched directly and its test process remained in
  the lane service rather than a heavy-work unit. Interrupted that diagnostic run and
  restarted `beep-heavy bun run beep quality package-verify @beep/repo-cli`; the shared
  wrapper reported all five slots busy and queued it.
- Would have prevented it: the package verifier admitting its own heavyweight subprocesses,
  or the handoff brief spelling the wrapper in each qualification command.

## 2026-10-14: A formatter error followed fifteen minutes of passing tests

- Doing: completing the default CLI package verification before publication.
- Evidence: the audit passed 6,025 TypeScript tests in 895 seconds and 53 Python tests,
  then failed on the formatter's single-line rendering of a message in `MergeGate.ts`.
  Applied the formatter and submitted the full verifier again.
- Would have prevented it: running the package's inexpensive lint stage before its test
  stage, or a changed-file formatting preflight before the full package verifier.

## 2026-10-14: The publish detector found three assertion-policy gaps

- Doing: publishing after the package verifier and the prescribed parity lanes passed.
- Evidence: publish passed 15 cheap gates but failed `lint:effect-vitest` on three new
  parser assertions in `yeet-ready-gate.test.ts` (EV006). Replaced them with
  `assertSome` and `assertNone`, preserving the original expected payload and polarities.
- Would have prevented it: including the Effect Vitest detector in the package verifier
  or the handoff's parity list, before the fifteen-minute full test suite.

## 2026-10-14: Changeset status passed while the hosted graph rejected the note

- Doing: publishing #1678 with the patch changeset requested by the worker brief.
- Evidence: local `quality:changeset-status` passed, but hosted Repo Sanity rejected
  the note because `@beep/repo-cli` is private: "private workspaces must not accumulate
  release notes." Removed the note and recorded the release-policy decision in `SPEC.md`.
- Would have prevented it: including `quality changeset-graph` in the publish cheap
  gates, and checking package privacy before a brief requires a changeset.

## 2026-10-14: Inherited drawing reds reached the S11 hosted proof

- Doing: reading #1678 failed jobs before acknowledging their inbox rows.
- Evidence: Heavy / Check failed on `drawings-review.test.ts:388` (`MarkupNote.pipe`),
  introduced on main by #1674; Test Unit / repo-cli-1 failed on the stale help
  expectation at `drawings-command.test.ts:112`, introduced on main by #1649.
  The aggregate Test Unit job only reported its failed shard. Assigned both source
  repairs to the design-figure-review-loop main repair lane; S11 files passed.
- Would have prevented it: a main repair lane verifying the test compiler and help
  assertions before landing the drawing routes, followed by dependent lanes merging
  the consolidated main fix once.

## 2026-10-14: Headless heavy admission needs the user-session bus

- Doing: running the round-one S11 regression tests through `beep-heavy`.
- Evidence: the wrapper refused before launching tests because
  `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were undefined. Supplying
  the existing user-session bus admitted the same command without bypassing
  the five-slot queue.
- Would have prevented it: the headless worker launcher supplying the
  user-session environment before invoking the heavy wrapper.

## 2026-10-14: An older audit observed mixed review revisions

- Doing: qualifying the round-one S11 fixes after the main merge.
- Evidence: an older audit completed during this worker's proof and armed
  `package:@beep/repo-cli:audit`; its log showed new tests calling missing
  `recordInheritedRedsWithRest` and `capabilityDoctorFindings` exports, plus
  the previous workflow-cancellation implementation. The test runner had
  loaded modules before the main merge and review edits settled. The fresh
  S11 run passed all 135 tests; a new full audit runs against stable source.
- Would have prevented it: stopping or handing off the prior lane verifier
  before a successor edits the same checkout, and retaining a source digest
  alongside every package-audit receipt.

## 2026-10-14: Passing runtime fixtures still need the REST return contract

- Doing: running test typechecking after the full package audit passed.
- Evidence: the new body-reconciliation REST fakes returned `Effect<void>`
  although `updatePullRequest` returns a pull-request record; the optional
  pagination fixture flag also failed strict boolean expressions. Corrected
  the fakes' return values and compared the flag explicitly with `true`.
- Would have prevented it: typechecking the new test transport fakes before
  launching the full runtime audit.

## 2026-10-14: Hosted lint found a codec allocation after local qualification

- Doing: publishing the S11 round-one repair when the previous head's Lint
  Policy job completed.
- Evidence: `MergeGate.ts` constructed the JSON-string schema inside the
  attributed-flag decoder callback, violating the parser-cache lint. Stopped
  the owned publish unit before any push, hoisted the schema and encoder,
  and kept the repair in the same review wave. Other logged failures were
  inherited Quality/Tasks and drawing code.
- Would have prevented it: including touched-package laws and Oxlint checks
  in local package qualification before publication.

## 2026-10-14: The publish gate exposed three complexity regressions

- Doing: publishing the qualified review wave after merging the main repairs.
- Evidence: Fallow audit and health blocked the ready-flip callback, the
  reconciliation loop and the paginated test fixture. Extracted the record
  confirmation and workflow-page fixture, and flattened the conditional
  body write without suppressions or baseline changes. No push had occurred.
- Would have prevented it: a scoped Fallow audit before the broad qualification
  sequence, so these small structural changes could land in the first proof.

## 2026-10-14: The worker brief and final-file watcher use different protocols

- Doing: declaring the S11 review repair final after publishing and resolving
  both review threads.
- Evidence: the brief requires `final <sha40> #<pr>` in the lane's final marker.
  The shared watcher reads its first field as a numeric PR number and expects
  `<pr-number> <sha10> <push-time>`, so it renamed the required marker to
  `.final.bad` without arming a merge gate. The worker's lane restriction leaves
  the shared watcher repair to the orchestrator.
- Would have prevented it: one versioned final-file contract shared by the
  brief generator and watcher, with a fixture for the documented worker line.

## 2026-10-14: A refused body record survived the next no-red flip

- Doing: closing the S11 round-two review.
- Evidence: a red could turn green after recording, making confirmation refuse;
  the next flip skipped reconciliation for an empty attribution list and retained
  the old section. Every flip now reconciles through the bounded writer, and
  empty attributions rewrite an existing section to a head-pinned None record
  while preserving surrounding text and adding no section when none exists.
- Would have prevented it: a sequence test covering record, post-record refusal,
  and a no-red rerun, rather than checking each refusal in isolation.

## 2026-10-14: Empty-set body reconciliation reached unstubbed scripted fixtures

- Doing: qualifying the head-pinned S11 audit amendment.
- Evidence: PR #1678 job 115715322044 reported three failures in
  `yeet-scripted-process.test.ts`: the status/flip fixtures reached the new
  default REST recorder and had no GitHub identity fixture. The status test also
  retained its two-read expectation despite the post-record confirmation.
  Injected the recorder in those transport-isolated tests and required three
  reads; the dedicated writer and ready-sequence tests retain real reconciliation.
- Would have prevented it: running the complete scripted-process suite with
  the empty-set change before publication, rather than only the direct gate tests.

## 2026-10-14: Runtime-green sequence fixtures failed the test compiler

- Doing: running ordered S11 hosted-parity checks after the package audit passed.
- Evidence: `quality test-tsgo` reported TS377047 for the two new ready-sequence
  reader callbacks. Converted the generator callbacks to `Effect.fnUntraced`;
  no production behavior changed.
- Would have prevented it: applying the Effect callback rule to test dependency
  fixtures before the full audit, since runtime tests do not enforce it.

## 2026-10-14: Integrating the skills split exposed an inherited host-path gate

- Doing: finishing ordered S11 qualification after resolving the #1685 skill split.
- Evidence: `knowledge refs --check` reported one live gated observation,
  `external-mirror-reference` at `.claude/skills/shadcn/design-system.md:31`,
  introduced on main by 96f1f5087b. The file is unchanged by this lane.
  Consolidated main repair is tracked in #1695 for the orchestrator and skills
  owner; dependent lanes should integrate that repair once instead of copying it.
- Would have prevented it: the skills import proof running the host-path gate
  on the imported Markdown references before the merge.

## 2026-10-14: Ready regression fixture needed its actual service contract

- Doing: adding the Run 5 REST-read failure regression for an empty inherited set.
- Evidence: the focused test found two fixture callbacks outside their describe
  scope, then a GitHubError constructor missing its required `operation` field.
  Local callbacks and the service error contract now replace those assumptions.
- Would have prevented it: checking fixture scope and the exported error shape
  before reusing helpers; test-only TSGo also catches both before publication.

## 2026-10-14: Stable qualification must start after fixture repair

- Doing: running the full S11 Run 5 package audit while its new failure fixture
  was still being corrected.
- Evidence: the audit loaded the missing `GitHubError.reason` at startup and
  retained that one failure for its 840-second run; 6,110 other tests passed.
  Fresh focused tests passed after the correction, but cannot make that audit
  green retroactively. A stable full audit is required after the main merge.
- Would have prevented it: waiting for the focused fixture test to pass before
  launching the full audit; buffered shard logs also hid the early failure.

## 2026-10-14: Test-only compiler enforced schema constructor form

- Doing: running Run 5 parity after the stable package audit and docgen passed.
- Evidence: `quality test-tsgo` reported TS377094 (`effect(newSchemaClass)`)
  for the scripted REST failure fixture. Replaced `new GitHubError(...)` with
  the equivalent `GitHubError.make(...)`; production behavior is unchanged.
- Would have prevented it: using the schema constructor consistently in test
  fixtures and running test-only parity before the long package audit.
