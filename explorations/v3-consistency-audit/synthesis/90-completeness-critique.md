# 90 — Completeness critique

## Verdict

The packet is not yet complete against the four-task brief. Tasks 1–3 are
substantively present, and all nine prior hypotheses plus the leading auditor
proposal are discussed, but task 4 is not complete: seven measured patterns
still have no chosen convention and therefore no per-pattern enforcement
recommendation. The assessment and ranking also retain several numbers that
the verified family tables corrected.

Evidence baseline for this critique:

- Packet files read: `README.md`, `CAPTURE.md`, `RESEARCH.md`, `DECISIONS.md`,
  `BRIEF.md`, `MAP.md`, `research/SOURCES.md`, and synthesis `00`, `10`–`15`,
  `20`–`25`, `30`, and `40`.
- `wc -l` over those files returned 4,231 lines.
- Family-row definitions: `awk` over the tables in `20`–`25` returned 105
  rows, matching `00-convention-inventory.md` §Status rollup (29 codified + 18
  codified-but-drifted + 14 drifted + 2 missing + 24 v4-only + 18
  not-worth-porting = 105).
- All commands below were run from `~/YeeBois/projects/beep-effect7`; counts
  exclude `node_modules`, `dist`, `coverage`, and `.turbo`.

## Blocking gaps

### B1 — Brief task 4 is explicitly unfinished

`40-recommendations-ranked.md` §Rows the grill measured but did not resolve,
L286-302 says four `drifted` rows and three `v4-only` policy questions have no
chosen meaning of “good” and are “a DECISIONS question for the follow-up, not a
gate”: `dir:package-shell-skeleton`, `BN-19`,
`tests:coverage-ratio-by-tier`, `tests:typecheck-covers-test-tree`, `BN-12`,
`BN-14`, and `BN-15`. `00-convention-inventory.md` §Decision coverage,
L196-198 independently calls the first four unresolved and the last three
unsettled policy questions. That contradicts `README.md` L27-35 and
`DECISIONS.md` L425-427, which say the frontier is empty, and it falls short of
the brief's required “per-pattern enforcement recommendation (CLI stage / lint
rule / generator).”

Command/excerpt:

```sh
sed -n '286,302p' explorations/v3-consistency-audit/synthesis/40-recommendations-ranked.md
sed -n '196,198p' explorations/v3-consistency-audit/synthesis/00-convention-inventory.md
```

Result: 7 unresolved rows; 4 are drifted and 3 are v4-only policy questions.

One-line fix: decide or explicitly defer each row in `DECISIONS.md`, then give
each row one terminal recommendation (`architecture-cli-audit`, lint,
generator, existing ratchet, or `not-worth-enforcing`) in `40`.

### B2 — The proposed first vertical slice cannot have “exactly nine” findings

`MAP.md` L54-65 requires the first audit report to contain “exactly the nine
divergences in synthesis/15” plus missing converters. But
`15-architecture-lab-vs-doctrine.md` §2 identifies repeated per-file findings:
two `.repository.ts`, two `.use-cases.ts`, two concept `server.ts`, five
lowercase config entry files, one config `.layer.ts`, three server handler
spellings, one tables entry, one client role, and one UI role. Its propagation
table at L156-160 calls these “9 divergent files” while listing 14 manifest
line locations. The document is using “nine” sometimes for categories and
sometimes for files/findings, so the acceptance assertion is not executable.

Command/excerpt:

```sh
sed -n '54,65p' explorations/v3-consistency-audit/MAP.md
sed -n '55,114p' explorations/v3-consistency-audit/synthesis/15-architecture-lab-vs-doctrine.md
sed -n '154,160p' explorations/v3-consistency-audit/synthesis/15-architecture-lab-vs-doctrine.md
```

Result: 9 is a category count; the cited file table yields more than 9 path
findings, and the manifest-location list itself contains 14 locations.

One-line fix: replace “exactly nine” with a checked path-level expected-findings
table and state separately how many categories and how many file findings it
contains.

### B3 — R3 still depends on undecided client/UI roles

