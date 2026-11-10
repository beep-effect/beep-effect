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

## PR 4 frontend friction

- A concurrent `runtime.fn` disposes its previous context when it is triggered again, and
  `get.set` on a disposed context is silently dropped. The flush resent a delivered intent
  about 1000 times in a panel test (`expected [ 'probe', 'probe', … ] to deeply equal
  [ 'probe' ]`). Fix: read and write through the `AtomRegistry` service inside fns. An
  effect-atom lint for `get.set` after an async boundary in a fn would catch this.
- Desktop tests run concurrently by default (`sequence.concurrent`), and jsdom `localStorage`
  is shared per file. Two queue tests saw each other's writes until the describe opted out
  with `{ concurrent: false }`.
- View `atLeast` cannot bound `VaultSyncStatus`: it is built from `SyncDestinationSnapshot`,
  another View, so a read bounded by the aggregate receipt never resolved. Confirmation now
  re-decides accepted intents against fresh reads instead.
- Effect's RPC HTTP client posts to `<url>/`. Effect's `HttpRouter` accepts that; an
  exact-path harness host did not, which cost a QA iteration.
- `portless proxy start --help` starts the proxy instead of printing help and makes a bare
  `sudo` attempt for port 443. It fell back to port 1355 without a TTY.
- A fresh worktree's Playwright install lacked the headless shell build the pinned Playwright
  needs (`chromium_headless_shell-1254`).
- The headless vault gate never reached its manual form: zenity exits non-zero without a
  display, which the picker reads as "cancelled". QA hid zenity and kdialog from the sidecar
  PATH to get the documented fallback.

## Final PR hand-merged while held (2026-11-08)

- Doing: holding STRICT final #2933 for ep58, with a DO-NOT-MERGE-before-the-gate line first in its body and the hold posted to the orchestrator.
- Evidence: it was hand-merged at 08:26:29Z. `goals completion refresh` then printed `unsatisfied` ("the merge-push rule suite failed required status checks"; "declared verdict is not a publish result"). A body line does not stop a human merge, and the PR had also left draft before its last step.
- Would have prevented it: a ruleset-enforced hold for a goal final, such as a required `yeet-verdict` status posted only after `merge-ready: yes`.

## Re-final merged two minutes after its ready flip (2026-11-10)

- Doing: verifying the proposed closeout with `goals completion refresh --slug alchemy-vault-sync-slice --readiness-job <id>` from the #2962 lane.
- Evidence: `unknown`, "Readiness recovery refused: status was recorded after job end". #2962 went ready and merged at 2026-11-08T11:35:24Z while its until-ready monitor was still running; the earlier finished job had ended on `blocked on not-draft`, and the running job overwrote `status.json` after the merge. The packet then sat two days as "proposed, unverified".
- Would have prevented it: the same ruleset-enforced hold as the receipt above, or a refresh that reads readiness from hosted facts at the merged head (required checks green, zero unresolved threads, window elapsed) when no local monitor job survived.
