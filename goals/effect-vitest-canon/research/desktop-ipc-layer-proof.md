# Compiled sidecar public fixture

The gated IPC integration now acquires its filesystem, real compiled child,
stderr drain, and RPC socket protocol through public it.layer. The test body
contains the original CreateThread and streaming SendMessage assertions. The
manual filesystem Layer.build/provider wrapper and whole-program scoped wrapper
are removed.

The fixture uses excludeTestServices: true and the layered it.effect tester.
This preserves the native process's live clock. Layer callbacks expose
MethodsNonLive, so attempting it.live inside that callback initially failed both
registration and typechecking; that mistake was corrected and recorded in
OPPORTUNITIES.md. The boot deadline remains twenty seconds, the RPC deadline
remains thirty seconds, and the resource fixture has a thirty-second hook budget.

The acquisition order remains directories, stderr child scope, process, and
protocol. Finalization therefore closes protocol resources, waits for child
termination, drains stderr, and removes the directories. This supersedes the
pending public-layer portion of desktop-ipc-resource-proof.md while retaining
that receipt's process-order repair.

## Verification

The canonical beep:test:integration:ipc command rebuilt the compiled Bun sidecar
and passed the enabled RPC streaming case. This is an actual subprocess run,
not credit for the default gated suite. Node cannot execute this Bun.spawn
boundary and is not claimed as a second runtime proof here.

Full Desktop package verification passed audit and docgen after the registration
correction. AST comparison preserved the original title and all four assertion
call expressions, including nested expressions.

Temporary probes ran both a successful body and an injected failing body. In
both runs, each directory finalizer observed that the child had exited, stderr
was unlocked after fixture finalization, and both temporary paths were absent.
The successful run passed; the failure run failed only at the injected body
failure and still wrote its post-cleanup receipt. Clock probes in acquisition
and the body observed nonzero live time. All probes were removed in a finally
block before final verification.

Schema-first, Biome, and strict packet validation passed. After the related
residual judgments, the final ratchet reports zero introduced findings, 242
resolved against the retained baseline, and 4,764 live findings. The strict
packet check validates 5,006 unique root IDs and 15,254 unique ledger rows;
that structural result is not final lens review or Desktop completion.
