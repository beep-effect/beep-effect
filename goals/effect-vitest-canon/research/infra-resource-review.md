# Infrastructure resource review

The saved native-resource constraints remain binding. The generated ghaRunners
SDK build tests use node:test and an actual selected compiler subprocess. Their
context.after cleanup, recorded argv/cwd, stale-compiler nonexecution and absent
postinstall witnesses remain intact. The nested Lambda tests retain their Bun
runner and injected AWS/HTTP seams; they are separate from configured Vitest
cases and are not credited by a Vitest-only timing receipt.

OpenClaw's runCaptured helper owns a real child-process handle in an inner scope
and joins stderr with exitCode. Preserve that early close boundary and native
Node Crypto services. The executable test covers only the rendered script's
missing-mode usage rejection, including exit1 and its usage text. Rendered
provider, backup and privileged commands are inspected as strings, not executed.

The platform groups acquire stateless NodeServices adapters and inherit the
shared10-second hook budget, or300 seconds for coverage/deep sweep. These are not
external deployment acquisitions. Preserve those configured budgets; generic
hardcoded hook timeouts would clamp the longer mode.
