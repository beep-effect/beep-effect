# CLI fence, spawn, proof, and packet-write design audit

Audited against source `7440cb8c4302ce64b87860069a464bafbf65f576`
and corpus main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
During the audit, upstream `origin/main` advanced to
`52fcc8d1353db9481ef9edb6cc9619500f95568d`. The checkout was intentionally
kept frozen; post-merge source-line and caller-graph refresh is required before
implementation.

## Corrected canonical metadata

### `jsdoc-fence-state`

- Source: `packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts:41`
- Symbol: `fenceState`
- Members: `[nextOpenFence,isFenced]`
- Evidence: E4 at `JSDocSections.ts:41-54`
- Cardinality: 4 representable / 3 legal
- Storage/exposure/tier: derived / internal / Tier 1
- Target: tagged union

The supported tuple table is absent/false outside, present/true fenced with the
active marker, and absent/true closing. Present/false is unreachable. The
closer must remain a separate no-marker/true outcome: `jsdocCommentEnd` at
lines 76-95 must suppress an embedded `*/` on that line, `tagsFromComment` at
`QualityArtifactSupport.ts:651-671` must skip it, and
`JSDocMigrateRewrite.ts:71-91` uses previous marker state plus the result to
identify `close`. The design preserves backtick/tilde kind, minimum run length,
same-character and at-least-opener-length closing, trimmed-tail validation,
malformed/nested handling, tag order, and exact comment offsets.

The complete tuple readers are those three functions. The only other exports
are the Docgen and Quality test kits. No encoded or persisted boundary exists.
The design deletes the tuple and all marker/Boolean combination guards while
retaining previous marker state as the scanner input.

### `r3-tooling-envconfig-turbo-spawn-kind`

- Source: `packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:264`
- Symbol: `turboEnvOverrides.spawnKind`
- Members: `[isBunxTurbo,isOpRunTurbo]`
- Disposition: withdraw out of net; no simultaneous sibling-state carrier exists

The stable inventory record must be archived out of net rather than retained or
admitted as a D1 record. Both named
members are private function declarations at `EnvConfig.ts:264-285`. At the
only purported joint reader, `turboEnvOverrides` binds only
`directTurbo: boolean` at line 571 and calls `isOpRunTurbo(...)` inline in the
early guard at line 572. It never stores or returns the second classification.
After that guard, `!directTurbo` selects the wrapped arm. The three command
shapes are real behavior, but they are repeated predicate control flow over one
input rather than a parallel Boolean carrier in census scope.

All other uses reinforce the exclusion: `turboEnvExtendsAmbient` at lines
519-522 calls only `isOpRunTurbo`, and `isOpRunTurbo` internally calls
`isBunxTurbo` on the child command as ordinary predicate composition. Callers
in `CiLane.ts`, `Quality/Tasks.ts`, and `shared-internals.test.ts` invoke the two
exported environment APIs; none receives both predicate results. The existing
design file remains intact solely for parent archival and must not be treated
as an implementation-ready qualified surface.

The raw Round 26 proposal
`r26-cli-internal-root-turbo-spawn-extends-ambient` must not be admitted.
`turboEnvExtendsAmbient` at `EnvConfig.ts:519-522` is an exported dual function,
not a Boolean value produced beside the private classifiers. It calls the
wrapped classifier for each consumer. Treating callable predicates as sibling
values invents a carrier in both the two-member stable record and the expanded
three-member proposal.

### `docgen-proof-manifest-verification-reason`

- Source: `packages/tooling/tool/docgen/src/ProofManifest.ts:302`
- Symbol: `DocgenProofManifestVerification`
- Members: `[status,reason]`
- Evidence: E4 at `ProofManifest.ts:542-572`
- Cardinality: 6 representable / 3 legal
- Storage/exposure/tier: stored / wire / Tier 2
- Target: union over the existing status LiteralKit

The supported rows are `current` without reason, `missing` with reason, and
`stale` with reason. The public example at lines 279-289 constructs the stale
shape. The verifier writes missing at line 548, four ordered stale reasons at
558-569, and current at 572. There is no explicit fixture, documentation, or
business writer supporting current/reason or missing-or-stale/no-reason;
permissive `.make` alone does not establish those tuples.

The raw report's internal/Tier-1 exposure is incorrect. Docgen check passes the
complete rows to `renderDocgenJson` at
`packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:697-718`, and
the JSON command fixture decodes `proofManifests` at
`packages/tooling/tool/cli/test/docgen.test.ts:3928-3955`. The design therefore
preserves an exact Tier-2 wire shape: current omits `reason`; missing/stale
encode it; all identity/path fields and strings remain unchanged. The local
renderer at `Docgen/internal/Local.ts:800-810,1140-1152` consumes both fields,
while `Docgen/internal/Targets.ts:189-200,227-245` uses current for reuse.
Corrupt manifests keep their typed decode failure rather than being normalized
to stale.

### `codex-findings-packet-commit-kind`

- Source: `packages/tooling/tool/cli/src/commands/Codex/Findings.write.ts:289`
- Symbol: `writePacket.commitKind`
- Members: `[exists,replacing]`
- Evidence: E4 at `Findings.write.ts:243-289`
- Cardinality: 4 representable / 2 legal
- Storage/exposure/tier: derived / internal / Tier 1
- Target: LiteralKit

The raw Round 26 4/3 count is wrong at the actual simultaneous-local boundary.
`exists && force !== true` returns `packet-exists` at lines 243-248 before
`replacing` is declared. Where both locals coexist, only false/false create and
true/true replace are reachable; true/false is the earlier refusal path and has
no `replacing` value. The optional `force` function parameter remains excluded
from the census.

The target `create | replace` commit kind replaces `replacing` and its three
guards governing move-aside, restore after failed promotion, and backup cleanup
at lines 289-321. The earlier refusal guard remains because it is a separate
policy outcome. The design preserves scan-before-staging, dry-run behavior,
temporary directory placement, exact document bytes and errors, and the
transactional move/restore/promote/cleanup order. `writePacket` has one
production caller at `Findings.command.ts:272-280`; direct test coverage is at
`codex-findings-write.test.ts:42-107,148-247,326-347` and the refresh test call
at `codex-findings-refresh.test.ts:153`. No encoded boundary changes.

## Files changed by this audit

- `goals/boolean-creep/designs/jsdoc-fence-state.md` — new complete design.
- `goals/boolean-creep/designs/docgen-proof-manifest-verification-reason.md` —
  new complete design.
- `goals/boolean-creep/designs/r3-tooling-envconfig-turbo-spawn-kind.md` — left
  intact for parent archival after the stricter carrier audit withdrew it.
- `goals/boolean-creep/designs/codex-findings-packet-commit-kind.md` — new
  complete corrected 4/2 design.
- `goals/boolean-creep/data/design-refresh-2026-09-09-runtime-evidence.md` —
  clarified that absence of both span fields is an intentional public DTO
  value.
- `goals/boolean-creep/data/design-refresh-2026-09-09-cli-fence-spawn-proof.md`
  — this durable handoff.

No product source, tests, inventory, lifecycle state, dependencies, generated
files, or git references were changed. Independent P3 review remains pending.

## Verification

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed
with `design coverage OK: 160 qualified ids`. Scoped `git diff --check` passed
for every changed file. A direct required-section check also passed for all four
designs because the aggregate validator covers only inventory-admitted records.
