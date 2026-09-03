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

- **2026-08-26: Two documented verification commands do not match the installed tools.**
  `bun run fallow dead-code --check` exits with `unexpected argument '--check'`; the working
  regression gate requires `--fail-on-regression` plus the tracked dead-code baseline. The
  package-scoped JSDoc loop also exits because `apps/labs/semantica` has no `docgen.json`, even
  though the lab exports documented services and layers. Prevention: expose a stable root
  dead-code check script and initialize docgen when a workspace first adds public source exports.

- **2026-08-26 — The design's degraded-extraction event had no lawful schema body.** PR C hit a
  direct conflict: `c0-design.md` §5 said a degraded extraction "appends an `Extracted{ degraded }`
  event", but the binding `EventBody.Extracted` schema requires a batch id and model identity that
  `ExtractOutcome.Degraded` does not carry. Disposition: the schema stayed authoritative — the
  ledger persists the degraded outcome row without fabricating an empty batch or a new provenance
  node; the design doc now records this. Prevention: when a design doc and a merged schema
  disagree, the schema wins and the doc gets amended in the same PR, never the reverse.

- **2026-08-26 — Bun-side validation still cannot complete in the Codex sandbox.** `bunx --bun
  vitest run` idles at the startup banner until interrupted, and `bun install --frozen-lockfile
  --offline` fails first on an unrelated `@pulumi/gharunners` postinstall and then on registry DNS
  even with `--ignore-scripts`. Disposition: Node-vitest fallback for tests; the workspace importer
  synchronized by hand from existing lock entries and re-verified by the orchestrator's `bun
  install`. Prevention: a lockfile-validation mode that neither runs unrelated lifecycle scripts
  nor contacts the registry.

- **2026-08-26 — PR B lock refresh still requires registry access despite an existing lock and install.**
  `bun install --lockfile-only --ignore-scripts` first failed with `EROFS accessing temporary
  directory`; explicit task-local `BUN_TMPDIR` and `BUN_INSTALL` paths under `/tmp` passed that
  point, but the lock-only run then failed on `DNSResolveFailed downloading package manifest` for
  already-installed catalog packages. The new workspace edges compile and all lab tests run from
  the existing install, but Bun cannot regenerate the workspace lock stanza in this managed
  sandbox. Prevention: make lock-only installs resolve catalog metadata from the existing lock and
  cache, or provide managed sessions a writable populated Bun cache with registry access.

- **2026-08-25 — C0 schema verification reproduced two managed-sandbox Bun failures.** `bun install`
  failed immediately with `EROFS accessing temporary directory`; setting `BUN_TMPDIR=/tmp` did
  not change the result, so the lockfile could not be refreshed. The exact app proof then reached
  `bunx --bun vitest run` but produced no worker results until interrupted; the authorized fallback
  `node ../../../node_modules/vitest/vitest.mjs run` completed all 40 tests. Prevention: provide Bun
  a writable effective temp/cache root in managed sessions and route lab Vitest scripts through the
  direct Node entrypoint when Bun worker startup is known to hang.

- **2026-08-25 — Git `text=auto` silently rewrote a byte-exact fixture at commit time.** The
  root `.gitattributes` normalizes every auto-detected text file, so the committed blob of the
  CRLF span-fidelity specimen `md-unicode.md` lost its `\r` bytes (sha `886330…` in the index
  versus `a40ded…` on disk and in `fixtures/f1/index.json`); CI checkouts would have failed
  `F1Catalog` drift while every local run passed. Evidence: `git show HEAD:<file> | sha256sum`
  versus `sha256sum <file>` after the first commit. Fix: a lab-local
  `fixtures/f1/documents/.gitattributes` with `* -text -diff -merge` plus `git add --renormalize`.
  Prevention: any committed byte-exact evidence directory needs its own `-text` attribute the
  moment it is created; a test that hashes `git show :<path>` (the index) rather than the
  worktree file would have caught it before the hook ran.

- **2026-08-25 — A Bun root import made the PDF generator untestable under Node.**
  The direct Vitest lane failed with `Cannot find package 'bun'` from
  `@effect/platform-bun/dist/BunRedis.js` when it imported the PDF generator. The generator used
  the platform package root only for `BunRuntime`, which pulled unrelated BunRedis exports into
  Node. Switching runtime and service imports to the explicit `BunRuntime` and `BunServices`
  subpaths restored the 14-test lane. Prevention: lint platform-bun root imports in modules that
  can be imported by Node tests.

- **2026-08-25 — The requested zero-argument service methods conflict with the v4 compiler law.**
  Modeling `CorpusManifestBuilder.build()` and `F1Catalog.load()` exactly as zero-argument
  functions returning `Effect` made `bun run check` fail with `effect(lazyEffect)`: Effect is
  already lazy, so the wrapper adds unnecessary indirection. The services therefore expose
  effect-valued `build` and `load` members while `check(manifestPath)` remains a method.
  Prevention: phrase v4 service contracts as effect-valued members when no runtime arguments are
  required, or revise the compiler policy before requiring zero-argument Effect methods.

- **2026-08-25 — Biome treats the deliberately truncated HTML fixture as source input.**
  The F1 formatting pass failed before linting with `Missing closing quote` and `expected > but
  instead the file ends` on `fixtures/f1/documents/html-truncated.html`. Those bytes are the
  requested malformed specimen, so making the document parseable would erase the test case.
  Prevention: lab fixture generators or lint geometry should support a narrow committed-fixture
  exclusion for intentionally malformed parser inputs.

- **2026-08-25 — Bun's Vitest wrapper stalled after test startup in the managed sandbox.**
  The P1 step-2 baseline reached `RUN v4.1.11` for `bun run test` but produced no test
  results before the command runner returned, so the chained baseline never reached its build
  step. The task already names this sandbox failure mode and authorizes the direct Node runner.
  Prevention: use `node ../../../node_modules/vitest/vitest.mjs run` for Semantica test proof in
  managed sandboxes, while retaining `bun run test` as the host lane command.

- **2026-08-25 — Effect reference checkout drifted from the installed rc.111 API.** P1 API
  verification found the checkout platform package at
  `.repos/effect/packages/platform/bun`, not the contracted
  `.repos/effect/packages/platform-bun` path. The checkout's `Config.ts` also exposes
  `Config.NonEmptyString` and `Config.Boolean`, while installed `effect@4.0.0-rc.111` exposes
  the lowercase `Config.nonEmptyString` and `Config.boolean` used by this repository. The installed
  package also exposes `Schema.toArbitrary` and `effect/testing`'s `FastCheck`; neither export is in
  the checkout. The installed version must win, but resolving the mismatch adds a second source
  lookup for affected APIs. Prevention: pin the reference checkout to the exact lockfile artifact
  or add a lightweight source-API parity check to agent bootstrap.

- **2026-08-25 — Bun install could not refresh the minted workspace in the managed sandbox.**
  The default run failed with `EROFS accessing temporary directory`. Dedicated `BUN_INSTALL`,
  `BUN_TMPDIR`, and process temp paths under `/tmp` passed that point, but the restricted network
  then produced `DNSResolveFailed downloading package manifest` for already-locked catalog
  packages, including `effect` and `@effect/platform-bun`; `--offline` behaved the same way. The
  dependencies were already installed, so compile and runtime verification remained available.
  Prevention: give managed repo sessions a writable Bun cache/temp root populated from the lock,
  or make Bun's offline install consume the existing lock without registry manifest refreshes.

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

- **2026-08-24 — Two shell gotchas cost two parallel read batches during the MAP session.** The
  Bash tool's working directory persists across calls, so a relative `cd explorations/<slug>` in
  one call made the next three parallel calls fail with `no such file or directory` (they started
  inside the packet). Separately, zsh aborted `grep -r --include=*.ts` with `no matches found`
  because the unquoted glob is expanded by the shell. Prevention: always use absolute paths in
  tool calls; quote `--include='*.ts'`; both are the same class as the `nullglob` receipt above.

- **2026-08-26 — First live gold-proposal run surfaced four defects local tests could not see.**
  (1) The repo `.env` names the key `AI_XAI_API_KEY` but `@beep/xai`'s `XAi.layer` reads
  `XAI_API_KEY`, so the driver failed with an opaque `reason: "config"` (its status-less
  config-miss error names no missing key). (2) `PinnedModelId` accepted no real xAI id: the live
  `/v1/models` list has `grok-4.6/4.5/4.3` — versioned, never dated — and the configured default
  `grok-4` no longer exists upstream; every JSDoc example used an invented `grok-4-20260826`.
  (3) `@beep/openai-compat` sent `tool_choice: "none"` on tool-less requests; xAI answers HTTP
  400 `invalid-argument` where OpenAI tolerates it, and the driver's error mapping discarded the
  response body that named the problem. (4) Bun 1.4.0's `fetch` aborts at ~300 s even when the
  caller passes a longer `AbortSignal`, killing non-streaming grok-4.6 generations over full
  papers. Evidence: `feat/semantica-gold-v1` commits 331a3ea304 and ee142cf081; a scratchpad
  logging proxy on `XAI_API_URL` recovered the 400 body and timed the abort at 301.5 s.
  Prevention: drivers should surface provider error bodies and name the missing config key;
  model-id pin grammars must be validated against the provider's live model list, not invented
  id shapes; any first live-provider lane deserves one cheap end-to-end probe call before the
  full run.

- **2026-08-26 — The first four live gold proposals were silently near-worthless: the model
  miscounts character offsets.** grok-4.6 copies evidence quotes verbatim but reports wrong
  `start` offsets, so the `TextAnchor` width check plus canonicalizer verification rejected
  almost every label (0/1/1/2 accepted across the four finished papers) — roughly an hour of
  hosted reasoning bought four nearly empty gold files, and nothing in the run output flagged
  it. Evidence: commit 6d8429efcd; the zero-spend `gold propose --offline` replay of the same
  cached responses accepts 26/3/3/5 after re-deriving each anchor from the exact quote
  occurrence nearest the claimed offset (verification still gates; unfound quotes still drop).
  Prevention: never trust model-reported offsets — treat the verbatim quote as the anchor's
  source of truth and re-derive positions locally; make acceptance-rate collapse loud (a
  near-zero accepted/proposed ratio on a live run should read as a defect, not a result); keep
  provider responses in the content-addressed cache so diagnosis and the fixed re-derivation
  replay for free.

- **2026-08-26 — The first live C0 slice crashed on a deterministic Anthropic refusal of a
  benign fixture.** `claude-sonnet-4-5-20250929` answers the hosted LangExtract prompt for the
  synthetic `md-structure` F1 fixture with an API-level refusal (`stop_reason` mapped to
  `content-filter`) and zero text parts — three consecutive attempts, so it is the model's
  deterministic response to this prompt shape (entity extraction of named people plus
  affiliations), not a transient filter. The lab then died as a defect instead of degrading:
  the caching adapter fed the empty success straight to `ProviderCacheEntry.make`, whose
  non-empty-response check throws. A trivial-prompt probe against the same driver returned text
  normally, which isolated the refusal to the extraction prompt; `claude-opus-4-6` answers the
  identical prompt on all three attempts. Fix: the adapter now fails typed (`AiError`, naming
  the finish reason) on any empty live generation before the cache boundary, and the extractor
  default moved to `claude-opus-4-6` (D-C0-1 pins the family, not the id). Prevention: guard
  every provider success against schema preconditions before content-addressed storage — an
  "impossible" empty success is exactly what a refusal stop reason produces; keep a
  trivial-prompt probe script beside any live lane to split driver faults from prompt faults
  in one call.

- **2026-08-26 — The slice repeated source alignment and then discarded the whole hosted batch
  on one ambiguous candidate.** A cache-only probe spent more than ten CPU-minutes inside
  `locateGroundedExtractions` after LangExtract had already grounded 181 candidates. The Opus
  response contained 126 exact canonical matches and 14 relation candidates; six relation texts
  were exact, but their endpoint set included repeated entity surfaces. The lab lost the whole
  batch because its second locator required every candidate text to occur exactly once. Fix:
  consume LangExtract's grounded UTF-16 span, verify every resulting `TextAnchor`, and retain
  unaligned candidates as typed degraded claims. The batch aligner now reuses one case-folded
  source map, rejects ambiguous exact or case-folded occurrences, and skips fuzzy work at the
  exact-only threshold. Prevention: verify an upstream span once, but make the upstream aligner
  withhold spans it cannot uniquely locate.

- **2026-08-26 — Review invalidated two apparent C0 passes because proof was not rerun after the
  grounding contract changed.** Directly consuming `GroundedExtraction` spans removed the slow
  all-or-nothing locator, but the shared aligner still assigned every repeated surface to its
  first occurrence. That let relation endpoints bind to the wrong entity claim while all
  `TextAnchor` byte checks still passed. The historical live/replay digests were deterministic
  but semantically unsafe. Fix: require a unique exact or case-folded occurrence, add repeated-
  surface regressions at the shared boundary, and rerun the official slice after review changes.
  Prevention: determinism evidence is not transferable across a grounding-contract edit; archive
  it as superseded until the final code reproduces the stage result.

- **2026-08-26 — The exact-head local proof missed a downstream coverage-only fixture failure.**
  Hosted `Heavy / Coverage Regression` ran `packages/law-practice/server` after the shared
  alignment contract changed and found five failures: the synthetic model emitted bare `Smith`
  while its source fixture contained two occurrences, so the reference correctly became
  `required-extraction-unaligned`. The affected unit lane had passed without exercising that
  coverage selection. Fix: make the synthetic source's second reference mention generic, retain
  one uniquely grounded `Smith`, update its content digest, and prove the package coverage lane
  directly. Prevention: shared grounding changes need downstream coverage selection in the local
  proof plan, not only affected unit tests.

- **2026-08-26 — The third G-relation paper exhausted the Extraction probe breaker because
  semantic relation text was not canonical evidence text.** The first Opus response contained
  16 relation candidates and the exact-evidence retry contained 7, but neither response had one
  relation text that exactly sliced the `@beep/doc-text` canonical string. The retry copied
  source wording more closely, yet still normalized PDF line boundaries, punctuation, or
  phrasing. Both runs therefore failed the typed non-zero relation gate instead of fabricating
  spans. Evidence: `goals/semantica-canary/history/p2-c0-probe-breaker.md`. Prevention: model a
  relation's semantic value separately from an independently selected verbatim evidence quote,
  or prove a bounded chunk-scoped candidate at `decompose`; do not overload generated relation
  prose as its `TextAnchor`.

- **2026-08-30 — The capability handoff gate read stale dependency declarations.** The first
  `bun run beep quality package-verify @beep/langextract` passed docgen but its audit build
  reported that five `@beep/provenance/VerifiedTextAnchor` exports used by untouched
  `VerifiedSpan` code did not exist. Current provenance source contained every export while its
  ignored `dist/` declarations did not, so focused source checks and all 86 package tests passed
  while the build lane failed before reaching the fold-alignment diff. Prevention: package
  verification should build or freshness-check workspace dependency declarations before the
  target package audit, and its failure capsule should identify a stale dependency artifact
  separately from a target-source defect.

- **2026-08-30 — A successful Fallow report failed the Yeet wrapper.** During
  `bun run beep yeet repair`, `fallow dead-code --check` emitted `status:"ok"`, zero introduced
  findings, and three baseline rows attributed `not-applicable`, then the wrapper printed
  `Fallow dead-code failed with status ok` and exited 1. Every later branch-relevant lane passed,
  including full docgen, affected build/check/lint, and 86 LangExtract tests, but the
  contradictory wrapper result made the overall repair verdict fail. Prevention: the Fallow
  wrapper must treat an `ok` envelope with zero introduced findings as success regardless of
  non-applicable baseline rows, or emit a non-`ok` status explaining the actual gate.

- **2026-08-30 — The first hosted review found two aligned-status consumers omitted the new
  minimal-fold case.** LangExtract's own handoff and service metrics accepted
  `match_minimal_fold`, but the LeJeune provider recorder and IrToLaw each repeated an older
  three-member aligned-status list. A valid folded match would therefore be silently discarded
  by one consumer and reported as unaligned by the other. Fix: both consumers now derive their
  predicate from `AlignedStatus.Options`, while IrToLaw derives its narrowed type by excluding
  only the `unaligned` case. Prevention: downstream consumers must derive a positive capability
  family from its authoritative literal domain instead of copying the current member list.

- **2026-08-30 — The full review-thread audit exposed two missing parts of the E1 uniqueness
  law.** The first implementation returned an exact or lesser occurrence before asking whether a
  second fold-equivalent source slice existed, and it applied one keep/drop choice to every
  end-of-line hyphen in a candidate instead of interpreting each independently. Both behaviors
  could admit an arbitrary evidence span or miss a mixed split-word/hyphenated-compound quote.
  Fix: minimal-fold matching now uses one encoded optional-hyphen automaton, rejects multiple raw
  source spans before preserving a higher-tier status, and covers mixed source and candidate
  choices. Prevention: translate decision phrases such as "unique across variants" into explicit
  cross-tier ambiguity and multiple-choice tests before the first hosted review.

- **2026-08-30 — Yeet rejected GitHub's empty encoding of an absent review decision.** The
  pull request had every required check green, zero unresolved threads, a current 5/5 Greptile
  review, and a ruleset requiring zero approvals, but `yeet status --remote` still reported
  `merge-ready: no, blocked on review-decision-acceptable`. Direct GraphQL returned `null` while
  `gh pr view --json reviewDecision` serialized the same state as `""`; status and watch accepted
  only `undefined`/`null` or `APPROVED`. Fix: normalize the empty string as absence in both paths
  and cover the CLI encoding with regressions. Prevention: boundary fixtures for optional GitHub
  fields must exercise every representation emitted by both GraphQL and `gh` JSON.

- **2026-08-30 — Agent shells misreported 1Password as signed out while the operator shell was
  authenticated.** The operator's `op whoami` succeeded, but both direct and interactive agent
  subprocesses returned `account is not signed in`. The agent inherited no `OP_SESSION_*`, and
  Codex had no registered `1password` MCP server even though the desktop server was enabled and
  `1password-mcp` was installed. Fix: register the user-level server with
  `codex mcp add 1password -- 1password-mcp`, then start a fresh agent session so its fixed MCP
  tool surface includes the server. For existing `op://` env files, the exact output-suppressed
  `op run --env-file=<path> -- true` preflight succeeded despite both `whoami` failures, proving
  that the wrapper can obtain desktop authorization directly. Prevention: agent diagnostics must
  distinguish operator CLI auth, operation-scoped desktop authorization, agent process
  inheritance, client MCP registration, and current-session tool exposure; never infer the first
  from failure of another or ask the operator to repeat sign-in blindly.

