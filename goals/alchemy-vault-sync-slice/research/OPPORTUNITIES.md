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
