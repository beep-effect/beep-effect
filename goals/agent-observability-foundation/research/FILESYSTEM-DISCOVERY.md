# Bounded streaming source discovery — 2026-10-28

Implemented `transcript-discovery.ts` and the owned Python stdlib directory
adapter in `internal/transcript-directory-helper.ts`. The installed Effect
FileSystem offers eager directory arrays, so directory iteration uses isolated
managed child processes through Effect's ChildProcess API. Direct Node filesystem
imports were rejected by the repository checks and removed; no diagnostics were
suppressed. Python receives a fixed program and explicit arguments without a
shell, ambient environment or site customization. It enumerates names/types but
never reads transcript contents. stderr is discarded and returned failures are
content-free. File metadata projection remains the existing incremental reader.

A scanner accepts at most eight disjoint absolute roots. Retired roots are never
opened; whole-filesystem roots are refused. Each root has at most one helper and
up to eight directory levels. Page consumption is capped at 1024 helper events
and 32 candidates. Each root cycle has an explicit entry ceiling (up to 1,048,576).
Helpers may prefetch ahead of observed progress until standard pipe/stream
backpressure or the cycle ceiling; page counts do not claim exact physical I/O.
A five-second cooperative pull deadline, scope cleanup and interruption handling
close owned helper scopes. Deployment still needs the qualified process group,
resource limits and local trusted source mount policy. Canonical path and
inode/device checks detect observed directory replacement; they cannot eliminate
an adversarial path-resolution race. Non-UTF-8 names fail closed rather than being
silently converted to a different path.

The scanner alternates events across roots and retains traversal progress across
pages. It reports pending, scanning, complete, unavailable, changed, overflow and
retired separately. Completion describes one observed traversal, not an atomic
snapshot or fleet coverage. Depth/capacity overflow remains explicit; no claim is
made about unseen files beyond a configured limit. Symlinks are excluded. Codex
candidates require rollout-*.jsonl; Claude candidates use *.jsonl. Only explicit
roots are traversed; archives are not automatically enrolled. Discovery root
hashes are scoped by the supplied salt, not asserted repository/worktree IDs.

`runDiscoveredTranscriptSweep` sends every candidate in a page through the
existing durable reader/journal. Namespace mismatch fails before discovery.
Raw candidate paths remain private; the composed result contains only metadata
reports. The worker binds one discovery capability, gates it behind shared
admission and captures its own SQL connection for both discovery and declared
sweeps. Successful pause drains activity then suspends helpers under exclusive
maintenance; resume rescans unfinished roots. A restart also restarts discovery,
while accepted source offsets remain durable. Failed admissions are retried on a
later traversal rather than advancing accepted offsets.

Seven discovery tests plus five worker tests passed (12 focused tests). They cover
N+1 files across roots with missing and retired roots, bounded pages, content-free
reports, partial-line completion, copied/new files, scanner restart, truncation,
namespace mismatch, depth/entry overflow, symlink roots/files, actual permission
denial and recovery, scoped process cleanup, explicit suspension, concurrent
refusal, interrupted reads and worker pause/resume/adoption behavior. The existing
source-page fixtures cover rotation, growth, oversized lines and observed source
mutation. Full ai-metrics package verification passed: audit 49.5 seconds and
docgen 11.7 seconds.

The actual resource-limited worker also invoked the helper and traversed 12
synthetic non-transcript entries, closed it, admitted no files and preserved the
existing receipt population. The controlled-stop proof passed its existing HTTP,
resource, independent backup and replay checks, and all owned units stopped. No
OOM exercise was enabled. This proves the tested helper configuration under the
worker limit, not maximum-root throughput or production coverage.

Production root enrollment, source/host/task identity reconciliation, owned
scheduling and health, CLI/desktop end-to-end canary, deployment and repository
delivery remain open. The original forwarder and historical archives are untouched.
