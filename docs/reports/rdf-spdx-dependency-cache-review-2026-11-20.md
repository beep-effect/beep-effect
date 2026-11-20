# Cache review for the @beep/rdf dependency on @beep/spdx (2026-11-20)

Branch `goals/text-knowledge-stack-rebuild-p1b-registry` (text-knowledge-stack-rebuild
P1, PR B commit 9, `feat(rdf,repo-cli): namespace pins and the pinned-vocabulary target`).
Reviewer: Claude Opus 5.5 (P1 registry lane).

`bun run beep quality cache-policy` reports 6 blocking findings in one subject:

- `@beep/rdf`: `configuration-drift` on `#build`, `#check`, `#doctest`,
  `#lint:deprecated-apis`, `#test` and `#test:property`.

## Cause

`@beep/rdf` gains the workspace dependency `@beep/spdx`: the new
`@beep/rdf/NamespacePin` module decodes each pinned namespace's license through
`SpdxExpression.FromString` (decision `2026-11-19-p1-pin-scope-eight-namespaces`).
`bun run beep tsconfig-sync` adds the matching project references. Each task's
dependency list gains `@beep/spdx#build`, which re-keys the six tasks.

## Judgement

One dependency edge is added. The tasks' commands, cache flags, inputs, outputs and
environment keys are unchanged. The added dependency only makes the cache key cover a
package the tasks now compile against. Recording the subject grants no qualification.

## Reversal

Remove `@beep/spdx` from `packages/foundation/modeling/rdf/package.json` together with
the license field of `NamespacePin`, run `bun run beep tsconfig-sync`, and re-record the
`@beep/rdf` subject.

## Root subject

`bun run beep cache baseline` re-records every subject whose posture changed, so the
request also covers `//`. Its only drift is the `turbo.json` seal-input lists that
commits 6 to 8 of this stack regenerated through `bun run beep lint
policy-fingerprint --write` (the identity `Authority.ts`, `Term.ts`,
`internal/Segment.ts` and `internal/generated/Registry.data.ts` modules and the
repo-cli `Identity/Registry.ts` and repo-cli-kit `cli/Json.ts` modules that the policy
and identity-registry lints now import). `bun run beep quality cache-policy` reported
it as a non-blocking `configuration-source-drift` review note. Commands, cache flags,
outputs and environment keys are unchanged. Reversal: drop the listed inputs with the
modules that introduced them and re-record `//`.
