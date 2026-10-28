# Cache baseline review: #1875 Effect Vitest canon wave 11

Reviewed 2026-10-27 for #1875 wave 11 (`test/vitest-canon-wave11`).

`bun run beep cache audit` reported 5 blocking findings, all introduced by this
branch: configuration drift for `@beep/m365-mcp#build`, `#check`,
`#lint:deprecated-apis`, `#test` and `#test:property`.

`@beep/m365-mcp` gains `@beep/memfs` (`workspace:^`) as a devDependency, added
with `bun add -d`, so `test/OutboxAttachmentSource.test.ts` can run on the
in-memory filesystem. `bun run beep tsconfig-sync` then added the memfs project
reference to the package's `tsconfig.json` and `tsconfig.check.json` and
regenerated `standards/fallow.boundaries.generated.jsonc`, and the `bun.lock`
workspace entry gained the same devDependency. These tasks see the new manifest
bytes, the new workspace dependency input and the new references.

The commands, scripts and cache settings are unchanged. The only change is the
new dependency edge, the same one `@beep/pdf-tools`, `@beep/practice-identify`,
`@beep/exiftool` and `@beep/github-actions` already declare. Recording this
subject accepts its existing posture with the added edge. No qualification is
granted, and no other subject changes.
