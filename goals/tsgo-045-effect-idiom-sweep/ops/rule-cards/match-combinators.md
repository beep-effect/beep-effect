# Rule card — Match combinators (repo law `match-shapes`)

Status: **skeleton** (M01 lane fills it; the law's fixtures are derived from
the before/after pairs here).

## Identity

- Repo lint law id: `match-shapes` (repo-cli `Lint` family, next to
  `tooling-schema-first`).
- Not a tsgo rule. D10 proposes it upstream after the law proves the pattern.

## Shapes the law flags

| Shape | Idiomatic form | Notes |
| --- | --- | --- |
| `Match.tag("A", fa), Match.tag("B", fb), ..., Match.exhaustive` over a closed tagged union | `Match.tagsExhaustive({ A: fa, B: fb })` | The #1060 regression shape (63 sites) |
| `Match.discriminator("kind")("a", fa), ..., Match.exhaustive` | `Match.discriminatorsExhaustive("kind")({ a: fa, ... })` | 33 sites |
| `Match.tag(...)` chain closed by `Match.orElse` | `Match.tags({...})` + `Match.orElse` | partial map |
| `Match.when({ _tag: "A" }, fa)` / `Match.when((x) => x._tag === "A", fa)` | `Match.tag("A", fa)` or the exhaustive map | literal `_tag` predicate |
| `Match.type<T>().pipe(Match.tag(...) ... Match.exhaustive)` | `Match.typeTags<T>()({...})` | 93 `Match.type` sites to audit |
| `Match.value(x).pipe(Match.when("lit", ...), Match.when("lit2", ...), Match.exhaustive)` over a `LiteralKit` domain | keep `Match.when` unless a `valueTags`/`discriminators` form applies | do not over-rewrite |

## rc.115 Match surface (verify in `$HOME/YeeBois/dev/effect/packages/effect/src/Match.ts`)

`any bigint boolean date defined discriminator discriminators
discriminatorsExhaustive discriminatorStartsWith exhaustive fn instanceOf
instanceOfUnsafe is nonEmptyString not number option orElse orElseAbsurd
record result string symbol tag tags tagsExhaustive tagStartsWith type
typeTags value valueTags when whenAnd whenOr withReturnType`

## Before / after

TODO: at least one pair per row above, cited from the PR #1060 diff
(`git diff 6b1ebc8d33^1 6b1ebc8d33 -- '*.ts'`), including a handler map whose
handlers are `Effect.fn` (the contextual-typing case fixed by `8d1e97a`).

## When NOT to rewrite

TODO: open unions, handlers needing the full value plus a fallthrough,
`withReturnType` interactions, and cases where a chain is genuinely partial.

## Law design

- Detector: syntax-level over the TS AST (mirror `EffectVitestDetectors`),
  positive and negative fixtures under `packages/tooling/tool/cli/test/fixtures/match-shapes/`.
- Baseline: committed empty JSONL; the law fails on any new row.
- Hosted seat: `lint:policy` lane, like the effect-vitest ratchet (#1098).
