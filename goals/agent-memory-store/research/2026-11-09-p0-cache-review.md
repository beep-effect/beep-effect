# P0 cache baseline review — 2026-11-09

Subjects: `//`, `@beep/agent-memory-store`, `@beep/sqlite`. Reviewer: Claude
Fable 5.1 medium, lane `goals/agent-memory-store-p0`.

`bun run beep quality cache-policy` on the P0 head reports exactly these
findings, all of them introduced by this PR and none inherited from `main`:

- `BLOCK configuration-drift: //#lint:policy-fingerprint`
- `BLOCK unreviewed-expansion` for the eight inherited task slots of
  `@beep/agent-memory-store`: `build`, `check`, `docgen`, `lint`,
  `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`
- `BLOCK unreviewed-expansion` for the same eight slots of `@beep/sqlite`
- `REVIEW configuration-source-drift: turbo.json`

## New workspace tasks

`@beep/agent-memory-store` (`packages/tooling/library/agent-memory-store`) and
`@beep/sqlite` (`packages/drivers/sqlite`) were created through
`bun run beep create-package` (decisions `package-home-tooling-library` and
`sqlite-driver-package`). Their sixteen task slots are the generated scripts
block, explicitly uncached, and are granted no reuse, qualification or
exception by this review. Script commands, cache flags, output globs and
environment declarations are the generated defaults.

## Root source drift

`//#lint:policy-fingerprint` and `turbo.json` changed because
`bun run beep lint policy-fingerprint --write` added the two new workspace
manifests to `standards/policy-tools.fingerprint.json` and to the root task's
input list; the root manifest gained the two workspaces and the root-package
projection was regenerated. Root task commands, outputs and environment
declarations are unchanged. The bytes of existing global inputs legitimately
changed; this review does not suppress an unrelated failure and qualifies no
root task.

Re-recorded on the merge of main 16370d15737 (#3014 moved the lint:laws
manifests onto the seal and re-recorded the baseline first): the merge took
main's baseline, and this request is replayed on top of it. `turbo.json` and
`standards/policy-tools.fingerprint.json` carry the bytes main wrote plus the
two new workspaces; nothing else in the review changed.

Exact reviewed current input bytes (SHA-256):

- `package.json`:
  `0979e9cdbafe9813a2d2e70c608d9491b689a7f503ece16fdbe3b946befa19c7`
- `turbo.json`:
  `5c603d7dded3bd88cbec749f3f672440249c1144302cedaa077f654957f27f25`
- `standards/policy-tools.fingerprint.json`:
  `94a09897722128bac14215d610bbd5cceb078dce53f8ee4707029514786f25e9`
- `standards/root-package.projection.generated.json`:
  `357d939f81311ff66266c5b8b25afd44b513775607cd94e158e81dfa98c22bfa`
- `packages/tooling/library/agent-memory-store/package.json`:
  `9096b64485bd6237af3784a1fbb7cf465cb8a1c4979fcf82ea0f4119cb2c5535`
- `packages/drivers/sqlite/package.json`:
  `efa7cf87e3427362ec9c5a5199adb8a17abca5d1fd11fd088ecc7742854c9bb0`

Verification on the lane: `bun run beep quality package-verify` passes for
both new packages and for `@beep/schema`; `tsconfig-sync --check`,
`lint policy-fingerprint --check`, `lint package-scripts` and
`lint schema-catalog` are green on the merged head. Hosted broad proof remains
pending.
