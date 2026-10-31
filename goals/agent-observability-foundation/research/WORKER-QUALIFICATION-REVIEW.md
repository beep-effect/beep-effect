# Worker qualification and shared private-file review

Assigned independent Astra panel, 2026-10-29. Bounded source review against exact
pre-refactor snapshots; no tests or services executed by the reviewer. Execution
receipts belong to the parent. This is not full-goal acceptance or live enrollment
qualification.

The first review found no actionable regression. Inherited flock qualification
still precedes cgroup limits, process limits and status checks. Qualification
finishes before credentials, journal opening or listener creation. Memory, swap,
tasks, CPU, descriptor, file-size/headroom, core-dump, no-new-privileges and umask
requirements are retained. The kernel reader delegates to the equivalent bounded
UTF-8 reader, retaining the sentinel byte and refusal-before-decode behavior.

The shared public file module supports both direct and curried forms. Private-file
metadata still requires a regular file, exact 0600 permissions, matching owner and
one link. Missing owner metadata now fails closed even when an invalid caller
supplies uid -1; the previous sentinel-based expressions could match that invalid
value. Caller-owned canonical paths, pinned handles, inode checks and byte bounds
remain in their callers. The shared reader itself does not prove ownership or a
stable snapshot, and requires a trusted finite ceiling.

The added boundary tests exercise both forms, UTF-8 byte boundaries, oversize,
encoding and read error distinctions, zero-byte ceilings, missing UID/link data,
wrong ownership, exposed permissions, multiple links and non-files. Startup proof
adds eight weak-resource configurations. Each must produce the exact invocation's
resources refusal and leave the existing journal digest unchanged. These cases
perform no allocation stress and establish no exhaustion behavior.

Initial reviewed hashes (before the final qualification-helper refinement):

- ObservationWorker.ts: `27cba62f2e410038ef65dcedf064595676acb488fc5bc3c4df58c237e91d01d5`
- observation-file.ts: `4be1ba9a329806f13a9821e9febfdf87fd3e6b3ffe115a6da7e05896754c63dc`
- observation-launch.ts: `6907b4eda7565d00527803a81b62b780c59747cd09161974512cd8310bfce9d0`
- observation-launch-claims.ts: `e40ef18215e4c2e58a9bd8e0880a5c9327bfc2ce757b75f8fbaf5229620fdd33`
- AgentMessage.observation.ts: `f60e713976fa379b07fc0ad3cd75834c67b47379893301b1703abdc29de9ea01`
- verify-worker-entrypoint.py: `42414b61353cd4e6da96e76c6077722d702275bc1c7c9b624b021ce96671ab02`
- observation-file.test.ts: `67a12e3e36b42fb8304321f22c4ebc9658a6dcc11ebcff9072a427bead8d66b3`

The subsequent helper refinement is reviewed separately below. The recovery hold
and full-goal delivery obligations remain in force.

## Final qualification-helper refinement

The follow-up found no actionable defect. Final worker SHA-256:
`b001740c23315a5190de5be77f3ff91cc623ebc9dc43f43ae66533971af49bbd`.
Original worker snapshot SHA-256:
`f30ee3f563ac61b90a735243ca6c466ab5e49a1fdc6a582cfa936e80f3a279fb`.

Device equality, present inode values and exact inode equality remain prerequisites
to the unchanged PID-bound exclusive-flock pattern. Option.exists uses the same
lock inode. The population schema preserves 0 < memory <= 2147483648, swap = 0,
and 1 <= pids <= 128 after FiniteFromString decoding. Positive CPU quota/period and
quota <= period retain the same numeric-pattern input. Cgroup reads stay ordered
memory, swap, pids, CPU. A single process-limits read precedes descriptor hard limit,
file hard limit/headroom and zero core checks. Refusal reasons remain resources or,
when inherited lock ownership cannot be established, ownership.

This replaces only the initial worker-file acceptance; all other reviewed hashes
remain unchanged. The reviewer did not execute the proof or close any hold.
