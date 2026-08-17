# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-14

Operator dump (paraphrased from the kickoff session):

> I want to further improve the effectiveness & agent friendliness of this
> repo. Best way to get a pulse is to survey a few data sources: agent
> memories of codex & claude code; the repository's AI metrics; the beep AI
> Metrics stack — Phoenix at dankserver.tailc7c348.ts.net:8447 — and the
> `.beep` directories (not sure it's all still working or collected anything
> useful). The Phoenix dashboard isn't working any more ("Server
> disconnected" banner); maybe fix that too.
>
> Hoping to learn: what skills are used the most or never used; what takes
> the majority of time; what bottlenecks slow a PR/goal/exploration getting
> to mergeable; what consumes the majority of token spend.
>
> Find additional data sources too (git?). And don't stop at data — research
> external strategies, trends, tools & frameworks. Analyze AGENTS.md
> (CLAUDE.md symlink) as well. Pause at points for plan-mode interviews
> (/grill-with-docs). Use codex GPT-5.6 Sol medium for subagent work to
> preserve the Fable 5 weekly limit. Many clones & worktrees of beep-effect
> live in [the machine-local projects dir] — their .beep dirs and agent memories count.

Screenshot provided (not committed — public repo, browser chrome shows
private bookmarks): Phoenix UI at
`https://dankserver.tailc7c348.ts.net:8447/projects/UHJvamVjdDox/spans`
showing the "Server disconnected — We are unable to reach the Phoenix
server" banner.

Same-session recon (verified live, details in RESEARCH.md):

- Phoenix itself is healthy — container up on dankserver, healthz 200,
  GraphQL answering, websocket upgrade 101 through Tailscale Serve over
  HTTP/1.1. The banner is a transient client-side drop. The *feed* is what
  died: 1,261 traces ending 2026-07-01; raw codex capture stopped 2026-06-08;
  DuckDB last written 2026-06-15.
- The forwarder status showing claude candidateFileCount=0 forever is a
  stale artifact, not a bug: the Jun 8 run predates the Claude project dir
  (born Jun 11). Live discovery now sees 1,155 claude candidates.
- Weekly scorecards flag cost/model-call/tool-invocation metrics as
  unavailable — exactly the four pulse questions. Skill invocation is not a
  scorecard dimension anywhere in prior art: new ground.

User decisions recorded at kickoff: new pulse exploration packet (this one);
durable pipeline revival (backfill + systemd timer, no code fix needed);
whole-fleet mining scope; /grill-with-docs checkpoints after pulse assembly
and after research deepening; codex GPT-5.6 Sol medium for heavy subagent
lanes.
