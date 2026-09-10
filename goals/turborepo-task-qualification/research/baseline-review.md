# Initial cache policy baseline review

The goal executor records the current executable cache posture under the
user-approved task-qualification scope. This is a review of configuration
continuity, not a claim of deterministic behavior or passing runtime evidence.

The projection comes from `beep cache census` using the installed exact Turbo
client and every discovered workspace manifest. Absent scripts remain graph
structure and are excluded from executable baseline nodes. Root global settings,
effective root/child task definitions, complete workspace script digests and
concrete graph dependencies participate in drift detection. Source-only config
changes remain visible even when effective settings are equivalent.

The only authorized qualification scope is `@beep/identity#lint` in profile
`local-linux-x64-bun1.4.1`, epoch `qualification-v1`. All inherited cached
computations without an explicit assessment remain unassessed. This review
permits no cache expansion and changes no task configuration. Disabling reuse
is allowed; an explicit excluded or suspended tuple blocks continued reuse.

A baseline replacement requires an explicit review request and the exact
prior baseline digest. Tuple transitions require a current ledger revision.
Signed replay and promotion depend on accepted conformance/trust runtime
receipts. The current implementation refuses promotion while that importer is
unavailable. The final goal still requires the complete experiment protocol.