- **2026-08-30 — Full-W1 C0 replay spent nearly ten minutes in opaque local grounding.** The
  network-off R2 replay kept the provider cache fixed and one Bun core busy for 580,206 ms before
  emitting its report; its p95 document duration was 148,696 ms. The live run took 1,906,490 ms
  with a 227,190 ms p95. During both runs the CLI emitted no per-document stage progress, so the
  only safe liveness evidence was process CPU/RSS and aggregate cache-file growth. Prevention:
  emit non-digest per-document stage telemetry or progress events around parse, provider wait,
  grounding, ledger, and evaluation so operators can attribute latency without inspecting
  provider text or interrupting an authoritative gate.

- **2026-08-31 — Concurrent unowned edits in one checkout invalidated focused C1 proof.** While
  the full-W1 C1 gate was running, an unrelated schema-statics change modified the lab's gold
  modules and `@beep/provenance` in the same worktree. Its transient unused import made
  `bun run check` fail after the C1 surface had already passed, so the failure was unrelated and
  could not lawfully be repaired or discarded by the C1 lane. Disposition: preserve that WIP
  unstaged and publish C1 from a clean owning worktree. Prevention: simultaneous agents must own
  separate sibling worktrees even when their intended files appear disjoint; shared checkouts
  make attribution and exact-head quality evidence unstable.

