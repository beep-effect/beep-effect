# Opportunities — friction receipts

## 2026-08-27 — Exact-snapshot Yeet refresh could not queue behind a sibling proof

- **What happened:** the first full semantic-foundation proof spent an extended
  period waiting for the repository-wide coordinator. After that proof passed
  and a documentation-status advisory was repaired, the required exact-snapshot
  refresh exited because a sibling checkout had acquired the coordinator. When
  owners released it, successive waiting siblings won the handoffs before this
  checkout could claim the lock.
- **Evidence:** `bun run beep yeet verify` reported `Another Yeet full proof for
  this repository is active` and identified the live owner checkout as
  a sibling beep-effect checkout. The owner process was still running, so
  deleting the shared lock would have been unsafe.
- **What would have prevented it:** a supported Yeet queue or `--wait` mode that
  retains the requesting command, emits periodic owner heartbeats, and starts
  verification when the coordinator becomes available.
- **Disposition:** repo-quality operator improvement; wait for the live owner
  and retry without bypassing the coordinator.

## 2026-08-27 — Staged-only proof hid the required package changeset

- **What happened:** full Yeet verification passed while the implementation was
  staged, and `changeset-status` reported no changed product workspaces. After
  staged-only publication created the commit, the post-commit proof correctly
  identified `@beep/ontology` as changed and required a new changeset.
- **Evidence:** the staged run reported `product_workspaces=0`; the post-commit
  run reported `product_workspaces=1` and named `@beep/ontology` as missing an
  in-range changeset. The older M1 changeset is already part of `origin/main`,
  so it cannot satisfy this delivery range.
- **What would have prevented it:** make staged-only verification evaluate the
  index as the candidate commit for changeset attribution, or have staged-only
  publication create its temporary commit before spending the full proof.
- **Disposition:** add the required patch changeset and amend the reviewed
  commit; candidate for a Yeet staged-only regression test.

## 2026-08-27 — Restored residue invalidated reuse of a successful proof

- **What happened:** the exact amended commit passed all 25 Yeet lanes, but the
  proof workflow restored unrelated `.codex` edits before returning. Parking
  those edits again made the worktree clean for publication, while also changing
  the recorded diff fingerprint, so `publish --reuse-verified` refused the
  otherwise exact-head proof.
- **Evidence:** `bun run beep yeet status` reported `verify success` for commit
  `d6476b6703` with only `.codex` residue present; after a path-scoped stash,
  publication exited with `stale proof state: diff fingerprint changed`.
- **What would have prevented it:** bind reusable proof identity to the verified
  candidate snapshot and preserve unrelated residue outside that snapshot, or
  provide a first-class clean-candidate worktree for verify and publish.
- **Disposition:** retain the residue in a named stash, amend this receipt, and
  verify the clean candidate snapshot before publication.

## 2026-08-27 — Hosted coverage found debt omitted by the local full proof

- **What happened:** the clean candidate passed all 25 local Yeet lanes, but the
  hosted coverage-regression check found one new uncovered loader error path.
  The loader refactor also reduced the number of branch sites, which lowered the
  branch percentage even though the absolute uncovered-branch count stayed at
  the `origin/main` value.
- **Evidence:** before the follow-up test, `@beep/ontology` had 48 uncovered
  lines, 49 statements, 37 branches, and 34 functions. A focused comparison to
  `origin/main` showed baseline debts of 47, 48, 37, and 33 respectively. The
  added malformed-slice test restored the candidate to exactly 47, 48, 37, and
  33; 68 ontology tests now pass.
- **What would have prevented it:** include the affected coverage-regression
  lane in the canonical local pre-publication proof, or surface an explicit
  advisory that the full local lane set does not cover this hosted gate.
- **Disposition:** cover the fail-closed parse-error path and retain the existing
  baseline; the comparator correctly ignores a percentage-only denominator
  change when uncovered debt does not increase.

## 2026-10-09 — Heavy wrapper needs the user-session bus in tool shells

- **What happened:** the initial wrapper probe could not connect to the user bus;
  the tool shell did not inherit the lane launcher's session environment.
