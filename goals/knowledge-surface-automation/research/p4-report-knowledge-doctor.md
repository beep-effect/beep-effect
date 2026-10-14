# P4 report — `beep knowledge doctor --report` over the live corpus (FP-eyeball input)

Status: phase-0 evidence for Workstream C Stage 2 (design:
`research/p4-knowledge-doctor-design.md`, PR 1). Read-only: produced by
`bun run beep knowledge doctor --report --json` at tree `f6a8fe3001` on 2026-10-13. The
command exits 0, reads no baseline, writes nothing (`git status --porcelain` unchanged),
and gates nothing. Causal grouping, the sealed baseline, leases, and quality-lane wiring
are later PRs (design sequencing PR 3–5). The domain evaluators (PR 2b) are in
"PR 2b — domain evaluators" below.

## What shipped

- `KnowledgeDoctor.schemas.ts`: span classes, witness-bearing evaluation outcomes
  (`Resolved` must carry a non-empty witness array), the report schema, and four
  additive finding kinds.
- `KnowledgeDoctor.service.ts`: span extraction over the Stage-1 corpus, the ordered
  classification rule table (archival-only historical markers; a marker on a live
  surface is inert and reported), the `paths` and `commands` evaluators,
  `unknown-beep-option`, and `overlayWithout` plus the counterfactual harness.
- `Knowledge.command-surface.ts`: static flag derivation, checked against the runtime
  CLI. Flags derive for 401 of 405 commands with zero mismatches, and that check is a
  committed test. Options on the other 4 commands are counted as unchecked, never
  passed.
- `knowledge-doctor.test.ts`: 23 tests, green on Bun and Node, including the
  counterfactual harness and the adversarial fixtures. Together with the existing
  knowledge suites that is 151/151 on each runtime, with Stage-1 behaviour unchanged.

## Live corpus

| Spans by class | Count |
| --- | --- |
| verified | 11,122 |
| unclassified | 19,314 |
| generated-example | 0 |
| historical-with-commit | 0 |

| Findings by kind | Count |
| --- | --- |
| unclassified-reference-span (advisory) | 19,314 |
| broken-tracked-path | 530 (across 255 documents) |
| unknown-beep-command | 20 |
| unknown-beep-option | 13 |
| failed-assertion | 1 |

Unchecked options: 0. Generated and historical counts are zero because the corpus has
no `beep:generated` fences or historical markers yet.

## Candidate false positives

1. **An assertion documented in prose is executed (true FP class).** The single
   `failed-assertion` is this packet's own `SPEC.md`, which shows the assertion syntax
   inside an inline code span (`` `<!-- beep:assert path-exists <path> -->` ``). An
   assertion marker inside inline code is documentation, not a claim. Fix in PR 2:
   only a marker that is a whole HTML-comment line outside code spans and fences
   asserts. This needs an adversarial fixture, not a normalizer exception.
2. **Planned commands in design-stage packets.** Of the 20 unknown commands, 16 name
   commands that design or plan documents propose but that do not exist yet:
   `ai-sync` (6), `laws dual-arity` (5), `reuse` (2), `quality repo-exports-catalog` (2),
   and `graphiti` (1). These are claims about the future, not doc rot. Proposed
   classification for PR 2: a command span inside a packet whose lifecycle is not
   `completed-retained`, in a planning document (`SPEC.md`, `PLAN.md`), classifies as
   `planned`. That is a new span class, non-baselineable, and reported but never
   blocking. It needs a K-decision before code.
3. **`…`-tail spans are true positives.** `ai-metrics …` and `yeet gh …` (3) violate
   the ratified authoring note (write `<command>`, never `...`). The fix is a doc fix.
4. **`worktree add` is a true positive.** The real subcommand is `worktree new`
   (`goals/lane-bootstrap/SPEC.md`).
5. **The 13 unknown options are all true positives.** `yeet repair --pr` (5) and
   `yeet publish --start-pr-early` (7) were removed in the push-first refactor, and
   `qa extract --round` (1) no longer exists.
