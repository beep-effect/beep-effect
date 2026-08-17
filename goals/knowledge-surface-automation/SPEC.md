# Knowledge-Surface Audit & Automation — SPEC

Ratified 2026-07-31 (interview with Benjamin). This packet is the self-hosting seed: it was
hand-rolled, and Workstream E's doctor must later adopt it as its own first adoption test
case. The roadmap engine's first customer is this initiative.

## Mission

Turn the repo's agent-facing knowledge surfaces — `goals/`, `explorations/`,
`.claude/skills/`, `.agents/skills/`, `docs/`, agents, plugins, `CLAUDE.md` / `AGENTS.md`,
and the `.claude` / `.agents` / `.codex` trees — into audited, gated, self-proving
infrastructure.

## Operating doctrine

- Design before implementing; schema → service contract → implementation.
- Remaining open decisions are grilled with Benjamin FIRST; grill outcomes land as their
  own docs-only PR before implementation PRs. Ratified decisions below are not relitigated.
- The audit is not a one-time cleanup. Every finding class becomes a permanent gate.
  Stage-1 gates are DIFF-SCOPED (no baseline infrastructure); Stage-2 gates use sealed
  ratchet baselines burned down over time. "Finish the audit" == "drive new-violation
  gates green and burn the baseline down"; the gates remain afterward.
- Phase 0 of every workstream is a READ-ONLY report command. No mutation until the
  report's false-positive rate has been eyeballed.

## Ground truth (verified in the live repo — build on it, do not rebuild it)

- `beep goals` exists: `packages/tooling/tool/cli/src/commands/Goals/` with `doctor`,
  `set-status`, `migrate`, inventory, and index generation (`goals/INDEX.md` grouped by
  canonical status from `goals/<slug>/ops/manifest.json`). Lifecycle statuses (LiteralKit):
  `active | paused | completed-retained | superseded | reference`; phase statuses
  `pending | in-progress | complete | superseded`; manifest schema `initiative-manifest/v2`.
- `beep skills` exists with `update` and its `--check` mode
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts`). `skills-lock.json`
  records per skill: `source`, `sourceType` ("github" | "local"), `skillPath`,
  `computedHash`; the updater also manages the `.codex/config.toml` skills table.
- There is NO goal-packet bootstrap/scaffold command (only `create-package` for packages
  and the `/explore` skill for explorations). Workstream E fills a real gap.
- Prior art to mine before designing: `tools/skillopt` (Python/uv, `vendor/` dir),
  `goals/agent-effectiveness-loop`, `goals/agent-pipeline-velocity`,
  `goals/ai-metrics-stack`, the memory-architecture decision log.

## Ratified decisions (2026-07-31 — do not reopen)

- **A**: dual-write typed refs, SCOPED — plain-path rewrite + governed rename tooling
  first; inline `beep:ref` identities only on durable high-churn surfaces; measure
  context-token cost, sidecar map fallback.
- **B**: line patches first, GRADUATE individual customizations to semantic guides only
  where upstream drift breaks them repeatedly.
- **C**: semantic-delta gate first (no baseline infra), full doctor + sealed baseline as
  Stage 2. All four hardening measures are in Stage-2 scope.
- **D**: bun:sqlite projection engine with a pure-TS differential reference; mermaid in
  INDEX.md before the HTML dashboard. Evidence receipts, scout nodes, respec dry-run,
  and achievement relics are all v1 spec.
- **E**: all four feature groups in v1 (bypass funnels, plan contract, lineage +
  provisioning, rematerialize + capsules).
- **Spin-offs**: context-rent telemetry and bitemporal `--as-of` roadmap are captured as
  `explorations/` packets, not workstreams here. The ASLR torture lane folds INTO
  Workstream A.

## Workstream A — clone-agnostic references

Mechanical pass first: find and rewrite absolute / home-relative paths in agent-facing
files to repo-root-relative paths, encoded as ast-grep/comby rules shipped into the repo
(reviewable, re-runnable; the scan becomes the standing gate). Machine-local mirrors of
external repos are inherently non-clone-agnostic: reference canonical GitHub URLs in
tracked prose; machine-local paths live only in untracked or `docs/_internal` files.

Reference-integrity architecture (incremental, behind `beep knowledge`):

- Typed URI buses keep reference kinds distinct and lintable: `repo://` (tracked repo
  artifacts), `host://` (machine-local — banned from tracked guidance), and
  `upstream://owner/repo@sha` (immutable provenance metadata only).
- Dual-write identities on durable surfaces: prose keeps the human-readable repo-relative
  path; `<!-- beep:ref goal/<slug> -->` (an Effect Schema `KnowledgeRef` tagged union)
  sits beside it as the authoritative identity. `beep knowledge relink` regenerates
  display paths from identities and fails on disagreement. Measure the context-token cost
  of inline comments on always-loaded files; fall back to a sidecar identity map if they
  bloat agent context.