- **Evidence:** `beep-heavy --help` exited with `XDG_RUNTIME_DIR not defined`.
  A read-only probe with explicit user-session bus variables found
  `agent-runs.slice` active. No heavy unit started on the failed probe.
- **What would have prevented it:** the lane harness should carry the user-bus
  variables into every tool shell, alongside its memory and concurrency pins.
- **Disposition:** supply command-local bus variables and the unchanged 32G cap.

## 2026-10-09 — Direct package check lacks dependency declaration artifacts

- **What happened:** R3 `beep-heavy bun run --cwd packages/foundation/modeling/ontology check`
  exited 1 with TS6305 before providing a usable source verdict.
- **Evidence:** `identity/dist/index.d.ts`, `rdf/dist/index.d.ts` and
  `schema/dist/index.d.ts` are absent. Diagnostics span untouched Fold and M1
  modules as well as the changed loader, with unresolved imports causing
  downstream any/unknown errors.
- **Attribution:** environment-only precondition; a direct package script does
  not orchestrate dependency builds. No source repair is justified yet.
- **What would have prevented it:** the lane preflight should qualify dependency
  declarations, or direct package-check guidance should name the prerequisite.
- **Disposition:** build ontology dependencies through Turbo under beep-heavy,
  then rerun the exact check. Preserve all dependency sources and tracked wiring.

## 2026-10-09 — Shared heavy admission has no FIFO ordering

- **What happened:** the loader coverage prerequisite waited over 30 minutes
  while newer shared-slot holders started; the dependency build also waited.
  Both lane jobs stayed below the two-job limit and the 32G cap.
- **Evidence:** the wrapper reported `all 3 slots busy, waiting`; repeated
  read-only lock and process checks showed three live holders with active
  children, including holders younger than the waiting coverage request.
- **What would have prevented it:** a FIFO admission queue with request age
  and periodic progress output, so earlier prerequisites cannot starve.
- **Disposition:** keep polling without changing the slot count or touching
  live owners. Prepare implementation in ignored lane scratch while the
  committed package snapshot remains stable for the prerequisite measurement.

## 2026-10-09 — Zsh reserves the path loop variable

- **What happened:** an instruction-file read used `path` as a loop variable;
  zsh treats it as the array tied to PATH, so `cat` stopped resolving.
- **Evidence:** the read-only command reported `command not found: cat`.
- **What would have prevented it:** use a task-prefixed shell variable rather
  than names that are special to the configured shell.
- **Disposition:** reran the read with `task_guide_path`; no files or persistent
  environment changed.

## 2026-10-09 — Architecture plan does not route modeling modules

- **What happened:** the required read-only architecture plan for a foundation
  Classification value proposed the synthetic `foundation-domain` proof tree,
  rather than modules in the brief's existing `@beep/ontology` target surface.
- **Evidence:** `beep architecture plan --slice foundation --concept
  Classification --domain-kind values --stage core` returned operations for
  `packages/foundation/domain` and legacy proof cleanup.
- **What would have prevented it:** a modeling-package module plan that names
  an existing workspace and returns only that workspace's role files.
- **Disposition:** applied none of those operations. The brief's ontology
  ownership and source-module contract remain authoritative.

### M2 boundary API defects caught before publication

- Work: first classification runtime coverage and ontology typecheck after dependency declarations were restored.
- Evidence: the fixture suite failed during pin construction with `ClassificationSchemeKind.$match(...) is not a function`; typecheck identified circular encoded XML interfaces, a nonempty-array refinement that did not narrow a mutable array, and typed-decoder/pipeable-helper requirements. All 73 existing tests passed.
- Attribution and correction: introduced M2 code. Validate LiteralKit handler semantics as well as Effect signatures before authoring; derive nonrecursive fields from schemas and type only the recursive encoded edge. The corrected wave is queued for coverage and check; no M2 pass is claimed. The live wrapper now reports five shared slots, changed externally; this lane changed no wrapper setting or cap and still runs at most two own jobs.
- Prevention: a tiny construction/recursive-codec proof admitted before expanding the parser would have caught these defects earlier.

### Shared XML text-node key rejects classification input

