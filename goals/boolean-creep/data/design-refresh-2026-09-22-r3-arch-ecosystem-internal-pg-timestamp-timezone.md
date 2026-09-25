# P2 audit — PostgreSQL timestamp identity

Exact source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Private proposal only; no implementation, P3, package verification, or census credit.

## Immutable inputs

- Private `input-inventory.jsonl`: `9c4eaaf326b781e0b6239b197098e82e25aa394c70da15225f5a2e4d8704c8d3`
- Private `input-design.md`: `841575a18d3bb7144d3763fcc89fe5b21f7d26f91fb0f424e3b3103cb64955bf`
- Private `input-row.json`: `2af63193df1d3d3b2caf31dd5a6437fabba72c2aa98aa9103a3c6dac4dc62651`

The saved inventory and design were byte-compared with the canonical live inputs before proposal writing and matched. The parent confirmed a successful fetch left main unchanged.

## Source and contract bindings

- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/ecosystem/AGENTS.md`: `126b9d7adb9f216cf98e795f138ec86ebd45b6215dab866abdff4536c68896e8`
- `standards/architecture/14-ecosystem-packages.md`: `a7fa4ea32557f5f1a772db62c71a088edab0f4a64e46ed6045e924f73a9f3d07`
- `packages/ecosystem/effect-drizzle/src/pg/Column.ts`: `29f2050af1c66927e3eb3a0b3071b99301389bdaaffe5f94c34c7643b7c42c50`
- `packages/ecosystem/effect-drizzle/src/pg/combinators.ts`: `910602cdace32ac9f691acf799dcdf2f3514470809afb97ab509c3d3821448e4`
- `packages/ecosystem/effect-drizzle/src/pg/table.ts`: `1a0479311c7f1c3d9780405ed006412fc978a2e68778853522a7861503a0a48e`
- `packages/ecosystem/effect-drizzle/src/pg/index.ts`: `05c93035482f73d5db99dd35abba18675836abe055f7ba5badbe6f749e1de43c`
- `packages/ecosystem/effect-drizzle/package.json`: `dfd946e911814ffb211748367cda9ec723603c543f0e35ff866a943f2b64de0c`
- `packages/ecosystem/effect-drizzle/test/fixtures.ts`: `4a69bb9b83717897ff67d06def1d1162b8da5af3fe1b01cf6bd1fd37e99b06ee`
- `packages/ecosystem/effect-drizzle/test/perf.consumer.ts`: `d0c8cbb614026a03fc9a27a9870ab3ffb815444197f3cd42a7876fa2bf51578c`
- `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts`: `0de4369ad93fbd7196358dbab2472dbdfdbd1ef3ccb3f00a123eb64a8e0cfc7a`
- `packages/ecosystem/effect-drizzle/test/unit.test.ts`: `2a3eaa425e5af7babadf3a3a384fce53901f6664901f88c23e3462a5a896390b`
- `packages/ecosystem/effect-drizzle/test/import-boundary.test.ts`: `589e34293f2358ef3d07b4276e4c46a5e18e13c751a1654366806769d24527c6`
- `packages/ecosystem/effect-drizzle/typetests/contracts.tst.ts`: `abbc72445a377d96be83a785c03e12b34021154aaa0e14255071e0b1f233800b`
- `packages/ecosystem/effect-drizzle/README.md`: `e47cc530f1da862ec55074c9bd4f9f6bd01e686aea039e246d2be5098969a68e`
- `.repos/effect/packages/effect/SCHEMA.md`: `4ad8e16a92cbefc9c7cc9759f982645a6a4802fdb18eb2b5f7755f2d30f652a9`
- `node_modules/drizzle-orm/pg-core/columns/timestamp.d.ts`: `e72b78079edd091fe116c8d66f0b38b3088bc0c770735f9b08207fa95831c639`
- `node_modules/drizzle-orm/pg-core/columns/timestamp.js`: `adaa393a690a0f225375d1a410aee1b8ee11b2cfc47824bab60f835c47d510d1`
- `bun.lock`: `acba0f05d1f3c47cb1a67598f992b80a8b4b96dada74c267d810c2fb1e1e4794`

## Findings incorporated

- Refreshed evidence to constructor 862, writer 1014, guard 983. Pair remains 4/2; mode is independent.
- isSpec common precheck checks only string identity: preserve explicit two-identity membership when removing flag coherence validation.
- Preserve public function flag/defaults and upstream Drizzle boolean boundary. Installed Drizzle defaults false, while wrapper defaults true.
- Exported second Timestamp generic migration is deliberately source-breaking for explicit old boolean consumers; decoded-shape rider permits atomic repo migration, not a false compatibility claim.
- Preserve isBoolean import: fromLiteralAST still uses it at 994.
- Ecosystem source/runtime dependencies forbid @beep/schema; reuse existing named identity domain rather than add duplicate kit.
- Read-only probe covered eight pair/mode combinations and nine public default/explicit-option builder cases; no replacement was implemented.
- Existing unit SQL assertion is substring-only and does not prove timezone preservation. Proposed tests require exact SQL, codec, type inference and guard rejection.

## Discovery limits

Graft callers(makeTimestamp) had no indexed callers; targeted Graft grep plus live repository textual checks covered the actual constructor writer, generic consumers, public barrel, and tests. Broad @beep/effect-drizzle Graft search was capped; no completeness claim relies on that capped output. Repository search for Timestamp<, Timestamp.make and withTimezone found no additional consumers of this owner; unrelated foundation Timestamp and raw Drizzle table calls are excluded. No claim is made about unobserved external consumers.

## Outputs

- Private `proposed-design.md`: `5c6be14b3b8f58d915c7a08d21a95a47db223045648e12b2697110a00ffda2fc`
- Private `proposed-row.json`: `c59dbd33c3f2f7eab76b64b36df1bfd76f11480c4df814fc8d58a52624716064`
- Private `behavior-probe.json`: `689f53520fd750e2cff8378f8df928104931ca87dabda33c5de00a0244b17890`

Graft estimate: 258826 tokens saved across four calls.