`40-recommendations-ranked.md` R3 L81-89 proposes replacing
`WorkItem.client.ts` and `WorkItem.view-model.ts`, but then marks the exact
client/UI roles open for a future DECISIONS entry. `15` L102-114 confirms that
neither current file has a doctrine role. This contradicts R3's presentation as
an implementable reconciliation and the packet's empty-frontier claim.

Command/excerpt:

```sh
sed -n '65,93p' explorations/v3-consistency-audit/synthesis/40-recommendations-ranked.md
sed -n '102,114p' explorations/v3-consistency-audit/synthesis/15-architecture-lab-vs-doctrine.md
```

Result: 2 proof files still lack a selected target role.

One-line fix: decide the client facade split and UI read-model home before R3,
or remove those files from R3 and name a separately gated prerequisite.

## Should-fix gaps

### S1 — `30-assessment.md` retains corrected-away numbers

The following is the exhaustive set of numeric disagreements found between
`30` and its cited verified family rows:

| Assessment claim | Verified family evidence | Problem | One-line fix |
| --- | --- | --- | --- |
| L10-14: IAM 20/20 and Knowledge 22/22 folders are “byte-identical in shape” | `10` §2.1 L48-56: IAM 20/20 have 11-file folders; `11` §2.2 L65-91: Knowledge has 19 persisted seven-role folders and 3 contract-only folders | 22/22 are PascalCase and indexed, but not one identical folder shape | Say “20/20 IAM share one shape; Knowledge has 19 persisted and 3 contract-only shapes.” |
| L13 and L71: v3 `Live` is 86% | `25` EL-12 L28 and verification L63: Live 108 / Layer 5 / Test 3 / lowercase `layer` 12 = 108/128 = 84%; the old denominator omitted Test | Stale pre-verification percentage | Replace 86% with 84% in both places. |
| L17, L65, and L121: `frs-01` supports 404/438 = 92.2% | `21` `frs-01` L21: 403/432 = 93.3%; `23` `CI-02` L20: 404/438 = 92.2%; `00` L200-203 explains the different denominators | The claim conflates two rows, and L121 attributes 92.2% directly to `frs-01` | Cite 403/432 for `frs-01` and 404/438 only for `CI-02`, with the denominator distinction. |
| L27: six v3 patterns are explicitly not worth porting | `30` §3 contains D1–D10; `00` status rollup L150-158 contains 18 `not-worth-porting` rows | Unscoped count with no path or definition of “pattern” | Delete “six” or identify the exact six grouped patterns and their rows. |
| L29-30: nine hypotheses = four held + three corrected + two wrong | `30` §5 L119-130 has 10 rows including the leading recommendation; its verdict labels do not partition cleanly into 4/3/2 | Summary count does not describe the table | State “nine hypotheses plus one leading recommendation” and recount the verdict buckets. |
| L36: 39/39 folders identical in shape | `10` L50-56 and `11` L65-91: 39 persisted concepts share seven semantic roles, but contract folders and extras differ | “Seven-role core” was promoted to whole-folder identity | Say “39/39 persisted concepts share the seven-role core.” |
| L38: tables kebab 23/23 | `20` `dir:tables-flat-kebab-folder` L35: IAM 20 + Knowledge 21 = 41 `.table.ts` files | Count disagrees with the verified directory-family table | Replace 23/23 with 41/41. |
| L48-51: every other tier shipped one `Dummy.test.ts` | `24` `tests:placeholder-dummy-test` L23: 8/10 tiers; `10` TL;DR L14 says IAM has 5 dummy files among 6 tests; `11` §1 L19-23 shows Knowledge domain/server have real tests | Universal claim overstates an 8/10 habit | Replace “every other tier” with “8/10 tier packages.” |
| L89: `dir:server-topical-modules-no-suffix` supports 167/189 | `20` row L37 scopes its command to non-entity files below topical dirs and returns 95 single-segment + 3 suffixed; `11` TL;DR L11 gives 167/189 for the entire Knowledge server | The number is valid only from `11`, not from the cited family row | Cite `11` alone for 167/189 or use the row's 95/98 topical-module count. |
| L90: Knowledge `_check.ts` covered 12/19 models | `23` `CI-09` L27: 11 distinct of 19 Knowledge models | Stale count | Replace 12/19 with 11/19. |

