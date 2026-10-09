# Nightly research packet — 2026-10-09

Window: `2026-10-08T08:30:00-05:00` → `2026-10-09T08:45:00-05:00` (~24h15m, America/Chicago). The previous packet, [PR #1551](https://github.com/beep-effect/beep-effect/pull/1551) (research/2026-10-08), merged 2026-10-09 03:33 UTC. It is Friday, so there is no weekly consolidation. Status **partial**: this harness has no blinded local verifier. X search worked. The arXiv export API timed out, so the writer used arXiv `/list/new` pages. The writer stage was blinded: no clone, and this publisher composed the packet only from the structured finding records.

## Delta-first

### New

- **Harvey LAB-AA v1.1 adds a hallucination gate, and headline scores fall to single digits.** Artificial Analysis and Harvey released 120 private tasks across 24 practice areas, run in AA's Stirrup harness, with a three-judge rubric and a two-pass source-grounded hallucination audit. The new "Hallucination-Gated All-Pass Rate" zeroes any task with a material hallucination. Launch results: Grok 4.7 (xhigh) 9.4%, Muse Spark 1.3 8.9%, GPT-6 Astra 8.6%. More than 60% of otherwise-passing results contained a material hallucination. v1.1 scores are a different metric from v1.0 ([Artificial Analysis — Harvey LAB-AA v1.1](https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1); [evaluation page](https://artificialanalysis.ai/evaluations/harvey-lab-aa); [Artificial Analysis on X](https://x.com/ArtificialAnlys/status/2108264572545310824)).
- **The checker model swings those hallucination counts by about 8×.** On the same LAB-AA v1.1 deliverables, GPT-6 Sol upheld 470 material hallucinations, Grok 4.7 upheld 219, Opus 5.5 upheld 99, and Claude Sonnet 5.5 upheld 57. Sol was selected for production. Grounding also reshuffles ranks: Muse Spark 1.3 falls from 26.7% to 8.9% after the gate. A verifier-gated legal pipeline has to pin and disclose its checker ([AI Primer — Harvey hallucination-gated benchmark](https://www.ai-primer.com/engineer/stories/harvey-hallucination-gated-benchmark)).
- **Harvey and LexisNexis shipped their first co-developed agentic workflow, Motion to Dismiss.** A planning agent ranks up to eight dismissal grounds from an uploaded complaint. The lawyer approves. Research agents then write per-argument memos (3–5 cases, Bluebook cites, adverse authority) validated with Shepard's, and a drafting agent detects the forum vehicle (CA demurrer, NY CPLR 3211, PA preliminary objections, FRCP 12(b)(6)). It is available to Ask LexisNexis / Lexis+ with Protégé customers. A Motion for Summary Judgment workflow is next ([Harvey — Motion to Dismiss workflow](https://www.harvey.ai/blog/motion-to-dismiss-workflow-lexisnexis); [LegalTech.ca, Oct 8](https://legaltech.ca/2026/10/08/harvey-and-lexisnexis-launch-ai-workflow-for-motions-to-dismiss/)).
- **Harvey published wake-sleep memory results for long-horizon legal agents.** Online "wake" runs use LAB tasks. Offline "sleep" reviewers distill graded traces into checklists and practice notes behind a commit gate. Over 196 LAB tasks and 10 cycles, all-pass rose from 2.9% to 15.7%, generalizing to held-out matters, at about 2.5× tool calls. Relevance-filtered lesson retrieval roughly halved per-task cost ([Harvey on X, Oct 8](https://x.com/harvey/status/2108231639616930135); [ZenML LLMOps — wake-sleep memory](https://www.zenml.io/llmops-database/wake-sleep-memory-for-long-horizon-legal-agents)).
- **USA Today Co. sued OpenAI for more than $250M.** On Oct 8, 2026, USA Today Co. and 13 affiliated newspaper entities filed in SDNY, *USA Today Co., Inc. v. OpenAI Foundation*, No. 1:26-cv-08892. The complaint alleges copying of hundreds of thousands of articles from 19 publications for training and operation of ChatGPT, and removal of copyright-management information under DMCA 1202 ([The Verge](https://www.theverge.com/ai-artificial-intelligence/1008198/usa-today-openai-copyright-lawsuit); [Bloomberg Law](https://news.bloomberglaw.com/ip-law/usa-today-news-outlets-join-openai-copyright-infringement-fight)).
- **Ropes & Gray and Akerman credit AI training toward billable targets.** Ropes & Gray lets 1,000+ associates and counsel count up to 100 hours of approved AI experimentation and training ("AI Ascend" Innovation Hours) toward annual billing requirements. Akerman offers similar credit. Big-firm adoption is shifting from tool purchase to a time budget ([Finance Time, Oct 8](https://financetime.org/legal/legalindustry/law-firms-give-lawyers-time-off-billing-grind-test-drive-ai-2026-10-08); [InsideAI](https://insideai.news/news/ai-in-business/law-firms-ai-billable-hours/13900/)).
- **Citation is not consultation.** [arXiv 2610.12361](https://arxiv.org/abs/2610.12361) (Oct 8) swaps the named legal authority for an unrelated one with the facts held fixed, and decodes verdicts from hidden states across seven open-weight models (8B–70B) and four judicial and contract benchmarks. Models name the correct authority 66.7–100% of the time, but verdicts change with the authority only 0–21.7% on CaseHOLD.
- **PARCEL is a public, claim-level benchmark for legal citation hallucination.** [arXiv 2610.10971](https://arxiv.org/abs/2610.10971) (Oct 7) labels 3,396 parenthetical-style claims from recent NY Court of Appeals decisions as Supported, Refuted, or Not Found. The strongest zero-shot LLMs reach about 0.97 accuracy and still mislabel unsupported claims. It is a public analogue of LAB-AA's private hallucination gate.
- **Effect main, still unreleased past effect@4.0.2:**
  - DNS resolution landed in `effect/net` ([Effect #8880](https://github.com/Effect-TS/effect/pull/8880), merged 2026-10-09 05:34Z), and TLSA records followed ([Effect #8953](https://github.com/Effect-TS/effect/pull/8953), 07:02Z). npm latest remains [effect@4.0.2](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2).
  - Effect spans now start with the active OpenTelemetry parent span itself ([Effect #8929](https://github.com/Effect-TS/effect/pull/8929), merged 2026-10-08 20:32Z). RPC response-encoding failures are recorded on the server span ([Effect #8958](https://github.com/Effect-TS/effect/pull/8958)). This continues the GenAI semantic-convention tracing work from 4.0.2.
  - JSON Schema export now keeps safe-integer bounds ([Effect #8956](https://github.com/Effect-TS/effect/pull/8956), merged 2026-10-09 09:19Z). Schema class field overrides are documented ([Effect #8960](https://github.com/Effect-TS/effect/pull/8960)). MCP and AI tool input schemas that derive from Schema to JSON Schema pick this up on the next release.
  - A cluster-lifecycle series of about nine pull requests merged between 2026-10-08 and 2026-10-09 12:08Z, on both the v3 and v4 lines: graceful one-at-a-time shard handoff on shutdown ([Effect #8941](https://github.com/Effect-TS/effect/pull/8941), v3 backport [Effect #8946](https://github.com/Effect-TS/effect/pull/8946)), lease-based SQL shard lock renewal restored ([Effect #8965](https://github.com/Effect-TS/effect/pull/8965)), locks held while the runner shuts down ([Effect #8961](https://github.com/Effect-TS/effect/pull/8961)), reclaim of row locks from unregistered runners ([Effect #8942](https://github.com/Effect-TS/effect/pull/8942)), handoff interrupts routed to the draining owner ([Effect #8940](https://github.com/Effect-TS/effect/pull/8940)), and an interrupt-on-termination RPC annotation ([Effect #8963](https://github.com/Effect-TS/effect/pull/8963)).
- **Harness releases:**
  - Claude Code 2.1.295 (npm 2026-10-08 18:22Z) adds `onFailure: "block"` for command and HTTP hooks, so a hook that cannot start, times out, or exits unexpectedly blocks the action. It also fixes remote MCP servers in headless and SDK sessions that stayed disconnected after outages longer than 15s (backoff to 30s), repeated pagination cursors, and MCP-returned CSS, JS, and XML saved as `.bin`. Marketplace adds whose name no plugin can install under are refused ([Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)).
  - Codex rust-v0.162.0 (2026-10-08 18:55Z) can create and list managed Git worktrees from trusted local projects, pin tasks in the agent Command Center, and opt into ranked tool search in Code Mode. Live web and remote compaction is configurable for custom Responses-compatible providers. Linux sandbox fixes reject writable sandbox-construction executables, and ripgrep config can no longer weaken deny-glob masks ([Codex rust-v0.162.0](https://github.com/openai/codex/releases/tag/rust-v0.162.0)).
- **Skill supply chain (arXiv, Oct 7–8):**
  - [2610.11169 Skill Constellations](https://arxiv.org/abs/2610.11169) builds a dated copy network from git history of every `SKILL.md` in GitSkills: 2,193,119 skill adoptions, used to trace origin, fix reach, and repos that warrant review. Skills are a registry-less, unversioned supply chain.
  - [2610.11647 One Skill Too Many](https://arxiv.org/abs/2610.11647) studies conflicts between co-installed similar skills, mined from 20,947 repo snapshots. The model selects by name and description, so an installed skill can lose a core constraint (for example a ban on touching git) while the task still passes. Completion-only benchmarks miss it.
  - [2610.10612 PyCache Trap](https://arxiv.org/abs/2610.10612) pairs benign skill source with a substituted bytecode cache the loader accepts. Across 100 skills and seven scanners, attack success is 94–100%. Admission has to hash or strip bundled caches, not only read `SKILL.md` and visible source.
- **Neural-symbolic and spec machinery (arXiv, Oct 7–8):**
  - [2610.11030 NOMOS](https://arxiv.org/abs/2610.11030) compiles written policy into deterministic tool-call gates in four passes. Tool-schema static checks alone, with no prover, solver, or LLM, repair or reject 37% (airline) and 13% (retail) of candidate rules that would otherwise be inoperable. The pattern applies to schema-first tool definitions.
  - [2610.11725 Spec Growth Engine](https://arxiv.org/abs/2610.11725) validates a spec graph against the code import graph with a model-free engine, earns "verified" from recorded test evidence, and classifies changes by blast radius. Separate intent-author, planner, and coder agents grow the spec under a deterministic acceptance rule each round.
  - [2610.11768 Ontology tower](https://arxiv.org/abs/2610.11768) proposes a narrow-and-deep ontology for one industrial equipment system: few entities, deep knowledge from physically derived quantities and operating-journal lessons, run daily on a real test plant through a PLC. It is a counterpoint to broad ontologies and maps onto matter-scoped legal ontologies.
  - [2610.10961](https://arxiv.org/abs/2610.10961) specifies an advisory cross-provider review contract: separate resource pools, bounded execution, restricted reviewer capabilities, explicit failure states, and per-attempt evidence. In a 20-turn paired pilot, 8 turns had a material reviewer finding (95% CI 19.1–63.9%).

### Moved

- **Effect MCP HTTP servers gained subscription controls.** [Effect #8924](https://github.com/Effect-TS/effect/pull/8924) (merged 2026-10-08 20:06Z) lets HTTP MCP servers disable subscriptions. [Effect #8925](https://github.com/Effect-TS/effect/pull/8925) (19:46Z) fixes spurious MCP list-change notifications on the first subscription. These are follow-ons to 4.0.2's `allowSessionTermination` for `McpServer.layerHttp` ([Effect #8773](https://github.com/Effect-TS/effect/pull/8773), the prior packet's session-termination claim). Still unreleased on npm.
- **Zero 1.10.0 is the npm `latest` tag.** [@rocicorp/zero](https://www.npmjs.com/package/@rocicorp/zero) moved `latest` to 1.10.0 at 2026-10-09 11:33Z. Canary is 1.11.0-canary.34 (09:50Z), with about 10 head builds in 24 hours. The prior packet's canary-only watch ([canary.29](https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.29)) now sits behind a stable release, and the canary channel is still moving.
- **Google AI Edge Foresight is a local-first meeting-notes app on EmbeddingGemma 2.** TechCrunch and The Verge (Oct 8) covered a free experimental Apple-Silicon Mac app that transcribes microphone and system audio, expands shorthand bullets, and answers questions over local files, fully on device (EmbeddingGemma 2, 740M parameters, plus a Gemma 4 assistant). This extends the prior packet's [EmbeddingGemma 2](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/) claim with a shipping big-vendor app ([TechCrunch](https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/); [The Verge](https://www.theverge.com/tech/1007985/google-ai-notetaking-app-transcribe-offline)).

### Contradicted

No finding in this window reverses a standing claim. The four refutation attempts below left their targets standing.

### Settled

- [PR #1551](https://github.com/beep-effect/beep-effect/pull/1551) (research/2026-10-08) is MERGED (2026-10-09T03:33:04Z, merge `8a5ba57c`). The stamp promotes `lastSuccessful*` to that packet. This packet stays `partial` until a human merges it; `lastSuccessful*` is not advanced to 2026-10-09 here.

Refutation attempted; the standing claim holds:

- **SEP-2640 Skills is still not in a shipped Python SDK.** [python-sdk #3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485) ("Add Skills extension") remains OPEN. Last update 2026-10-07 11:02Z, read on 2026-10-09. Watch `w-sep2640-sdk-ship` stands.
- **jazz-tools is still 2.0.0-alpha.59.** The npm `alpha` dist-tag on [jazz-tools](https://www.npmjs.com/package/jazz-tools) was still 2.0.0-alpha.59 as of 2026-10-09 08:40 CT. No new alpha in the window. Watch `w-jazz-alpha-59` stands.
- **The MCP TypeScript SDK has no release after 1.32.1.** npm latest for [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) remains 1.32.1, published 2026-10-05. No newer patch and no new advisory in the window. The 2026-10-08 OAuth-issuer claim (fixed in 1.31.0 / 2.2.0) stands. Watch `w-mcp-ts-oauth-issuer` stands.
- **TanStack DB is still 0.12.3.** npm latest for [@tanstack/db](https://www.npmjs.com/package/@tanstack/db) is still 0.12.3 (published 2026-10-07 21:13Z). No further release in the window. Watch `w-tanstack-db-012` stands.

## Topical appendix

### Law / legal-AI / IP

- The evaluation story moved from "did the task pass" to "did a named checker find a material hallucination." [LAB-AA v1.1](https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1) collapses headline scores into single digits, and [the checker comparison](https://www.ai-primer.com/engineer/stories/harvey-hallucination-gated-benchmark) shows the checker choice moves the count by about 8×. [PARCEL](https://arxiv.org/abs/2610.10971) is the public claim-level analogue. [Cited but Not Consulted](https://arxiv.org/abs/2610.12361) shows that naming the right authority is weak evidence the verdict used it.
- Product surface: [Harvey × LexisNexis Motion to Dismiss](https://www.harvey.ai/blog/motion-to-dismiss-workflow-lexisnexis) is a lawyer-gated, citation-validated workflow, and [wake-sleep memory](https://x.com/harvey/status/2108231639616930135) is Harvey's published loop for turning graded traces into checked-in practice notes.
- Copyright litigation widened. [USA Today Co. v. OpenAI](https://www.theverge.com/ai-artificial-intelligence/1008198/usa-today-openai-copyright-lawsuit) (SDNY 1:26-cv-08892) seeks more than $250M and pleads DMCA 1202 alongside training copies.
- Adoption economics: [Ropes & Gray / Akerman](https://financetime.org/legal/legalindustry/law-firms-give-lawyers-time-off-billing-grind-test-drive-ai-2026-10-08) put AI experimentation inside the billable-hour target.

### Effect / schema-first / local-first

- Anything bumping past [effect@4.0.2](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2) picks up unreleased main: [DNS and TLSA](https://github.com/Effect-TS/effect/pull/8880), [HTTP MCP subscriptions](https://github.com/Effect-TS/effect/pull/8924), [OTel parent spans](https://github.com/Effect-TS/effect/pull/8929), [JSON Schema integer bounds](https://github.com/Effect-TS/effect/pull/8956), and the [cluster shutdown series](https://github.com/Effect-TS/effect/pull/8941). None of that is on npm yet.
- Local-first: [@rocicorp/zero 1.10.0](https://www.npmjs.com/package/@rocicorp/zero) is stable while canary.34 and the head channel keep moving. [Google AI Edge Foresight](https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/) is a shipping on-device notes app on [EmbeddingGemma 2](https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/).

### Agents / MCP / skills / ontologies / neural-symbolic

- Fail-closed hooks are now a product switch. [Claude Code 2.1.295](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) `onFailure: "block"` treats a hook that never starts as a deny. [Codex 0.162.0](https://github.com/openai/codex/releases/tag/rust-v0.162.0) adds managed worktrees and ranked tool search, and tightens the Linux sandbox.
- Skill admission is a supply chain. [Skill Constellations](https://arxiv.org/abs/2610.11169) maps 2.19M copies. [One Skill Too Many](https://arxiv.org/abs/2610.11647) shows co-installed skills silently dropping constraints. [PyCache Trap](https://arxiv.org/abs/2610.10612) shows scanners that read source and miss a swapped `.pyc`.
- Schema-level policy checks are already useful before a prover. [NOMOS](https://arxiv.org/abs/2610.11030) rejects inoperable rules from the tool schema alone. [Spec Growth Engine](https://arxiv.org/abs/2610.11725) separates a deterministic spec-vs-import check from the agents that grow the spec. [Ontology tower](https://arxiv.org/abs/2610.11768) argues for narrow depth. [Cross-provider review](https://arxiv.org/abs/2610.10961) writes the reviewer as a bounded contract with an explicit failure state.

## Counts & run status

- **Claims:** 28 (24 window_new, 4 refute; law 8 / effect 9 / agents 11).
- **Novelty:** collision rate **10.7%** (3 of 28). All three are moved deltas: Effect MCP HTTP follow-ons ([#8924](https://github.com/Effect-TS/effect/pull/8924)), Zero 1.10.0 stable ([npm](https://www.npmjs.com/package/@rocicorp/zero)), and Google AI Edge Foresight ([TechCrunch](https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/)). The exclusion digest was the 40 claims in research/2026-10-08 plus ledger tombstones and excluded packets. No tombstone collision. Under the 40% gate, so no self-reject. Window-new collision is 3 of 24 (12.5%).
- **RUN:** **partial**. There is no blinded local verifier. X search was available. The arXiv export API timed out. The box `gh` CLI returned 401; GitHub reads used the cursor-github connector and unauthenticated REST.

## Source index

https://github.com/beep-effect/beep-effect/pull/1551
https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1
https://artificialanalysis.ai/evaluations/harvey-lab-aa
https://x.com/ArtificialAnlys/status/2108264572545310824
https://www.ai-primer.com/engineer/stories/harvey-hallucination-gated-benchmark
https://www.harvey.ai/blog/motion-to-dismiss-workflow-lexisnexis
https://legaltech.ca/2026/10/08/harvey-and-lexisnexis-launch-ai-workflow-for-motions-to-dismiss/
https://x.com/harvey/status/2108231639616930135
https://www.zenml.io/llmops-database/wake-sleep-memory-for-long-horizon-legal-agents
https://www.theverge.com/ai-artificial-intelligence/1008198/usa-today-openai-copyright-lawsuit
https://news.bloomberglaw.com/ip-law/usa-today-news-outlets-join-openai-copyright-infringement-fight
https://financetime.org/legal/legalindustry/law-firms-give-lawyers-time-off-billing-grind-test-drive-ai-2026-10-08
https://insideai.news/news/ai-in-business/law-firms-ai-billable-hours/13900/
https://arxiv.org/abs/2610.12361
https://arxiv.org/abs/2610.10971
https://github.com/Effect-TS/effect/pull/8880
https://github.com/Effect-TS/effect/pull/8953
https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2
https://github.com/Effect-TS/effect/pull/8929
https://github.com/Effect-TS/effect/pull/8958
https://github.com/Effect-TS/effect/pull/8956
https://github.com/Effect-TS/effect/pull/8960
https://github.com/Effect-TS/effect/pull/8941
https://github.com/Effect-TS/effect/pull/8946
https://github.com/Effect-TS/effect/pull/8965
https://github.com/Effect-TS/effect/pull/8961
https://github.com/Effect-TS/effect/pull/8942
https://github.com/Effect-TS/effect/pull/8940
https://github.com/Effect-TS/effect/pull/8963
https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
https://github.com/openai/codex/releases/tag/rust-v0.162.0
https://arxiv.org/abs/2610.11169
https://arxiv.org/abs/2610.11647
https://arxiv.org/abs/2610.10612
https://arxiv.org/abs/2610.11030
https://arxiv.org/abs/2610.11725
https://arxiv.org/abs/2610.11768
https://arxiv.org/abs/2610.10961
https://github.com/Effect-TS/effect/pull/8924
https://github.com/Effect-TS/effect/pull/8925
https://github.com/Effect-TS/effect/pull/8773
https://www.npmjs.com/package/@rocicorp/zero
https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.29
https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/
https://www.theverge.com/tech/1007985/google-ai-notetaking-app-transcribe-offline
https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/
https://github.com/modelcontextprotocol/python-sdk/pull/3485
https://www.npmjs.com/package/jazz-tools
https://www.npmjs.com/package/@modelcontextprotocol/sdk
https://www.npmjs.com/package/@tanstack/db
