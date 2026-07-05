# Repo Crispening Orchestration

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Orchestrate the repo-wide crispening from this packet: push every invariant
and pure behavior into `effect/Schema` and onto the data — schema-as-truth,
defaults/normalization/Option in schemas, tagged-union discrimination,
colocated statics, precision + annotations — so business-logic modules read as
pure intent. The end state is durable and self-enforcing: four novel lint
cards, the per-owner blocking policy ratchet
(`standards/schema-crispening.policy.jsonc`), the Law 20/47 amendment, and the
tracked schema catalog (`standards/schema-catalog.generated.jsonc`).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repo-crispening-orchestration/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Enforce foundations — next action: author the four novel lint cards
(`SFV4-fn-schema`, `SFV4-getsomes-struct`, `SFV4-normalization`,
`SFV4-null-return`) in
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` and the
`standards/schema-crispening.policy.jsonc` schema-crispening policy.

## Latest Evidence

Not started (packet authored 2026-07-05; see
[`research/decisions-locked.md`](./research/decisions-locked.md)).

## Notes

- All decisions D1–D5 and grill outcomes G1–G7 in
  [`research/decisions-locked.md`](./research/decisions-locked.md) are
  **locked — do not reopen**; amendments require a superseding entry in
  `standards/architecture/DECISIONS.md`.
- D5 ordering constraint: the Law 20/47 amendment (and mirrors) must merge
  **before** the `SFV4-getsomes-struct` (`R.getSomes` → `O.getSomesStruct`)
  sweep runs.
- Specialist discovery prompts (S1–S5) and the per-package remediation
  template live in [`ops/prompts/`](./ops/prompts/); the codemod triage table
  and contract live in [`ops/codemods/`](./ops/codemods/).
