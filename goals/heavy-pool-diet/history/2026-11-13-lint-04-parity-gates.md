# LINT-04 residual: per-family parity gates, 2026-11-13

PLAN slice 4b. #3019 (027664ba178) rewrote five checker families and asserted byte-for-byte
output in its PR body, but committed none of the per-family gate items. This file records what
was run for each family, the numbers, and the committed test that pins it. No checker's output
changed. The only production edit is S2's pre-filter, which is now generated from the rows.

## Method

The pre-#3019 side of each comparison is the current source with #3019's hunks for that family
reverse-applied (`git show 027664ba178 -- <file> | git apply -R`). The result was copied into a
scratch directory under `~/.cache/beep/` with relative imports rewritten to absolute paths, and
both sides ran over the same input. Reverse-applying keeps every later change (#3041, #3114), so
the diff isolates #3019. Where a later commit touched the same file, the literal
`027664ba178^` and `027664ba178` versions were also compared with each other. Scratch drivers
were never committed.

The S4 and P12 whole-repo runs on 2026-11-13 ran without a memory cap. After the orchestrator
stopped an unbounded P12 run (below), every later heavy run used
`systemd-run --user --scope -p MemoryMax=8G -p MemorySwapMax=0`, started only when the 1-minute
load average was under 8 and more than 16 GiB was available, one at a time.

## S2 retired-iri: pre-filter generated from the rows

- **Change:** the hand-written `/beep(?:-effect)?\.(?:dev|sh)/iu` is replaced by
  `retiredIriAuthorityPrefilter = new RegExp(RETIRED_HOSTS, "iu")`. `RETIRED_HOSTS` is the
  alternation of the escaped row hosts that rule 1 already uses, so the rows are the one source
  for both patterns. The pre-filter is a necessary condition of rule 1 under the same flags, so
  its findings cannot change. `bun run beep lint policy-fingerprint` reports `current` (no new
  module edge, no reseal).
- **Repo run:** 39,887 tracked files (38,224 text). Rule-1 matches with no pre-filter, and
  behind each of the three pre-filters (generated, #3019's hand-written, and the pre-#3019
  `/beep/iu` substring): **50,603** each, sorted-findings sha256
  `d9b8f1069222d37db83659bc3c9d21ae30505065c4c13902e4df508112f17a8d` each. Files admitted: 8
  (generated), 8 (hand-written), 23,394 (substring). The 50,603 matches the count #3019's PR
  body recorded (over 38,268 tracked files then).
- **Pinned by:** `packages/tooling/tool/cli/test/laws-retired-iri-authorities.test.ts`,
  describe "rule 1 pre-filter". It checks that the source is the alternation of the escaped row
  hosts with flags `iu`, and that every row matches in lower case, upper case and as a
  subdomain. It pins the exact findings for each host in five forms (https, upper-case
  percent-encoded scheme, JSON-escaped, `@` email domain, bare prose), 20 cases, all also
  admitted by both earlier pre-filters. Two more tests: U+017F folding to `s` (shared by the
  rule), and a negative fixture the generated pre-filter rejects while #3019's admitted it, with
  no findings either way.

## P55 effect-imports: planted fixtures

- **Run:** one planted file containing `import type`, `import x = require(...)`, dynamic
  `import()`, `require()`, an `import("effect").X` type node, a module JSDoc fence and a
  class-member JSDoc fence with root imports, a comment and a string literal spelling a root
  import. Run in check mode (the P55 path) through `runEffectImportRules` against HEAD and
  against HEAD with #3019's P55 hunks reverted: the encoded summaries are **byte-identical**.
  Four manual reviews (dynamic-import line 12, require 13, import-type 14, import-equals 11),
  `rootSpecifierCounts {effect: 7}`, 2 fences, 3 root imports rewritten in the plan, 0 parser
  warnings. The comment and the string literal contribute nothing.
- **No repo run:** the repo corpus reports zero effect-imports findings, so a main-HEAD summary
  diff is vacuous (skeptic note). #3019's own direct comparison over 9,809 files is in its PR
  body.
- **Pinned by:** `packages/tooling/tool/cli/test/effect-imports.test.ts`, "reports the exact
  rows for every planted root-import node kind in check mode" (full review rows with reasons,
  counts, and an unchanged file).

## S4 effect-vitest: findings diff

