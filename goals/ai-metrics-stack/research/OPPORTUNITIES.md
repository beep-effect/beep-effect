# Opportunities

## The packet had no friction ledger at closeout

- **Work:** Starting the P7e production-readiness closeout from the verified
  2026-08-10 handoff.
- **Friction:** The packet's operating law requires friction receipts in
  `research/OPPORTUNITIES.md`, but that file did not exist. The closeout had to
  stop and discover another packet's format before it could record the first
  receipt.
- **Evidence:** `rg --files goals/ai-metrics-stack` returned no
  `research/OPPORTUNITIES.md` before this file was created.
- **Proposal:** Create the opportunities ledger when a goal packet is
  scaffolded, even when it begins empty.

## OTLP status hid the collector's actionable response

- **Work:** Diagnosing why the live forwarder's OTLP export failed while the
  Phoenix endpoint still answered health probes.
- **Friction:** The CLI reduced the OpenTelemetry exporter's retryable HTTP
  failure to a generic `AiMetricsOtlpExportError`. A direct protobuf POST and a
  temporary cause-logging harness were needed to expose Phoenix's HTTP 503
  response: `Server is at capacity and cannot process more requests`.
- **Evidence:** The 2026-08-10 03:30 CDT forwarder status recorded
  `exported=false`; an empty protobuf `POST /v1/traces` returned HTTP 503; the
  installed Phoenix 15.5.0 source maps that response to a full span queue.
- **Proposal:** Preserve a sanitized HTTP status and retryability category in
  OTLP export errors and forwarder status. Never include request headers or
  payloads.

## Whole-backlog acknowledgement made a bounded collector impossible to drain

- **Work:** Replaying 166,152 pending live turns to Phoenix after confirming the
  endpoint and workstation timer were otherwise healthy.
- **Friction:** The sender delivered 512-span chunks, but the durable watermark
  closed only after the entire backlog succeeded. Phoenix accepted a prefix,
  filled its 20,000-span queue, rejected a later chunk, and the next retry sent
  the same prefix again. Stable span ids prevented duplicate storage but could
  not prevent retry starvation.
- **Evidence:** The first retry with per-chunk acknowledgement reduced the
  pending count from 166,152 to 159,189 before the next HTTP 503. The new
  regression test proves an acknowledged prefix remains closed after a later
  chunk fails.
- **Proposal:** Keep delivery acknowledgement and durable progress at the same
  chunk boundary, and add a production-shaped test whose backlog exceeds the
  collector queue.

## The generic test command selected the wrong runner

- **Work:** Running the focused AI metrics OTLP regression test.
- **Friction:** Direct `bun test` selected Bun's runner for an Effect Vitest
  suite and failed during test collection with
  `V.TestRunner.getCurrentSuite`. The correct command was
  `bunx --bun vitest`.
- **Evidence:** The same focused test passed under Vitest, followed by all 50
  tests in `packages/tooling/library/ai-metrics/test/ingest.test.ts`.
- **Proposal:** Put the package's focused-test command in its README or add a
  package script so operators do not have to infer the required runner.

## Effect v4 collection helpers have a non-obvious migration boundary

- **Work:** Extracting optional string turn ids from OTLP projection
  attributes for per-chunk checkpointing.
- **Friction:** `Array.filterMap` in this Effect v4 tree accepts `Result`, not
  `Option`; the familiar v3-shaped use typechecked only after being rewritten
  as `Array.map` plus `Array.getSomes`.
- **Evidence:** `bun run --filter @beep/repo-ai-metrics check` caught the
  mismatch before the package test suite was rerun green.
- **Proposal:** Add this `filterMap` boundary to the v3-to-v4 migration notes
  and provide a discoverable Option-specific collection recipe.

## Hardware-backed SSH lost non-interactive continuity mid-closeout

- **Work:** Inspecting Phoenix container pressure and later confirming the
  derived mirror on dankserver.