- Work: M2 synthetic master-file decoding through the required existing `@beep/schema/Xml` boundary.
- Evidence: the bounded decoder diagnostic reports `Invalid XML input (Invalid tag name: text).` The reader sets `textNodeName: "text"`; installed fast-xml-parser 5.11.2 rejects a tag equal to that reserved key in `OrderedObjParser.js`. The pinned IPC master actually contains `<text>` elements. Current `origin/main` at `4e82f6d942` retains this configuration, and the installed parser/validator versions match the committed lockfile.
- Attribution: inherited shared-reader limitation, exercised by the new classification path. Affected ontology fixtures: five failed, 77 passed out of 82. Package verification repeats the same failure after successful build and typecheck.
- Boundary and prevention: repairing the shared reader is outside this lane scope; no parser bypass or dependency change was made. The orchestrator should route a compatible XML reader repair to its owner on main, with reserved-name and existing consumer tests, then let this lane merge main once and resume. A minimal actual classification XML precondition probe before drafting would have caught this earlier.


### Resume ruling conflicts with the lane execution boundary

- Work: read the full resume brief before starting PR 0.
- Evidence: the current instruction says work only inside semantic-m2m3;
  the appended ruling requires a new schema-xml-text-node sibling worktree
  and work from clone beep-effect11. It also says resume through M4 while
  the brief's mission and scope exclude M4.
- Disposition: stop under contradictory inputs; preserve the unfinished M2
  candidate and publish nothing. No new heavy command or gate was started.
- Prevention: issue a coherent resume instruction that permits the separate
  reader-fix lane and retains the explicit M4 routing boundary, or land the
  shared-reader repair through an already authorized owner.

## Resume wrapper environment and help probe (2026-10-09)

- Work: restore bounded heavy-command admission after the corrected resume ruling.
- Evidence: `beep-heavy --help` first failed because the user-scope bus environment
  was absent. With the runtime/bus environment supplied, the wrapper interpreted
  `--help` as a command and queued a transient service instead of printing usage.
- Response: stopped only the newly owned probe service before admission; inspected
  the wrapper to establish its positional command contract. No proof ran and no
  slot or memory configuration changed.
- Prevention: document that the wrapper has no help flag and initialize the
  user-systemd environment in headless lane launchers.

## Candidate JSDoc category admission (2026-10-09)

- Work: independently compile/check M2 public documentation while waiting for
  the owner XML-reader branch.
- Evidence: scoped `docgen:local -- --package @beep/ontology` rejected four
  exports using the unknown categories `identity` and `filesystem`.
- Attribution: introduced in the M2 candidate; category validation was not
  reached by the earlier package-audit stop.
- Response: use the binding category inventory's `identifiers` and `resources`
  categories. Rerun the same scoped gate; do not infer docgen admission from
  package JSDoc lint alone.
- Prevention: validate categories against `.patterns/jsdoc-documentation.md`
  before the first runtime audit, so a dependency blocker does not hide docs reds.

## Reader-owner branch unavailable at bounded resume deadline (2026-10-09)

- Work: resume M2 by cherry-picking the separately owned XML-reader repair.
- Evidence: thirteen `git fetch origin fix/schema-xml-text-node` attempts from
  21:43:18Z through 22:43:27Z all returned `couldn't find remote ref`. Fresh main
  still uses the reserved XML text key. Exact receipts are in the lane handoff.
- Response: committed the candidate and independent documentation repair,
  ended the owned poll at its deadline, retained active M2/M3 and pending M4,
  and published no incomplete wave.
- Prevention: announce a fetchable owner commit with its SHA before resuming a
  dependent lane, or provide a revised dependency-wait budget in its brief.

## Reader fix carries an unlanded dependency (2026-10-09)

- Work: admit the published XML-reader owner fix for the corrected resume.
- Evidence: owner branch head `1b26273832` is fetchable; PR #1594 is open and
  unmerged. Its source fix `288f402edf` adds `fast-xml-builder` to the schema
  devDependencies, root catalog and lockfile, and imports it in the regression
  test. Fresh main `3200e01946` does not contain those additions.
