# P0.5 conformance entrypoint policy integration

Status: in progress.

Scope: only Quality.command.ts, quality-tsgo-directives.test.ts, this report, and private p05-policy-* proof files. No agents, git operations, dependency changes, scanner/inbox writes, broad checks, global diagnostic changes, or helper edits.

Authority: integrate the approved D14 exception only for the canonical file-local strictEffectProvide skip-file directive in packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts. All other directive rejections remain the default. Root owns the helper directive, resource-lifetime explanation, aggregate package proof, and git.

## Progress

- Created this report before investigation or source edits.

- Read live AGENTS.md, effect-first-development/SKILL.md, export JSDoc law, PLAN P0.5, resource-authoritarian.md, DECISIONS.md D14/compiler integration, and the platform-boundary research. Primary authority explicitly preserves per-test subject-layer provision and shorter asserted resource scopes.
- Searched live Quality source, helpers, tests, and barrels. Existing directive recognition regex and collector are the appropriate seam; no reusable contextual policy exists. Keep recognition unchanged; add one dual pure rejection predicate and call it directly from the collector after its existing path normalization.
- Policy will compare the complete normalized repo-relative path and complete directive line with exact string equality. No trimming, basename/suffix matching, extra rules, alternate spelling, or generalized exemption configuration.
- Live non-login runtime checks: `command -v bun node`, `bun --version`, `node --version` exited 0: Bun 1.4.2 and Node v24.20.0. Installed @effect/tsgo package metadata identifies 0.39.1. Early exploratory reads found no tsconfig.src.json or tsconfig.base.jsonc; corrected discovery to the existing tsconfig.json, tsconfig.check.json, and tsconfig.base.json. No writes resulted from those reads.
- Saved before-images of both owned files under ~/.cache/beep/effect-vitest-canon/p05-policy-proof/ for a no-git diff and attribution. No ownership extension is needed.

- Implemented the contextual dual rejection predicate with meaningful runnable JSDoc. The existing recognition export remains unchanged. The collector computes the normalized relative path once and passes that path plus the unmodified line to the tested predicate; the same path is used in its location report.
- Extended the owned test with canonical acceptance/recognition and both dual forms; sibling, basename, fixture, prefix, suffix, case, and non-normalized path rejection; alternate rule, combined/duplicate rules, next-line, off, block-comment, and whitespace/spelling rejection; existing non-directive cases remain.
- Focused Vitest uses the real package config through a private wrapper solely to place Vite cache files in authorized scratch. It uses Node directly, runner config loading (no generated repo config), and disables result caching. No diagnostic option is changed.

### biome-initial

```sh
node node_modules/@biomejs/biome/bin/biome check packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 3.175s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/biome-initial.log.

### vitest-initial

```sh
node node_modules/vitest/vitest.mjs run --root packages/tooling/tool/cli --config ~/.cache/beep/effect-vitest-canon/p05-policy-proof/vitest.config.ts --configLoader runner --no-cache test/quality-tsgo-directives.test.ts
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 6.381s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/vitest-initial.log.

### compiler-test

```sh
node node_modules/@effect/tsgo/dist/effect-tsgo.cjs diagnostics --project ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.json --file ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts --format text --strict --list-files
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 0.635s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/compiler-test.log.

### compiler-quality

```sh
node node_modules/@effect/tsgo/dist/effect-tsgo.cjs diagnostics --project ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.json --file ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts --format text --strict --list-files
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 0.649s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/compiler-quality.log.

### compiler-typescript

```sh
node node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.json --pretty false
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 5.913s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/compiler-typescript.log.

### policy-wiring

```sh
node ~/.cache/beep/effect-vitest-canon/p05-policy-proof/verify-policy-wiring.mjs
```

Working directory: filesystem worktree root. Exit: 1. Elapsed: 0.024s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/policy-wiring.log.

- Focused native TypeScript/Effect compiler completed successfully (exit 0); it used only the two owned root files and their dependency closure, with no emission or incremental state.
- No-git diff review confirms only the intended predicate/JSDoc and collector seam changed in Quality.command.ts. The existing directive recognizer is byte-for-byte unchanged.
- Private wiring verification passed collector equivalence, recognition preservation, exact source scope, and absence of active directive comments in the owned source/tests, then failed its configuration-display assertion: the native compiler's `--showConfig` output omits `compilerOptions.plugins`. This is a proof-harness assumption, not a source finding. Preserve the failed receipt; verify plugin inheritance from the config chain and an intentionally invalid private diagnostic canary before closing. No repository config was changed.

### diagnostic-canary

```sh
node node_modules/@effect/tsgo/dist/effect-tsgo.cjs diagnostics --project ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.canary.json --format text --strict --list-files
```

Working directory: filesystem worktree root. Exit: 1. Elapsed: 0.247s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/diagnostic-canary.log.

### diagnostic-canary-both

```sh
node node_modules/@effect/tsgo/dist/effect-tsgo.cjs diagnostics --project ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.canary.json --format text --strict --list-files
```

Working directory: filesystem worktree root. Exit: 1. Elapsed: 0.241s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/diagnostic-canary-both.log.

### compiler-canary

```sh
node node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.canary.json --pretty false
```

Working directory: filesystem worktree root. Exit: 1. Elapsed: 0.256s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/compiler-canary.log.

### policy-wiring-final

```sh
node ~/.cache/beep/effect-vitest-canon/p05-policy-proof/verify-policy-wiring.mjs
```

Working directory: filesystem worktree root. Exit: 0. Elapsed: 0.025s. Log: ~/.cache/beep/effect-vitest-canon/p05-policy-proof/policy-wiring-final.log.

## Final result

Status: complete within this lane's ownership; ready for root integration and aggregate proof.

Changed only:

- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`: added `isRejectedEffectDiagnosticsDirectiveForTesting`, a dual data-first/data-last predicate with meaningful JSDoc. It recognizes directives through the unchanged existing recognition API and rejects them unless BOTH the normalized repo-relative path and complete line exactly match the authorized conformance pair. The actual collector calls that predicate using its existing normalization and emits the same path/line location for rejections.
- `packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts`: 40 focused tests now cover the exact allowance, retained recognition, default rejection, lookalike paths, additional/different rules, next-line forms, off/broad forms, alternate spelling/comment framing/whitespace, both dual forms, and non-directive text. Fixture directives are constructed string data; neither owned file contains an active diagnostic directive comment.

