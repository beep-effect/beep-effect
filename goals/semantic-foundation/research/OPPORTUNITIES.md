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
