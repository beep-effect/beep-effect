# Paused draft PR checkpoint

The operator requested a pause and a draft PR on 2026-09-09. The packet is
paused with its existing phases incomplete. Saving this branch does not
qualify a computation, authorize cache activation, or satisfy final Yeet and
hosted acceptance. Continue only after the operator resumes the work.

## Retained implementation and evidence

The branch contains the qualification policy and lifecycle writer, executable
census and entrypoint review, scoped drift audit, synthetic runner, native
identity-lint pilot, installed dependency materialization, and exact-runtime
cache key. The identity and types pilot computations remain excluded with
live cache reuse disabled.

The last complete native matrices are the separate stable and canary
`pilot-runtime-key-v5-*.json` receipts. Each records 67 observations, 40 passing
checks and ten shadows. Their runtime identity predates the startup-library
extension; preserve them as historical evidence rather than claiming they
verify the new fingerprint.

The latest source increment adds bounded glibc startup-library discovery to
the toolchain snapshot. It hashes library aliases and physical targets, the
loader, and the discovery helper. It distinguishes explicit static linkage
from failed discovery and records all six executable roles. The pilot uses
the requested Turbo client's linkage, compares sandbox resolution with the
reviewed runtime, and checks linkage again after execution. Older snapshots
remain readable with an explicitly absent library observation.

Source typechecking, 26 focused tests, and full CLI package verification pass
(audit 425.0 seconds; docgen 21.1 seconds). Those tests include a native
shell discovery and negative discovery cases, malformed/unresolved listings,
library byte changes, symlink retargeting, loader changes, and changed client
linkage. The full updated native pilot matrix has not run. Final checkpoint
verification and retained log hashes are in `paused-pr-verification.json`.

## Resume order

1. Inspect the draft PR, exact branch head and working tree, then reactivate
   the packet through `beep goals set-status` when resumption is authorized.
2. Refresh the activation preview for the new toolchain identity and run the
   stable and canary native matrices separately. Confirm the new sandbox
   linkage checks and preserve any failure attribution. Retain the requested
   client's complete linkage snapshot in the native receipt so its runtime
   digest can be reconstructed independently, including a dynamic client.
3. Finish ordinary Quality/CI/Yeet runtime-key enforcement and remaining
   runtime/semantic observations, including actual asynchronous I/O outcomes.
4. Consume accepted signed conformance and trust runtime evidence. Searches
   found no accepted receipts; the sibling packets remain paused. The earlier
   request to launch separate sibling tasks has not received approval.
5. Complete signed replay, qualify a real computation, and prepare the adoption
   handoff. Run full Yeet and hosted review closeout before declaring the final
   implementation merge-ready or completing the goal.

Full repository proof, hosted acceptance and final closeout are not part of
this save checkpoint. The original SPEC remains the completion contract.