- Validation resolves against a GIT TREE (`--tree HEAD`), never the working filesystem —
  untracked files and local symlinks cannot fake validity.
- References to generated targets carry a producer ID (`producer://goals/index`) mapped
  in one CLI registry to the exact command that materializes them, so a missing generated
  file reports "run this" instead of "broken".
- `beep knowledge rename` is a governed migration: `--plan` emits a deterministic JSON
  artifact (move + reference rewrites + expiring tombstone alias) that review approves
  and CI replays.
- Hermetic proof: delivered as code, not a lane (amended 2026-08-17,
  `research/p3-hermetic-lane-decisions.md`). Probe children run under `makeHermeticEnv`;
  byte-emitting git children pin canonical config at the call site (`gitArchiveArgs` +
  `gitArchiveEnv`). The standing gate is the hostile-profile differential test in
  `@beep/repo-cli`: archive bytes under each declared hostile profile must be
  byte-identical to the clean profile, and every profile carries a negative-control
  witness — the unpinned vector must differ, else the test fails as "profile inert".
  The formerly specced clean-clone/empty-`$HOME` lane and optional ASLR variant are
  dropped as vacuous (`research/p3-hermetic-lane-design.md`).

First step (read-only): `beep knowledge refs --tree HEAD --json` inventories the current
repo-relative and machine-local reference forms across agent-facing files and exercises
representative `repo://goal/*` fixtures until live dual-write identities exist. It resolves
tracked targets and goal slugs, classifies false positives, and measures mismatches.
Load-bearing risk: split-brain identity drift (copied comments identifying the wrong
object) — relink/doctor must treat identity-path disagreement as a hard failure.

## Workstream B — vendored-skill supply chain ("bonded warehouse")

Three layers, extending `beep skills` + `skills-lock.json`: (1) pristine upstream snapshot
pinned to an immutable revision (upstream SHA + snapshot hash in the lockfile); (2)
ordered LOCAL PATCH SERIES (plain git patches to start — graduate a customization to a
semantic guide with anchors + preconditions only after upstream drift breaks it
repeatedly); (3) installed copies are RECONSTRUCTED (`beep skills materialize`);
`beep skills update --check` fails on hand-edited output via a reconstructed-output hash.

- **Clearing house**: one verified effective tree per skill feeds BOTH `.claude/skills/`
  and `.agents/skills/` through thin adapters, with a cross-target equivalence check so
  the two trees cannot drift from each other.
- **Update flow**: Renovate regex custom manager watches `skills-lock.json`, opens
  digest-pinned revision-bump PRs on a schedule — one PR per independently clearable
  skill with a parent batch report, so one conflict never stalls the update train. CI
  reconstructs old + new, replays patches, attaches the upstream-vs-effective diff and
  per-hunk conflict report.
- **Review ergonomics**: every hunk decision persists in a ledger keyed by (old rev, new
  rev, patch-set hash, hunk hash) with resume; `--ghost` replays prior decisions on
  byte-identical hunks; a ~20-minute session budget checkpoints unresolved work while
  cleared skills ship; each patch carries an inventory label (policy / repo adaptation /
  temporary drift) with owner and drop condition.
- **Initial adoption**: auto-generate the patch series from (pristine snapshot vs current
  installed copy); Benjamin classifies each hunk — that session is the first HITL review.
  Capture upstream licenses at snapshot time; license findings get fixed from provenance
  data.
- Deferred (parked, do not build now): policy plasmids as the default mechanism, upstream
  credit ratings, pre-bump conflict futures, apoptosis self-removal PRs.

First step (read-only): `beep skills provenance <skill>` for ONE GitHub-backed customized
skill — resolve upstream commit, separate upstream content from local drift, prove
reconstructability. Load-bearing risk: source identity — skills.sh-sourced skills
(oracle, turborepo, portless, shadcn) must each resolve to a fetchable repo + commit
before automation can manage them; do that resolution as an explicit early task.

## Workstream C — self-proving docs

**Stage 1 — semantic-delta embargo (existing quality job, no baseline infrastructure):**
`git archive` BOTH the merge-base and HEAD into temp dirs, run the same narrow scanner
over each, fail only on normalized HEAD-minus-base findings (rename detection preserves
document identity, so Markdown reflow can neither hide nor fake a regression). In the
HEAD archive with emptied `$HOME`/XDG: verify backticked tracked paths resolve; probe
documented `bun run beep <command>` spans by replacing their tails with `--help` (the CLI
parser becomes the doc oracle, nothing mutating executes); regenerate `goals/INDEX.md`
and fail on diff; support exactly one explicit assertion form
(`<!-- beep:assert path-exists <path> -->`). First step: a versioned `KnowledgeFinding`
Effect Schema + golden test on paired base/HEAD fixture archives (edit, reflow, rename,
command, assertion) proving only semantic additions surface.

