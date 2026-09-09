# Instance

- id: `docgen-proof-manifest-verification-reason`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/docgen/src/ProofManifest.ts:302`
- symbol: `DocgenProofManifestVerification`
- members: `status`, `reason`
- evidence: E4 at `ProofManifest.ts:542-572` — the verifier writes `missing`
  and every `stale` result with a reason, and writes `current` without one;
  CLI readers render the reason and use `current` as the reuse gate.

# Current shape

The exported `DocgenProofManifestVerification` class stores the existing
three-value `DocgenProofManifestStatus` plus an optional string reason. The
verifier has exactly three outcome shapes: missing manifest with a reason,
stale manifest with the first applicable mismatch reason, or current manifest
without a reason. Package identity and paths are independent payload carried
unchanged by every case.

The stale checks are ordered package name, input digest, output digest, then
tool version. That first-match order determines the diagnostic. The result is
read by docgen check reuse selection and local docgen status rendering, and the
complete rows are included in `docgen check --json` output.

# Cardinality gap

Three status literals times reason presence expose six shapes. Three are
supported:

| status | reason | meaning |
| --- | --- | --- |
| `current` | absent | all proof fields match |
| `missing` | present | proof file does not exist |
| `stale` | present | first detected proof mismatch |

`current` with a reason and `missing`/`stale` without one are not produced by
the verifier or documented as outcomes. The public JSDoc example explicitly
constructs `stale` with a reason at `ProofManifest.ts:279-289`; no fixture or
consumer establishes the three incoherent shapes as compatibility values.
Generic schema construction permissiveness is not business-contract evidence.

# Target schema

Keep `DocgenProofManifestStatus` as the existing LiteralKit. Redefine
`DocgenProofManifestVerification` as a schema union under the same exported
owner and encoded field names:

- `{ packageName, packagePath, manifestPath, status: "current" }`;
- `{ packageName, packagePath, manifestPath, status: "missing", reason }`;
- `{ packageName, packagePath, manifestPath, status: "stale", reason }`.

Use `S.String` for reason so this change enforces the proven presence relation
without introducing an unrelated content restriction. Preserve the schema's
`.make` construction surface and derive case guards from the union. Do not add
a second discriminator or a generic status/reason helper.

# Migration inventory

- `packages/tooling/tool/docgen/src/ProofManifest.ts:111-132` — reuse the
  existing status LiteralKit and exact encoded literals.
- `ProofManifest.ts:279-308` — replace the flat optional-reason class shape
  with the three-case union under the same public symbol and update its example
  only as required by the schema form.
- `ProofManifest.ts:419-432` — replace the optional `makeVerification` input
  with case-safe construction, or delete the helper and construct each outcome
  directly. Do not retain an optional reason wall around the union.
- `ProofManifest.ts:533-572` — construct missing, each ordered stale mismatch,
  and current through their legal arms. Preserve filesystem error handling,
  decoded manifest validation, fingerprint computation, comparison order, and
  exact reason strings.
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts:189-200,227-245`
  — preserve target-order verification and current-status reuse selection.
- `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:800-810,946-954,1140-1152`
  — render required reasons for missing/stale and no suffix for current while
  preserving typed error wrapping and the all-current gate.
- `packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:697-718` —
  preserve the complete `proofManifests` array in JSON output and all reuse
  counts.
- `packages/tooling/tool/cli/test/docgen.test.ts:861-872,3930-3957` — retain
  current/stale behavior and make the JSON shape assertions exact for both
  reason absence and presence.
- `packages/tooling/tool/docgen/src/index.ts:47` and the package wildcard
  export remain unchanged.

Targeted repository search found no other writer or reader of the verification
class.

# Guard-deletion accounting

Delete `S.optionalKey(S.String)`, the optional `reason?` helper input, its
`O.fromUndefinedOr`/`O.getSomesStruct` construction guard, and the renderer's
undefined check. Exhaustive status matching supplies the reason only on the two
cases that carry it. Keep ordered mismatch guards: they determine which stale
reason is emitted and are not Boolean coherence guards.

# Encoded-side impact

The carrier is wire-exposed Tier 2: `docgen check --json` passes the complete
verification rows to `renderDocgenJson` at `Docgen.command.ts:707-718`, and the
JSON integration fixture decodes that payload at `docgen.test.ts:3930-3957`.
Preserve the exact legacy object keys and strings. `current` continues to omit
`reason`; `missing` and `stale` continue to encode it. Package and manifest
paths remain byte-for-byte unchanged. No persisted file format, database row,
default, or compatibility transform changes.

# Test impact

Exercise missing, all four ordered stale reasons, and current. Assert the exact
encoded JSON field set for each case, including absent `reason` on current and
present exact text on missing/stale. Include multiple mismatches to prove the
existing first-match diagnostic order, filesystem/read failures on their typed
error path, target-order preservation, reuse only for current, and local status
rendering. Run focused repo-docgen and repo-cli docgen tests plus package
verification when implemented.

# Risk and sequencing

Tier 2 stored/wire schema refactor. Change the schema, sole verifier, CLI
readers, and JSON fixtures atomically. The main risks are changing diagnostic
precedence, accidentally encoding an undefined reason key for current, dropping
paths, or treating a corrupt manifest as stale instead of preserving its typed
decode failure. The defining schema, verifier, exports, CLI readers, and JSON
fixture were rechecked at the exact source SHA above.
