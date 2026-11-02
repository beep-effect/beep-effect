# Retained repository tool workflows: qualification receipt (2026-10-31)

Refs #1852. Witnessed at base `2e17c92111b8a31c72771053413ee2305b955d18`
(origin/main, after #2398) in a fresh lane checkout, on Linux x86_64 with bun
1.4.4. Every row below records the command that ran and its real output; no row
rests on `--help` output. This receipt supersedes the rows of the
[2026-10-23 witness](2026-10-23-retained-tools-witness.md) for the same tools;
that file stays as history.

## First-party Semgrep: paired fixtures, now run by CI

`.semgrep/first-party.yml` holds the only first-party Semgrep rules in the
repository (`beep-no-eval`, `beep-no-dynamic-shell-exec`,
`beep-hardcoded-private-key`). Each has `ruleid:` positive and `ok:` negative
cases in `goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts`
(case table in the 2026-10-23 witness).

Before this PR nothing ran those fixtures. This PR wires them in twice:

- `bun run beep ci lane sast` (the hosted `SAST` job in `check.yml`) now runs
  `semgrep --test --config .semgrep/first-party.yml <fixture>` on every
  invocation, before the changed-file filter. A rule that stops matching its
  `ruleid:` case or starts matching an `ok:` case fails the lane, including
  when a new `semgrep/semgrep` image changes behaviour (the image is unpinned).
- `packages/tooling/tool/cli/test/quality-tasks.test.ts` fails when any rule id
  in `.semgrep/first-party.yml` lacks either a `// ruleid: <id>` or a
  `// ok: <id>` line in the fixture, and asserts the rule-test step runs even
  when the scan is skipped.

Local lane run (`bun run beep ci lane sast`, exit 0):

```text
[github-checks] sast: semgrep rule tests
[beep-cli] sast:semgrep-rule-tests: docker run --rm -e SEMGREP_SEND_METRICS=off -v <lane>:/src -w /src semgrep/semgrep semgrep --test --disable-version-check --config /src/.semgrep/first-party.yml /src/goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts
  Scanning 1 file with 3 Code rules:
  Scanning 1 file with 3 ts rules.
3/3: ✓ All tests passed
No tests for fixes found.
[github-checks] sast: skipped, no tracked JavaScript or TypeScript files
[beep-cli] ci:sast: ok in 8884.113393ms
```

Image `semgrep/semgrep@sha256:32e459968daabe7ab86968184a29109b9564aa00392401156f9788452b42786b`,
Semgrep 1.178.0. The safe.directory warning printed in a linked worktree is
cosmetic; `--test` does not use git.

Negative control: a scratch copy of the fixture with one `// ok: beep-no-eval`
line turned into `// ruleid: beep-no-eval` exits 1:

```text
2/3: 1 unit tests did not pass:
	✖ beep-no-eval
	missed lines: [25], incorrect lines: []
```

Focused tests: `vitest run test/quality-tasks.test.ts -t "Semgrep|ignored paths"`
passed 4 of 4 (the two new tests plus the two existing include-pattern tests).

## Revision-bound Vitest alias projection

```text
before sha256 522371b87e2ecd3a417aadb6d3f71c894d3dcad749e68529ad083c9eb4a50e25
$ bun run beep tsconfig-sync --check
tsconfig-sync: no drift detected                      (exit 0)
$ bun run beep tsconfig-sync --write
tsconfig-sync: all files already in sync              (exit 0)
after sha256 522371b87e2ecd3a417aadb6d3f71c894d3dcad749e68529ad083c9eb4a50e25
$ git diff --stat -- vitest.aliases.generated.json    (empty, exit 0)
```

The writer regenerates `vitest.aliases.generated.json` (954 aliases)
byte-identically, so the file is bound to this revision's workspace graph. The
Vitest run above resolved both alias shapes in use: exact
(`@beep/utils`, `@beep/test-runner`) and wildcard (`@beep/repo-cli/commands/Quality`,
`@beep/repo-cli/test/Quality`).

## Compiler shim provenance

| Item | Value |
| --- | --- |
| `@effect/tsgo` installed | `0.59.0` |
| `@typescript/typescript-linux-x64` installed | `7.0.2` |
| `bunx tsc --version` | `Version 7.0.2+effect-tsgo.0.59.0` |
| Patched `@typescript/typescript-linux-x64/lib/tsc` | sha256 `41c9bff8800c9e0db5211ee8100a52bdbc0bb33e32ebfdbe96f2cfeed05974da` |
| Effect artifact `@effect/tsgo-linux-x64/lib/tsc` | sha256 `41c9bff8800c9e0db5211ee8100a52bdbc0bb33e32ebfdbe96f2cfeed05974da` (identical) |
| Stock binary kept as `tsc.original` | sha256 `4f2de678286401759b3fb4475bafe35b8f32b4b3a07d92642bbf37eadc9b34a4` (unchanged since 2026-10-23) |
| `tools/tsgo-shim/tsgo.js` | sha256 `64dd14b52060b1a5c6b3765a10f02df6e9c3c0b015e1cfdcf831044f40cd7e2d` |

`bun run prepare` (`effect-tsgo unpatch --tsrs && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch --tsrs`)
exited 0:

```text
Restored original typescript at <lane>/node_modules/@typescript/typescript-linux-x64/lib/tsc
Restored original tsrs at <lane>/node_modules/@tsrs/linux-x64-gnu/tsrs
[prune-tsgo-backups] reclaimed ~0 MB of stale binary backups
Patched typescript at <lane>/node_modules/@typescript/typescript-linux-x64/lib/tsc
Patched tsrs at <lane>/node_modules/@tsrs/linux-x64-gnu/tsrs
```

After the cycle every hash above is unchanged and `tsc --version` still reports
`7.0.2+effect-tsgo.0.59.0`. The installed compiler is the Effect artifact for
the catalog pin.

## WebStorm exclusions (`beep-effect.iml`)

The `.iml` has 245 `excludeFolder` and 8 `excludePattern` entries
(`.beep`, `.next`, `.turbo`, `build`, `coverage`, `dist`, `storybook-static`,
`docs`). Compared with `git status --ignored` of the long-lived primary clone,
to depth 2:

- Every git-ignored directory is excluded, either by an `excludeFolder` entry
  (or an excluded parent) or by a pattern (`.beep`, `infra/.beep`,
  `scratchpad/.beep` and `.turbo`). `scratchpad/rules-engine` holds only
  `node_modules`, which WebStorm treats as a library root. No gap.
- Three entries name paths absent from that clone: `docs/generated` (docgen
  aggregate output), `packages/tooling/tool/cli/python/photo-face/.venv` and
  `.ruff_cache` (created by the photo-face Python tooling). All three are tool
  outputs that appear on use, so they stay.

No `.iml` change was needed.

## Spelling

| Binary | Command | Result |
| --- | --- | --- |
| typos-cli 1.50.3 (CI pin, `heavy.yml` `install_typos`), upstream musl release, sha256 `2cc30c49b25423c9c5599bbc72e1189b86c08a2ba38d73d210d37ed631486ff3` (same binary as the S44 re-witness) | `typos` at the repository root (`lint:typos`) | exit 0, no findings |
| typos-cli 1.51.1 (local) | `bun run lint:typos` | exit 0, no findings |

Both versions agree on `_typos.toml` at this base, so the version/vocabulary
note is closed.

## Scoped lint

| Gate | Command | Result |
| --- | --- | --- |
| Strict shadcn (oxlint 1.89.0) | `bun run lint:shadcn` (`oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json apps packages`) | exit 0 |
| Identity lint profile freshness | `bun run beep cache profile` | `Identity lint candidate profile is current.` exit 0 |
| Identity lint profile in use | `bunx biome lint --config-path=biome.identity.jsonc` | `Checked 301 files in 995ms. No fixes applied.` exit 0 |

## Stately: noninteractive discovery

`statelyai/0.14.3 linux-x64 node-v24.22.1`, `@statelyai/sdk` 0.40.0.

`node_modules/.bin/statelyai scan --json` exited 0 and found both selected
machines; `git status --porcelain` was identical before and after:

```json
{ "machines": [
  { "name": "documentIntakeMachine", "line": 216, "relativePath": "apps/professional-desktop/src/intake/DocumentIntake.machine.ts" },
  { "name": "intakeBatchMachine", "line": 133, "relativePath": "apps/professional-desktop/src/intake/IntakeBatch.machine.ts" }
] }
```

`statelyai status` exited 0:

```text
Auth: none (not required for local projects)
Mode: local
Machines: 2 (0 linked, 2 local-only, 0 remote-only, 0 missing-remote)
  [local-only] documentIntakeMachine  apps/professional-desktop/src/intake/DocumentIntake.machine.ts:216
  [local-only] intakeBatchMachine  apps/professional-desktop/src/intake/IntakeBatch.machine.ts:133
```

The test fixtures `packages/drivers/xstate/test/fixtures/*.machine.ts` are
correctly not discovered (`statelyai.json` globs only `src/`). This PR also
corrects two stale lines in `docs/runbooks/xstate-effect-statecharts.md`
(`@statelyai/sdk` 0.39.1 → 0.40.0; the discovery globs).

Discovery is not the visual workflow. The hosted `stately` MCP server
(`.mcp.json`) reports "requires authentication" in agent sessions, and
`statelyai open` starts an interactive local editor.

## Operator hands: Stately visual workflow (open)

The authorized Stately owner runs these steps; an agent cannot.

1. In an interactive Claude Code terminal session in this repository, run `/mcp`,
   select `stately`, and complete the Stately OAuth sign-in in the browser.
2. From the repository root, run
   `bunx statelyai open apps/professional-desktop/src/intake/DocumentIntake.machine.ts`.
3. In the editor it opens, confirm `documentIntakeMachine` renders both
   parallel regions, its compound states and its final states, matching the
   source at line 216.
4. Capture a screenshot or `bun run beep qa record` artifact of that view, plus
   one `stately` MCP call that lists or reads the machine after sign-in.
5. Attach both to #1852 with the commit SHA, then close the issue. If the
   owner decides the MCP route is optional, record that decision on #1852 in
   place of the MCP half of step 4.
