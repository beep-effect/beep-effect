# Graphnosis → beep-effect mapping proof

Territory: **error classification, tests, benchmarks & evidence**
Repo under test: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean)
Source: `/home/elpresidank/YeeBois/dev/Graphnosis`
Mining note: `../graphnosis/survey-proof.md`
Date: 2026-08-06

Everything below was executed live in the beep-effect checkout. Where I claim absence,
the exact command is quoted with its (empty) result.

---

## 0. Structural facts established first (they change several verdicts)

### 0.1 Nothing in beep-effect is published to npm

```
$ python3 (walk all package.json, skip node_modules/.git)
total 179 publishable 34
```

All 34 publishable manifests live under `./.repos/effect/**` — the **vendored Effect v4
clone**, not beep code. Every one of the 125 `@beep/*` packages is `private: true`
(verified directly on `packages/foundation/modeling/schema/package.json` → `'private': True`).
`changeset publish` in the `release` script therefore skips them all.

Consequence: gai-05 (packaged-artifact verifier) and gai-14 (npm publish gate ordering)
lose most of their blast radius. The shipped artifact that *does* exist is the Tauri
desktop bundle.

### 0.2 …but `publishConfig.exports` → `dist/` exists and is completely unproven

`@beep/schema`'s `exports` map points at `./src/*.ts`; its `publishConfig.exports` map
points at `./dist/*.js`. That second map is the artifact map.

```
$ rg -n 'from "@beep/[a-z-]*/dist' -g '!**/node_modules/**' packages apps
[no matches]
```

Nothing imports `dist/`. The only assertion about the dist map anywhere is a string
comparison in a generator test:

```
packages/tooling/tool/cli/test/architecture-operation-plan.test.ts:670
  expect(parsedPackageJson.publishConfig?.exports?.["."]).toBe("./dist/index.js")
```

— it checks that the generator *wrote the string*, never that the path resolves.
This is Graphnosis's exact blind spot, structurally present.

And the lane that would catch it is not required:

```
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:450-457
  id: "build", contextName: "Build", required: false, notes: "Push-only in hosted CI."
```

### 0.3 rg flag hazard hit during this session (friction receipt)

I ran `rg -rn "npm pack|..."` intending `-n`. `rg` parsed it as `-r n`
(**--replace n**), silently substituting every match with the letter `n`. The output
looked like real hits with mangled words (`package` → `nage`, `accuracy` → `n`), and I
nearly recorded a false result. Re-ran as `rg -n --no-heading`. Anyone scripting proof
searches must never write `-rn`.

---

## 1. gai-01 — error CLASS above error code

### Bricks found (all read live)

**The principle is already stated verbatim, per-module:**

```
packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.errors.ts:1-14
  "Conflict is deliberately ONE error rather than three, because the lock loser, the
   stale caller, and the writer the database backstop caught are indistinguishable to
   the caller — all three must re-read the head and decide again."
```

That is gai-01's axis ("not *which* error but *what do I do about it*") applied to
collapse three codes into one. It is reasoning in one module's header, not a repo axis.

**A frozen recovery-action classification does exist — in the tooling domain:**

```
packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts:158
  export const QualityIssueAttribution = LiteralKit(["introduced","inherited-adjacent","not-applicable"])
```

```
packages/tooling/tool/cli/src/internal/process/StepExec.ts:170-192
  "Flake-quarantine policy a quality step may opt into."
  "Named environment-only failure signature a quality step may quarantine on."
```

The flake-quarantine policy is structurally the *same* insight as version-skew-vs-corruption:
only a named environment-only signature may be quarantined; a real failure never may.

**And a genuine data-loss guard already exists, with the reasoning written down:**

```
apps/professional-desktop/src/runtime/Pglite.ts:201-206
  "...stores that fail the probe are left untouched and fail boot with a recovery log.
   Populated directories that do not look like PGlite are moved aside with a timestamped
   backup before a fresh data dir is created. ... Unreadable directories fail boot
   instead of being quarantined."
```

```
apps/professional-desktop/src/runtime/Pglite.ts:104
  recovery: S.String.annotateKey({ description: "Operator guidance for safely recovering the incompatible data." })
```

