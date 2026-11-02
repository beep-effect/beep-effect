# Existing managed-owner observation enrollment

`agent-message serve` now accepts optional `--observation-dir`. It opens the same
existing native adapter through an observation integration, rather than introducing
a parallel launcher. Without that explicit option, existing behavior remains and
no observed-launch coverage is asserted.

## Enrollment and identity

The supplied directory must be canonical, owned and 0700. Its `enrollment.json`
must be an owned regular 0600 file, without symlink or hardlink aliases. Reading
uses a checked descriptor and a 32 KiB ceiling. Unknown fields, invalid UTF-8,
missing stores and invalid identities refuse startup with content-free errors.
The integration never creates a missing independent claim store.

The enrollment contains the existing claim policy, private collector destination,
original Prepared submission and a salted owner binding. The binding is derived
from actual endpoint ID, owner ID, lifecycle generation, repository scope, canonical
workspace and provider. The launch ID is deterministically derived from that binding.
Within the preserved enrolled claim store, the same owner occurrence cannot gain
a second attempt merely by changing the submission ID. Replacing or rolling back
that store is a separate recovery boundary requiring a hold; this process cannot
detect an administrator substituting an entirely new valid store.
Namespace, host, route harness, CLI surface and collector directory must agree.
Task/repository/clone/worktree attribution remains explicitly declared evidence;
this binding does not manufacture verified values for those fields.

The configured private hash salt is required. Empty/whitespace values and the known
insecure smoke fallback are refused. The collector's configuration composition now
applies the same refusal even if a matching insecure namespace was declared.
No secret value is included in errors, output observations or receipts.

## Local-first lifecycle

A fresh durable claim precedes `sessions.open`. Started and SessionBound callbacks
write metadata locally and never contact the collector. A scoped reconciliation
activity begins only after adapter initialization and validation. It retries exact
idempotent facts at a bounded cadence of 60 seconds and logs only delivery-state
transitions. A missing collector therefore preserves local observations without
preventing an otherwise authorized enrolled agent from starting.

Before close, the owner interrupts that reconciliation activity and waits for it
to stop. The real child is closed and isRunning must report false before Finished
is recorded. An owner-initiated successful close is cancelled; an already-stopped
child with a numeric exit code is classified from that code; an unavailable exit
result remains unknown. These are process outcomes, never task-quality evaluations.
A failed adapter close does not erase a confirmed stopped child: its outcome is
kept conservative. Failed initialization records unknown only after the observed
child is confirmed stopped. Scope finalization invokes the same cached close effect.
A final flush has a two-second bound; missing acknowledgments remain in the outbox.

Local observation writes now read fact integrity separately from receipt integrity.
An interrupted receipt write can still hold transport reconciliation, but cannot
prevent later shutdown metadata from being retained. A torn lifecycle fact still
refuses further uncertain mutation. No damaged record is silently replaced.

## Verification and limits

The focused suite includes the actual serve command, actual Bun synthetic protocol
children, offline local capture, explicit close, command interruption, forced child
termination, policy-handshake rejection and duplicate-launch refusal. It checks
wrong owner/generation/salt, exposed and oversized enrollment, changed attempt
identity and a missing store before spawn. Exported facts contain hashes rather
than the fixture's raw session ID, workspace or salt. Existing managed dispatch,
permission drift, grant expiry and mailbox settlement regressions also run.

The CLI-wide test typecheck initially exceeded an incorrectly assigned 6 GiB limit
and produced an OOM-kill event. This was disclosed and recorded in the memory
investigation. Focused checks use about 1.5 GiB. The subsequent broader attempt is
supervised by an early-stop guard with a 12 GiB job threshold and 10 GiB host
available-memory floor, below a 24 GiB emergency ceiling; its actual result is
recorded separately rather than inferred from the focused suite.

Current results and fingerprints belong in `ops/history/managed-owner-verification.json`.
This is opt-in production code with synthetic qualification. No real provider
session, live enrollment, desktop restart, historical forwarder or production
collector configuration was changed. Provisioning and claim-store recovery ownership, independent population reporting,
real CLI/desktop canaries, deployment, final panel and repository delivery remain open.


## Recovery after the owner exits

The existing command family now exposes:

```sh
bun run beep agent-message observation status --observation-dir <private-enrollment-directory>
bun run beep agent-message observation reconcile --observation-dir <private-enrollment-directory>
```

Status reads the original bounded facts and historical acknowledgment receipts
without contacting the collector. Reconcile explicitly replays at most four
unchanged facts with the existing ten-second transport bound. Neither operation
has a launch profile, launch grant, process-spawn dependency, salt requirement,
claim initialization or epoch-selection path. The enrollment must match the
retained Prepared claim exactly before transport, including its original epoch.
Missing, changed or damaged state refuses; an unsuccessful replay retains durable
facts and any verified partial acknowledgments. It never repairs a torn receipt.

