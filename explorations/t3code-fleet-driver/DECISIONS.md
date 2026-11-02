# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-01 — messaging-substrate

**Question:** Which route do the orchestrator skills make primary for
cross-session and cross-provider messaging: T3's native MCP tools
(`t3_thread_*`, `delegate_task`, Linked environments) or the shipped
`beep agent-message` mailbox?

**Answer:** T3-native primary. Skills and runbooks route orchestrator-to-session
messaging through T3's MCP tools, and through Linked environments when the
target is on another host. `beep agent-message` stays as it is: it serves
sessions outside T3 and acts as the audit and receipt layer. No new mailbox
work is planned in this packet.

**Rationale:** T3 already injects its MCP server into every session it
launches. Its messages are visible in the UI the operator now drives from,
and its tools already address threads on other environments. Extending
`@beep/t3-code` to remote URLs and launches would rebuild what T3 provides.
Rejected options: "Beep mailbox on top of T3" (more code for a stronger audit
trail that nothing currently needs) and "retire the mailbox" (it would
discard the working non-T3 adapters).

## 2026-11-01 — fork-distribution

**Question:** How does the fork build of T3 Code reach remote hosts, given that
T3's updater tracks only the public npm `t3` package?

**Answer:** Build once on DankStation and push to the hosts. The existing
`t3code-source-update` sync builds the fork, packs the server bundle once,
installs it on each enrolled host over its SSH route, and restarts that
host's T3 service.

**Rationale:** Every host runs the same version, and the small hosts
(dankserver, tbk-worker) never compile the app. Rejected options: upstream
npm on the remotes (version drift, and fork patches never reach them) and a
per-host fork build (dankserver would compile alongside its monitoring stack).
Per-host SSH routes need a YubiKey touch, so the push step must batch hosts
under one touch window or run while the operator is present.

## 2026-11-01 — tom-pc-1-environment