No new source role file, service, configurable exemption API, allowlist, or parser was added. No ownership extension was needed. The helper, dependencies/manifests, goal decisions/phase state, exception inventories, global configuration, diagnostic severities, scanners/inboxes, and git were not edited or operated on by this lane. All proof artifacts are in the authorized private `p05-policy-proof` directory; this report is the sole goal-document write.

### Verification outcome

- Node v24.20.0 focused Vitest: **40/40 passed**, exit 0. Real package config and setup were retained; only cache storage was directed to private scratch, with runner config loading and result caching disabled.
- Biome for the two owned files: **passed**, exit 0, no fixes applied.
- Focused Effect diagnostics: **0 errors, 0 warnings, 0 messages**, exit 0. The CLI checks the two project roots together when both project and file options are supplied; the two earlier invocations therefore duplicate this same bounded two-file proof, rather than proving different subsets.
- Native `@effect/tsgo` compiler (7.0.2+effect-tsgo.0.39.1) over the two owned entry files and their import closure: **passed**, exit 0. No emit or incremental files.
- Final private wiring/config proof: **passed**, exit 0. It verifies the complete collector matches the prior collector with only the normalized-path hoist and tested-predicate substitution; preserves the recognition export verbatim; verifies the remaining Quality source is unchanged; and confirms the fixture/source files contain no active directives. This is structural collector-to-predicate verification plus runtime predicate tests; no repository-wide collector scan was run.
- Configuration proof confirms the private config inherits the complete live base plugin unchanged: **all 103 diagnostic rules remain `error`**, including `strictEffectProvide` and `missingPipeableSignature`.
- The private negative canary intentionally exits 1 with exactly `TS377032` / `strictEffectProvide` and `TS377101` / `missingPipeableSignature`, under both focused diagnostics and the native compiler. These are expected negative-control results, not unresolved source failures. They confirm diagnostics are active, beyond merely inspecting configuration.
- The earlier private `policy-wiring` failure was resolved by checking the config inheritance chain and runtime canary instead of expecting `--showConfig` to emit plugin metadata. The initial failed log is retained separately from the passing final log.

Additional inspection commands: `node node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/p05-policy-proof/tsconfig.json --showConfig > ~/.cache/beep/effect-vitest-canon/p05-policy-proof/effective-tsconfig.json` exited 0. Both `diff -u` comparisons against the private before-images exited 1 as expected because of the intended source/test changes; their changes were reviewed and the Quality delta was checked by `policy-wiring-final`. Runtime/package metadata, help, source, and authority-document reads were read-only.

### Handoff and remaining acceptance

No lane-owned implementation concerns remain. Root must add the exact directive and its concrete resource-lifetime reason to `FileSystemConformance.ts` after that writer exits. Put the reason on a separate comment line: the authorization intentionally does not accept an appended reason, whitespace variant, additional rule, or alternate directive. The collector receives the existing LF-split source line without trimming, so the authorized line must match literally.

Root still owns full `package-verify`, docgen/package/hosted acceptance, and all git/publication work. Those proofs were deliberately not run here, per the explicit lane contract. Focused success does not substitute for them.

Final owned-source SHA-256 (`sha256sum`, exit 0):

```text
148f6529074451f38706d7e8f4cccbb8f4842624003fa502f3823209e5c3b3a9  packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts
885327e44109932a7d22d2cd99e4903f840cdcaf941838f83bc1dea793bb8aec  packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts
```

No source edits occurred after the passing tests, Biome, and compiler proofs.
