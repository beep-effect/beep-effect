# Cache review after merging P1 PR A into P1 PR B (2026-11-19)

Branch `goals/text-knowledge-stack-rebuild-p1b-registry` (text-knowledge-stack-rebuild
P1, PR B). Reviewer: Claude Opus 5.5 (P1 registry lane).

PR B was built on PR A's head `25dd82ae723`. Merging PR A's final head `7a7b87f0328`
(which carries `origin/main` up to `3c1e3329376`: #3426, #3431, #3433 and earlier)
re-recorded `//` and `@beep/rdf` on PR A's side, so the merge took that side's
baseline files and PR B's own changes are recorded again on top of them.
`bun run beep cache audit` then reports 7 blocking findings and one review note:

- `@beep/rdf`: `configuration-drift` on `#build`, `#check`, `#doctest`,
  `#lint:deprecated-apis`, `#test` and `#test:property`.
- `//`: `configuration-drift` on `//#lint:identity-registry` and
  `configuration-source-drift` on `turbo.json`.

## Cause

- `@beep/rdf`: PR B adds the workspace dependency `@beep/spdx` for the
  `NamespacePin` license codec, so each of the six tasks gains the `@beep/spdx#build`
  (and `#transit`) edge. Basis: `docs/reports/rdf-spdx-dependency-cache-review-2026-11-20.md`.
- `//#lint:identity-registry`: PR B adds the input glob
  `packages/foundation/modeling/identity/registry/**/*.json`, the declared-term
  registry shards the lint now checks against the generated `Registry.data.ts`.
- `turbo.json`: the seal-input lists that `bun run beep lint policy-fingerprint
  --write` regenerated on the merged tree list PR B's identity modules
  (`Authority.ts`, `Term.ts`, `internal/Segment.ts`,
  `internal/generated/Registry.data.ts`), drop the deleted `Curie.ts` and
  `internal/generated/SparTerms.ts`, and add the repo-cli `Identity/Registry.ts` and
  repo-cli-kit `cli/Json.ts` modules the identity-registry lint imports, next to
  main's new `Root.ts`.

## Judgement

One dependency edge and one input glob are added; the remaining change is generated
seal-input paths. No command, cache flag, output or environment key changes.
Recording the two subjects grants no qualification.

## Reversal

Remove `@beep/spdx` from `packages/foundation/modeling/rdf/package.json` with the
license field of `NamespacePin`, drop the registry shard glob from
`//#lint:identity-registry` with the term-registry check, run
`bun run beep tsconfig-sync --write` and `bun run beep lint policy-fingerprint
--write`, and re-record `//` and `@beep/rdf`.