**Question:** On tom-pc-1, a new WSL environment (the operator's 2026-11-01 ask)
or the dedicated Hyper-V VM accepted on 2026-10-26?

**Answer:** A new dedicated WSL distro. This supersedes the 2026-10-26 Hyper-V
design. The distro exists only for agent work, with `/mnt/c` automount and
Windows interop disabled, its own Linux user and separate credentials. The
T3 server runs inside it, set up through the desktop app's WSL backend
(confirm in the goal; see constraints). The existing Ubuntu distro is
preserved untouched.

**Rationale:** WSL needs neither Hyper-V enablement nor a reboot coordinated
with the PC's user. Disabling automount and interop recovers most of the
isolation the VM would have given. Accepted costs: WSL's 4 CPU / 8 GB cap is
per user and shared with the existing distro, and the Windows desktop app
must stay open because Windows has no background T3 service (or the goal
proves `t3 service` under systemd inside WSL). Strict-tier rules still apply:
no Funnel, a tailnet-only or loopback listener, and no client data in the
repo. Rejected options: Hyper-V (stronger isolation, gated on elevation and a
reboot) and deferral.

## 2026-11-01 — grok-bot-box-1

**Question:** Is grok-bot-box-1 a T3 host?

**Answer:** No, it is out of scope.

**Rationale:** The tailnet policy refuses the operator's user over Tailscale
SSH, no repo record says what runs there, it appears to be the Grok Bot's
hosted VM, and `explorations/grok-bot-automation` forbids local credentials
on it. Revisit only if the operator later wants it as a credential-free,
Grok-only sandbox.

## 2026-11-01 — outside-harness-mcp

**Question:** How do harness sessions started outside T3 register T3's MCP
server? These are terminal Claude, Codex and Grok sessions, plus Junie and
cursor-agent.

**Answer:** On every host, each harness registers one user-scope server named
`t3-hub`. It points at the DankStation environment over Tailscale HTTPS with a
Full-access ceiling, and Linked environments carry its calls to the other
hosts. The repo documents a recipe for each harness and adds a reminder to
renew the 30-day grants. A live check must confirm that T3-launched sessions,
which already get the injected `t3-code`, do not also load `t3-hub`. If they
do, the goal resolves it, for example with project-scope exclusion, before
rollout.

**Rationale:** One grant per harness keeps the OAuth renewal surface small.
Full access is required to send to Full-access threads (prior qualification).
Rejected options: read-only (outside agents could not orchestrate) and one
entry per environment (harnesses times hosts in grants, with no benefit once
links exist). A repo-owned config writer stays out of scope; that belongs to
the `agent-config-canonicalization` INBOX item.

## 2026-11-01 — link-topology

**Question:** What shape do the Linked environments take?

**Answer:** Hub and spoke. DankStation links to each host with full access;
the hosts do not link to each other.

**Rationale:** It needs the fewest pairwise links to renew, gives one place to
revoke, and matches the orchestrator living on DankStation. Full-access links
run agents unfenced as the remote user, which is acceptable only on hosts
already provisioned as agent workers. Rejected options: an extra
beep-worker peer and a full mesh, where link count grows quadratically.

## 2026-11-01 — spill-policy-automation

**Question:** How automatic is the first cut of "spill beep-effect work when
DankStation is constrained"?

**Answer:** An advisory rule in the `orchestrate` skill. Before launching
substantive work, the orchestrator reads
`bun run beep palantiri parcel host-pressure --json`. Above the thresholds,
it launches the thread on the next host in spill order through T3
(`t3_thread_launch` / `delegate_task` with `environmentId`). Thresholds come
from the 7-day baseline once the MemAvailable-0 sample is explained.

**Rationale:** It reuses an existing signal and T3's existing cross-host
launch, and adds no daemon. An automatic dispatcher stays a gated follow-up,
built only if the advisory rule proves out. Manual-only was rejected as the
status quo.

## 2026-11-01 — tbk-worker

**Question:** How does tbk-worker, offline with its protective-stop latch
held, enter the plan?

**Answer:** It is designed in, but its rollout is gated. The goals include its
T3 install (reached only through an SSH forward, per its network design) and
its slot in the spill order. That step runs only after the operator releases
the latch, and the gate is recorded in MAP.md.

**Rationale:** Agents must not start the guest, but planning for it now avoids
reopening the design later. Rejected options: dropping it, and releasing the
latch as part of this packet.

## 2026-11-01 — build-distribution-transport

**Question:** How do the hosts receive each fork build that DankStation
produces?

**Answer:** The hosts pull from DankStation. After each sync, DankStation
publishes the packed server bundle and its SHA-256 on a tailnet-only
endpoint. A timer on each host pulls the bundle, verifies the hash, installs
it and restarts T3.

**Rationale:** There is no SSH and no YubiKey touch for each host, so updates
run unattended, and the hosts hold no DankStation credentials. Rejected
options: an SSH push from DankStation (one touch per host per update) and
GitHub-release distribution (adds release publishing on the fork).

## 2026-11-01 — spill-order

**Question:** In what order does work spill to other hosts when DankStation
is constrained?

**Answer:** beep-worker, then tom-pc-1 (the WSL distro, one job at a time),
then dankserver as the last resort. tbk-worker slots in after beep-worker
once its latch is released.

**Rationale:** beep-worker is the provisioned worker that already runs T3.
tom-pc-1 has the RAM, but sits behind a per-user WSL cap on a PC that is in
use, so it takes one job at a time. dankserver shares 16 GiB with the
monitoring stack. Rejected options: putting tom-pc-1 last, and spilling to
beep-worker only.

## 2026-11-01 — retire-beep-agent-messaging (supersedes messaging-substrate in part)

**Question:** What becomes of beep-effect's own agent-to-agent tooling now
that T3 is the messaging substrate?

**Answer:** It is removed. The operator, mid-session on 2026-11-01: "any custom
beep tooling related to this use case should be removed / deleted. A while
back we had a goal & some exploration packets related to agent to agent
communication & I'd like if this surface was cleaned up & deleted from
beep-effect". T3-native messaging stays primary, as decided above. Retaining
`beep agent-message` as an audit and receipt layer is withdrawn. Its deletion
and the deletion of the related goal and exploration packets become work in
this packet. The exact surface is mapped in the removal inventory (see
RESEARCH.md).

**Rationale:** A second messaging stack that nothing routes through anymore
is complexity kept only because it exists. Git history keeps the earlier
qualification evidence; this packet cites it by commit instead of by path.

## 2026-11-01 — retirement-placement

**Question:** Does the deletion happen in this exploration PR or in its own
goal?

**Answer:** In its own goal. The first graduated goal,
`t3-native-orchestration`, deletes the surface listed in
[research/removal-map.md](research/removal-map.md) and rewrites the skills
and runbooks for T3, all in one PR. This PR carries only the exploration
packet and the goal packets.

**Rationale:** About 50 files plus the regeneration runs would bury the
packet review. The operator also wants to launch the work from a T3 session.
Rejected option: doing it in this PR.

## 2026-11-01 — wake-service

**Question:** `goals/wake-service` is active with no code, and it delivers
wakes through the agent-message router. What happens to it?

**Answer:** It is superseded by T3 scheduled tasks and `watch_pull_request`,
and deleted with the retirement (`supersededBy: t3-native-orchestration`).

**Rationale:** Its transport is being deleted and T3 already provides the
wake primitives. A rewrite on T3 waits until a real gap shows up. Rejected
options: rewriting it on T3 now, and leaving it untouched, which would
leave an active goal pointing at deleted code.

## 2026-11-01 — observability-enrollment

**Question:** `goals/agent-observability-foundation` enrolls managed owners
through `agent-message observation`. What happens to that path and to the
ai-metrics `observation-launch-*` modules it leaves unused?

**Answer:** The path is retired with a decision row in that packet, and the
unused `observation-launch-*` modules are deleted in the same retirement PR.
The rest of the packet stays.

**Rationale:** Dead modules with no caller are exactly what the retirement
removes. A T3-based enrollment, if one is ever wanted, starts from T3's own
session metadata. Rejected option: keeping the modules for later.

## 2026-11-01 — local-state-cleanup

**Question:** Clean up the out-of-repo state the old tooling left behind?
That is about 2.0 GB of `~/.cache/beep/agent-comms*` and `agent-message*`
directories, a stale mise trust entry, and four Codex memory files that
describe the old route.

**Answer:** Yes, as the retirement goal's final step after its PR merges, run
on DankStation against the exact paths in
[research/removal-map.md §8](research/removal-map.md).

**Rationale:** Local state outlives the code. Cleaning up after the merge
keeps rollback possible until the PR lands. Rejected options: cleaning up
now, and leaving the state in place.

## 2026-11-01 — kept-borderline-packets

**Question:** Which borderline packets survive the retirement?

**Answer:** `goals/yeet-pr-events` stays: it delivers PR events, which is
notification rather than agent-to-agent messaging. These also stay, with
only historical mentions: fleet-coordination, agent-chat-interface,
harness-the-harness, agent-fleet-layout, remote-skill-activation-conformance
and multi-provider-llm-dispatch-fallback. Those with live references get
reference edits only (removal-map §5c).

**Rationale:** Recommendation accepted with no objection. Each of these has a
primary purpose other than session messaging.

## 2026-11-01 — shape-approval

**Question:** Does BRIEF.md (four goals, no-gos as written) match the
operator's picture?

**Answer:** Yes; decompose it.

**Rationale:** Approved as recommended. Rejected alternatives: folding harness
MCP into the fleet rollout, and folding the spill rule into the orchestrate
rewrite.