**A per-domain severity axis exists in the interop layer:**

```
packages/foundation/modeling/pandoc-ast/src/Pandoc.report.ts:64
  export const PandocMappingSeverity = LiteralKit(["lossy", "unsupported"])
```

### What is missing

1. `recovery` as an error field exists **exactly once** in the whole repo:

```
$ rg -n "recovery: S\.|recovery:" -g '!**/node_modules/**' packages apps --type ts | grep -v "/test/"
apps/professional-desktop/src/runtime/Pglite.ts:104   recovery: S.String…
apps/professional-desktop/src/runtime/Pglite.ts:174   recovery: "manual_export_or_reset_required"
apps/professional-desktop/src/runtime/Pglite.ts:184   recovery: ChatDbIncompatibleRecoveryMessage
(+2 unrelated prose hits in comments)
```

App-local, free-form `S.String`, not a bounded literal domain, not shared.

2. **No repo-wide code→recovery-class table** and no `isCorruption` / `isVersionSkew`
   equivalents. Search:

```
$ rg -n "quarantine|FailureClass|ErrorKind|ErrorCategory|errorClass|failureClass|codeClass" \
    --type ts -g '!**/node_modules/**' packages apps tools scripts
```
returns only: law-practice `PatentCitationQuarantine` (a *domain* observation marker,
`packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:212-282`),
the Pglite dir logic, the CLI flake-quarantine, and `WinkObservability.ts:272`
`errorClassification` (driver-local). No cross-package axis.

3. **Version skew is the specific unguarded case, and beep is exposed.**

```
packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts:36
  export const PandocApiVersion = S.NonEmptyArray(S.Int.check(S.isGreaterThanOrEqualTo(0)))
```
Any non-negative int tuple decodes. No policy for "this document came from a newer pandoc".

Persisted-artifact version literals across the repo — `"beep.qa.provenance.v1"`
(`packages/tooling/library/qa-capture/src/QaCapture.models.ts:596`), `qa-inventory/v1`,
`"yeet-flake-quarantine/v1"` (`packages/tooling/tool/cli/test/flake-quarantine.test.ts:184`),
`DocgenProofManifestSchemaVersion = LiteralKit(["1"])`
(`packages/tooling/tool/docgen/src/ProofManifest.ts:72`) — are `S.Literal`. An artifact
written by a **newer** beep decodes-fails **identically** to a malformed one. Every
consumer therefore treats "you are old" and "this is broken" the same way.

**Verdict: `partial`.** Value 4, effort M.

---

## 2. gai-02 — one error class carrying a string code

Effect v4's tagged errors *are* the string-discriminant design, and beep goes further:
errors are Schema classes, so they encode/decode across RPC/IPC by construction.

```
packages/foundation/modeling/schema/src/TaggedErrorClass/TaggedErrorClass.errors.ts
packages/foundation/modeling/schema/src/CauseTaggedError/CauseTaggedError.errors.ts
packages/foundation/modeling/schema/src/StatusCauseTaggedErrorClass/StatusCauseTaggedErrorClass.errors.ts
  (all three exported from packages/foundation/modeling/schema/src/index.ts)
```

Prototype-identity branching is essentially absent:

```
$ rg -n "instanceof [A-Z][A-Za-z]*Error" -g '!**/node_modules/**' packages apps --type ts
packages/drivers/gov-legal-mcp/src/ToolNames.ts:268   (inside a JSDoc @example)
packages/foundation/modeling/identity/src/Id.ts:126   (inside a JSDoc @example)
```

Two hits, both documentation examples. Branching goes through `Effect.catchTag` /
`Match.tag` / `_tag`.

**Verdict: `already-have`.** Value 1 — the only transferable residue is the written
*rationale* (duplicated module instances, esbuild inlining, JSON-RPC boundaries), which
would be one useful paragraph in `standards/` explaining why `_tag` is not just style.

---

## 3. gai-03 — frozen strings as a compatibility surface + negative-word test

beep freezes a different surface: **schema literal domains and export names**, not
message prose.