- Attribution: separately owned prerequisite, not a dependency introduced by
  this lane. The brief permits fetching the fix commits but explicitly stops
  on a dependency not on main and on unplanned dependency/lockfile changes.
- Response: merged main, retained the committed M2 candidate, and stopped
  before cherry-picking, running dependent proof or publishing an incomplete
  wave. No shared-reader fix was authored or partially imported here.
- Prevention: land dependency-bearing prerequisite PRs on main before sending
  dependent lanes a cherry-pick instruction, or explicitly reconcile that
  instruction with the dependent lane's dependency admission rule.
## 2026-10-09 — XML repair brief carries stale publication metadata

The schema-xml-text-node brief requested a patch changeset for `@beep/schema`,
calling it published. On current main `4e82f6d942`, its manifest and the CLI
consumer manifest both have `private: true`. After staging the requested
changeset, `bun run beep quality changeset-graph` exited 1 with
`private workspace changesets are forbidden`. Removed the changeset under
the brief's private-workspace exemption; no release policy was changed.
Generate package publication facts from the lane's refreshed base when
writing briefs so workers do not prepare release notes the gate rejects.

## 2026-10-09 — XML builder declarations disagree with runtime exports

The XML round-trip regression initially used `XMLBuilder` from
`fast-xml-parser`; the schema audit's Biome gate rejected its deprecated
re-export. The maintained `fast-xml-builder@1.3.1` declarations expose a
named `Builder` export, but its ESM source exports only the default
constructor. The focused test and schema package audit exposed
`undefined is not a constructor`; using the default import repaired it.
Prefer the runtime-supported default import and verify runtime exports when
following this package's declarations. Adding the explicit test dependency
also made bounded docgen require the canonical full proof because the root
catalog and lockfile changed.

## 2026-10-09 — Scoped CLI coverage reports unrelated baseline drops

`bun run beep ci lane coverage --filter @beep/repo-cli` passed 291 files
and 5,834 tests (5 skipped), then failed committed coverage floors on
`Accounts.command.ts` (branches 75 < 100), `EffectImports.ts`
(functions 89.34 < 90.17, lines 92.36 < 92.52, statements 92.02 < 92.13),
and `Yeet/internal/TurboQuery.ts` (functions 73.91 < 78.26,
lines/statements 86.66 < 88.33). All three files are unchanged by this lane
relative to its base `4e82f6d942`; the baseline is also unchanged on current
main. This lane does not lower their floors or repair their unrelated code.
Main advanced during the proof, including global inputs. Integrate the newer
base and replay with PR-base framing before attributing the final-head gate.

## 2026-10-09 — New main inherits cheap-gate reds that block XML publication

After integrating `cb64e0484f` and re-running both package verifiers green,
`bun run beep yeet publish --message "fix(schema): use a reserved text-node key in the XML reader"`
created local commit `0b96e712b7` but exited 1 before any push.
`lint:schema-first` reported three missing inventory entries: exported
`AccountsSecretField` and `AccountsSecretsItem` structs, plus the
`ci-runner-security.test.ts` schema-codec advisory. `lint:effect-vitest`
reported 13 new findings across seven upstream files. None of these files
is changed by this lane relative to integrated base `cb64e0484f`.
The root packet identifies `schema-first-policy`; the full cheap-gate log
contains both red lanes. Fix these once on main and merge that fix into the
dependent lanes, as the Quality Operator law requires. This lane does not
refresh unrelated baselines, waive gates, or copy upstream repairs.
The remaining owned parity batch was stopped after the hard publication
blocker was attributed; its partial full-docgen replay is not a green proof.

## Resume 5 — Nice decoder retains the old XML text-node key

- Work: resume the M2 fixture/coverage gate after merging prerequisite PR #1594
  from main and installing the frozen lockfile.
- Evidence: scoped ontology coverage exited 1: 81 tests passed and one failed,
  `loads Nice classes and goods/services basic terms`, with
  `ClassificationError` / `source-parse` / `Invalid Nice class`. A bounded
  reader diagnostic parsed the synthetic HeadingItem with an id attribute as
  `{ HeadingItem: { "#text": "Synthetic goods class", id: "h1" } }`.
