# Cache baseline review: practice-gateway gate repair wave 1

Reviewed 2026-10-14 for gate repair wave 1 of `goals/practice-gateway`
(`history/p1/gate-repair-wave-1.md`).

`bun run beep quality cache-policy` reported:

- unreviewed expansions for the three new workspaces, `@beep/practice-gateway`,
  `@beep/windows-secrets` and `@beep/mcpb-kit`: `#build`, `#check`, `#docgen`,
  `#lint`, `#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and `#test`;
- configuration drift for `@beep/practice-kg-mcp` `#build`, `#check`,
  `#lint:deprecated-apis` and `#test`.

The new workspaces carry the standard generated task set (`bun run beep lint
package-scripts`) with the same commands, inputs, outputs and cache flags as
their siblings: `@beep/practice-gateway` is a service app like
`@beep/practice-kg-mcp`, `@beep/windows-secrets` a driver library and
`@beep/mcpb-kit` a tooling library scaffolded by `bun run beep
create-package`. Their extra scripts (`package:mcpb*`, `smoke`) are not turbo
tasks.

The `@beep/practice-kg-mcp` drift is a dependency-digest change only: the app
moved its host resources into `@beep/law-practice-server/PracticeKgHost` and
its `.mcpb` packaging and process entrypoint into `@beep/mcpb-kit`, which adds
those workspace edges and tsconfig references. Its commands, outputs, env and
cache flags are unchanged.

Recording them accepts the existing posture for these four subjects only; no
qualification is granted and no other subject changes.
