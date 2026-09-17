# Gate and knowledge plumbing — research, 2026-09-12

Evidence is the current dirty working tree, not a released/merged implementation. All paths below are repository-relative unless labeled **upstream**, in which case they are relative to `.repos/effect/`. Proposed paths and contracts are explicitly labeled. No implementation, upstream index operation, network request, or test suite was run.

## Verified inventory and provenance

Count commands (run from repository root):

```sh
rg --files packages/tooling/tool/cli/src/commands/Lint/internal | rg -c '/SchemaFirst[^/]*\.ts$'
rg --files packages/tooling/tool/cli/src/commands/Lint/internal | rg -c '/EffectVitest[^/]*\.ts$'
rg --files packages/tooling/tool/cli/test/fixtures/effect-vitest-rc115 | rg -c '.'
rg -c '"id":' standards/effect-vitest.primitives.jsonc
rg -n 'rc115|rc113' packages/tooling package.json docs standards
# Counting the preceding match lines with rg -c '.' yields 7.
git -C .repos/effect rev-parse HEAD 'effect@4.0.0-rc.115^{commit}'
git status --short -- packages/tooling/tool/cli/test/fixtures/effect-vitest-rc115 standards/effect-vitest.primitives.jsonc packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts
```

| Surface | Verified result | Consequence |
|---|---|---|
| `SchemaFirst*.ts` internal files | 6: ArbitraryCoverage, Detectors, Policy, Project, Scan, Store | Scan/store/render are concrete adapters, not a pluggable detector registry. |
| `EffectVitest*.ts` internal files | 6: Detectors, Policy, Primitives, Scan, Store, Syntax | Reuse contract patterns; their implementations are Vitest-specific. |
| rc115 fixture layout | 10 files: `LICENSE`; `packages/vitest/{README.md,src/index.ts.txt,src/utils.ts.txt}`; `charter/{Arbitrary,Effect,Internal,Layer,Logger,TestClock}.txt` | Source fixtures are data, with `.ts.txt` avoiding accidental source/test discovery. |
| Primitive graph | 100 `id` rows in `standards/effect-vitest.primitives.jsonc` | Test independently expects graph/anchor cardinality and validates anchors: `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:106`, `:281`. No test execution claimed. |
| Literal rc115/rc113 search | 7 matching lines, all rc115; no literal rc113 matches in searched scope | This search alone misses dotted versions (`rc.115`); it does not prove absence of a bump process. |
| Installed catalog pin | `effect` and `@effect/vitest` = `4.0.0-rc.115` | `package.json:46`, `:161`. Installed package execution was not tested. |
| Upstream checkout HEAD | `51d4a2f08a5c7691dc876415bc9fc0ecf467e153` | Research comparison source. |
| Release tag commit | `4a05d4914fa2327a42bd75fe77c22c188becf3b4` | Matches current graph SHA at `standards/effect-vitest.primitives.jsonc:8`; HEAD and release SHA must not be conflated. |
| Fixture lifecycle | rc115 files staged as added; charter files also modified; graph and test modified | The rc115 procedure here is live work in progress. Read-only `git log` returned no committed history for this new directory. Preserve others' work. |

## (a) Exact extension points and proposed contract

Abbreviations in this section: **L** = `packages/tooling/tool/cli/src/commands/Lint`; **I** = `packages/tooling/tool/cli/src/internal`. They expand to repository-relative citations.