- Attribution: the lane's new ClassificationXml TextNode still decodes `text`;
  Nice heading/label values now arrive under `#text` and are silently discarded.
  This is an introduced consumer compatibility defect, not a failure of the
  landed shared reader. Literal `<text>` IPC fixtures now pass.
- Response: stop as run-5 ruling step 2 explicitly requires for a fixture
  failure on the text-node key; do not patch the shared schema reader or
  publish an incomplete M2 wave. All owned commands finished.
- Prevention: when resuming a dependent lane after an output-shape repair,
  authorize that lane to adapt its own new consumer to the landed shape, and
  test elements containing both attributes and text before full archive proof.

## 2026-10-09 — Interrupted coverage receipt did not identify its source snapshot

- **What happened:** the resumed tree included a coverage test edit made after the saved passing run; the self-closing `titlePart` fixture decoded as an empty string rather than an object.
- **Evidence:** fresh coverage reported `Invalid IPC XML` in the optional-title test while the older receipt said 85 passed. Adding a synthetic attribute to the empty `titlePart` expressed the intended object boundary; the next suite passed all 87 tests.
- **What would have prevented it:** save a source fingerprint beside every proof receipt, especially before interrupted edits.
- **Disposition:** retain the meaningful absent-title test and use fresh coverage, not the stale passing log.

## 2026-10-09 — CPC master repeats title text nodes

- **What happened:** the first real-artifact proof failed on CPC after fixtures passed.
- **Evidence:** `cpc-scheme-A.xml` schema decoding reached the `A01H` title; its first title part has two child `text` elements. The boundary expected one string or attributed node.
- **What would have prevented it:** a synthetic repeated-title fixture and shape census before loader qualification.
- **Disposition:** admit singleton or repeated title children through `ArrayEnsure`, retain `#text` for attributed content, and join only admitted title fragments. Definitions, notes, references and warnings remain excluded.

## 2026-10-09 — CPC-specific title wrapper has no text child

- **What happened:** after repeated title children decoded, the real CPC master exposed a different title shape.
- **Evidence:** the diagnostic identified a missing `text` key in a `CPC-specific-text` title-part child of `cpc-scheme-A.xml`. This is distinct from the repeated-title mismatch; a wrapper may carry only excluded reference content.
- **What would have prevented it:** a synthetic attributed wrapper with no admitted title child.
- **Disposition:** default the absent child list to empty at the XML boundary and retain the facts-only field projection.

## 2026-10-09 — CPC real-artifact parser remains blocked after repeated attempts

- **What happened:** three real-artifact attempts returned `ClassificationError` with `source-parse / Invalid CPC XML` while synthetic tests passed.
- **Evidence:** after repeated title children and empty admitted child lists were handled, the remaining diagnostic points to `cpc-scheme-A01G.xml`, notation `A01G9/24`: one title part has two `CPC-specific-text` siblings, while the boundary expects one object.
- **What would have prevented it:** a census of cardinality variants across all official scheme files, turned into synthetic fixtures before runtime admission.
- **Disposition:** stop under the brief's repeated-blocker rule; keep M2/M3 in progress and publish no incomplete wave. Resume requires the orchestrator's next ruling; preserve the bounded, package-verified candidate.

## 2026-10-09 — CPC class-range containers are not broader class concepts

- **Work:** run-8 full-edition proof after admitting repeated title containers.
- **Evidence:** XML decoding completed, then snapshot validation failed with
  `Conflicting parents for A22B`. The section file nests identifiers
  `A → A21 → A22 → A22B`, while the subclass file starts at `A22B`.
  The intermediate A21 container groups classes; it is not A22's broader class.
- **Attribution:** introduced interpretation defect in the lane-owned CPC walker.
- **Response:** derive section/class/subclass parents and depths from their
  symbols, retaining the source tree for group and subgroup hierarchy. Add a
  synthetic range-container fixture with the duplicate subclass root.
- **Prevention:** include cross-file duplicate identity and class-range wrappers
  in the fixture census, beyond repeated-element shapes.
