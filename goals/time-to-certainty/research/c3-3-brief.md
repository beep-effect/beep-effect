# C3.3 implementation brief — the package-local law scanner and the `lint:laws` task

Owner: Fable orchestrator. Implementer: one Codex `codex exec` lane per stage (`gpt-6-astra`,
reasoning `medium`, `workspace-write`) in worktree `~/YeeBois/projects/beep-effect3-worktrees/ttc-c3-3`
on branch `ttc/c3-3-laws-task`. The lane makes **no git writes** and runs **no graft commands**; Fable
stages listed paths by name and signs commits. Results file:
`goals/time-to-certainty/research/c3-3-implementation.md` (one `## Stage <X>` per launch with
decisions + rejected alternatives, `### Stage <X> — files`, verification table with exit codes,
measurements, blockers). Sibling lane: C3.2b works in `ttc-c3-2b` on the typed eslint worker and the
policy plan in `Quality/Tasks.ts`; **this lane does not edit `Quality/Tasks.ts`, `Lint.command.ts`'s
deprecated-apis code, or the eslint configs**. The plan switch (retiring `scopedLawStep`) is a
follow-up after both PRs land.

## Read first

1. `research/decisions.md` rulings 19–30; `research/c3-lane-task-table.md` D5 (the package-local
   scanner), D15 (fingerprint edge), §2.1 row `lint:laws` (line ~332, inputs verbatim), §2.2 row
   `//#lint:native-runtime:roots`, §7.1 fixtures, §7.2 row 3.
2. `research/c3-1-brief.md` amendments 5–6 (the `laws --package` worker: package-test-imports only
   under `packages/`, `--include` expansion) and `research/c3-2-implementation.md` (the Turbo
   fixture idiom in `policy-fingerprint-turbo-inputs.test.ts`; the sticky-CI lesson).
3. Code: `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts` `lintLawsCommand` (lines
   ~723–771: today it spawns one CLI subprocess per law with `--include <prefix>`),
   `packages/tooling/tool/cli/src/commands/Laws/*.ts` (each law's `includePaths`/`sourceFileGlobs`
   and `TSMorphService` use), `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts`
   (`createProjectPool`, scope resolution with `tsConfigPath`, `referencePolicy: workspaceOnly` →
   `skipFileDependencyResolution`, `mode: syntax` → `skipLoadingLibFiles`; `DEFAULT_TSCONFIG_FILE_NAME`
   is the root `tsconfig.json`), a package's `tsconfig.test.json` (`include: ["src","test"]`, no
   references), `turbo.json`, `standards/effect-laws.allowlist.jsonc`,
   `packages/tooling/policy-pack/repo-configs/src/eslint/{EffectLawsAllowlist,NoNativeRuntimeHotspots}.ts`,
   `.repos/effect` for every Effect v4 API.

## Why (measured)

`beep lint laws --package packages/foundation/modeling/identity` takes 14.3 s and 1.0 GB for a tiny
package: four subprocesses, each resolving a ts-morph scope from the root `tsconfig.json` and
preloading the root corpus. D5 wants one process, one package-scoped syntax project, one hash.

## Stages — one commit each, one stage per launch

### Stage A — the package-local scanner (schema → contract → implementation)

1. Schema: a `LawsPackageScope` class (package dir, repo root, the overlay path it scans with, the
   law list) and a `LawsPackageReport` (per-law finding counts, advisory flags) in the Laws domain;
   `LiteralKit` for the law names.
2. Contract: extend the `TSMorphService` scope so a caller can request a **package-scoped** project:
   `tsConfigPath` = the package's `tsconfig.test.json` (src + test), `referencePolicy: workspaceOnly`,
   `mode: syntax`, no root preload, root compiler options only by value where a law needs them.
   Locate the scope entrypoint (`entrypoint` tagged `"tsconfig"`, ~line 892) and add the overlay as
   an explicit scope rather than a new global default; existing root-scoped callers keep their
   behavior byte-for-byte.
3. Implementation: `lint laws --package .` runs terse-effect (`--check --advisory`), native-runtime,
   frozen-grant-set, effect-fn and (under `packages/` only) package-test-imports **in one process
   over one shared package project**, keeping each law's diagnostic exclusions; package-test-imports
   still reads every `packages/**/package.json` (a declared input). Exit code and log lines keep
   the existing `lint laws:` prefixes. The root `laws <law>` commands and their scoped steps are
   untouched.
