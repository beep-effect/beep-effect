# Opportunities & Friction Ledger — semantica-lab

Live ledger (DECISIONS D17): opportunities, improvement ideas, and friction receipts recorded at
the moment they surface — during planning, research, design, and implementation. Never saved for
closeout. Redact per repo law (public repo: no secrets, `~` for home paths, minimal error text).

## Opportunities

- **2026-08-24 — Neuro-symbolic reasoning opening.** Benjamin has Rete/forward-chaining
  experience and sees "massive opportunities": a schema-first, provenance-carrying, Effect-native
  reasoning substrate (typed proof DAGs, Rete-as-data over `effect/Graph`, bounded chaining as
  fibers) has no strong TS-ecosystem incumbent. Target of the /adhd divergence pass (D15).
- **2026-08-24 — pgvector-on-PGlite convergence.** PGlite supports the pgvector extension;
  professional-desktop already embeds PGlite+Drizzle. Vector search inside the existing embedded
  DB = zero new storage engines in a Tauri app. Storage bake-off must weigh this explicitly.
- **2026-08-24 — Extraction pipeline is proto-lab code.** The atlas sync pipeline (AST/griffe →
  JSONL IR → Notion render/diff) is itself an ingest→parse→normalize→export chain — treat it as
  the lab's first artifact, not tooling overhead.
- **2026-08-24 — Upstream contribution lane.** Three unpushed `danklocal` fixes + a growing
  Findings DB = cheap goodwill with semantica-agi, keeps the fork mergeable, pressure-tests
  findings before they justify port decisions.
- **2026-08-24 — Rosetta glossary as naming authority.** The semantica-term → beep/Effect-term
  table (D18) doubles as the port's canonical naming map, preventing ad-hoc renames at port time.
