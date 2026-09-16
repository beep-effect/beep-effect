# Rule card — `schemaSync`

Status: **skeleton** (P2 discovery lane fills every section; the orchestrator
rejects a card with any `TODO` left).

## Identity

- tsgo rule id: `schemaSync`
- Since: 0.45.0 (new)
- Message(s) as shipped in 0.45.0:
  - `{0}` executes synchronously. Use `Schema.{1}` to compose this operation through Effect without throwing. effect(schemaSync)

## What the compiler detects

TODO: cite the detector source in the tsgo clone (`internal/rules/<file>.go:<line>`),
state the exact AST shape it matches, and the shapes it deliberately skips.

## The Effect v4 idiom

TODO: name the API the rule points to, with the clone citation
(`packages/effect/src/<Module>.ts:<line>` in `$HOME/YeeBois/dev/effect`,
rc.115). Explain why it is preferred (typed errors, scope, laziness, tracing).

## Before / after (repo-shaped)

TODO: two or three minimal pairs drawn from real repo sites (cite
`path:line` at main), covering the common shape, the pipeable shape, and the
test-file shape.

```ts
// before
```

```ts
// after
```

## When NOT to rewrite

TODO: list shapes where the rewrite changes behavior (sync boundaries, module
top-level, config-time code, intentional non-finite numbers, entrypoints for
strictEffectProvide) and what the correct fix is instead. A directive is
never the answer; the two allowlisted files are closed.

## Verification

- Command that shows the diagnostic for one file with the worktree-local 0.45 install.
- Package handoff: `bun run beep quality package-verify <@beep/pkg>`.
- Test-file rule: follow effect-vitest canon (`it.effect`, no `Effect.runSync` around decode).

## Gotchas seen in this repo

TODO: fill during the shard runs; every fixer appends here via its lane report.