4. Tests: a fixture package with one violation per law proving the worker reports them from the
   package project alone (no root preload: assert the project's source-file count equals the
   package's files); the lab-kind and non-`packages/` paths; the `Laws` domain schemas round-trip
   through fast-check (`S.toArbitrary`, `FastCheck as fc from "effect/testing"`).
5. Measure: identity, schema, repo-cli — wall and max RSS before (14.3 s / 1.0 GB for identity) and
   after; diagnostics identical to the four root-scoped laws over the same package.

### Stage B — the Turbo task and the root residual

1. `turbo.json` `lint:laws` exactly as §2.1 row 332 (inputs verbatim, `cache: true`, `outputs: []`,
   `dependsOn: ["//#lint:policy-fingerprint"]`); `//#lint:native-runtime:roots` per §2.2 with root
   script `"lint:native-runtime:roots": "beep-cli laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology"`
   and inputs = those roots' `**/*.{ts,tsx}` plus the allowlist sources.
2. Fixtures per §7.1(1)–(2) in a new `laws-turbo-inputs.test.ts` following the Stage A/B idiom of
   `policy-fingerprint-turbo-inputs.test.ts` (NodeServices + StepExec, real `turbo --dry-run=json`,
   per-edge isolation: package source, `standards/effect-laws.allowlist.jsonc`, the two repo-configs
   law files, the generated snapshot, an upstream `packages/**/package.json`, an unrelated package).
3. Fleet: `bunx turbo run lint:laws --concurrency=4 --continue=dependencies-successful --summarize --cache=local:rw`
   cold and warm; record `Tasks/Cached/Time`, per-task p50/max, task-seconds, against the five
   hosted steps (33+27+19+16+14 = 109 s, table row 332).
4. Results file: name the follow-up precisely — `rootRepoLintPolicySteps` replaces the five
   `scopedLawStep`s with `turbo run lint:laws //#lint:native-runtime:roots` (affected locally, full
   hosted) behind the sweep switch C3.2b introduces (`standards/lint-policy.sweeps.jsonc`, key
   `laws`), and `beep:policy` retires from the two manifests and the scripts schema.

## Verification in the sandbox (record exit codes)

`bunx biome check <touched>`; `bunx oxlint --quiet --disable-nested-config <touched TS>`;
`bunx --no-install vitest run --pool=threads <touched tests>` and `bunx --bun vitest run --pool=threads <touched tests>`;
`bun run beep lint schema-first`; `bun run beep quality fallow audit --check --base origin/main --quiet`
and `... health --check --base origin/main --quiet` (read `.beep/fallow/*.check.json` `exitStatus`);
`bun run beep lint policy-fingerprint --check` (regenerate with `--write` after CLI source edits);
`bun run beep lint package-scripts --check`; a source-resolving focused tsgo config over the
touched tests. Fable runs package-verify (`@beep/repo-cli` and `@beep/repo-utils` if touched), Node
coverage, and the hosted lane.

## Hard rules

No git writes; no graft; never touch `.claude/settings.json`, `graft/`, `.ignore`, `docs/_internal/`;
Effect v4 (`.repos/effect`), `HashMap`/`HashSet`, `Effect.fn`/`fnUntraced`, `LiteralKit` (no `as const`),
no `node:http`; JSDoc `**Example** (Title)` with `console.log`, module-path imports; tests via `@beep/*`
aliases, runtime-agnostic (no `Bun.*`), `describe(name, { concurrent: false }, fn)`; no inline
`S.decodeUnknownSync`; every new `src` module needs full coverage or a note for the baseline row;
workspace scripts blocks are generated; keep `turbo.json` Biome-formatted; stop at the end of the stage.

## Amendment 2026-09-10 (1) — packages without a test overlay

Ratified by the orchestrator after Stage A: `repo-cli`, `todox`, `ciops` and `infra` have no
`tsconfig.test.json`. The scanner prefers that overlay when present and otherwise takes the
package's own `tsconfig.json` for compiler options only, with config preload disabled and the
full package TS/TSX surface added explicitly; `LawsPackageScope` records the path actually used.
Rejected: falling back to the repository root (the root preload is what D5 removes), creating a
fleet of unrequested overlays, or silently omitting package tests.