- **Friction:** The security-key SSH identity required a YubiKey touch in a TTY,
  while the configured askpass path and agent socket were unavailable.
  A temporary control connection allowed non-interactive follow-up probes, but
  it expired while Phoenix was draining.
- **Evidence:** Batch mode failed with `signing failed for ED25519-SK` and
  `Permission denied (publickey)`; an interactive TTY connection succeeded
  after hardware authorization.
- **Proposal:** Restore the desktop SSH agent socket for hardware-backed keys,
  or document the supported control-master bootstrap for agent-operated remote
  maintenance.

## Phoenix capacity is shared with an independently retrying trace pipeline

- **Work:** Explaining why the AI metrics backlog drained unevenly even after
  progressive checkpoints made every retry monotonic.
- **Friction:** Port `8447` reaches Phoenix directly, but the same 20,000-span
  queue also receives coding-harness traces from
  `monitoring_otel_collector`. The collector maintains its own retry senders,
  so a healthy `/healthz` and an occasional successful empty OTLP request do
  not describe the capacity available to the AI metrics exporter.
- **Evidence:** Phoenix container logs distinguish direct host requests from
  `172.19.0.1` and sustained `monitoring_otel_collector` traffic from
  `172.19.0.2`; the latter logged repeated retryable HTTP 503 responses while
  Phoenix held about 100% CPU and its block writes grew beyond 5 GB.
- **Proposal:** Export Phoenix queue depth, rejection count, and per-ingress
  source pressure to Prometheus. Add an explicit capacity gate to the AI
  metrics runbook instead of treating endpoint reachability as readiness.

## Secret-reference flags do not make the forwarder command self-sufficient

- **Work:** Running one fresh production-shaped forwarder after the historical
  OTLP watermark reached zero.
- **Friction:** The command accepted both `--hash-salt-secret-ref` and
  `--raw-archive-key-secret-ref` but still failed until the actual runtime
  variables were injected: `Non-local AI metrics commands require --hash-salt
  or BEEP_AI_METRICS_HASH_SALT.` The timer already handles this correctly via
  its mode-0600 environment file, but a manual operator command is easy to read
  as self-contained.
- **Evidence:** The refs-only command exited 1; the identical command succeeded
  after sourcing the installed protected environment without printing any
  value.
- **Proposal:** Make CLI help and error text explicitly distinguish plan-time
  secret references from required runtime injection, and provide one safe
  systemd-environment execution recipe.

## The declared remote mirror root was not provisioned

- **Work:** Running the P7e confirmed mirror sync to the canonical
  `/srv/data/ai-metrics/p7-derived-mirror` target.
- **Friction:** `@beep/infra` declared the remote path, but neither the Pulumi
  component nor dankserver configuration management had created it. The SSH
  account could not create the root-owned parent. A protected 1Password path
  was unavailable, one narrowly scoped Docker attempt failed to start and was
  removed, and the operator ultimately had to authorize the exact `sudo
  install -d` in a visible terminal before the CLI could sync.
- **Evidence:** The first confirmed sync failed before rsync; remote `stat`
  showed `/srv/data` as root-owned mode `0755` and the mirror root missing. The
  authorized install created `/srv/data/ai-metrics/p7-derived-mirror` owned by
  `elpresidank` at mode `0750`; confirmed sync and status then passed.
- **Proposal:** Provision the canonical mirror root, ownership, and mode in
  dankserver configuration management before advertising it as an operational
  CLI target.

## Explicit mirror bundle ids are interpreted as paths

- **Work:** Retrying the confirmed sync with the just-built bundle id.
- **Friction:** `--bundle p7-mirror-1786367539589` is treated as a literal
  directory path, but the resulting error only said that bundle inventory
  inspection failed. `--bundle latest` resolved the data-root bundle directory
  and succeeded immediately.
- **Evidence:** The explicit-id invocation stopped before SSH with `Failed to
  inspect AI metrics mirror bundle file inventory`; the otherwise identical
  `--bundle latest` invocation synced the expected bundle.
