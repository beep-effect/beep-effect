# Cache baseline review: W2b (Yeet remainder and ai-metrics onto `@beep/git`)

Reviewed 2026-11-02 for W2b of `goals/repo-cli-gh-git-consolidation` (SPEC D-11).

`bun run beep quality cache-policy` reported 5 blocking findings on the merged head, all introduced by this branch
and all configuration drift on one package: `@beep/repo-ai-metrics#build`, `#check`, `#lint:deprecated-apis`,
`#test` and `#test:property`.

The cause is one dependency edge. `packages/tooling/library/ai-metrics/src/config-snapshot.ts` reads `revParse` and
`lsFiles` through `@beep/git`, so the package manifest gains a `@beep/git` workspace dependency, `bun.lock` records
it, and `tsconfig.json` and `tsconfig.check.json` gain the matching project reference. Each of the five tasks now
hashes the new manifest input and depends on `@beep/git`'s build. No command text, output, environment key or
cache flag changes, and `bun run beep lint policy-fingerprint` reports the root seals current.

Recording the package subject accepts the existing posture for the five tasks. No qualification is granted, and no
other subject changes.
