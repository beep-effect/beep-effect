# Citation identity foundations and migration scan

Date: 2026-10-28. Local implementation checkpoint; goal remains active.

## Admission and limits of this checkpoint

The ten-component portable audit passed again. The default strict command
still rejects unfinished target proof, as required. Both public prerequisite
contracts are available through the recorded compatibility receipt. The
annotated limits/defaults and parent-owned isolation strategy are frozen.
These satisfy the explicit before-P1 holdpoints. Limited P1 identity work now
overlaps P0's unfinished target proof bindings. P0 stays in progress because
focused divergence tests and execution proof are still missing. Neither
phase is complete, and the strict gate has not been weakened.

`CitationMentionId` and `CitationAuthorityId` now validate distinct versioned
`cm1:` and `ca1:` tokens through the public shared `Sha256Hex` schema. Their
brands are distinct from each other and shared persisted
`LawPractice.CitationId`. Tests prove codec round trips, malformed-token
rejection, cross-role rejection and compile-time brand separation. These are
format contracts only: digest producers, verified mentions, semantic keys,
resolution and the legacy citation-schema replacement remain unimplemented.

## Consumer evidence

`ops/citation-migration-surface.json` freezes 76 legacy exports, 48 value
directories and 94 definition-file hashes at baseline commit `a8c5a38d20`.
This inventory survives later deletion of those definitions.
`citation-consumer-scan.json` records the compiler/scanner/surface hashes,
examined-file hashes and all findings from 7,753 source files. The scanner
uses the already authorized pinned donor TypeScript 5.9.3 compiler only as a
maintainer tool. It is not an engine or portable parity dependency.

Eight positive use-form controls cover named/aliased imports, default imports,
wildcard exports, namespace members, namespace escapes, dynamic module loads,
import types and module-name strings. An unrelated named import is rejected
as a citation finding. The transient owned control file is removed before
the final scan and package verification. There are no relevant parse errors.

Five external production findings require manual classification:

| Source and line | Classification |
| --- | --- |
| `identity/src/packages.ts:977` | Package identity composer type argument. |
| `CiLanePartitions.ts:342` | CI package-name partition entry. |
| `CiLanePartitions.ts:413` | CI package-name partition entry. |
| `CheckCensusGate.ts:1038` | Package/config target registration. |
| `internal/CoverageScope.ts:198` | Package coverage threshold entry. |

The identity source is under `packages/foundation/modeling`; the other four
are under `packages/tooling/tool/cli/src/commands`. None reads a citation
schema field. Two namespace escapes in
`use-cases/test/LegalPositionRelatorPolicy.test.ts:292,297` inspect the unrelated
`correlativeKind`, `oppositeKind` and `negatedPolarity` exports. Other external
test module strings identify the package in identity/quality fixtures. Keep
these findings in the report; do not silently filter them out.

The scan is migration evidence, not proof that arbitrary computed module
loading is absent. Repeat it immediately before destructive schema changes
and inspect conservative findings against the actual code being changed.

## Verification

Both `@beep/law-practice-domain` and `@beep/law-practice-use-cases` passed
package audit and documentation generation. The domain gate includes the new
identity tests and type checks. Scanner controls and the final scan passed.
The new evidence note passes Markdown lint. PLAN and SPEC retain the same
26 pre-existing line-length findings as HEAD; this checkpoint adds none.
Goals doctor reports no new blocking findings. Supporting cache logs are `p1-domain-verify.log`,
`p1-use-cases-verify.log`, `p1-consumer-controls.log`, `p0-exit-audit.log` and
`p0-exit-strict.log`.

Reproduce the optional scan using `verify-consumer-scan.py` with
`--typescript-module` pointing at the pinned donor's
`node_modules/typescript/lib/typescript.js` and `--scratch-root` pointing at
an owned cache directory. This does not install or execute a donor suite.

Next: apply the semantic/mention/document schema disposition, implement digest
production and verified anchors, and retire the old local `CitationId` after
another consumer scan. The first case/Id/supra/USC/CFR slice remains only the
first internal slice of the full parity goal.