- **Proposal:** Accept bundle ids relative to `<dataRoot>/mirror/bundles`, or
  say explicitly that non-`latest` values must be directory paths.

## Package checks did not typecheck the test-only fake sender

- **Work:** Binding the P7e branch to the full Yeet verification proof after
  the AI-metrics package check, lint, docgen, and 147 runtime tests passed.
- **Friction:** The package source typecheck excludes test files and Vitest
  transpiles them without the Effect language-service diagnostic. Only the
  repo-wide test-file TypeScript sweep reported that the new fake sender used
  `yield* Effect.fail` around an already-yieldable tagged error.
- **Evidence:** `@beep/repo-ai-metrics` check and all runtime tests passed; the
  first `bun run beep yeet verify` then failed at
  `packages/tooling/library/ai-metrics/test/ingest.test.ts:186` with
  `effect(unnecessaryFailYieldableError)`.
- **Proposal:** Include the package's test tsconfig in its normal `check`
  script so focused development catches Effect diagnostics before the
  repo-wide 707-test-file sweep.

## Yeet staged-only publication cannot reuse an exact verified index

- **Work:** Publishing the fully verified closeout index through the canonical
  Yeet commit, push, PR, and monitor path.
- **Friction:** `--staged-only` and `--reuse-verified` sound complementary for
  an exact reviewed index, but Yeet rejects the combination because
  staged-only publication creates a fresh commit. The rejection happened
  before any commit or push, but recording it necessarily invalidated the
  exact proof that had just completed.
- **Evidence:** `bun run beep yeet publish --staged-only --reuse-verified --pr
  --monitor ...` exited 1 with `--staged-only cannot be combined with
  --push-only, --reuse-verified, or --amend`.
- **Proposal:** Make `yeet verify` print the supported next publish command for
  a staged index, or allow a verified index fingerprint to be consumed while
  creating its corresponding commit.

## Chunk ownership was split across the sender boundary

- **Work:** Closing the PR review loop after the first hosted publication.
- **Friction:** The production drain proved that per-chunk progress was needed,
  but the first fix left chunk acknowledgement inside the pluggable sender and
  kept all session projections ahead of all turn projections. Two reviewers
  independently found that 512 sessions could therefore form a successfully
  delivered chunk with no turn watermark to close; a third finding showed that
  TypeScript permits a custom sender to ignore the callback entirely.
- **Evidence:** PR #647 review threads `discussion_r3750403323`,
  `discussion_r3750403337`, and `discussion_r3750406648` arrived after the
  initial local proof and publication.
- **Proposal:** Keep chunking, delivery, and checkpoint orchestration in one
  owner; keep each session projection adjacent to its turns; retain the
  production-shaped 512-session regression in the package suite.

## Staging invalidates an otherwise exact reusable Yeet proof

- **Work:** Amending the review fix into the already-open closeout PR after a
  fresh full Yeet verification passed.
- **Friction:** The proof was run over the exact three-file worktree and the
  files were staged without content changes immediately afterward. Yeet still
  rejected `publish --amend --reuse-verified` because the diff fingerprint
  changed, forcing another full proof of byte-identical content.
- **Evidence:** The publish stopped before commit or push with
  `yeet publish --reuse-verified found stale proof state: diff fingerprint
  changed` and instructed a new exact-worktree verification.
- **Proposal:** Fingerprint the resulting tree plus relevant untracked residue,
  or document that the index/worktree partition is proof material and print
  the required stage-before-verify sequence.

## Remote freshness expired during the full proof

- **Work:** Publishing the fully proved, staged review fix to PR #647.
- **Friction:** `origin/main` advanced four commits while the staged full proof
  ran. Yeet correctly refused publication because both histories touched the
  generated `goals/INDEX.md`, so the just-completed proof could not be consumed
  until the branch was rebased and proved again.