6. **Broken tracked paths (530) carry over Stage-1's live finding set.** They are
   spread over 255 documents, mostly `packages/` (146), `goals/` (132), and
   `scripts/` (69) targets, concentrated in older reports (for example
   `goals/standards-remediation`). Burn-down belongs to the sealed baseline (PR 4–5),
   not a doc sweep now.
7. **Unclassified spans (19,314) are the classification worklist (K9).** They are
   advisory only and concentrate in large research packets (`goals/boolean-creep`
   1,694; `goals/time-to-certainty` 1,182). They gate only through the Stage-1
   introduced-only delta.

## After PR 2

Re-run of the same read-only report on the PR 2 working tree (2026-10-14), after the
whole-line assertion reader, the arrow-chain eligibility fix, and the accepted doc fixes:

| Count | PR 1 report | Verdict re-run | After PR 2 |
| --- | --- | --- | --- |
| failed-assertion | 1 | 1 | 0 |
| unknown-beep-option | 13 | 13 | 0 |
| unknown-beep-command | 20 | 20 | 10 |
| broken-tracked-path | 530 | 530 | 530 |
| verified / unclassified spans | 11,122 / 19,314 | 11,167 / 19,372 | 11,151 / 19,370 |

The 13 options split into 5 arrow-chain artefacts (no longer command spans) and 8 doc
fixes. The 10 commands that left are the 3 ellipsis tails (now `<command>`) and the 7
planned-command spans re-spelled as prose `beep <cmd>`. The 10 that remain are the
removed-command spans, which belong to the baseline burn-down with the 530 broken paths.

## PR 2b — domain evaluators

Re-run of the read-only report with the three domain evaluators (design K14–K17), at
tree `7f23ce0df5` on 2026-10-14. It exits 0, writes nothing (`git status --porcelain`
unchanged), and gates nothing. The paths and commands results are unchanged (530
broken paths, 10 unknown commands).

| Evaluator | Verified spans | Unclassified spans | Findings on verified spans |
| --- | --- | --- | --- |
| `symbols` | 5,188 (5,163 specifiers, 25 imported identifiers) | 10,804 | 328 `unknown-beep-symbol`: 241 package, 81 subpath, 6 export; 136 documents, 100 causes |
| `packet-status` | 83 (80 current-phase, 3 lifecycle) | 22 | 1 `packet-status-claim-drift` |
| `skills-local` | 37 (one per locked or installed skill) | 0 | 14: 6 `floating-github-skill-source`, 6 `skill-license-unrecorded`, 2 `skill-lock-coverage-drift` |

Span totals moved from 11,151 verified / 19,370 unclassified (after PR 2) to 16,460 /
30,197. The unclassified growth is almost all `@beep/*` specifiers on archival paths
(mostly turbo task ids such as `@beep/test-runner#build` in research captures). They
are advisory and join the K9 classification worklist.

Every evaluator passes the counterfactual harness on its fixtures, with every witness
`failed` and none `vacuous`. Parity tests pin the tree readers to the live-filesystem
readers on this checkout: packet records against `listGoalPackets`, workspace packages
against `resolveWorkspaceDirs`, and installed skills against the `.claude/skills`
listing.

### Candidate false positives (PR 2b)

8. **Proposed packages (symbols, about 185 of the 241 package findings).** Package
   names that design-stage documents propose but that do not exist:
   `@beep/courtlistener` (55, of which 24 are in
   `explorations/_gold-intake/GOLD_SYNTHESIS.md`), `@beep/federal-register` (18),
   `@beep/dol` (18), `@beep/protobuf` (8), and the canvas family. The count is what
   remains after classes 9 and 10. Of all 241 package findings, 149 are in explorations
   and 77 in goal packets, mostly `SPEC`, `PLAN`, and `GOAL` files. This is the
   planned-command shape, which the verdict ruled has no `planned` class (rewrite as
   prose). The ask is whether the same ruling applies to package names.
9. **Slice-family names written as packages (42).** `@beep/epistemic` (29),
   `@beep/law-practice` (10), and `@beep/agents` (3) name the `packages/<family>/`
   directories, not a package. This is a reader FP class. Options: read
   `@beep/<family>` as a family reference when `packages/<family>/` exists, or rewrite
   the spans as `packages/<family>/`.