| Contract | Existing extension point | Proposed parity integration |
|---|---|---|
| Detector inputs/output | `L/internal/SchemaFirstDetectors.ts:1173` groups AST functions; a concrete finding constructor is at `:1141`. `L/internal/EffectVitestDetectors.ts:1547` accepts `(SourceFile, file, owner)` and returns findings; `:1551` resolves imports before detection. | **ADD `L/internal/UpstreamParityDetectors.ts`**: `(sourceFile, file, owner, inventoryIndex, policy) → readonly findings`. Emit evidence, rule, occurrence, replacement symbol ID, inventory SHA. AST and binding provenance decide matches; spelling overlap only seeds review. |
| Policy/replacement edges | `L/internal/EffectVitestPolicy.ts:232` validates policy references even with no findings; `:264` verifies each selected primitive has the rule edge. Existing crispening exemptions use owner → family → nonblocking fallback at `L/internal/SchemaFirstPolicy.ts:100`, `:139`. | **ADD `L/internal/UpstreamParityPolicy.ts`**: reviewed rule-to-inventory-symbol mappings, Role A adoption vs Role B exemplar restrictions, mechanizable pattern definitions, bounded exception rationale. Do not inherit crispening family exemptions silently. Mechanically extracted JSDoc cannot decide “same intent.” |
| Typed models | `L/Lint.schemas.ts:104` is the closed rule domain; `:247` finding fields; `:307` inventory document. The current finding has no upstream SHA, symbol ID, evidence span, or occurrence digest. | **ADD `L/UpstreamParity.schemas.ts`** for symbol rows, pin manifest, rule policy, finding and independent baseline. **MODIFY `L/Lint.schemas.ts`** to admit parity rule IDs and summary counters where integrated. Avoid forcing source-knowledge rows into the existing finding schema. |
| Store | `L/internal/SchemaFirstStore.ts:33` reads a fixed JSONC path, returns absent as `Option.none`, rejects malformed inventory; `:95` formats/writes. `L/internal/EffectVitestPrimitives.ts:30` loads required knowledge with typed errors. | **ADD `L/internal/UpstreamParityStore.ts`** using `I/artifacts/index.ts` adapters: strict JSONL decode, duplicate-ID rejection, consistent SHA/version validation, required pin manifest and independent findings baseline. Proposed baseline: `standards/upstream-parity.inventory.jsonc`; proposed fixture root: `packages/tooling/tool/cli/test/fixtures/upstream-parity-rc115/`. Missing knowledge must fail, not yield an empty successful gate. |
| Scan/discovery | `L/internal/SchemaFirstScan.ts:304` creates project/owner resolver and walks source files; `:314` runs arbitrary/tagged-error checks before generic exclusions; `:315` excludes other source; append calls follow. Project creation: `L/internal/SchemaFirstProject.ts:57`; ecosystem exclusion: `:88`. | **ADD `L/internal/UpstreamParityScan.ts`**, **MODIFY `SchemaFirstScan.ts`**: load/validate knowledge once, invoke parity against the already-created source project and owner resolver, then compare its separate baseline. Define scope explicitly; a new project and second repo walk are avoidable. Preserve ecosystem law scoping unless ratified otherwise. |
| Identity/merge | `L/Lint.schemas.ts:586` keys file + symbol + kind + rule + line. `L/internal/SchemaFirstScan.ts:336` preserves the entire old entry on key match. | Parity requires stable occurrence identity independent of line moves, with current evidence refreshed separately from accepted exception metadata. Consult Vitest occurrence generation at `L/internal/EffectVitestDetectors.ts:1553` and membership normalization at `L/internal/EffectVitestScan.ts:283`; do not reuse their Vitest-specific identities unchanged. |
| Ratchet | `I/ratchet/RatchetDiff.ts:71`: `diffMembership({current, baseline, equivalence, order}) → {currentCount, baselineCount, introduced, resolved}`. `I/ratchet/RatchetLifecycle.ts:67` reports typed regressions/tightening. Schema-first uses membership at `L/internal/SchemaFirstScan.ts:372`. | Reuse shared diff, with **independent parity baseline**. A floor is membership, not merely total count: fixing one occurrence cannot buy a different violation. Add parity comparison to the existing schema-first result; do not create `lint:upstream-parity`. |
| Failure semantics | Schema-first fails candidates, active advisories and const assertions even with `--write`; outside write mode it also fails missing/stale entries (`L/internal/SchemaFirstScan.ts:454`). Vitest fails introduced instances only (`L/internal/EffectVitestScan.ts:360`). | Decide explicitly how provisional inventory is reduced: membership ratchet during migration, strict empty actionable backlog at goal closure. `--write` must not permit increasing an established parity baseline or turn nonzero backlog into completion. Pin refresh and baseline acceptance are distinct operations. |
| Rendering/routing | `L/SchemaFirst.render.ts:40` explicitly lists finding groups; `:60` builds `SchemaFirstPolicyFinding`; `:207` prints advisories. `I/quality/SchemaFirstPolicyFinding.ts:115` is shared issue schema. | **MODIFY `L/SchemaFirst.render.ts`** for parity counters/group and source-grounded remediation. Reuse structured finding output so Yeet receives the same category. Check rule-domain consumers/tests when adding IDs. |
| Command facade | `L/SchemaFirst.ts:380` registers `schema-first` with `--write`; `L/Lint.command.ts:1159` includes it; `L/index.ts:126` exposes facade symbols. | **MODIFY `L/SchemaFirst.ts`** for accurate write semantics/help and **`L/index.ts` / test facade as needed**. Existing Lint subcommand registration stays. No new hosted lane or hand-edited generated package scripts needed. |
| Tests/errors | Pin behavior and fixture anchors are tested in `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:100`, `:386`. | **ADD focused `test/upstream-parity-*.test.ts`**, **MODIFY `L/Lint.errors.ts`** for required typed read/pin errors. Cover alias/shadowing, re-export consumers, line shifts, duplicates, missing/different pins, missing policy edges, role restrictions, independent floor, zero-backlog closeout, and operation without `.repos/effect`. |