```
packages/tooling/tool/cli/src/commands/Lint/SchemaTopology.ts:23-26
  const LEGACY_TOPICAL_SEGMENTS = ["blockchain","color","csv","dom","http","location","person"]
  const LEGACY_CASE_EXPORT_PREFIXES = ["ExpectCT","XSSProtection"]
  const RETIRED_SUITE_EXPORT_PREFIXES = ["Blockchain","Dom","Http","Location","Person"]
  const RETIRED_INTERNAL_EXPORT_KEYS = ["./internal/markdown","./internal/yaml"]
```

That is a *negative* constraint pinned by a lint law — "these names may not come back" —
structurally the same move as Graphnosis's forbidden `signature` word.

Plus generated-surface ratchets: `standards/schema-catalog.generated.jsonc`
(`beep lint schema-catalog --write`, header at `Lint/SchemaCatalog.ts:32-35`),
`standards/jsdoc-documentation.inventory.jsonc`, `standards/effect-laws.allowlist.jsonc`.

Missing: no message text is frozen anywhere —

```
$ rg -ni "do not reword|frozen message|message is frozen|load-bearing string|do not change this string" \
    -g '!**/node_modules/**' packages apps standards
[no matches on message freezing; only unrelated "wire compatibility" prose]
```

But that is largely correct for beep: consumers decode typed errors, not substrings.
The genuinely transferable residue is the **technique**: extract only *reachable* string
literals when a law scans source (so comments are exempt), and pair every scan with a
non-vacuity count. That collapses into gai-04.

**Verdict: `partial`.** Value 2, effort S.

---

## 4. gai-04 — non-vacuity clauses + recorded mutation results  ← highest value

### The ritual exists once, at system level, and it is excellent

```
goals/recorded-qa-acceptance/README.md (header)
  "The system is not 'accepted' because it ran — only because it demonstrably detects
   the defect class it was built for."
  | Falsification | Revert patch of the Sash preventDefault hunk pre-saved in
    ops/falsification/; round-F runs provenance-flagged (falsification: true, scenario
    prefix falsification:), doubled strip density |
```

That is Graphnosis's mutation discipline, promoted to a campaign exit criterion.

### Individual instances exist, and are rare

```
packages/ontology/server/test/OntologyPublishTools.test.ts:106
  "The sibling of the test above, and the reason it is not vacuous: if the …"
packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts:391
  describe("knowledge semantic-delta negative controls", …)
apps/professional-desktop/test/integration/execution-authority.pglite.test.ts:102-103,302
  workspace canary + "pins exact ledger columns and stores no reachable publish-body canary"
packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts:253
  "…with every content-bearing key filled with the canary."
packages/tooling/tool/cli/test/yeet.test.ts:1718-1749  (clipboard-canary escape proof)
```

### Measured density

```
$ rg --files -g 'packages/**/test/**/*.test.ts*' -g 'apps/**/test/**/*.test.ts*' | wc -l
641
$ rg -li "not vacuous|vacuous|positive control|negative control|canary" \
    -g 'packages/**/test/**/*.test.ts*' -g 'apps/**/test/**/*.test.ts*' | wc -l
8
$ rg -l "Measured:|measured:" -g 'packages/**/test/**' -g 'apps/**/test/**' | wc -l
1
```

**8 of 641** test files carry any control/non-vacuity language. **1** records a measured
mutation result.

### Why this matters specifically here

Auto-memory already carries `vacuous-test-pattern` and `vacuous-effect-fn-test-body`
(`it(name, Effect.fnUntraced)` never runs — use `it.effect`) as *recurring* failure
classes, and `stale-artifact-false-greens` as another. beep has diagnosed the disease
repeatedly and has no mechanism: there is no lint rule for it —

```
$ ls packages/tooling/policy-pack/lint-rules/src/rules/
namespace-node-imports.ts  no-global-process-runtime.ts  no-inline-schema-compile.ts
no-js-extension-imports.ts no-manual-effect-runtime-in-tests.ts no-opaque-instance-fields.ts
```

— and no mutation tooling:

```
$ rg -ni "mutation test|stryker|mutant|neutralis|neutraliz" -g '!**/node_modules/**' -l .
(only goals/*/research prose and unrelated Md.escape.ts hits — no tooling)
```

Also note every repo *law* is a source scan (`Laws/FrozenGrantSet.ts`, `Laws/EffectFn.ts`,
`Laws/TerseEffect.ts`, `Lint/SchemaCatalog.ts` …) and none of them asserts its scan
matched anything — the exact vacuity hole Graphnosis closes with one extra `check()`.

**Verdict: `partial`.** Value 5, effort M.

---

## 5. gai-05 — packaged-artifact verifier

```
$ rg -n --no-heading "npm pack|bun pm pack|publint|arethetypeswrong|verify:package|verify-package" \
    -g '!**/node_modules/**' -g '!bun.lock' . | grep -v "^./goals/\|^./explorations/\|^./scratchpad/"
(only prose hits: "npm package names" in packages/tooling/library/repo-utils/src/schemas/PackageJson.ts)
```

`bun run pkg:verify` exists but is **not** this — it runs each package's own
`beep:lint` / `beep:check` / `beep:test` scripts:

```
packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:26
  const VERIFY_STEP_NAMES = ["lint", "check", "test"] as const
```

The real brick is the desktop release path, which *does* verify a staged artifact
before the irreversible step — see §14.

