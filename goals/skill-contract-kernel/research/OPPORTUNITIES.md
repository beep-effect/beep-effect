# Friction ledger: skill-contract-kernel

Receipts recorded when work is slower or riskier than the repo workflow should make it.

## 2026-08-24: package generator inherits a read-only Bun temp directory

- **Doing:** creating `@beep/skill-contract` with the canonical `beep create-package` command after its dry run matched the packet.
- **Evidence:** the scaffold, identity registration, and TypeScript config sync completed, then `bun install --lockfile-only` failed with `EROFS accessing temporary directory` and asked for `BUN_TMPDIR` or `BUN_INSTALL`.
- **Prevented by:** the generator selecting a writable temp directory in managed agent sessions, or documenting and applying a sandbox-safe `BUN_TMPDIR` for its lockfile refresh subprocess.

## 2026-08-24: offline package creation cannot finish workspace enrollment

- **Doing:** completing the generator's failed lockfile refresh and then running `config-sync` after adding the repo CLI consumer dependency.
- **Evidence:** setting `TMPDIR`, `BUN_TMPDIR`, and `BUN_INSTALL` reached dependency resolution, but the sandbox denied DNS. `bun link --no-save` also attempted a whole-workspace resolution. Until the workspace link existed, `config-sync` could not load `@beep/skill-contract` from the repo CLI.
- **Prevented by:** an offline workspace-enrollment mode that links a newly generated local package and updates its lockfile workspace entry without consulting the registry. This run restored only the untracked local package symlink; `bun.lock` remains for an environment with registry access.

## 2026-08-24: Vitest fork workers do not start in the managed sandbox

- **Doing:** running the generated package's exact Turbo test task for the first-slice proof.
- **Evidence:** both default fork workers timed out after 60 seconds before collecting either test file; the same seven tests completed immediately with `--pool=threads`, and the package coverage command then reported 100% for statements, branches, functions, and lines.
- **Prevented by:** a repo-supported sandbox test profile that selects Vitest threads when child-process workers cannot start, while leaving ordinary local and CI defaults unchanged.

## 2026-08-25: the TS2589 quarantine's lane rerun fails under peer-session load

- **Doing:** first `yeet publish --pr` proof for the P1(c) judge retrofit, while two sibling checkouts ran their own proofs (load average ~28 on the same box).
- **Evidence:** `quality:build` reported no-location `error TS2589` from `@beep/ui`, `@beep/xai`, and `@beep/box` — packages the PR does not touch; the quarantine reran and logged `lane rerun failed with exit 2; keeping failure hard`, so the whole ~25 min proof was lost to one environment-only class. `bunx turbo run build --filter=@beep/ui --filter=@beep/xai --filter=@beep/box --force --concurrency=1` then passed 11/11 at the same commit.
- **Prevented by:** the quarantine rerunning the attributed packages at `--concurrency=1` (the disproof that always passes) instead of a full-lane rerun that inherits the same scheduling pressure, or a load-aware pre-flight that defers the full proof when the box is above a threshold.

## 2026-08-25: the PR-3 exact Turbo test lane repeats the fork-worker timeout

- **Doing:** running the required two-package `turbo run test` proof after adding the SKILL.md projection and repo CLI consumer gate.
- **Evidence:** all eight `@beep/skill-contract` fork workers reported `[vitest-pool-runner]: Timeout waiting for worker to respond` before test collection. The projection suite passed 6/6, the consumer parity file passed 16/16, and the full contract package passed 45/45 with 100% Istanbul coverage when constrained to one thread worker.
- **Prevented by:** a managed-sandbox test profile that selects the Vitest thread pool and one worker without requiring each package command to carry bespoke fallback flags.

## 2026-08-25: workspace dependency lock refresh requires unavailable temp and network access

- **Doing:** refreshing `bun.lock` after adding the local `@beep/md` workspace dependency to `@beep/skill-contract`.
- **Evidence:** the default install failed with `EROFS accessing temporary directory`; writable `BUN_TMPDIR` and `BUN_INSTALL` moved past that failure, but registry resolution then failed because DNS/network access was unavailable.
- **Prevented by:** an offline lockfile-only workspace dependency updater that can modify an existing workspace entry without resolving unchanged registry dependencies.

## 2026-08-25: JSDoc quality has no affected-package lane

- **Doing:** proving the new exported projection API against the repository JSDoc grammar and sort-tag rules.
- **Evidence:** `quality jsdoc-quality` only supports repo-wide `--all` analysis and exited 1 on 11,416 inherited missing-example failures. The focused ESLint check, JSDoc ratchet, module-tag guard, and package docgen all passed.
- **Prevented by:** a package or changed-file scope for `quality jsdoc-quality`, aligned with `docgen:local -- --package`.

## 2026-08-25: coverage ignore hints depend on which runner measured

- **Doing:** shipping `SkillProjection.ts` with one unreachable `RenderError` arm annotated `/* istanbul ignore next */`, after the Codex sandbox proved 100% coverage with the Istanbul provider (`vitest.config.ts` picks Istanbul under Bun).
- **Evidence:** the hosted `Heavy / Coverage Regression` lane measures with the v8 provider (`vitest.shared.ts`), which ignores Istanbul hints, so the new-file rule failed on #817's first head; the `@beep/html` precedent is `/* v8 ignore next -- reason */`.
- **Prevented by:** one provider for local and hosted coverage (or a lint that rejects `istanbul ignore` when the ratchet provider is v8), so an ignore hint proven locally is the hint the lane honours.