**Important boundary:** the standing gate can enforce reviewed concepts and idioms; inventory completeness plus a clean detector run does not establish universal semantic optimality. Unknown same-intent cases remain review work until converted into policy/detection coverage.

## (b) Pinning and refresh: what actually exists

Search evidence (no generator assumed):

```sh
rg -n 'rc115|rc113' packages/tooling package.json docs standards
rg -n -i 'refresh|bump|re-pin|regenerat|git show' goals/effect-vitest-canon/PLAN.md
rg -n 'verifyEffectVitestPin|Regenerate|Baseline pin|options.write' packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts
rg -n -i 'effect-vitest|rc115|rc113' scripts packages/tooling --glob '*.{ts,sh,json}' --glob '!**/test/**' --glob '!**/Lint/**' --glob '!**/node_modules/**' --glob '!**/build/**' --glob '!**/dist/**'
```

| Existing operation | Exact command / evidence | What it does not prove |
|---|---|---|
| Review immutable source | `git -C .repos/effect show '<tag>:<path>'`; procedure explicitly says tag-local `git show` at `goals/effect-vitest-canon/PLAN.md:356` | No clone, fetch, or checkout is needed for available tags. Historical PLAN example pin is rc.112, not current rc.115. |
| Re-pin primitive knowledge | Regenerate source anchors at new tag, review semantic diff, update graph pin as one change: `standards/effect-vitest.primitives.jsonc:1`; `goals/effect-vitest-canon/PLAN.md:365` | A named automated fixture/anchor-generation script was **NOT FOUND in the searched paths**; its existence elsewhere is **UNVERIFIED**. Do not advertise a nonexistent command. |
| Version guard | `verifyEffectVitestPin` reads `node_modules/<graph.package>/package.json` and compares version at `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts:75` | SHA is printed in errors but is not verified against upstream Git by this function. |
| Refresh findings baseline | `bun run beep lint effect-vitest --write`; write contract at `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestStore.ts:99` and scan branch at `.../EffectVitestScan.ts:468` | Does not regenerate primitive graph, fixture sources, or source anchors. |
| Read-only lint | `bun run beep lint effect-vitest`; graph loaded and pin checked at `.../EffectVitestScan.ts:403`; baseline version mismatch rejected at `:450` | Successful ratchet can retain existing findings; not zero backlog. |
| Portable fixture validation | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts:110` parses `.ts.txt`; `:238` reads charter markers; `:281` checks each anchor; `:293` compiles graph examples against installed package | Existing excerpt markers are assertions about source spans, not a fresh cryptographic comparison to the local checkout. Tests were read, not executed. |

**PROPOSED missing generator:** `scripts/upstream-parity-inventory.ts`, invoked as `bun scripts/upstream-parity-inventory.ts --effect-dir .repos/effect --tag effect@4.0.0-rc.115 --out packages/tooling/tool/cli/test/fixtures/upstream-parity-rc115`. This is a proposed command, not callable existing tooling. Implement schema-first CLI parameters and deterministic extraction in the goal.

| Proposed bump step | Required output/check |
|---|---|
| Resolve release/source identity | Resolve tag commit without moving checkout; record release version/tag/SHA, source SHA, extractor version and input module manifest. Research HEAD can differ from installed release; explicitly record that distinction and reject adopting unreleased APIs without a pin change. |
| Extract mechanically | Emit `symbols.jsonl`, pin/coverage `manifest.json`, license notice; stable module/name/kind identity, overload signatures, JSDoc sections/examples/since, file spans, source hashes, SHA on rows. Do not bulk-copy upstream implementation. |
| Preserve scope | Role A supplies adoption targets. Role B supplies exemplar evidence. Markdown docs need document-section records or a companion artifact because they have no exported-symbol AST; barrels and merged declarations need explicit handling. Upstream example of interface/namespace merging: **upstream `packages/effect/src/StandardSchema.ts:38` and `:43`**. |
| Review semantic delta | Reconcile added/removed/changed rows and accepted rule edges; regenerate prompts from rows. Type-check cost first; runtime hot-path numbers second per packet decision. Changing SHA alone is insufficient. |
| Validate portable proof | Schema-decode every row; reject mixed pins, duplicate identities and missing policy references; validate manifest coverage and compile selected examples with installed effect. Hosted verifies committed data, not upstream extraction completeness by accessing local Git. |
| Refresh findings independently | Proposed parity mode under `bun run beep lint schema-first --write`, with no baseline growth permitted after accepted initialization. Commit pin/fixture/policy/baseline/consumer changes together in the goal's authorized PR. |

## (c) Hosted versus local-only

| Execution | Verified routing / availability | Parity consequence |
|---|---|---|
| Hosted lint-policy | `.github/workflows/heavy.yml:21` includes lint-policy; `:244` calls its CI lane; `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:1478` runs `beep lint policy --full`; `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2634` includes schema-first | Integration into schema-first automatically participates in this route. Existing workflow gating still applies; no claim every workflow runs on every edit. |
| Local check catalog | `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:715` lists `lint:schema-first` in cheap-gates/preflight; `:722` likewise Vitest | Reuse current catalog entry. It is a local check specification, not by itself proof of hosted execution. |
| Hosted parity proposal | Committed JSONL + manifest + reviewed policy + separate baseline + installed effect + repo AST | Version/fingerprint checks, detector scan and ratchet must run with no `.repos/effect`, graft, network or LLM dependency. |
| Local inventory refresh | Available upstream checkout and tag objects | Read source, produce deterministic knowledge, review source diff. Hosted must reject stale package pins using committed metadata. Source-origin attestation remains the local generator's responsibility. |
| Local graft | Machine-local index and retrieval/MCP | Agent context only; never required by hosted lint. |
| Setup script | `scripts/setup-effect-ref.sh:71` defaults to `$HOME/YeeBois/dev/effect`; `:79` clones only if missing; `:85` manages symlink | `bash scripts/setup-effect-ref.sh` is provisioning, not pin bumping: no fetch/reset/tag checkout/index generation. Not run in this lane. |

## (d) Graft: live contradiction and usable agent route

Commands run: `graft --help`, `graft build --help`, `graft --version`, `graft ask --help`. Exact output retained alongside this report.

| Finding | Evidence | Decision impact |
|---|---|---|
| Installed version reports `0.16.0` | `explorations/effect-schema-parity/research/gate-graft-version.txt:1` | Verified via `--version`, not network-capable `version` subcommand. |
| **Live build help DOES include `--only-dir`** | `explorations/effect-schema-parity/research/gate-graft-build-help.txt:41` | Contradicts the lane's “0.16.0 has no --only-dir” assertion. Local patch provenance and actual build behavior are **UNVERIFIED**. Do not remove the packet's scoped-index plan based on version alone. |
| Directory target supported | `.../gate-graft-help.txt:25`, `:41` | `graft build <effect-dir>` and `graft mcp <effect-dir>` are direct graft commands, not `beep graft` subcommands. |
| Query scoping/read-only option | `.../gate-graft-ask-help.txt:17`, `:22` | Proposed agent query: `graft ask '<question>' --source --in packages/effect/src --no-refresh "$HOME/YeeBois/dev/effect"`. `--no-refresh` permits intentionally stale, nonrefreshing reads; validate recorded index SHA separately. |
| Repo wrapper has other purpose | `packages/tooling/tool/cli/src/commands/Graft/Graft.command.ts:477` exposes cache sync and deep commands; `:437`, `:447` wire deep refresh/timer; `packages/tooling/tool/cli/src/commands/Root.ts:86` registers it | No existing `beep graft effect-index` or inventory extractor. Cache/deep orchestration is not needed for the structural knowledge plan. |

Future operator provisioning, **not executed**: run the approved structural build in `$HOME/YeeBois/dev/effect`, scoped by the help-advertised `--only-dir packages/effect/src` only after verifying the installed behavior. Build help also offers `--no-gitignore` and `--no-ignore` (`.../gate-graft-build-help.txt:47`) if upstream tracked ignore files must remain untouched. If another installation really lacks `--only-dir`, use the whole upstream repository index with query-time `--in` filtering; do not substitute `--include-dir`, which overrides skipped directory names rather than restricting the walk. No upgrade is required for this fallback.

Configure a separate `graft mcp "$HOME/YeeBois/dev/effect"` server at session setup, preserving the repo's MCP stability rule. Keep beep-effect and Effect indexes separate; do not enable nested-repository following. Graft is regenerable code context; JSONL is portable pinned knowledge. Markdown guides remain inputs to the JSONL/document extraction even when excluded from the structural source index. This lane did not start MCP, edit configuration, query/rebuild indexes, or verify retrieval quality.

## (e) NET-NEW bricks versus reuse

| Brick | Disposition | Reuse boundary |
|---|---|---|
| AST project, source exclusions, owner resolution | REUSE | `SchemaFirstProject.ts:30`, `:57`, `:88`; avoid expanding scope accidentally. |
| Finding membership comparison and failure reporting | REUSE | `internal/ratchet/RatchetDiff.ts:71`, `RatchetLifecycle.ts:67`; use parity identities and independent baseline. |
| JSONC artifact IO / JSONL formatting approach | REUSE adapters, NEW domain decoder | `SchemaFirstStore.ts:42`, `:102`; `EffectVitestStore.ts:169` is per-package finding export, not a schema-symbol extractor. |
| Hosted lane, Lint command, issue channel | REUSE + integration edits | `Quality/Tasks.ts:2634`, `Lint.command.ts:1159`, `SchemaFirst.render.ts:60`. |
| Upstream symbol/docs extractor, pin/coverage manifest | NET-NEW | No discovered automated Vitest fixture generator to rename. Determinism, namespace merging, overloads, barrels and document sections require implementation. |
| Same-intent/adoption policy edges and idiom rubric | NET-NEW | Reuse graph-edge validation pattern from `EffectVitestPolicy.ts:232`; semantic decisions must come from reviewed research. |
| UpstreamParity detector/store/scan/models + independent inventory | NET-NEW | Reuse machinery without adding a lane. Mandatory pin failure and independent floor are not delivered by adding an advisory ID alone. |
| Inventory-derived agent prompts | NET-NEW | Stable row IDs, source SHA, role and evidence scope per prompt; graft adds current context, not replacement authority. |
| Separate upstream graft index | REUSE installed CLI; local provisioning still needed | Live help supports directory targeting and scoped build; actual index state/retrieval remains UNVERIFIED. |
| Architecture decision and README policy | PROPOSED authored docs | Goal-stage work only; text below. |

## (f) Risks and controls

| Risk | Evidence / control |
|---|---|
| False closure | Existing membership ratchet can be green with backlog (`EffectVitestScan.ts:360`). Goal needs an explicit empty actionable parity inventory and reviewed coverage, including semantic candidates. |
| Advisory accidentally blocks or disappears | Current schema-first active advisories fail (`SchemaFirstScan.ts:454`); grouping is explicit (`:420`). Integrate parity separately and test failure aggregation. |
| Baseline laundering | `--write` refreshes current findings; independent floor must reject newly introduced instances after baseline initialization. Require zero actionable backlog at closure, not exceptions relabeled as zero. |
| Intent mistaken for equality | Policy accepts adapting behavior; detect validated patterns, retain semantic-change receipts and consumer verification. Name matches are not adoption rules. |
| Old lint recommends retired wrappers | Current remediation explicitly names `SchemaUtils`, `Defect`, `Fn`, Email (`SchemaFirstPolicy.ts:29`). Reconcile detector policy/remediation in the same migration PR; inventory alone will not remove contradictory guidance. |
| Line-only identity churn | Existing key includes line (`Lint.schemas.ts:586`); unrelated shifts produce missing/stale entries. Use occurrence anchors and refresh live evidence while preserving reviewed disposition. |
| Version field trusted as source integrity | `verifyEffectVitestPin` compares installed version only (`EffectVitestScan.ts:89`). Pin manifest needs source hashes and deterministic-generation proof; hosted cannot independently inspect local upstream Git. |
| Partial scope hidden by “all symbols” | AST namespaces, export-star/re-exports, overloads, markdown and Role B evidence need explicit coverage semantics. Keep per-module extraction failures visible as UNVERIFIED, never empty success. |
| Scan cost / heavy type resolution | Schema-first creates projects for main scan and const assertions (`SchemaFirstScan.ts:307`, `:52`). Add parity to shared traversal; avoid another full project. Before/after type-check and scan measurements are goal work, **UNVERIFIED here**. |
| Mutable neighboring work | rc115 fixtures and graph are currently dirty/staged. Citations describe present bytes; reread pins immediately before implementation. |
| Graft help differs from expected release | Saved help contradicts brief; runtime support and patch provenance remain UNVERIFIED. No init/build/upgrade/uninstall or deep operations were used to resolve it. |
| Doctrine scope overreach | `standards/architecture/11-evolution-and-deprecation.md:98` limits immediate removal to never-released in-repo symbols with no remaining consumers. Preserve protected published/cross-slice rules. |

## (g) Proposed doctrine text — do not apply during research

Precedent: `standards/architecture/DECISIONS.md:580` rejects a repo PGlite driver wrapper, permits boundary-local composition (`:587`) and explains duplicate upstream responsibilities (`:606`). Retirement condition: `standards/architecture/11-evolution-and-deprecation.md:98`.

PROPOSED architecture entry (8 lines):

```md
## YYYY-MM-DD: Upstream-First Foundation/Modeling
- **Status:** Proposed; activate when the implementing goal is ratified and delivered.
Decision: foundation/modeling uses upstream Effect concepts when they cover the intended capability.
When upstream covers the same intent, retire the local concept and adapt every consumer in the same PR.
Accept necessary behavior changes explicitly; remove the implementation and exports without compatibility aliases.
Immediate removal applies to in-repo symbols with no remaining consumers; protected release contracts follow §11.
The schema-first parity gate uses reviewed rules and SHA-pinned knowledge refreshed with every Effect bump.
Rationale: avoid duplicate ownership, following the 2026-07-08 upstream PGlite decision; measure migration costs.
```

PROPOSED `@beep/schema` README paragraph (3 lines):

```md
Prefer upstream Effect whenever it covers a concept's intent; consult the pinned inventory before adding a schema helper.
Retire covered local concepts in the same PR that adapts all consumers, deleting implementations and exports without aliases.
Record behavior changes and measured costs, refresh parity evidence on Effect bumps, and preserve protected release contracts.
```

## Verification limits / research friction receipt

This report is source inspection and a proposed integration design, not a working gate or generated inventory. Tests, builds, performance, graft retrieval quality and hosted execution were not run. The missing named fixture generator and conflicting graft help were resolved by inspecting current source/help rather than inventing a command. A checked-in deterministic extractor and a capability receipt tied to the installed executable would prevent those ambiguities. Writes in this lane are confined to this report and its adjacent graft-help evidence files.

Artifact/proposal count checks (executed; outputs respectively 5, 7, 1, 8, 3):

```sh
rg --files explorations/effect-schema-parity/research | rg '/gate-(and-knowledge-plumbing\.md|graft-.*\.txt)$' | rg -c '.'
rg -c '^## \([a-g]\)' explorations/effect-schema-parity/research/gate-and-knowledge-plumbing.md
rg -c '^  --only-dir' explorations/effect-schema-parity/research/gate-graft-build-help.txt
sed -n '/^## YYYY-MM-DD:/,/^Rationale: avoid/p' explorations/effect-schema-parity/research/gate-and-knowledge-plumbing.md | rg -c '.'
sed -n '/^Prefer upstream Effect whenever/,/^Record behavior changes/p' explorations/effect-schema-parity/research/gate-and-knowledge-plumbing.md | rg -c '.'
```

The shared structured issue schema accepts `ruleId: S.String` (`packages/tooling/tool/cli/src/internal/quality/SchemaFirstPolicyFinding.ts:118`); adding parity IDs does not itself require changing that transport schema. The closed inventory rule domain and any rule-specific consumers still need integration checks.