10. **Illustrative slices in standards (about 13).** `@beep/tasks-use-cases`,
    `@beep/notes-server`, `@beep/billing-use-cases`, and `@beep/iam-domain` are teaching
    examples in `standards/architecture/` chapters. True FP for a reader that cannot
    tell an example. The doc fix is a placeholder spelling such as
    `@beep/<slice>-use-cases`, which the reader already skips.
11. **Retired `@beep/schema` subpaths and exports in standards (27).** `Dom`, `Http`,
    `http/headers`, `color`, `ExpectCT`, `XSSProtection`, `Blockchain`, `Person`, and
    `Location` subpaths, and the `Defect`, `TaggedErrorClass`, and `OpaqueUnknown`
    exports. In `ARCHITECTURE.md` and `07-non-slice-families.md` these are true
    positives (live guidance names layouts that no longer exist). 36 symbol findings sit
    in `DECISIONS.md` files, which narrate past states. The ask is whether decision
    logs get the archival treatment (historical citations) rather than a HEAD check.
12. **File- and member-shaped specifiers (11).** `@beep/mcp-kit/README.md`,
    `@beep/rdf/Vocab/Prov.ts`, `@beep/schema/Int.ts`, `@beep/utils/Number.ts`,
    `@beep/schema/Color/Color.hex`, and `@beep/shared-tables/table/Table.make` use the
    package name as shorthand for a package-relative file or member, not as an import
    specifier. This is a reader FP class. The fix would read a final segment with a file
    extension as a package-relative path and check it against the tree.
13. **A handoff snapshot read as a current claim (packet-status, 1).**
    Line 9 of `goals/ai-metrics-stack/ops/handoffs/HANDOFF_P7E_CLOSEOUT.md` says the
    packet is `active`, but its manifest says `completed-retained`. A handoff is a
    point-in-time capture under `ops/handoffs/`, which the rule table treats as live.
    The ask is whether `ops/handoffs/` is archival. The other 80 current-phase claims and 2
    lifecycle claims all resolve.
14. **Skills findings are true positives.** The 6 GitHub skills (`adhd`, `grill-me`,
    `portless`, `shadcn`, `teach`, `turborepo`) follow `main` and record no license under
    the v1 lock, which is what B-3b's v2 migration fixes. `closeout` and `orchestrate` are
    installed with no lock entry. No FP candidates.

### Asks for the PR 2b verdict

4. Rule on 8: apply the planned-command ruling to proposed package names, or not.
5. Pick the fix for 9 and 12 (reader change or doc rewrite).
6. Accept 10 as doc fixes and 14 as true positives (B-3b and a lock refresh).
7. Rule on 11 and 13: should decision logs and `ops/handoffs/` be archival surfaces?

## PR 3 — causal grouping and root attribution

Re-run of the read-only report with causal grouping (design contract 12, K18–K23), at
tree `a439bc3ff2` on 2026-10-14. It still exits 0, writes nothing, and gates nothing;
two runs produce byte-identical JSON. Every finding keeps its `causeKey`; the report adds
`groups` (one per distinct cause key) and `rootHistory`, and the human output lists roots
instead of findings. `goals doctor` output is byte-identical before and after its packet
core moved onto a reader.

| Measure | Value |
| --- | --- |
| Findings / blocking findings | 31,116 / 883 |
| Cause groups / groups with a blocking finding | 7,688 / 341 (the other 7,347 are the unclassified worklist) |
| Blocking roots by cause | 238 path, 54 `@beep` package, 26 subpath, 4 export, 4 command, 14 skill, 1 packet-status |
| Groups with 5 or more dependents | 37, covering 441 of the 883 blocking findings |
| Delegated roots | 0: at this tree the goals doctor reports only Git-history advisories, which are excluded |
| Path roots attributed to a removing commit | 103 of 238 (12 with a rename repair target) |
| Root history | `available` (full clone) |

The 883 blocking findings collapse to 341 roots. Cross-evaluator merging works: 20
`unknown-beep-symbol` findings whose subpath resolves to a missing file share the
`path:` root with the broken-path findings for that file.

Top roots by dependents:

