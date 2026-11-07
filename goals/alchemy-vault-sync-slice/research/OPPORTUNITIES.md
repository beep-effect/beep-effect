# PR 3a friction receipts

| Work | Evidence | Prevention |
| --- | --- | --- |
| Start packet commands in a fresh T3 checkout | session open and architecture initially failed: Cannot find module effect/Result; frozen-lockfile install repaired it | Run the repository dependency bootstrap before opening the implementation lane |
| Run the broad schema-first detector | lint schema-first returned exit 1 with no detector result beyond the command banner; no successful proof | Prefer a package-scoped syntax/checker detector on memory-constrained hosts |
| Run the full two-package verifier | One attempt exited 130 before a package result; later bounded retry passed both packages | Preserve process exit results and expose admission/interruption reason in the verifier |
| Add source coverage identities without weakening floors | Initial domain-only unit coverage was too sparse; a pure model scenario raised it above the existing package floor; use-cases still has an existing 100 percent floor | Keep package-local event-fold scenarios and dual-platform policy scenarios; add missing file identities separately from adopting package percentages |
| Acknowledge verifier inbox failures under a no-Yeet task | The harness requires yeet inbox ack even when the user assigns publication to the orchestrator | Give proof inbox acknowledgement an independent command route; this lane used only mandated ack, no publication/readiness action |

## Follow-up receipts

| Work | Evidence | Prevention |
| --- | --- | --- |
| Obtain scoped lint proof | Both native lint help pages lack scope flags; bounded canonical scans found six schema and two Effect Vitest findings, all fixed | Add native scope flags; the packet adapter preserves detector code and avoids a repo-wide program |
| Verify deadline policy replay | One run timed out waiting for a 40 ms expiry; final test executes the exact stale expiry id after success and replays the policy | Test replay independently of short wall-clock wakeups; retain the separate scheduled expiry scenario |

## PR 3b part 1 integration friction

- Fresh checkout: the initial session command failed with "Cannot find module effect/Result".
  Running the pinned bun install repaired this checkout; a dependency preflight would catch it
  before invoking packet tooling.
- The brief's decision command used an unsupported --slug flag. The installed CLI accepts the
  packet slug as the positional argument and --topic for the filename. Its help resolved the mismatch.
- Snapshot-backed Projection.caughtUp on an aggregate receipt returned before the SQL handler
  applied transitive View deliveries. Scenario tests now await expected SQL state too. A documented
  transitive progress contract would prevent mistaking intake progress for read-model readiness.
- Package-verifier failures create P0 inbox rows despite this lane's no-publication scope.
  Only mandatory inbox acknowledgements were used; no publication workflow ran.

### 2026-11-07: part 2 checkout and proof friction

- Fresh checkout: the first main merge commit hook could not resolve
  `@commitlint/config-conventional`. `bun install` repaired local dependencies;
  the merge then committed through normal hooks. Bootstrap dependencies before
  invoking merge hooks in a new T3 checkout.
- Package verification caught an unsupported docgen category, Effect diagnostics
  and formatting in the new source. These were repaired and the package verifier
  reran. The mandatory harness required local inbox acknowledgement commands;
  no publication/readiness/monitor command was run.
- Main's cache repair was integrated first. Twelve stack-local dependency subjects
  still needed the reviewed request; re-recording only those subjects restored
  zero policy blockers. The requested `cache-baseline-request-pr2b-main.json`
  was absent from this branch; the existing request schema and current main
  baseline were used instead, without hand-merging baseline JSON.
- The writer transition remains incomplete: an added startup check cannot make
  a previously released executable epoch-aware. Cutover needs a database refusal
  boundary and a tested post-admission reversal before the legacy writer is
  removed. The packet decision records this implementation hold explicitly.
## PR 3c API integration friction

- The fresh checkout lacked dependencies: session tooling failed with "Cannot find module
  effect/Result" and the merge commit hook lacked commitlint configuration. Frozen-lockfile
  installation restored both; no hook was bypassed.
- No verified signed-in desktop principal or live membership resolver exists in the current
  sidecar host. RpcSessionAuth verifies only the launch token. An explicit enrollment and
  membership-owner adapter is needed before switching legacy callers; treating the launch
  token as an organization grant would violate D14.
- The installed beta.85 Api client declaration exposes a private CallOptions type through
  inferred wrappers. A mapped client contract names the original indexed method types,
  avoiding a patch or a type assertion.