- **Evidence:** `yeet publish --amend --reuse-verified` reused the proof from
  `2026-08-10T15:06:21.815Z`, then stopped before commit or push with
  `branch is 4 commit(s) behind origin/main` and named `goals/INDEX.md` as the
  overlapping path.
- **Proposal:** Capture remote freshness immediately before the most expensive
  proof wave and surface an early warning if the tracked base moves while that
  wave is running; keep the final publish-time refusal as the hard gate.

## Rebase left stale TypeScript build state behind

- **Work:** Re-proving the closeout commit after rebasing it onto the fresh
  remote main branch required by Yeet.
- **Friction:** The full build first reported no-location `TS2589` failures in
  `@beep/box` and `@beep/ui`; Yeet's isolated quarantine passed, but the next
  build and check lanes surfaced cascading `unknown` errors in `@beep/xai`.
  A frozen install alone did not clear them, even though the closeout diff did
  not touch that package.
- **Evidence:** `bun install --frozen-lockfile` succeeded, the isolated normal
  `@beep/xai` check still failed at `XAi.service.ts:320` and related lines,
  then `tsgo -b --force tsconfig.json` followed by the same normal check passed
  without any source edit.
- **Proposal:** After a rebase that changes TypeScript dependencies or patched
  compiler state, refresh affected build info before the full proof; teach the
  flake quarantine to try a forced package rebuild when located errors follow
  a transient no-location `TS2589` failure.

## A hosted runner shutdown reports as a failed Check lane

- **Work:** Monitoring PR #647 through its final required hosted checks after
  the exact-head local Yeet proof passed.
- **Friction:** The Check job reported a failure even though its package check
  completed 33 of 33 tasks successfully. The self-hosted runner received a
  shutdown signal during the following test-file TypeScript sweep, so the lane
  could not reach a semantic verdict and required a fresh hosted proof.
- **Evidence:** GitHub Actions job `93510172617` logged `33 successful, 33
  total`, started checking 708 test files across 128 packages, then emitted
  `The runner has received a shutdown signal` and `The operation was
  canceled` before terminating the TypeScript process.
- **Proposal:** Classify runner shutdown/cancellation separately from source
  failures in the required-check summary and automatically retry an
  interrupted lane once on a fresh runner.

## Yeet amend does not inherit the existing commit message

- **Work:** Republishing the runner-shutdown friction receipt into the open
  closeout PR with `yeet publish --amend`.
- **Friction:** Yeet rejected the amendment before verification because no
  `--message` was supplied, even though the amended commit already had a valid
  conventional commit message that did not need to change.
- **Evidence:** `bun run beep yeet publish --amend --pr --monitor` exited 1
  with `yeet publish requires --message with a conventional commit message for
  reviewed staged changes`; `git log -1 --format=%B` showed the existing valid
  message `fix(ai-metrics): close V1 production readiness`.
- **Proposal:** Default `--amend` to the existing commit message when
  `--message` is omitted, while retaining commitlint validation.

## Interactive status steering terminated an active Yeet proof

- **Work:** Running the fresh local proof and publication after adding the
  hosted-runner shutdown receipt.
- **Friction:** A user status message interrupted the tool wait and the active
  Yeet process disappeared after it had amended the local commit but before it
  wrote a terminal proof or pushed. The branch was left clean and recoverable,
  but local and remote heads diverged and the completed proof work was lost.
- **Evidence:** The publish session became an unknown process id; local `HEAD`
  was `d7400044463bbbebb64d7b2560b11fc76b64ad3b`, while the remote branch and PR
  remained at `ea01fccb13481a00face5686d166efda16edb9e4`. `yeet status --json`
  still exposed the earlier pre-verification failure rather than a terminal
  verdict for the interrupted attempt.
- **Proposal:** Run publish verification in a durable process whose lifecycle
  is independent of conversational turn steering, and preserve the latest
  in-progress/terminal attempt instead of falling back to an older verdict.
