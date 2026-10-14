# Cache baseline review: `@beep/repo-cli` gains `@beep/ai-sync` (2026-10-14)

Reviewer: Claude Fable 5.1 (agent-skills-conformance publish, PR branch `feat/agent-skills-conformance`).

## What changed

`@beep/repo-cli` now depends on `@beep/ai-sync` (the Agent Skills frontmatter
schema the `beep skills update` check decodes with). That moves two subjects:

- `//`: the `//#lint:policy-fingerprint` root task gained the inputs
  `packages/tooling/library/ai-sync/package.json` and
  `packages/tooling/library/ai-sync/src/**` (regenerated with
  `bun run beep lint policy-fingerprint --write`).
- `@beep/repo-cli`: `build`, `check`, `doctest`, `lint:deprecated-apis`, `test`,
  and `test:property` now carry `@beep/ai-sync` in their dependency set
  (`package.json` dependencies plus `tsconfig.json` / `tsconfig.check.json`
  references).

No command, env, output, or cache flag changed for any task, and no
qualification is granted or revoked: this records the reviewed legacy posture
after the dependency edge was added.