- **Repo run A (isolates #3019 at HEAD):** detectors at HEAD against HEAD with #3019's S4 hunks
  (`EffectVitestDetectors.ts`, `EffectVitestSyntax.ts`) reverted. Raw detector rows over every
  file `discoverEffectVitestSourcePaths` returns, encoded through `EffectVitestFinding` and
  sorted. Both sides: **3,852 files, 729 findings**, sha256
  `8ff80d1129469f2c8792caedadb14114f85ef437a63b7fc9db5bbbb80c212a66`. Wall: 176 s (HEAD) and
  1,251 s (reverted), on a loaded host.
- **Repo run B (literal versions):** the detectors at `027664ba178^` and at `027664ba178` (both
  without #3114), over the same tree after this slice's three test files were added. Both:
  **3,855 files, 746 findings**, sha256
  `de277ff3e2a20d25001aec1587cec7c015fb0697b492ec27592928471dbb9258`. Run B has 17 more rows than
  run A because it lacks #3114's retirements, and it covers 3 more files.
- **Pinned by:** `packages/tooling/tool/cli/test/effect-vitest-identifier-index-parity.test.ts`
  over the committed fixture set `test/support/EffectVitestParityFixtures.ts`. The set has 39
  in-memory files: opaque references, reassigned bindings, platform namespace members, and one
  representative of each other detector. Pinned: **30 rows** (EV001 1, EV002 1, EV003 2,
  EV004 1, EV005 1, EV006 1, EV008 2, EV010 18, EV013 1, EV014 2), sha256
  `f49bcd0aeccf6942f4243af6243a4afb99a79ba232bba9a1b4b72c9fb47317ec`. All four detector
  versions (HEAD, HEAD reverted, `027664ba178^`, `027664ba178`) produce that digest.

## P12/P11 opaque-roundtrips

- **Where the gate's numbers come from:** #3019's PR body ("a digest over 814 assertions (sorted
  scope, operand opaque names, raw flags), 42 diagnostics and the findings JSON is identical");
  the skeptic pass copied them with the truncated sha `44b7c59c9033de74`. Neither records the
  serialization or which diagnostics were counted, so that sha cannot be reproduced. This
  slice records its own digest definition: one JSON row per `expect(x).toStrictEqual(y)`
  visited (file, line, sorted sample scope, each operand's Opaque names, each operand's raw
  flag), sorted; diagnostics are each program's options, global and per-candidate syntactic
  diagnostics.
- **HEAD over the whole repo (2026-11-13, before the cap rule):** 94 candidate files,
  **888 assertions** (sha256 `1e5a1315111a9cd426ae6d4ab454eb1864c96b2cf8647d9d013c29340a34680a`),
  **0 diagnostics** under this definition, 0 findings; 168 s, 10.7 GB peak RSS. 888 rather
  than 814 because the repo gained assertions since #3019; 0 rather than 42 because the
  diagnostic set #3019 counted is not recorded. Neither number is forced to match.
- **Pre-#3019 over the whole repo: not completed.** An unbounded run was stopped by the
  orchestrator at about 2026-11-14T01:45Z after 47 minutes at 14.0 GiB resident on a 31 GiB
  worker with no swap (with a sibling lane's 8 GiB job it left 4.7 GiB available, load 57, I/O
  stalled about 99%). #3019 measured the old scanner at 21 GB, above the 8 GiB cap now
  required, so it was not retried.
- **Measured instead, both sides alone under the cap:** a bounded sample of four real
  packages (`packages/foundation/modeling/html`, `packages/drivers/m365`,
  `packages/epistemic/tables`, `packages/foundation/modeling/md`): 16 candidate files, **154
  assertions**, assertions sha256
  `da39596576ed87a8c8b432982d711f8821b5b99a54fd03d116ca5972b555812d`, 0 diagnostics, 0
  findings, combined sha256 `598f0ec3ca34bf35ddcf15c36930589e894c9c621cc30b560c09e3966767b3a6`,
  **identical** for HEAD (30 s, 2.6 GB) and pre-#3019 (43 s, 3.5 GB). Also the aliased fixture
  below: one identical finding on both sides.
- **Pinned by:** `packages/tooling/tool/cli/test/lint-opaque-roundtrips.test.ts`, "reports an
  aliased assertion whose Arbitrary and Opaque class are reached only through inference". Its
  Arbitrary comes from a helper's inferred return type, its Opaque class is reached through a
  const alias and a type alias, and the assertion sits two callbacks below the property call.
  A `make`-normalised twin in the same fixture is not reported.

## P28 lint:laws manifest walk: census and re-key probe

- **Census:** a fixture tree with seven visible manifests (depths 1 to 9 below `packages/`,
  among them `docs/` and a non-`@beep` name) and one manifest under each of the eight
  directories the seal negates. A recording `FileSystem` shows that the pruned walk
  (`inspectPackageTestImports(root, [])`) reads **7** manifests. An unpruned reference walk
  (the pre-#3019 shape, minus symlink following) finds **15**. The 7 read are exactly the
  manifests the lint-laws seal's route selects. Its negated directory names come from
  `POLICY_ROOT_FILE_ROUTES`. The 8 left out are exactly the negated-directory manifests, and the
  deep fixtures sit 7, 8 and 9 directories down.
- **`WORKSPACE_MANIFEST_WALK`:** still exported from `PackageTestImports.ts` and still the span
  name of `collectPackageSourceRoots`. The policy fingerprint routes the workspace-manifest glob
  family (`packages/**/package.json` and eight negations) to every seal whose closure contains a
  module carrying that literal. The live module's code literals route exactly that family.
- **Re-key probe (real Turbo):** in the existing lint-laws Turbo fixture, adding a manifest
  eight directories below `packages/` changes the hash of `@fixture/consumer#lint:laws` and of
  the lint-laws seal, and leaves the root native-runtime task alone. Renaming the directory that
  holds it changes both hashes again, and removing it restores every baseline hash.
- **Pinned by:** `packages/tooling/tool/cli/test/laws-manifest-walk-census.test.ts` (census and
  marker) and `packages/tooling/tool/cli/test/laws-turbo-inputs.test.ts` (re-key probe).

## Coverage

No per-file floor was edited. The S2 production change replaces one constant with another
on the same line set. The other families add tests only.