Given §0.1/§0.2, the gap is real but its consequence is currently confined to a
`required: false` build lane and a `publishConfig.exports` map that has never resolved.
The transferable piece with immediate value is the **positive control / canary**
(`scripts/verify-package.mjs:127-140`, "a guard reported without its mutation is
unproven"), which is the same ask as gai-04.

**Verdict: `partial`.** Value 2, effort M.

---

## 6. gai-06 — adversarial fixture construction

### Already practiced, and named in beep's own words

```
goals/recorded-qa-acceptance/README.md (Falsification pass bar row, AMENDED 2026-08-01)
  "…the selection-smear revert nonetheless does NOT reproduce on the current stories even
   with defenses stripped, because the FIXTURES cannot express it: story tabs carry
   user-select: none independently of preventDefault, and the sash sits in an 8px
   text-free gap. This is a fixture-realism gap, not a lane gap — a smear-capable fixture
   (plain selectable tab label over text-dense panel) is the remaining work."
```

```
packages/foundation/modeling/pandoc-ast/test/fixtures/PROVENANCE.md
  "gap-docx-styles.pandoc.json is a hand-minimized DOCX-origin stand-in…"
  "…these fixtures should either be replaced by generated fixtures with recorded command
   provenance or kept as small invariant smoke fixtures beside generated samples."
```

Determinism-of-randomized-guards is already law:

```
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:588,597
  const DEFAULT_PROPERTY_LANE_RUNS = "400"
  const DEFAULT_PROPERTY_LANE_SEED = "20260708"
```

### The identity blind spot is NOT covered, and beep is exposed

```
$ rg -n 'Id.make\("' -g 'packages/epistemic/**/test/**' -g 'packages/documents/**/test/**'
packages/documents/server/test/VaultSyncReviewRegressions.test.ts:288  RemoteItemId.make("fx-under-root")
packages/documents/server/test/VaultSyncDrift.test.ts:86               RemoteItemId.make("fx-9999")
… (hand-authored `fx-*` ids throughout)
```

Nothing asserts a fixture's id-space is disjoint from production-minted ids, nothing
compares evidence **by content** when ids are expected to differ, and nothing tests a
tie-break comparator directly. beep's epistemic stack keys ordering and dedup on
`EntityId`s and content digests (`dedupeBySha256`,
`packages/tooling/tool/cli/src/internal/cli/FsGuards.ts:136`), and bitemporal edge
authority chooses "the version a supersession replaces … among the rows the transaction
locked" (`packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:158-159`) —
precisely the shape where a hand-authored-id fixture proves nothing.

**Verdict: `partial`.** Value 4, effort M.

---

## 7. gai-07 — an evidence bundle that verifies itself

### The brick is real and close

```
packages/tooling/tool/cli/src/commands/Qa/JudgeLint.ts:1-11
  "Ingest validates once, at write time. Lint re-runs the same schema decode and round
   cross-check against the file that is actually committed, which is what catches an
   inventory edited by hand, carried into a goal packet, or left behind after its
   evidence was pruned."
JudgeLint.ts:70-73
  "A copied inventory can pass another round's cross-check (seqs restart per round,
   frame names repeat), so round coherence is checked explicitly."
JudgeLint.ts:76  crossCheckAgainstRound(layout, inventory, eventLog)
```

So: schema re-decode (`qa-inventory/v1`), round-coherence, and every finding
cross-checked against the round's artifacts and `events.ndjson`. That is a
self-verifying evidence bundle.

### Missing, in order of cost

1. **It gates nothing.**

```
$ rg -n "judge-lint" -g '!**/node_modules/**' .github lefthook.yml \
     packages/tooling/tool/cli/src/commands/Ci packages/tooling/tool/cli/src/commands/Yeet
[no matches]
```
Exactly Graphnosis antipattern A3: the best artifact in the territory runs only when a
human remembers.

2. **No content hashing of the evidence files.**

```
$ rg -n "checksums" -g '!**/node_modules/**' packages/tooling apps .github
[no matches]
```

3. **No prose-to-data binding.** Goal packet READMEs and ledgers quote numbers
(`requiredCount: 0`, "five real defects", coverage percentages) that nothing recomputes.
This is where Graphnosis's `+11.8` vs `78.00−64.60=13.40` bug lives.

4. **No delta-pairing discipline** (every asserted difference declaring its two arms).

**Verdict: `partial`.** Value 4, effort M.

---

## 8. gai-08 — provenance grading + retroactive reproducibility flag

### beep has a *typed* version of `command_provenance` — for CI lanes

```
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:51
  export const CI_LANE_CLASS_VALUES = ["cli-runnable","workflow-gated","ci-native"]
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:104
  export const CI_LANE_REPLAY_VALUES = ["exact","approximate","none"]
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:294-307
  class CiLaneDescriptor { id, contextName, required, laneClass, replay, flags, notes }
CiLane.ts:330-338 (example)
  id: "pr-size", laneClass: "ci-native", replay: "none",
  notes: "Inline github-script API labeling; PR-only; no local replay."
```

An honesty grade for "does this local command reproduce that hosted lane", schema-first
and frozen. Stronger than Graphnosis's prose grades.

### Missing

- The grade is on **lanes**, not on **recorded runs**. `BenchmarkRun`
  (`packages/tooling/library/ai-metrics/src/models.ts:654-668`) carries
  `benchmarkCaseId / benchmarkRunId / configSnapshotId / elapsedMs / passed /
  qualityGate / recordedAtEpochMillis` — **no command, no argv, no provenance grade**.
  There is no way to ask of a stored number "how sure are we this is the invocation that
  produced it".
- **No comparability boundary when a default changes.** beep changes measurement-affecting
  defaults constantly (`DEFAULT_PROPERTY_LANE_RUNS`/`SEED`, coverage baselines,
  `@effect/tsgo` pins). Nothing ships a flag that restores prior semantics so archived
  numbers stay reproducible, and nothing marks "numbers before this line are not
  comparable".

**Verdict: `partial`.** Value 4, effort M.

---

## 9. gai-09 — refusing to quote a headline the code cannot support

### beep publishes no external metrics

```
$ rg -n "LongMemEval|accuracy|pass@|recall@|badge" README.md
3: [![Ask DeepWiki](…)]
4: [![Greptile: The War on Bugs](…)]
```
Two vanity badges. Zero performance claims.

### But the *mechanism* already exists internally, and is good

```
packages/tooling/library/ai-metrics/src/scorecard.ts:33-40
  const AiMetricsCoverageGap = LiteralKit([
    "no_tasks","no_labels","no_benchmark_runs",
    "scorecard_completion_credit_blocked",
    "model_call_metrics_unavailable_not_scored",
    "tool_invocation_metrics_unavailable_not_scored",
    "cost_metrics_unavailable_not_scored",
  ])
packages/tooling/library/ai-metrics/src/models.ts:697-720
  class Scorecard { …, completionReady, coverageGaps, … }
```

`*_unavailable_not_scored` is exactly "do not credit a number the inputs cannot support",
mechanized — and stricter than a grey badge, because it travels in the data.

Packet-level staleness/correction convention also exists:
`goals/one-round-loop/README.md` "Closeout reconciliation (2026-07-11)" and
`goals/recorded-qa-acceptance/README.md` "AMENDED 2026-08-01" rows are in-place
corrections with the reasoning, not silent edits. And
`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:1-14` lists **staleness** among
its advisory findings.

Missing: no staleness banner on historical evidence logs, and no
"this is the top of a distribution, not a level" framing anywhere.

**Verdict: `partial`.** Value 2, effort S.

---

## 10. gai-10 — the instrument identifies, defines and unit-tests itself

### Half of it is already shipped, and shipped better

```
packages/tooling/library/qa-capture/src/QaCapture.models.ts:540-621
  class CaptureProvenance {
    actionSeq, capturedAtEpochMs, clockOffsetMs, commitSha, scenarioName,
    schemaVersion: S.Literal("beep.qa.provenance.v1"), sessionId, sourceVideo, toolVersions
  }
  "This is the single schema encoded into each artifact's native metadata channel — the
   XMP-beepQA namespace for PNG/JPEG/GIF via exiftool, and container tags for
   webm/mkv/mp4 via ffmpeg remuxing."
```

Provenance travels *inside* the artifact, schema-validated. Graphnosis puts it in a
sidecar JSON.

```
packages/tooling/tool/docgen/src/ProofManifest.ts:389-394
  const inputSha256 = sha256Json(options.inputs)
  const outputSha256 = sha256Json(options.outputs)
  … sha256: sha256Json({ inputSha256, outputSha256, toolVersion })
```

### Missing

1. **The harness never hashes its own source.** `toolVersions` is a version map; a
   changed extractor at the same version produces provenance-identical artifacts.
   No `instrumentSourceSha256` equivalent anywhere:
   `rg -n "instrument" packages/tooling/library/{ai-metrics,qa-capture}/src` → nothing.
2. **No `definitions` block travelling with the numbers.** `AiMetricsCoverageGap` says
   *what was not scored*; nothing says *what the score means* inside the artifact.
3. **No `--self-test`** of the metric/scoring functions independent of the system under
   test. `beep qa judge-lint` validates evidence; nothing validates the scorer.
4. **No instrument-mismatch warning** when two artifacts from different revisions are
   compared.

**Verdict: `partial`.** Value 4, effort M.

---

## 11. gai-11 — ablation as CI gate + faithfulness check on the reference impl

### The faithfulness half is `already-have` and mechanized

```
apps/architecture-lab-proof/AGENTS.md:6-10
  "PROOF ORACLE: this file is part of the architecture-lab accepted oracle —
   `beep architecture` generation replays this tree byte-for-byte and the
   operation-plan tests compare against it."
packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts
packages/tooling/tool/docgen/test/SchemaParity.test.ts
packages/law-practice/use-cases/test/SchemaParity.test.ts
apps/professional-desktop/test/schema-parity.test.ts
```

A reference implementation kept beside production code, with a byte-for-byte
faithfulness assertion — exactly the lesson, already enforced.

### The ablation half is absent

```
$ rg -ni "ablation|control arm|counterfactual" -g '!**/node_modules/**' packages apps .github
[no matches]
```

No experiment-as-regression-gate exists. Places it would pay: hybrid retrieval fusion
ranking, contradiction-triage ordering, seed/budget selection — anywhere a scoring rule
could be silently replaced by a worse one and every test still pass.

**Verdict: `partial`.** Value 3, effort M.

---

## 12. gai-12 — conformance fixtures shipped for second implementations; refusal is the contract

Positive-path oracles exist (§11) and the schema surface is published
(`standards/schema-catalog.generated.jsonc`, generated by `beep lint schema-catalog --write`).

But **no fixture is malformed on purpose**, and no test asserts a refusal's *code*:

```
$ ls packages/foundation/modeling/pandoc-ast/test/fixtures/
gap-docx-styles.pandoc.json  green-core.pandoc.json  PROVENANCE.md
```
Both are valid documents. `gap-*` means "exercises a lossy mapping", not "must be refused".

Density of blind refusal assertions (the Graphnosis A1 antipattern) in beep:

```
$ rg -l "rejects|toThrow" -g 'packages/**/test/**/*.test.ts' -g 'apps/**/test/**/*.test.ts' | wc -l
216
$ rg -c "_tag" -g 'packages/**/test/**/*.test.ts' -g 'apps/**/test/**/*.test.ts' | wc -l
175
```
Not a clean partition, but 216 files assert *that* something failed while only 175 files
mention `_tag` at all — beep has the typed-error vocabulary to assert *why* and does not
consistently use it at decode boundaries. Given §1 (version skew and corruption decode-fail
identically), asserting only "it failed" is the exact hole.

**Verdict: `partial`.** Value 3, effort M.

---

## 13. gai-13 — refusal design: validator returns the error; reserved sentinel below the floor

### Batch atomicity: `not-applicable` — beep has the stronger tool

```
packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:4
  "Every write here is one database transaction, and the transaction boundary is …"
EdgeAuthority.repo.ts:393
  "record and supersede each run one serialized FOR UPDATE transaction that closes …"
EdgeAuthority.repo.ts:440,473  .transaction(…)
packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:743-748
```

Graphnosis's `refusalFor` returns-instead-of-throws trick buys all-or-nothing semantics
*without* transaction machinery. beep-effect has real serialized SQL transactions. Porting
the trick to the server path would be a downgrade.

### Separable transferable parts

**(a) Errors that name the fix — already practiced:**
```
packages/tooling/tool/cli/src/commands/Qa/JudgeLint.ts:62
  `qa judge-lint could not read ${inventoryPath}; run \`bun run beep qa judge-ingest
   --round ${options.round} --from <file>\` first.`
apps/professional-desktop/src/runtime/Pglite.ts:184  recovery: ChatDbIncompatibleRecoveryMessage
```

**(b) Refuse-don't-clamp — beep does the opposite at one decode boundary:**
```
packages/foundation/ui-system/editor/src/chat/attachment-model.ts:129-143
  const clampAttachmentCaptureLimitBytes = flow(…, N.clamp({ minimum: 0, maximum: DEFAULT_MAX_ATTACHMENT_BYTES }))
  … decode: clampAttachmentCaptureLimitBytes
  description: "A composer attachment capture limit clamped to the supported byte range."
```
A decoder that silently clamps out-of-range input into something plausible. This is the
exact pattern Graphnosis refuses ("NaN is refused, not clamped into something plausible").
Low stakes here (a UI byte budget) — but it is the precedent, and the reasoning is worth
writing down before it lands on a confidence or score field.

**(c) Reserved sentinel below the legal floor:** no equivalent found —
`rg -ni "sentinel|tombstone|reserved value" packages --type ts | grep -v /test/` returns
nothing structural, and `rg "deletedAt|softDelete|tombstone"` over
`packages/foundation/modeling/schema/src/EntitySchema` returns nothing. `goals/domain-kernel-hardening`
names soft-delete as its mission and is `paused`, so the ordering invariant
(`RETIRED < MIN`, asserted as a test on the constants, not on behaviour) is a
ready-to-use design input for when it resumes.

**Verdict: `partial`.** Value 3, effort S.

---

## 14. gai-14 — CI = exactly the release chain; irreversible gate last

### The desktop release path is already stronger than Graphnosis's

```
.github/workflows/release-desktop.yml:60-79
  job release-desktop-preflight "Validate desktop release inputs":
    - tag must match ^professional-desktop-v.+$
    - `gh api …/git/ref/tags/$TAG` must resolve  → "Push the tag before running this workflow."
release-desktop.yml:151  "Validate updater signing secret"
release-desktop.yml:374-388  "Verify every desktop target completed" (cancelled/failed ⇒ keep draft unpublished)
release-desktop.yml:397-440  "Stage and verify draft release assets":
    manifest count == matrix target count; diff expected vs actual targets;
    duplicate asset names rejected; duplicate updater platform keys rejected
```

The release is staged as a **draft** and never auto-published — a strictly safer
placement of the irreversible step than "gate immediately before `npm publish`".

```
.github/workflows/release.yml:105-108  publish job requires workflow_dispatch AND inputs.confirm_publish == 'PUBLISH'
.github/workflows/release.yml:110-112  environment: release-publish  (reviewer-gated)
.github/workflows/release.yml:52       "Validate changeset package graph": bun run beep quality changeset-graph
```

### The one real gap: CI does not run the release chain

```
$ rg -n "audit:full|audit github|bun run release" .github
.github/workflows/release.yml:139   run: bun run release
```

`bun run release` = `bun run build && bun run test && bun run lint && bun run audit:full
&& changeset publish` (root `package.json`). It appears **only** inside the manual
publish job. On PRs, CI runs `beep ci lane <id>` lanes — a different chain — and
`audit:full` runs in no PR workflow at all. So the release path still has a segment whose
first execution is at release time. Plus `build` is `required: false`
(`CiLane.ts:450-457`).

**Verdict: `partial`.** Value 3, effort S.

---

## 15. Antipatterns — does beep risk the same mistakes?

| Graphnosis antipattern | beep risk | evidence |
|---|---|---|
| A1 conformance asserts *that* it threw, never *why* | **yes** | 216 test files use `rejects`/`toThrow`; version-skew and corruption decode-fail identically (§1, §12) |
| A2 half the format untested by fixtures | **yes, mildly** | 2 pandoc fixtures, both valid; no malformed/refusal fixtures (§12) |
| A3 the self-verifying bundle is verified by nobody | **yes, exactly** | `judge-lint` in no workflow and no hook (§7) |
| A4 tests never typechecked | **no** | `beep lint package-test-typecheck` + `Lint/PackageTestTypecheck.ts`, and `test-tsgo` in `beep:preflight`; memory `effect-lsp-enforced-on-test-files` |
| A5 doc drift where no checker exists | **yes** | numbers in goal READMEs/ledgers are unchecked (§7.3); `goals doctor` checks manifest↔README *status* drift only, and staleness is advisory |
| A6 serial `&&` runner, one red hides the rest | **no** | turbo lanes with `--summarize`, `beep ci append-turbo-summary`, ratchet baselines |

---

## 16. Landing packets used

| id | packet | why |
|---|---|---|
| gai-01 | `explorations/graphnosis-prior-art` | cross-cutting design decision; must be shaped before it becomes a schema |
| gai-02 | NONE | already the repo's native pattern; nothing to build |
| gai-03 | `explorations/graphnosis-prior-art` | folds into the law-scan non-vacuity ask |
| gai-04 | `explorations/graphnosis-prior-art` | the packet's highest-value carry; graduates to a lint-rule + law change |
| gai-05 | `explorations/graphnosis-prior-art` | only worth doing as the canary/positive-control half |
| gai-06 | `goals/recorded-qa-acceptance` | that packet already named the fixture-realism gap and deferred it |
| gai-07 | `goals/coding-agent-effectiveness-evidence-loop` | active; mission is literally trustworthy schema-first evidence |
| gai-08 | `goals/coding-agent-effectiveness-evidence-loop` | run-level provenance grading belongs with the flight records |
| gai-09 | `goals/ai-metrics-stack` | owns `Scorecard` / coverage-gap semantics |
| gai-10 | `goals/coding-agent-effectiveness-evidence-loop` | instrument self-identification + self-test |
| gai-11 | `goals/hybrid-retrieval-fusion-core` | the one place a scoring ablation gate would pay |
| gai-12 | `explorations/docx-roundtrip-interop` | pandoc/docx is beep's only real format-reader boundary |
| gai-13 | `goals/domain-kernel-hardening` | paused, owns soft-delete + `.errors.ts` convention |
| gai-14 | `goals/one-round-loop` | owns CI-lane parity (`research/ci-lane-parity.md`, cited by `CiLane.ts:315`) |

All 14 packet paths verified present by
`ls explorations goals` at the top of the session.