The report labels current process liveness and backend visibility as unknown.
Finished is historical evidence of the owner's observed shutdown, and a collector
receipt is historical local-commit evidence. Neither establishes current Phoenix
visibility, a task-quality score or coverage of another harness. The command may
be used while a producer is alive; its snapshot is not a transaction spanning
later producer appends. Re-run explicitly for newer facts. Whole-store rollback
still requires a recovery hold and is not repaired by either command.

Each periodic owner flush now owns a short-lived resource scope. The platform
HTTP client installs agent cleanup finalizers; the previous parent-session scope
would retain those until session close on every retry. Per-attempt scope releases
them immediately. This is a source-level lifetime correction, not attribution of
the workstation's memory notifications or a measured long-running leak claim.

## Actual command and worker proof

The extended worker-entrypoint verifier executes the real serve command with an
actual synthetic Codex protocol child while collector intake is paused. All four
local facts survive owner interruption, the child is confirmed stopped, and there
are zero receipts. After the actual collector entrypoint restarts, a new process
runs the real recovery command. It obtains four durable receipts for the identical
facts and a duplicate serve attempt creates zero children. The existing library
lost-acknowledgment scenario remains separate and still passes. Across all fixture
launches the journal retains exactly sixteen launch facts.

The proof checks absence of raw synthetic owner/endpoint/repository/workspace,
session ID and salt in the command report and collector journal. All ten owned
service processes stop. This is synthetic protocol and collector-journal evidence:
zero real provider requests and no new Phoenix backend-visibility claim. Exact
fingerprints/results are in ops/history/managed-owner-recovery-verification.json and
ops/history/managed-owner-command-worker-verification.json. The broader CLI gate remains
unverified; this does not waive it or complete the packet.


The full command-group service environment also exposed HTTP layer memoization:
a general HTTP client could be reused while constructing the private Unix-socket
client. The private options layer now uses Layer.fresh. A focused regression
reproduced the failure with the enclosing general client, and its repaired case
checks independently addressed sockets. The integrated fixture supplies the full
command group's HTTP dependency and invokes its registered subcommands.


## Explicit provisioning operations

Setup now uses the registered `agent-message observation` command family:

```sh
bun run beep agent-message observation initialize-claims --request-dir <private-request-directory>
bun run beep agent-message observation enroll --request-dir <private-request-directory> --observation-dir <new-private-enrollment-directory>
```

Both read `request.json` through the existing strict owner/mode/descriptor and
32 KiB input boundary. Its schema is `AgentObservationProvisioning`:

| Field | Required evidence/input |
| --- | --- |
| owner | Actual endpoint, owner, generation, repository scope, canonical workspace and provider |
| claims | Independent directory and explicit fence/host/namespace/capacity policy |
| destination | Existing collector directory, matching host/namespace and finite request timeout |
| evidenceEpoch | Explicit original collector epoch; setup does not select or advance it |
| identity | Declared route/harness/surface and separately evidenced or unknown identity components |

The private configured hash salt must match the declared namespace and must not be
empty or the insecure fallback. Setup derives the owner binding and attempt ID
using the same contract as serving. It verifies the canonical workspace, CLI
harness/provider match and consistent host/namespace/destination before mutation.
Private inputs and salt never appear in the setup receipt; it contains only
operation, attempt/fence/host/namespace digests and the explicit epoch.

`initialize-claims` is exclusively for a genuinely new independent store. It calls
the existing exclusive initialization and sync implementation. An existing or
partial store is refused and preserved. This command is not authorization to
replace a missing store belonging to an already enrolled owner.

`enroll` only uses an existing valid independent store. It refuses an already
consumed attempt and creates a new enrollment directory/file exclusively. Its
parent must be canonical and owner-only. Enrollment cannot be inside, contain or
replace either the claim store or collector directory. File and directory sync
precede acknowledgment, and the result is re-read through serving's exact private
input checks. Existing or interrupted partial output is preserved, not retried,
overwritten or removed. Setup does not launch a child or contact the collector.

For an existing initialized store, skip initialize-claims and enroll a new owner
occurrence against that same retained fence. Repeated delivery uses reconcile;
it never uses either setup command. Store loss, uncertain rollback, or a partial
setup requires retaining the evidence and holding affected launches for explicit
recovery. Collector restoration does not grant permission to replace producer
claims. Independent off-device claim-store preservation and restoration policy
still need operational qualification before production enrollment.

The registered-command proof now invokes both setup operations before serve,
checks their exact receipts and the installed enrollment against independently
computed synthetic expectations, then performs the existing paused-capture,
shutdown, restart and recovery proof. No real user owner was enrolled. See
ops/history/managed-owner-provisioning-verification.json for this source revision.