- **2026-08-31 — The C1-to-C2 clean-worktree handoff hit two avoidable Git and install traps.**
  `git fetch --prune origin main:refs/remotes/origin/main` deleted the local tracking ref before
  failing to recreate it with `unable to resolve reference`; a normal configured `git fetch
  origin` restored the ref at the merged C1 commit. The new worktree then lacked workspace links,
  so `bun run beep architecture` failed with `Cannot find module '@beep/utils'`. Disposition:
  install the committed lockfile in the clean worktree before running repo tooling. Prevention:
  use the configured fetch refspec instead of combining prune with an explicit destination, and
  make the sibling-worktree bootstrap path install or link dependencies before its first command.

- **2026-08-31 — The architecture touch rule names an incomplete command.** The required
  `bun run beep architecture` invocation printed only `architecture commands: create, add, plan,
  apply, check`; attempting the apparent validation form, `architecture check`, then required a
  plan file that does not exist for a hand-authored lab-local concept. No architecture validation
  ran, although the normal lab check, lint, and tests remained available. Prevention: make the
  touch table name the concrete discovery or validation invocation for an existing package, or
  have the bare command run the applicable read-only check.

- **2026-08-31 — The advertised F1-only canary selection cannot satisfy its own hosted
  coverage schema.** A C2 integration smoke using `canary c2 --selection f1` stopped in the
  inherited C0 evaluator with `No covered document supports structure-span-f1:hosted`; the
  ratified `f1+w1` R2 selection passed with zero unexpected degradation. Prevention: either
  make every advertised selection construct a satisfiable metric set or reject unsupported
  stage/selection pairs during CLI decoding, before provider and ledger work begins.