Authoring note (ratified doc-fix, not a normalizer change): the scanner probes every inline
`bun run beep` span as a real command, so placeholder tails are written `<command>`, never
`...` — a bare ellipsis resolves to no subcommand and reports `unknown-beep-command`.

**Stage 2 — full `beep knowledge doctor`, hardened against gaming from day one:**

- Full-corpus scan reusing `beep goals doctor` / `beep skills update --check` as domain
  evaluators; extraction covers paths, commands, `@beep/*` symbols, packet-status claims,
  skill sources, licenses.
- **Sealed baseline**: keys minted ONLY by CI at a reviewed default-branch SHA; feature
  branches may remove keys, never add/replace/relabel. Every reference-shaped span must
  be classified (verified / generated-example / historical-with-commit); unclassified
  spans are non-baselineable; generated-example markers are fence-scoped; historical
  claims cite an ancestor commit.
- **Counterfactual assertion tests**: each evaluator is validated by virtually removing
  its resolved target (filesystem-overlay) and requiring failure — vacuous checks die.
  Every evaluator ships adversarial fixtures (reflowed spans, alternate path spellings,
  fenced examples, renamed documents).
- **Debt leases**: suppressions are owner-bound (CODEOWNERS-resolvable) with expiry and
  per-document quotas; yeet warns before expiry and blocks after.
- **Causal grouping**: cascades collapse to one authored root cause with dependent spans
  beneath; full JSON retained.