No cited row id in `30` or `40` is nonexistent. Exact check:

```sh
awk 'NR==FNR { defs[$1]=1; next } !defs[$1] { print $1; missing++ } END { print "missing=" missing+0 }' \
  <(awk -F'|' '/^\| [0-9]+ \| `dir:/ { v=$3; gsub(/`| /,"",v); print v } /^\| (frs-|BN-|CI-|tests:|EL-)/ { v=$2; gsub(/`| /,"",v); print v }' explorations/v3-consistency-audit/synthesis/{20,21,22,23,24,25}*.md | sort -u) \
  <(rg -o '`(dir:[^`]+|frs-[0-9]+|BN-[0-9]+|CI-[0-9]+|tests:[^`]+|EL-[0-9]+)' explorations/v3-consistency-audit/synthesis/{30-assessment,40-recommendations-ranked}.md | sed 's/.*:`//' | sort -u)
```

Result: `missing=0`.

### S2 — `40-recommendations-ranked.md` has two wrong enumerations

| Recommendation claim | Verified family evidence | Problem | One-line fix |
| --- | --- | --- | --- |
| R1 L31-34 and unresolved table L300: 15 `server.ts`/`worker.ts` shims across 5 slices | `22` `BN-12` L30: 14 `server.ts` across 6/8 packages plus one `worker.ts`; `20` `dir:per-concept-entry-files` L32 gives the same six slice names | File total is right; slice total is wrong | Replace “5 slices” with “6 slices” in both places. |
| R11 L244-246: baseline 8 rows, followed by a seven-item path/name enumeration | `25` EL-16 L32: three law-practice exports (`CandorPolicyLive`, `LegalPositionRelatorPolicyLive`, `CandorRecordReaderFromRepository`) plus five ontology exports = 8 | The parenthetical omits `CandorRecordReaderFromRepository` and does not use the verified five ontology names | Copy the exact 3 + 5 enumeration from EL-16. |

Three migration estimates assert counts without a reproducible path census:

- R3 L73: “Cost ~35 renames.” `15` provides divergent template paths but no
  command that expands consumer/export-map renames to 35.
- R10 L223: “~55 renames.” EL-08 and EL-12 provide class/value counts, but no
  path-level selection showing which 55 names change under the proposed
  tier-sensitive rule.
- Dropped ideas L315: “~45 more packages.” No family row inventories the
  driver/foundation package set used by this estimate.

Command:

```sh
rg -n '~35 renames|~55 renames|~45 more packages' explorations/v3-consistency-audit/synthesis/40-recommendations-ranked.md
```

Result: 3 unsupported estimates at L73, L223, and L315.

One-line fix: replace each estimate with `find`/`rg` path output and a counted
list, or label it explicitly `UNMEASURED ESTIMATE` rather than evidence.

### S3 — R6's rollout count covers shape drift but omits completeness drift

R6 promises barrel presence, shape, completeness, and `exports ↔ folders`, but
its rollout at `40` L154 counts only 8 flat-only + 1 mixed + 1 named-only
barrels. `22` BN-02 L20 separately finds 16 missing kind barrels (29/45
present). Those missing barrels are part of R6's stated rule set and need
baseline rows.

Command/excerpt:

```sh
sed -n '137,156p' explorations/v3-consistency-audit/synthesis/40-recommendations-ranked.md
sed -n '18,22p' explorations/v3-consistency-audit/synthesis/22-family-barrel-namespace.md
```

Result: 10 shape-drift barrels named in rollout, 16 absent kind barrels omitted.

One-line fix: add the 16 missing-kind-barrel findings to the R6 rollout and
keep shape and presence as separate rule counts.

### S4 — Inventory files and final synthesis disagree on corrected counts

These are not harmless denominator differences; later verified family tables
explicitly corrected them:

| Earlier/final claim | Verified result | One-line fix |
| --- | --- | --- |
| `12-v4-doctrine-inventory.md` L13/L225: ~336 tier-correct suffixes; `13-v4-slices-census.md` L13/L65/L73: 331/432 | `21` frs-03 L23: 335/432 after recognizing four declared named-port implementations | Add a correction note to `12`/`13` and point readers to frs-03's final classifier. |
| `12` L16/L220/L252 and `13` L405: `$I` in 380 files | `23` CI-06/CI-07 L24-25 and verification: anchored declaration count 379; 380 included a JSDoc example | Replace 380 with 379 or label 380 as the rejected unanchored count. |
| `12` L14/L70/L222/L250 and `DECISIONS.md` L123-133: 21 kind : 9 bare : 3 flat | `20` row 4 L27: 20 kind-only + 1 mixed + 8 bare-only + 3 flat = 32 | Use the mutually exclusive 20/1/8/3 categories; do not count the mixed package twice. |
| `13` L13: 331 tier-correct while `BRIEF.md` L20-21 and `00` L163 use 335 | `21` frs-03: 335 | Make `13` explicitly historical/pre-verification or update its TL;DR. |
| `15` TL;DR L11 says 6 non-vocabulary suffixes but parenthetically lists `.repository`, `.use-cases`, `.http`, `.rpc`, `.tools`, `.client`, `.view-model` (7 names) | `15` §2 classifies some as globally known but wrong-tier and others absent from all vocabularies | Split “globally absent” from “tier-incorrect” and give each count. |

### S5 — A pre-align recommendation contradicts the locked decisions

`12-v4-doctrine-inventory.md` §7 L263-268 recommends leaving barrel shape and
test ratios ungated and postponing the suffix vocabulary. The final packet
instead chooses namespace barrels (`DECISIONS.md` L259-280), a test lens/twin
ratchet (L236-257), and a closed tier vocabulary (`BRIEF.md` L62-87). Because
`RESEARCH.md` tells readers to consult inventories for source evidence without
marking their recommendations superseded, both answers remain live on the
page.

Command/excerpt:

```sh
sed -n '259,268p' explorations/v3-consistency-audit/synthesis/12-v4-doctrine-inventory.md
sed -n '236,280p' explorations/v3-consistency-audit/DECISIONS.md
```

Result: 3 earlier enforcement recommendations are superseded by locked choices.

One-line fix: label `12` §7 “pre-align hypotheses, superseded by DECISIONS” and
link each changed item to its final decision.

### S6 — MAP cites a real file but a private capability

Every MAP capability path exists, but `MAP.md` L12 and R2 in `40` L46-52 say
the new Architecture command can import
`PackageTestImports.collectPackageSourceRoots`. The cited symbol is a
module-private `const`, not an export.

Commands:

```sh
test -e packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts
rg -n 'collectPackageSourceRoots' packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts
```

Result: path PASS; L118 is `const collectPackageSourceRoots = ...`, with no
`export` modifier.

One-line fix: recommend extracting/exporting a shared package-discovery helper,
and list that extraction as NET-NEW instead of claiming direct reuse.

## Nice-to-fix gaps

### N1 — Status labels are sometimes compressed past the packet vocabulary

`30` L65 says “codified, 92.2%,” although the packet's status definition makes
doctrine-backed adherence below 90% `codified-but-drifted` and the cited
92.2/93.3 measures are both above 90%. The label is valid, but pairing it with
the wrong row denominator makes it look like a threshold exception. Likewise,
the source family tables sometimes use compound prose such as “v4-only,
codified” while `00` collapses the status to `v4-only`.

One-line fix: give every summary claim exactly one vocabulary status and put
orthogonal facts such as “gated” or “95% conforming” in a separate field.

### N2 — Test-file denominators are not named consistently

`12` L7/L16/L26 says 170 test files, `13` L65/L71 says 171 files under test
(169 `*.test.*` plus 2 helpers), and `24` consistently uses 169 actual test
files. These can all be reconciled only by reconstructing the included file
types.

One-line fix: reserve `test files` for 169 `*.test.{ts,tsx}` and call 171
“TypeScript files under `test/`,” with the two helper paths named.

## Brief-task and hypothesis coverage

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Task 1: inventory every relevant v3 IAM/Knowledge convention | answered | `00` contains 105 rows across the six required families; source inventories `10` and `11` include directory, suffix, barrel, collocation, test, error, and Layer evidence. |
| Task 2: compare doctrine and actual v4 slices with statuses | answered, but stale source summaries need correction | `00` supplies one status per row and `20`–`25` supply doctrine + code commands; S4 lists the remaining cross-file count conflicts. |
| Task 3: likes/dislikes and current benefit | answered | `30` §§2–4 gives nine likes, ten dislikes, and seven v4 strengths, subject to S1's corrections. |
| Task 4: per-pattern enforcement recommendation | **not answered completely** | `40` L286-302 explicitly leaves seven rows undecided; B1. |
| Prior hypotheses validated rather than assumed | answered | `30` §5 addresses nine brief hypotheses and separately pressure-tests the leading auditor proposal, but its summary count should be corrected. |
| PascalCase decision preserved | answered | `DECISIONS.md` L8-20 and `30` L127 preserve PascalCase; no recommendation restores v3 kebab concepts. |
| v4 boundaries win | answered | `30` §§3–4 rejects wildcard exports, domain-owned ports, same-file contracts/Layers, and transport-coupled errors. |

## Standards-scope check

No file in this exploration packet edits `standards/`, and no recommendation
claims such an edit occurs inside this packet. The apparent proposals are all
explicitly follow-up prerequisites:

- `BRIEF.md` L141-150 lists doctrine amendments as P0 of the future audit
  packet, and L192-193 says no `standards/` edits occur here.
- `MAP.md` L17-34 schedules a future amendments PR and baseline PR.
- `40` L5-8 says decisions are recorded in standards “by the follow-up, not
  here”; L35 assigns the amendments PR to `slice-topology-audit`.

Command:

```sh
rg -n 'No `standards/` edits|Doctrine amendments|amendments PR|by the follow-up, not here' \
  explorations/v3-consistency-audit/{BRIEF,MAP}.md \
  explorations/v3-consistency-audit/synthesis/40-recommendations-ranked.md
```

Result: all standards changes are listed as follow-up prerequisites, which is
within the brief's allowed scope.

## MAP capability-path audit

Every filesystem capability path cited in `MAP.md` exists after resolving its
CLI-relative shorthand against
`packages/tooling/tool/cli/src/commands/`. The exact `test -e` loop returned
13 PASS / 0 FAIL for:

1. `packages/tooling/tool/cli/src/commands/Architecture/Architecture.schemas.ts`
2. `packages/tooling/tool/cli/src/commands/Architecture/Architecture.command.ts`
3. `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`
4. `packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts`
5. `packages/tooling/tool/cli/src/commands/Lint/SchemaTopology.ts`
6. `packages/foundation/modeling/schema/src/LiteralKit/`
7. `packages/tooling/tool/cli/src/commands/Ci/`
8. `standards/coverage.regression-baseline.jsonc`
9. `package.json`
10. `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
11. `packages/tooling/tool/cli/src/commands/Architecture/internal/TemplateRetarget.ts`
12. `packages/architecture-lab/`
13. `goals/canonical-slice-factory/`

The symbol check also found `collectTypeScriptFiles` exported from
`Lint.command.ts` and `ArchitectureWriterKind` exported from
`Architecture.schemas.ts`; only `collectPackageSourceRoots` has the visibility
problem recorded in S6.

## Ranked closeout

1. **Blocking:** resolve the seven undecided rows and give each a terminal
   enforcement disposition — fix B1.
2. **Blocking:** replace the ambiguous “exactly nine findings” acceptance test
   with a path-level inventory — fix B2.
3. **Blocking:** decide or explicitly defer the proof's client/UI roles before
   presenting R3 as executable — fix B3.
4. **Should-fix:** correct all assessment/ranking numbers in S1–S2.
5. **Should-fix:** include absent barrels in R6 and make the private walker
   extraction explicit — fix S3 and S6.
6. **Should-fix:** mark stale inventory recommendations/counts as superseded —
   fix S4–S5.
7. **Nice:** normalize status and test-count terminology — fix N1–N2.