- **2026-08-31 — The first C2 report encoded component proxies as bundle-level proof.** Hosted
  review found that the crash witness rebuilt one in-memory snapshot twice, cold start timed only
  a second `ReasonerLive`, p95 closed ten synthetic seed triples, and RSS sampled the final heap.
  Those values could pass while persisted-ledger recovery or the full selected workload failed.
  Fix: the canary now rebuilds the actual run ledger in fresh processes around a SIGKILL, times a
  fresh complete runtime to readiness, queries the full loaded projection for p95, and records
  the process high-water RSS. Prevention: every telemetry field must name and exercise the same
  accounting boundary as its governing workload-contract row; a component proxy is not evidence
  for a bundle-level claim. The first corrected query probe then reported 280 ms because the
  Oxigraph service silently constructed and reloaded a new store for every request; service-local
  reuse of the immutable dataset's store reduced the same ordered query to a measured 5 ms
  p95. Prevention: a query boundary over an already loaded dataset must not hide dataset rebuild
  work inside every execution. Follow-up review also found that both recovery digests came from
  the persisted representation and that the killed child had not itself committed data. The first
  repair added a durable checkpoint, but a fresh review correctly showed that metadata was absent
  from the recovered RDF projection and could still pass without projection-relevant recovery.
  The first projection-relevant repair then selected only one non-empty batch, so a passing digest
  still omitted the rest of the committed C1 state. Final fix: an isolated crash ledger starts
  empty; the killed child commits every C1 extraction outcome and provenance event; the parent
  independently digests the full C1 projection; recovery must match that digest and remain stable
  across another restart. The metadata-only checkpoint API was removed. Prevention: crash evidence
  needs an independent full-state pre-crash oracle and must mutate every projection-relevant row in
  the process that is actually killed.

