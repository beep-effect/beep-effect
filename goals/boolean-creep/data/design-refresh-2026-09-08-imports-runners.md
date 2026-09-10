# Effect Imports and runners Tier 2 design refresh

Date: 2026-09-08

Source audited: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus baseline audited: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

The checkout merged the newer corpus baseline after the initial audit. An
exact path diff from the prior source to this merge was empty for all three
source graphs and their tests, so the cited lines and conclusions remain live.

## `effect-import-rules-summary-operation`

The current summary schema at
`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:241-272` accepts
four `write`/`candidate` pairs. Only three have supported meaning. The CLI
adapter rejects combined true at
`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:276-278`, and the
independently exported runner rejects it again at
`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1623-1627` before
either writer at lines 1629-1643 and 1794-1811.

Repository searches found no decoder, fixture, documented input, or consumer
contract that assigns meaning to combined true. The design therefore keeps
the inventory's three legal operations, reuses the Tier 1
`EffectImportOperation` owner, preserves `write` and `candidate` on the wire,
and explicitly rejects the unsupported pair at the compatibility boundary.
Its test plan now separates the three legitimate old/new canonical
`encode(decode(payload))` equality cases from the deliberate incoherent-input
rejection. It also preserves field order, trailing-array defaults, and the
candidate command's existing human rendering.

## `effect-import-rules-strict-failure`

The full writer derives strict failure at
`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1788-1792`; the
inert writer emits false at lines 1629-1643. The encoded false value loses
whether the original run was advisory or strict-clean. No repository input
contract supplies that missing intent.

The design now reuses the Tier 1E `LawScanDisposition` owner and makes the
information loss explicit: legacy false decodes to `None`, legacy true to
`Some(strict-failure)`, while live writers construct exact `Some(advisory)`,
`Some(strict-clean)`, or `Some(strict-failure)`. Both legacy boolean rows must
retain exact old/new canonical object and JSON equality. The command must
schema-encode before the generic JSON printer and inspect only the exact
failure disposition for its existing exit behavior.

## `runners-bake-freshness`

`packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:757-780` is
the sole production writer: three probes vary independently and `fresh` is
always their conjunction. The command reads the report at
`Runners.command.ts:59-68,118-130`; the public barrel exports the report and
JSON codec at `Runners/index.ts:35-36`. The only fixture constructs coherent
flags, and repository searches found no JSON decode consumer or documented
contract for contradictory tuples.

The inventory's eight legal states therefore remain source-proven. The design
keeps all four legacy boolean keys in JSON, decodes only three freshness
literals, and derives overall freshness once. For the eight legitimate rows,
new canonical `encode(decode(payload))` must equal the old canonical object and
JSON byte for byte, including key order and optional-key omission. For the
other eight structurally accepted rows, the decoder tolerates the incoherent
redundant `fresh` value and re-encodes the probes' canonical conjunction; that
deliberate inequality is tested separately.

## Qualification and verification

No cardinality or qualification correction is required for these three
inventory entries. The permissive schemas admit extra tuples, but no supported
producer, fixture, documentation, or consumer gives those tuples domain
meaning. The operation design uses explicit rejection; the runners design uses
documented canonicalization.

Verification at source `7440cb8c4302ce64b87860069a464bafbf65f576`:

- `bun goals/boolean-creep/ops/validate-designs.ts` — the first run passed with
  `design coverage OK: 105 qualified ids`. A later post-edit aggregate retry
  named only a concurrently edited SHACL design that was being withdrawn; it
  named none of these three designs. The parent lane owns the final aggregate
  after that inventory/design update.
- Scoped `git diff --check` over the three designs and this handoff — passed.
- Exact source-graph path diff from
  `05405bf322da0ca7eb88b8bb402145081e8fded6` to this source — empty.

No remaining qualification, cardinality, topology, or encoded-contract blocker
was found within these three designs. Formal P3 review, implementation, and the
post-withdrawal aggregate validation remain outside this refresh.
