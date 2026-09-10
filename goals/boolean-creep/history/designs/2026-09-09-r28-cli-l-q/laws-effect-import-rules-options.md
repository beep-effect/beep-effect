# Instance

- id: `laws-effect-import-rules-options`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:137`
- symbol: `EffectImportRulesOptions`
- members: `write`, `candidate`
- evidence: E2 at `EffectImports.ts:1623-1626` — the exported runtime
  entrypoint rejects candidate-plus-write before scanning.

# Current shape

The exported decoded TypeScript options class stores `write` and `candidate`
with false defaults. The command adapter and tests construct all three legal
operations, while the runtime guard rejects the fourth pair. `strictCheck`,
corpus mode, documentation enforcement, and scopes are independent.

# Cardinality gap

Four pairs are constructible but only three operations are supported:
`dry-run`, `write`, and `candidate`.

# Target schema

Add the exported named
`EffectImportOperation = LiteralKit(["dry-run", "write", "candidate"])`
beside `EffectImportCorpusMode`. Replace both options fields with
`operation`, defaulting to `dry-run`. This is an authorized atomic decoded
public TypeScript migration: update every in-repo constructor and reader in
the same Tier 1 PR; do not add a compatibility alias because no encoded or
supported external options contract exists.

# Migration inventory

- `EffectImports.ts:40-70` — define and document the shared operation kit
  after confirming no equivalent owner exists in live source or barrels.
- `EffectImports.ts:110-174` — replace options booleans with the defaulted
  literal and update its example.
- `EffectImports.ts:1573-1595` — update active-scope policy predicates without
  changing candidate/documentation/family-promotion semantics.
- `EffectImports.ts:1620-1643` — delete the impossible-state guard and derive
  early-return summary fields from the operation until the Tier 2 summary
  migration lands.
- `EffectImports.ts:1707-1807` — replace persistence and strict-failure reads;
  write only for `write`, candidate strictness only for `candidate`.
- `Laws.command.ts` — consume the command-side design and pass one operation.
- `packages/tooling/tool/cli/test/effect-imports.test.ts` and all exact-source
  constructors — migrate fixtures for dry-run, write, and candidate.

# Guard-deletion accounting

Delete `options.candidate && options.write`, every pair forwarding, and all
separate operation reads. Literal matching or kit guards own persistence,
candidate policy, and summary projection.

# Encoded-side impact

None. `EffectImportRulesOptions` is a decoded in-process TypeScript input; it
is not printed or persisted. The CLI JSON summary remains byte-compatible
under its separate Tier 2 design.

# Test impact

Migrate the extensive Effect Imports fixture matrix without weakening it.
Cover all three operation values, candidate scope requirements, write
persistence, strict checks, three corpus modes, documentation enforcement, and
the no-promoted-family early return. Tests continue importing through
`@beep/repo-cli/test/Laws`.

# Risk and sequencing

Tier 1E, atomic with `laws-effect-imports-command-options`. The source has a
large test matrix, so exact member searches are mandatory. Land before the
Tier 2 summary codec, temporarily projecting the operation to its legacy
summary fields.