- **2026-08-31 — An unrelated scheduler coverage floor failed two exact-head C2 runs.** The
  hosted coverage lane repeatedly reported `QualityScheduler.ts` statements `91.44 < 91.66` and
  branches `86.07 < 86.7`, although the C2 branch did not change that source. The missing case was
  an installed-memory ceiling that clamps a five-token request to two tokens while still
  satisfying the hard floor. Fix: a focused scheduler test now exercises the clamp and verifies
  its admitted journal weight. Prevention: admission policy branches added to the monotonic floor
  need a behavior-level test for each distinct machine-envelope outcome before ratification.

- **2026-08-31 — The projection-relevant crash witness exceeded the process argument limit.** A
  full-W1 repair passed the extracted batch as one child-process argument and reached the crash
  boundary only after the ten-minute live pipeline, where spawn failed with `E2BIG: argument list
  too long`. Fix: `CrashProjectionInput` now schema-encodes the batch and event to the isolated
  crash directory; the child schema-decodes that bounded path before committing the transaction.
  Prevention: subprocess protocols should pass file or stream handles for workload-sized typed
  payloads and reserve argv for identifiers, modes, and bounded scalar options.

- **2026-08-31 — A property test derived a sparse-file size from runner free space.** The final
  exact-head Property Laws lane failed in `corpus-preservation.test.ts` after truncating a fixture
  to `destFreeBytes + 1`; on that runner the subsequent source census tried to hash the enormous
  sparse file and returned `PreservationArchiveIoError` before the expected capacity error. The
  destination-capacity law is covered by the direct validator and by deterministic injected
  capacity probes before and during copy. Fix: replace the host-sized sparse-file case with an
  explicit destination-free-space validator witness and retain the bounded integration probes.
  Prevention: tests must inject capacity readings instead of allocating or sizing fixtures from
  live runner resources.