| Dependents | Root | Attribution |
| --- | --- | --- |
| 55 | `beep-package:@beep/courtlistener` | none (package names are not paths) |
| 29 | `beep-package:@beep/epistemic` | none |
| 29 | `path:goals/ip-law-knowledge-graph` | deleted in `cd7670d5d0` (#401, portfolio consolidation) |
| 25 | `path:scripts/generate.ts` | none |
| 23 | `path:tools/call` | none |
| 18 | `beep-package:@beep/dol`, `beep-package:@beep/federal-register` | none |
| 18 | `path:packages/drivers/workflow` | none |
| 17 | `path:goals/trustgraph-port` | deleted in `cd7670d5d0` (#401) |
| 16 | `path:scripts/setup-effect-ref.sh` | deleted in `0684c57f99` (#1583, scripts ported to Effect commands) |
| 15 | `path:goals/ontology-modeling-foundation` | deleted in `cd7670d5d0` (#401) |
| 13 | `path:scripts/cloud-session-setup.sh` | deleted in `0684c57f99` (#1583) |
| 10 | `path:apps/canvas` | deleted in `33c584b179` (retired slices and apps) |

The commits that removed the most attributed roots: `cd7670d5d0` (#401) 26,
`33c584b179` 12, `0684c57f99` (#1583) 10, `8852619f04` (repo-exports catalog removal) 8.

### Candidate wrong groupings (PR 3)

15. **Directory repair targets taken from one renamed file.** The proposal for a
    directory root comes from the newest rename under it. `packages/foundation/capability/nlp`
    proposes `packages/drivers/rdf-canonize` and `packages/common` proposes
    `packages/foundation/ui-system`, because one file moved there while the rest of the
    directory went elsewhere. Attribution (the commit) is right; the repair target is
    not. Option: propose a directory target only when every rename under the root agrees.
16. **One skill, several roots.** `skill:adhd:license` and `skill:adhd:revision` are two
    roots for one lock entry (6 skills split this way, 14 skill roots in all). The ask is
    whether the skills cause key should be the lock entry (`skill:<name>`), so one
    lock fix is one root.
17. **Package roots are never attributed.** 54 package roots (241 dependents) carry no
    authoring commit because a package name is not a path. Most are proposed packages
    (candidate 8), so there is no commit to find; for removed packages, attribution
    would need the removed `package.json` whose `name` matched.
18. **Unattributed path roots are mostly never-existed paths.** 135 of 238 path roots
    have no removal in history: planned paths, MCP method names written as paths
    (`tools/call`, `tools/list`), and shorthand. These are paths-evaluator FP classes,
    not grouping errors, but grouping makes them visible as single roots.

### Asks for the PR 3 verdict

8. Rule on 15: restrict directory repair proposals to unanimous renames, or drop them.
9. Rule on 16: key skill causes by lock entry.
10. Accept 17 and 18 as known limits (attribution is path lineage only, per C6 tier 2).

## Deviations from the design (recorded)

- Historical-marker block scope is line-based (Stage-1 fence reader plus blank lines),
  not a Markdown AST, so the slice adds no mdast dependency. A loose list split by
  blank lines counts as several blocks.
- The counterfactual harness has three verdicts. `failed` is required where no flag
  spelling is shadowed. `rebound` means the span still resolves through a different
  real witness (for example `-v` falling back to the global `--version`). `vacuous`
  means the evaluator ignored the tree, and it must never occur.
- `Failed` can carry several failures, so one command with two bad options yields two
  findings.
- Running without `--report` fails on purpose until the sealed baseline exists.

## Asks for the verdict

Verdict recorded 2026-10-14 in
[`p1-fp-eyeball-verdicts.md`](./p1-fp-eyeball-verdicts.md) (Workstream C knowledge
doctor): ask 1 accepted, ask 2 ruled with no `planned` class, ask 3 partial (candidate 4
and five of candidate 5's spans rejected). C Stage-2 PR 2 lands the fixes.

1. Accept candidate 1 as a true FP class, to be fixed in PR 2 with a fixture.
2. Rule on candidate 2: add a `planned` span class (new K-decision), or treat planned
   commands as true positives to be rewritten.
3. Accept candidates 3–7 as true positives. Fix 3–5 with a small doc PR; 6–7 are the
   baseline and classification burn-down.
