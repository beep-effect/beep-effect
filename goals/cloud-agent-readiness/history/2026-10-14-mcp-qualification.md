# Worker MCP qualification — 2026-10-14

## Environment and acceptance

Qualified the configured server transports from beep-worker's
`~/YeeBois/projects/beep-effect-worktrees/linux-agent-readiness` at c080bf6f6d,
then applied the narrowly scoped WordCount metadata patch before the corrected
native-agent test. The worker root remains main. Each workload explicitly
removed SSH_AUTH_SOCK; no administrative agent was available to these probes.

Initialization and tools/list are distinguished from actual tools/call. The
[probe asset](../ops/mcp-readonly-probe.py) supports stdio and Streamable HTTP,
uses bounded request waits, allows only inspected read-only calls, suppresses
response bodies except synthetic NLP and bounded source-navigation evidence,
and tears down its owned stdio process groups. Graft additionally stops its
exact owned scope. It reports nonzero on transport or tool errors. Raw stderr
and native session logs remain in the worker's private cache, not the repo.
The committed [summary](../research/2026-10-14-mcp-qualification.json) contains
sanitized statuses and metadata, not credentials or service response bodies.

## Actual protocol results

| Server | Advertised tools | Request | Result / boundary |
| --- | ---: | --- | --- |
| NLP | 42 | WordCount on synthetic text | Pass: 37 characters, 5 words. |
| shadcn | 7 | get_project_registries | Pass; no registry installation. |
| Next devtools | 4 | nextjs_index | Pass for local discovery; no running Next application's runtime behavior claimed. |
| Fallow | 40 | project_info, one parser thread | Pass; no audit, fixes or code_execute. |
| Phoenix docs | 3 | search_phoenix for project-listing docs | Pass over configured HTTPS endpoint. |
| Phoenix service | 109 | getProjects with limit 1 and synthetic no-match filter | Pass over dankserver tailnet HTTPS; no traces, prompts or secrets read. Default-disabled in repo agent settings. |
| Graft | 6 | graft_find_all for one source symbol in a narrow path | Pass through the PATH resource guard, using the root main checkout's existing index. |
| Chrome devtools | 3 | initialize + tools/list | Startup only; no browser navigation/evaluation. Default-disabled. |
| M365 outbox | 6 | initialize + tools/list via configured op-run launcher | Startup only; no mailbox tool call, draft, send or event write. |
| Serena | — | initialize attempt | Executable absent; configured JetBrains backend also requires the IDE. Default-disabled. |
| WebStorm | — | configured localhost HTTP endpoint | Connection failure; worker has no listener there. Default-disabled. |
| Stately | — | configured HTTPS initialize | HTTP 401, requires its own OAuth. Enabled in repo settings, so native full-profile readiness remains incomplete. |

No 1Password failure occurred: the configured outbox launcher initialized and
listed tools. This proves the launch-time secret injection path, not Graph
mailbox access or send readiness. The desktop-owned Codex node_repl server is
app-session infrastructure and was excluded from this headless test; its trust
and browser channels were not copied into a standalone profile.

## Native agent proof and remediation

The initial Claude Fable 5.1/medium smoke hit its session quota before a tool
request (reported reset 05:40 America/Chicago). No Claude model substitution or
permission weakening was attempted. Native Claude MCP invocation remains
unqualified in this run despite successful direct transport requests.

A native Codex GPT-6.1-Sol/medium ephemeral session then ran with a read-only
sandbox and approval policy never. Phoenix docs succeeded, but WordCount was
blocked: MCP declared it non-read-only and destructive. The unannotated Effect
Tool defaults caused that declaration. Inspected the Wink handler: it tokenizes
the supplied string and returns counts, with count-only telemetry. Corrected
only WordCount's source definition to Readonly=true, Destructive=false,
Idempotent=true, OpenWorld=false using Effect Tool's upstream annotation API.
Other corpus/file tools retain their existing declarations; no blanket safe
classification was applied.

The fresh wire inventory showed all four corrected hints. A fresh native Codex
session successfully invoked WordCount and search_phoenix exactly once each,
with no approvals or configuration relaxation. WordCount returned 5. Both
MCP item.completed events report completed with no error. The agent used the
runtime functions.exec discovery/invocation wrapper despite the prompt's
no-other-tools clause; no shell, delegation or file write occurred. That
self-reported extra wrapper use is retained rather than claiming perfect prompt
compliance.

Seven existing NLP server tests pass. The touched @beep/nlp-processing package's
quick verification passes lint and type check; this four-annotation change is
covered by the existing handler tests plus live wire and native approval-policy
regression proof. Full audit/docgen and all NLP tool annotations are not claimed.

## Friction and next work

- Graft MCP takes its repository as a positional argument: `graft mcp <repo>`.
  The first request used an unsuitable dir flag and found no graph. Corrected
  invocation passed without a rebuild. This proves the root main graph's tool
  path, not a fresh structural index for the readiness worktree.
- Fallow project_info returned about 923 KB despite disabled optional sections.
  Keep that response out of agent context; qualify more focused tools before
  making it a default discovery call. Phoenix docs returned about 19 KB.
- Direct transport success does not establish approval-free native invocation
  for all other tools. Review pure NLP tools' annotations individually; do not
  mark corpus mutations, file processing or external operations safe in bulk.
- Stately needs OAuth or an explicit host-scoped optional-server decision.
  Preserve the shared .mcp.json and existing disabled-server settings. Installing
  Serena alone would not qualify its JetBrains backend on this headless baseline.
- Chrome debugging and M365 mailbox operations need separately scoped acceptance.
- Detached Yeet lifecycle proof remains the next independent readiness task.

## Synchronization boundary

Code and qualification receipt landed as fa5f293974. During synchronization,
the worker readiness worktree had new edits to Graft helpers, agent settings,
MCP configuration, skills and AGENTS.md, plus an untracked Grok configuration.
Preserved these edits rather than attributing or reverting them. Restored only
this task's checksum-verified WordCount patch before fast-forwarding to the
committed copy; file hashes prove the other working edits stayed unchanged.
The worker readiness worktree therefore carries additional configuration dirt;
this receipt qualifies the inspected profile and snapshot, not every later
configuration change. Local feat/linux-agent-readiness is clean.