- **2026-09-02 — An unmatched optional commitlint glob aborted a config lookup.** The closeout
  command resolved `commitlint.config.ts`, then zsh stopped on `no matches found` for the optional
  `.commitlintrc*` argument before ripgrep could inspect the resolved file. Prevention: pass only
  paths returned by `rg --files`, or enable `nullglob` for commands with optional file families.

- **2026-09-02 — Managed Git metadata permissions stopped Yeet before verification.** The P5
  `bun run beep yeet verify` preflight failed before any quality lane because `git fetch` could not
  open `~/YeeBois/projects/beep-effect11/.git/worktrees/semantica-p5-close/FETCH_HEAD` on the
  read-only linked-worktree metadata mount. The docs checks were not implicated. Prevention: grant
  the designated worktree write access to its own Git administrative directory, or give Yeet a
  supported no-fetch verify mode when the caller has an already verified base snapshot.

- **2026-09-02 — Codex's Notion OAuth grant was revoked; the atlas lane could not read Notion.**
  The read-only Codex atlas-proposal lane started with `failed to refresh OAuth tokens for server
  notion: ... invalid_grant: OAuth grant revoked` and inventoried only what an earlier report and
  ten live catalog queries supplied. The six park writes were applied from the orchestrating
  session's own Notion connection with a canary write and SQL read-back. Prevention: check
  `codex mcp list` auth state before delegating Notion work, and re-run `codex mcp login notion`
  when it reports a revoked grant.
