# Cache baseline review: #1875 Effect Vitest canon wave 10

Reviewed 2026-10-27 for #1875 wave 10 (`test/residue-vitest-canon-wave10`).

`bun run beep cache audit` reported 8 blocking findings, all introduced by this
branch: configuration drift for `@beep/pdf-tools#build`, `#check`,
`#lint:deprecated-apis` and `#test`, and for `@beep/practice-identify#build`,
`#check`, `#lint:deprecated-apis` and `#test`.

Both packages gain `@beep/memfs` (`workspace:^`) as a devDependency, added
with `bun add -d`, so their test suites can run on the in-memory filesystem.
`bun run beep tsconfig-sync` then added the memfs project reference to each
package's `tsconfig.json` and `tsconfig.check.json`, and the `bun.lock`
workspace entries gained the same devDependency. These tasks see the new
manifest bytes, the new workspace dependency input and the two new
references.

The commands, scripts and cache settings are unchanged. The only change is the
new dependency edge. Recording these two subjects accepts their existing
posture with the added edge. No qualification is granted, and no other subject
changes.