- **2026-08-24 — Notion as cross-agent surface (pilot).** This packet's atlas is the first real
  workload for Notion as an agent-writable shared spec surface (Claude plugin + Codex MCP, both
  OAuth'd to Todox). Harvest workflow lessons for other projects.
- **2026-08-24 — Evals as differentiator.** Semantica's `evals` is literally empty; beep's
  schema-validated eval reports over golden corpora would be both the lab's proof spine and a
  visible upstream-differentiating capability.

- **2026-08-24 — Owned working Rete + executable oracle.** The v3 archive's `@beep/rete` is a
  real (restricted) alpha/join Rete over EAV facts with 46 green behavioral tests — joins,
  incremental updates, retractions, rule-induced facts. The new reasoning substrate can be built
  against that test oracle from day one, and `rete`'s audit/DOT hooks seed the explanation-event
  vocabulary. Turns the reasoning family from greenfield into salvage+redesign.

- **2026-08-24 — The TS Datalog gap is a market gap.** The fetch-verified census found NO
  TypeScript/WASM Datalog engine clearing both the license and maintenance gates (Dusa GPL,
  CozoDB/datalog-ts stalled, DataScript EPL/CLJS). Benjamin's "massive opportunities" instinct
  on reasoning is corroborated by ecosystem absence, not just preference — strengthens the
  Rust-crate (Ascent/Datafrog) exception path, the NET-NEW spike case, and the long-term value
  of an Effect-native engine (potentially publishable beyond the lab).

- **2026-08-24 — Gate 8 (checkable proofs) is a near-universal killer.** The reasoning bake-off
  found only EYE WASM survives all hard gates among ten candidates — every Datalog/Prolog/
  validator candidate fails on absent derivation APIs. Independently corroborates the ADHD/
  market-gap finding: proof-DAG-native reasoning is the open lane.
- **2026-08-24 — `shacl-engine` hung 20s on a violating six-quad fixture** (conforming sibling
  passed) measured against the in-repo `@beep/drivers/shacl` surface (`Shacl.validation.ts`).
  Potential live repo issue independent of this packet — worth its own investigation/issue.

- **2026-08-24 — Gate-4-class defects in our own bricks.** The extraction bake-off verified in
  live source that the `@beep/langextract` handoff currently drops relations, and
  `@beep/nlp-processing`'s WinkBackend can fabricate a first-position span on an alignment miss
  — a success-shaped fallback in-repo. Both are repo-issue candidates independent of this
  packet, and both validate the shared-schema laws (span fidelity, typed degradation).

## Dispositions (2026-08-24 opportunities grill — DECISIONS O1–O5)

Every entry above now has a fate: **absorbed** — pgvector convergence (storage runner-up),
evals-differentiator (D16 spine + EvalReport), owned-Rete oracle (C2/spike inputs), gate-8/
Datalog-gap evidence (reasoning family + O4 gate), neuro-symbolic opening (ADHD synthesis →
spike). **Actioned** — repo defects → drafted issues (O1); upstream lane → draft-and-hold
branch + issues (O2); docs-drift → Findings DB rows (O5). **Gated** — atlas backlog: templates
→ IR row-fill → module analyses → sync pipeline, all behind canary (O3); OSS ambitions → two
named MAP gates (O4). **Recorded** — Notion-pilot lessons → basic-memory at session close;
`op`-prewarm → machine memory; Rosetta `tbd` fill → Fable drafts during shape, Benjamin
ratifies.

## Friction receipts

- **2026-08-24 — Knowledge gates vs future/external paths cost two verify cycles.** The refs
  gate requires backticked governed-root paths to exist in-tree (a planned lab path fails) and
  bans live `~/` host anchors in packet-root files, so the hygiene pass's absolute→`~/` rewrite
  traded one violation for another; external-repo paths under governed roots
  (`packages/common/...` in an archive checkout) trip the same rule. Working spellings: prose
  for future paths, `<HOME>/...` and `<clone>/...` placeholders, brace groups. Prevention: run
  `bun run beep ci lane lint-policy` on a committed docs branch BEFORE the full verify (the
  gates scan HEAD, not the worktree), and know the gate enforces packet-root files while
  `research/` classifies archival.

- **2026-08-24 — `op run` auth prompt dismissed mid-agent-run.** The docs-mining agent's first
  `op run` succeeded, a later one died with `authorization prompt dismissed` (1Password desktop
  prompt appeared during an unattended background job); it recovered via `op read` in-process.
  Prevention: pre-warm 1Password auth before launching agents that need `op`, or expect the
  `op read` fallback.

- **2026-08-24 — `codex exec` has no `--effort` flag.** The plugin wrappers accept `--effort`;
  raw `codex exec` needs `-c model_reasoning_effort=<level>`. Cost one failed fan-out launch.
  Prevention: recorded in file memory (`codex-notion-mcp-access`).
- **2026-08-24 — Codex Notion MCP OAuth stale-credential class.** `MCP startup failed: OAuth
  refresh credentials … missing an authorization server issuer` requires `codex mcp logout
  notion` before `codex mcp login notion`; surfaced while provisioning agent parity. Prevention:
  same memory file carries the repair recipe.
- **2026-08-24 — Notion writes blocked by session approval policy.** The atlas schema pass reached
  the connected read/write MCP but every write returned `MCP tool call requires approval, but
  approval policy is never`; read-only fetches still worked. Prevention: launch atlas-operator
  sessions with Notion write approval enabled and verify one additive schema call before fan-out.

- **2026-08-24 — Refs gate rejected a backticked private-workspace path; one full proof cycle
  lost.** The shape PR's first `yeet publish` failed at `quality:lint-policy` with
  `knowledge semantic-delta: 3 introduced blocking finding(s)`: three packet-root mentions of the
  gitignored teaching workspace under docs-internal, written with backticks, counted as
  `broken-tracked-path`. This packet already carried a receipt for the same gate class (future
  and external paths); the private-workspace case is a third spelling of it. Prevention: spell
  any untracked/gitignored/future path in prose in packet-root files; run
  `bun run beep ci lane lint-policy` on the committed branch before the full proof. Attribution
  note: the `@beep/xai#build` TS2589 seen in the same proof is the known native-compiler flake;
  the build lane retried green and needed no repair. A second full cycle
  then failed on `knowledge:refs-check` for one `~/YeeBois/dev/effect` anchor in the same
  DECISIONS entry (`external-mirror-reference`, home-relative). Two cycles for two spellings of
  one gate. Cheapest prevention is a pre-verify grep over packet-root files:
  `grep -n -E '~/|docs/_internal' explorations/<slug>/{README,BRIEF,DECISIONS,RESEARCH}.md`.
- **2026-08-24 — Headless Grok lanes died in turn 1 on the repo's MCP tool schema.** Seven
  env-scrubbed grok-4.6 lanes (tracker sweep) failed with `API Error: 400 ... [invalid_client_tool_schema]
  mcp__nlp__Analyze: tool parameter root must be an object type` because `.mcp.json` loads the
  `nlp` server into every headless session and the xAI proxy rejects that schema. Fix that worked:
  `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` on lane invocations (lanes need only
  Read/Write/Bash). Prevention: make it part of the headless-lane recipe; consider fixing the `nlp`
  MCP root schema (a `$ref` root) at the source.
- **2026-08-24 — Two orchestrator gotchas cost a relaunch.** `pkill -f 'tracker/run.sh'` matched
  the Bash tool's own shell (the command line contains the pattern) and killed the cleanup
  mid-way (exit 144); use bracket patterns (`run[.]sh`). In the same line, zsh's
  `no matches found` on an empty glob aborted the whole `rm`, leaving stale first-run logs that a
  monitor then mis-reported as live errors. Prevention: `setopt nullglob` or `rm -f` per path;
  never chain kills with globbed cleanup.
- **2026-08-24 — A review round lost to unpropagated post-review edits.** After applying the
  skeptic's corrections to the tracker synthesis (#518 reclassified, #683 downgraded), the
  Numbers table, the per-lane rows, a bolded "0 rows" sentence, and a downstream "seven of eight"
  count were not all updated; PR #797's first review caught six threads of exactly that. A
  follow-up regex fix then rewrote a per-lane count that was correct. Prevention: when a
  disposition changes on one row, regenerate every derived count from the inventory (`jq`) rather
  than hand-editing prose; treat counts in prose as generated text.

