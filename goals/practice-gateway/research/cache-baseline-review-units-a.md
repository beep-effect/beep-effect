# Cache baseline review: practice-gateway units A1–A3

Reviewed 2026-10-14 for units A1–A3 of `goals/practice-gateway`
(`history/p1/gateway-units-brief.md`).

`bun run beep quality cache-policy` reported configuration drift for
`@beep/practice-gateway` `#build`, `#check`, `#lint:deprecated-apis` and
`#test`.

The drift is a dependency-digest change only. Unit A2 (Box Drive tools) adds
the workspace dependencies `@beep/doc-text` and `@beep/file-processing` and the
test-only `pdf-lib`; unit A3 (Microsoft 365 sign-in) adds `@beep/m365` and
`@beep/m365-mcp`. `bun run beep tsconfig-sync` added the matching tsconfig
references. The package's commands, inputs, outputs, env and cache flags are
unchanged; no turbo task was added or renamed.

Recording it accepts the existing posture for `@beep/practice-gateway` only;
no qualification is granted and no other subject changes.
