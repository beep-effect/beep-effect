# Live workstation root inventory

On 2026-10-28 at approximately 23:03 CDT, the actual registered
`ai-metrics inventory probe-roots` command inspected 28 explicitly declared local
paths with the existing configured identity salt. The private declaration includes
the primary Beep checkout, numbered checkout slots 0 through 22, the private Beep
checkout, this active foundation worktree, dankserver and its foundation worktree.
It is not an exhaustive discovery of every sibling worktree or another host.

Results: 27 present Git roots, one unreachable declared path, three repository
identity groups, 25 owning-clone groups and 27 worktree identity groups. Separate
clone/worktree identities correctly keep the active worktrees attached to their
owning clones. The missing slot remains an explicit inventory entry with unknown
Git identity. The observation window is the preceding 24 hours, not evidence that
that period's launches or events were measured.

All seven requested harnesses are represented: Grok, Claude Code, Claude Desktop,
Codex CLI, ChatGPT Desktop, Muse and cursor-agent. Their transport, surface,
capability, heartbeat, launch and event populations remain unknown in this root
probe. Reading Git metadata does not qualify an application integration. The
report intentionally makes no claim that unsupported and installed applications
have zero activity.

The actual human inventory command also passed against this captured inventory.
Its wording now leads with “Launch population: unknown” and “Expected event
population: unknown” when any declared route has an unknown denominator. Counts
of enumerated IDs are displayed separately, preventing an unmeasured population
from being presented as a zero total.

The published artifacts are `ops/workstation-root-probe.json`,
`ops/workstation-root-inventory.json`, `ops/workstation-root-inventory.txt` and
`ops/workstation-root-verification.json`. Raw paths, hostname and the configured
secret were checked absent before publishing the sanitized JSON. The private
input remains outside the repository. No transcripts, prompts or runtime secrets
were copied into the evidence; no collector was started or enrolled by the probe.

The command ran under external resource supervision: approximately 443 MiB peak
observed process-group memory, a 4 GiB emergency ceiling, a 2 GiB early-stop
threshold, zero allowed swap and a 90-second hard runtime bound. The guard did not
need to stop it. This proves the sampled roots and capture time only.

Remaining: declare other hosts and the rest of the active worktree fleet, establish
real route capability/identity through bounded canaries, and join independently
measured launch/event populations to collector and Phoenix read-back evidence.
