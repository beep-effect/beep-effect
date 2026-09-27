# ACP existing-inventory wave preparation

The lane starts at main 9cb79ddda2b72c426b322045fee9f5131b92a13c. Its existing
inventory has 46 rows across six paths, including two support files. All six
paths remain present. Four changed since frozen census 662823dd960367046ba7d73dd8fd25d15782865a;
protocol.test.ts grew from 626 to 971 lines. Current cases inside those paths
remain part of this wave's source review and must preserve their assertions.

A seventh path, packages/drivers/acp/test/json.test.ts, was added after the frozen
inventory. The configured package proof includes it; the six-path lens inventory
does not. Its new lens inventory remains part of the later remainder pass, per
the instruction to exhaust existing legitimate inventories first. No claim of
complete current-package inventory coverage is made here.

Both configured baselines passed all 39 tests with zero failures or skips:
Node 5.422 seconds and Bun 3.219 seconds. Full package audit/docgen passed
(12.3 / 3.9 seconds). The four ambient mock-peer switches were absent. Tests
use real local Bun children running the committed ACP peer fixture, with piped
stdin/stdout, inherited stderr and deliberate native exit scenarios. They do
not require provider credentials or external endpoints. Source/manifest/lock
hashes stayed stable; load, pressure, runtime and limits accompany the public
baseline receipts. The frozen 22-case result remains historical. These single
observations do not establish a performance improvement.

D12 begins with scope ownership before acquisition, preserving isolated mutable
agent/client registrations and real subprocess lifetimes. Assertions retain all
IDs, wire payloads, exit codes and Cause predicates. Later phases preserve
property domains and deadlines before safe diagnostic instrumentation. No
production repair, generated protocol refresh or global reinventory is authorized.
The bounded six-file source review and exact scope plan are still in progress.
