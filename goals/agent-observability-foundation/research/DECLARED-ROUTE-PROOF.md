# Declared repository route proof

Current qualification is the explicitly new v3 pair documented in
[hosted build repair](./HOSTED-BUILD-REPAIR.md), its
[v3 preparation receipt](../ops/declared-canary-root-v3-preparation-verification.json),
and [committed source binding](../ops/committed-source-binding-verification.json).
The account below is retained historical v2 evidence and is not relabeled as v3.

The disposable and live stages passed against the same retained v2 synthetic Git
root. Both used the actual installed worker and frontend, the pinned collector and
two explicit synthetic CLI/desktop records. See
`../ops/declared-route-stages-verification.json` for exact digests, private archive
locations, event IDs and resource receipts.

Before the single producer POST, each stage persisted a create-only plan binding
the positively verified host/root identities, worker configuration digest, request
digest, route, project and independently calculated event IDs. The plan file and
its parent directory were synced. Readback then matched exactly two backend event
IDs and their surface/route attributes, two local delivery events and visibility
receipts, and the journal's host/namespace. Both stages rechecked the exact retained
root evidence after readback. All seven real harness populations remain Unknown.

Independent source review found that HEAD/remote/clean status alone did not guard
against Git-directory indirection changing clone/worktree identity. The final guard
checks canonical Git/common-directory hashes and normalized repository identity,
and disables Git fsmonitor. Read-only mocked probes prove changed Git directories
are refused; an occupied plan is refused without changing its digest. No retained
repository was modified for these refusal checks.

Both final runs use the repaired helper. The disposable receipt binds 87 source
files and the live receipt 86; all stayed unchanged during their respective runs.
The process guards observed roughly 0.53 GiB peak each, no task-limit events, no
protective stop and exit zero. Docker components have separate explicit memory,
CPU, process and runtime bounds; the process guard's peak is not total Docker
memory. Owned worker/frontend unit files were removed, collectors stopped and
removed, and private queues retained. Backend readback remained exact after route
shutdown. The disposable backend/network were then removed; the two live records
remain in a distinctly described synthetic project.

An initial Python invocation failed on missing Jinja before any services or send;
the installed system Python supplied the required modules. Initial successful
runs preceding the final identity guard are archived separately as historical
evidence. They are not substituted for the final source-bound pair.

This proves the stated synthetic association. It does not prove actual activity
from Grok, Claude Code/Desktop, Codex CLI, ChatGPT Desktop, Muse or Cursor, and does
not release the historical recovery hold or complete repository delivery.

## Host association boundary

The retained Phoenix REST rows expose the stage route ID and deterministic event
IDs, but not separate resource-level host/namespace fields. The proof checks the
pre-send declared root and host, the unique per-stage route and expected IDs, the
exact stored row set, and the local journal host/namespace and visibility set.
That association is transitive through the unique route/events. It proves the
single declared synthetic route required here; it does not claim an independent
backend host attribute or cross-host fleet coverage.
