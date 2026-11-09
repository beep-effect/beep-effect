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

Exact reviewed current input bytes (SHA-256):

- `package.json`:
  `0979e9cdbafe9813a2d2e70c608d9491b689a7f503ece16fdbe3b946befa19c7`
- `turbo.json`:
  `89791e0323a482dc7770d5a9421befb3d2457ea5fb4060f9d807cbcc9e9132fc`
- `standards/policy-tools.fingerprint.json`:
  `b58eb73d585bf00e7fd0c7dba72073d89f450a4d85642095e4bc67dfe058da4c`
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