- Tombstones evolve into identity tracking across renames/re-exports (multi-hop moves
  can't evade a flat dictionary); git history proposes repair targets, prose changes stay
  human-reviewed.
- **Ambiguity lint** (scheduled lane, not PR-blocking): two isolated agents turn the same
  rule into action plans; disagreement flags the guidance as ambiguous even when every
  path resolves.
- Contradiction/redundancy pass: one authoritative home per normative rule, other
  appearances become links/transclusions; genuine conflicts go to a grill session;
  context-bloat pruning proposals are presented as a diff with token-weight estimates,
  never applied unilaterally.

Load-bearing risk: weak normalization / over-broad markers become a laundering API that
hides new debt — the golden paired-archive tests and adversarial fixtures exist to
prevent exactly this.

## Workstream D — capability-derived roadmap

Status folders remain REJECTED (directory moves break every inbound link and git
history); status stays manifest-derived.

- Manifest schema extension (additive, defaulted — existing manifests decode unchanged):
  `provides` / `requires` arrays of namespaced free-form capability slugs
  (`memory/query`); a capability CATALOG is generated from manifests (providers,
  consumers, collisions, orphans) rather than maintained as a registry.
- **Engine**: manifests decode through Effect Schema into a disposable in-memory
  `bun:sqlite` projection; frontier, blockers, cycles, and shortest-unlock-path are
  recursive CTEs behind `beep goals next` / `explain <slug>`; a tiny pure-TS reference
  evaluator differential-tests the SQL on fixtures (AND-gate, orphan, cycle, completed
  provider). One deterministic projection feeds JSON, the Mermaid block, and the
  dashboard so renderers cannot invent divergent semantics.
- **Evidence receipts** (bridges C and D): yeet and reflect tooling write a canonical
  typed `ops/evidence.json`; the graph computes SEPARATE nominal vs evidence-backed
  readiness, and boss-gate nodes (capability providers ∧ required proof lanes ∧ closeout
  reflection) unlock downstream work only on receipts — never prose-scraping.
- **Scout**: requirements nothing provides render as stable `fog:<capability>` nodes —
  visible, outside the actionable frontier; `beep goals scout --bootstrap` turns one into
  an exploration/goal scaffold with the capability prefilled as `provides`.
- **respec --dry-run**: simulate status changes, splits, supersession as an overlay
  transaction; report unlock/orphan deltas; roll back.
- **Achievement relics**: completed initiatives render with proof commit, reflection
  link, provided capabilities, and unlocked goals; completed topo layers auto-collapse
  into relics unless part of a blocker explanation.
- **Rendering order**: generated Mermaid block in `goals/INDEX.md` first (topo-layer
  subgraphs, lifecycle node classes, blocker edges + explanation table); the single
  self-contained HTML dashboard (kanban + DAG, no server, no React build) second.
- Explorations are NOT graph nodes; graduation records provenance edges only.
- Deferred: speedrun-ghost routing, typed substitution routes; bitemporal `--as-of` goes
  to its own exploration (sibling of epistemic-bitemporal-edge-core).

Load-bearing risk: capability-name semantic drift (task names masquerading as durable
capabilities) — mitigated by the generated catalog, doctor checks, and naming
conventions (grill item).

## Workstream E — packet bootstrapping

- **Schema-compiled, template-free**: `beep goals bootstrap` decodes a `BootstrapInput`
  whose prompts/defaults come from InitiativeManifest schema annotations, then a PURE
  `compileMaterializationPlan` (no filesystem) maps it through phase-archetype
  constructors to every path, payload, ownership boundary, and validation requirement.
  Golden-test the compiler before any writes exist. Phases are stable-ID child entities;
  prefer fully generated files BESIDE fully authored files over mixed ownership regions.
- **`--plan --json` is the shared dry-run contract** for bootstrap, graduation, adoption,
  tests, and future editor tooling.
- **Atomic publish**: staged in a same-filesystem directory, validated (decode + doctor +
  index regen + link validation) against a prospective overlay, published via no-replace
  atomic rename; indexes are disposable projections regenerated after publish.
- **Identity + lineage**: immutable PacketId beacons; indexes derive by DISCOVERING
  beacons, not mutating a registry; a lineage identity spans exploration → graduated goal
  → superseding goal.
- **Graduation**: `beep explore graduate` calls the same compiler through a journaled
  idempotent (content-addressed) transaction and deposits a maternal-provisioning
  artifact — inherited decisions, evidence, open questions, links — into the newborn goal.
- **Rematerialize + capsules**: `ops/materialization.json` records generator revision,
  schema version, normalized inputs, per-region hashes, AND content-addressed prior
  blobs, enabling true three-way rematerialization without clobbering authored prose.
- **Bypass funnels**: `set-status` on an unknown slug returns a typed error carrying the
  exact bootstrap command (creates only behind explicit `--create`/confirmation); when
  doctor finds a hand-rolled packet it emits a hash-pinned ADOPTION PATCH plus
  preservation report — never mutating during diagnosis. First adoption target: THIS
  packet (self-hosting proof).
- Accompanying SKILL.md so agents discover the lifecycle surface (bootstrap, set-status,
  next, explain, scout, graduate, adopt); a specialized subagent once the CLI settles.

First step (read-only): implement only the pure plan surfaces, then report
`beep goals bootstrap --plan --json` for a representative input and
`beep goals adopt knowledge-surface-automation --plan --json` for THIS packet. The
report covers proposed paths, ownership classification, preservation decisions, and
validation requirements without writing; Benjamin reviews its false positives before
any materializer or publish path exists.

Load-bearing risk: ownership misclassification overwriting authored knowledge — hence
whole-file ownership preference, golden tests, and patch-not-overwrite on drifted regions.

## Remaining decisions to grill (P2) — RATIFIED 2026-08-01

The P2 grill session is complete. All 24 decisions (this list plus the open questions in
the three `research/p1-*.md` documents) are ratified in
`research/p2-grill-decisions.md`, which is doctrine of equal standing with this SPEC:
do not relitigate in implementation PRs. One-line outcomes:

- Capability slugs (D): strict two-segment `S.TemplateLiteral`, durable abilities only,
  no aliases in v1, informational collisions, ratcheted duplicate findings,
  schema-rejected self-cycles (→ D1–D6).
- Evaluator semantics (D): frontier-only `executionCapable` exclusion with annotated
  routing; strand + re-declare for superseded/reference providers (→ D7–D8).
- Evidence receipts (D↔C): `goal-evidence/v1` append-only ledger; mint lanes are
  publish, strict closeout, and reflect — never bare verify (→ D9–D10).
- Warehouse (B): full `skills-lock/v2` shape as audited; wave 1 = all 8 resolved
  entries with shadcn as provenance pilot; Renovate confirmed; two-strike hunk rule for
  patch→guide promotion (→ B1–B4).
- References (A): same-line trailing + heading-scope `beep:ref`; dual-write on
  portfolio surfaces only in v1 (→ A1–A2).
- Self-proving docs (C): no archival opt-ins before Stage 2; info-string fence tokens;
  reserved option-probe class; fail-closed `--base`; digest-level index-drift;
  measured-hybrid document identity; zero-FP promotion window; CI-generated
  baseline-only PRs (→ C1–C8).
- Context-bloat pruning candidates in CLAUDE.md/AGENTS.md remain a queued deliverable
  (diff + token-weight estimates), not a grill decision.

## Spin-off explorations to capture (not built here)

- **Context rent**: instrument which CLAUDE.md/skill lines actually change agent behavior
  (harness telemetry + agent-effectiveness-loop prior art); prune empirically.
- **Bitemporal roadmap**: `beep goals next --as-of <commit|date>` over an event ledger;
  link from Workstream D and from epistemic-bitemporal-edge-core.
