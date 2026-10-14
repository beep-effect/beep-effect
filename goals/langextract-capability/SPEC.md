# LangExtract Capability Spec

## Objective

Create and execute a canonical goal packet that delivers `@beep/langextract` as
an Effect v4-native foundation capability for LLM-powered structured extraction
from unstructured text, with every extraction grounded to exact half-open source
character spans.

The packet must drive research, synthesis, proposal review, packet
finalization, implementation, quality review, yeet publication, PR creation, and
PR babysitting. The implementation must be provider-neutral and must reuse or
extend existing repo primitives before adding new models.

## Non-Goals

- Do not implement provider-specific SDK adapters, provider env/config loading,
  live-provider smoke tests, CLI commands, rendering, or visualization in
  `@beep/langextract` V1.
- Do not copy the Effect v3 reference package wholesale.
- Do not duplicate span, provenance, annotated document, token, chunk, mention,
  entity, relation, or handoff primitives that fit or nearly fit `@beep/nlp`.
- Do not place the package under `drivers`; V1 is a provider-neutral foundation
  capability.
- Do not push, open a PR, or resolve GitHub review threads unless the future
  execution session reaches the yeet/PR phase named in this spec.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, especially
   `standards/ARCHITECTURE.md` and `standards/architecture/*`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Goal packet: `goals/langextract-capability/**`.
- Target package: `packages/foundation/capability/langextract/**`.
- Reuse candidate package: `packages/foundation/capability/nlp/**`.
- Existing provider drivers may be referenced externally but must not become
  foundation dependencies.
- Supporting docs, package manifests, exports, dtslint, tests, and generated
  catalog files required by repo quality gates.

## Constraints

- `@beep/langextract` must stay provider-neutral and may use injected
  `effect/ai/LanguageModel` services rather than importing provider
  drivers directly.
- Foundation packages must not depend on drivers, slices, product apps, or
  provider-specific runtime config.
- Before introducing a new public primitive, search
  `standards/repo-exports.catalog.{md,jsonc}` and inspect relevant packages.
- Reuse classification is mandatory for every overlapping model:
  `reuse as-is`, `extend @beep/nlp first`, or `langextract-local with rationale`.
- Structured data models must be schema-first and documented with repo-standard
  annotations.
- Tests must use deterministic fake language-model services and property-based
  coverage with Effect Schema arbitraries / Effect testing support.
- The implementation proposal must pass a read-only reviewer loop before the
  final implementation packet is considered ready.
- The final code closure must run the actual `$quality-review-fix-loop` until
  zero required blockers remain or explicit waiver records exist.

## Accepted Proposal Contract

The accepted proposal is stored in [`research/synthesis.md`](./research/synthesis.md).
Implementation must follow these decisions unless a later review records an
explicit change:

- `@beep/langextract` owns schema-first extraction targets, examples, requests,
  options, results, diagnostics, prompt/output contracts, response parsing,
  deterministic alignment, typed errors, service orchestration, and handoff
  adapters.
- Generic NLP primitives are reused from or promoted into `@beep/nlp`. In V1,
  span and provenance invariants are the expected near-fit promotions.
- Concrete provider drivers, provider SDKs, provider env/config, live provider
  smoke tests, CLI, rendering, and visualization remain out of scope.
- The service consumes injected `effect/ai/LanguageModel.LanguageModel`
  and translates AI/schema/alignment failures into package typed errors.
- V1 public source offsets are JavaScript string indices.
- Streaming is deferred unless exposed as schema-backed LangExtract domain
  events; raw AI stream chunks are not public API.

## Acceptance Criteria

- [x] `goals/langextract-capability/` exists with `README.md`, `SPEC.md`,
      `PLAN.md`, `GOAL.md`, `ops/manifest.json`, `research/`, and `history/`.
- [x] Parallel research reports exist under `research/reports/` for repo reuse,
      `@beep/nlp` fit, Effect v3 reference inventory, Effect v4 migration,
      architecture boundaries, extraction/alignment algorithms, and
      testing/quality.
- [x] `research/synthesis.md` contains an implementation proposal that has
      completed a QRFL-style proposal review loop with zero required findings.
- [ ] `@beep/langextract` is implemented as a foundation capability package and
      remains provider-neutral.
- [ ] Any near-fit reusable primitives are promoted into `@beep/nlp` instead of
      duplicated.
- [ ] Deterministic fake model tests and property-based span/schema tests pass.
- [ ] Package-level and repo-level quality checks pass.
- [ ] The actual `$quality-review-fix-loop` closes with zero required blockers
      or explicit waiver records.
- [ ] The yeet cycle publishes a PR, and PR babysitting closes CI and actionable
      review feedback with follow-up commits.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/langextract-capability/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/langextract-capability/ops/manifest.json` | Passes |
| Packet references | `rg -n -e "langextract-capability" -e "GOAL.md" -e "agentLaunchers" -e "packetAnchorDocument" goals/langextract-capability` | Finds expected references |
| Whitespace | `git diff --check -- goals/langextract-capability` | Passes |
| Repo export reuse | `rg -i -e "span" -e "annotateddocument" -e "handoff" -e "extraction" -e "languagemodel" standards/repo-exports.catalog.md packages/foundation/capability/nlp packages/drivers` | Evidence recorded in research |
| Package quality | package-local checks selected during implementation | Passes |
| Repo quality | `bun run audit:github quality` | Passes or unrelated failures are documented |
| QRFL closure | reviewer inventory files and final closeout | Zero required blockers or explicit waivers |
| PR babysitting | PR checks/review evidence | CI green and actionable feedback closed |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- Research proves the desired provider-neutral foundation package cannot satisfy
  the architecture gate without an explicit standards decision.
- Required live-provider proof would require credentials, cost, or secrets not
  named in this spec.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
