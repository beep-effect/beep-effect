# `@beep/xdg` 4-X gaps: red run of the new tests (PR 4-X-A)

Recorded 2026-10-24 for SPEC W4-c (4-X-A part). The fix commit for the two
4-X known gaps changes the tests and the source together, so this file is the
red half of red-then-green.

Method: in the lane checkout, `src/Xdg.ts`, `src/AppDirs.ts`, `src/XdgBase.ts`,
`src/index.ts` and `src/internal/absolute.ts` (since W4-w the public `src/Absolute.ts`) of
`packages/foundation/capability/xdg` were replaced by their versions at the lane base `bda2713db8` (origin/main before
4-X-A), and the 4-X-A `test/Xdg.test.ts` and `test/AppDirs.test.ts` were run
against them with `bunx --bun vitest run test/Xdg.test.ts test/AppDirs.test.ts`.
The source was then restored, and the full suite passes on the fixed source.

Result against the old source: `Test Files 2 failed (2)`, `Tests 13 failed | 84 passed (97)`.

Failing tests (every one is a 4-X-A assertion; no other test failed):

- test/AppDirs.test.ts > AppDirs > input schemas > admits only absolute override paths, POSIX or Windows
- test/AppDirs.test.ts > AppDirs > the override guard > a relative config override dies with AppDirsOverrideError
- test/AppDirs.test.ts > AppDirs > the override guard > a relative data override dies with AppDirsOverrideError
- test/AppDirs.test.ts > AppDirs > the override guard > a relative cache override dies with AppDirsOverrideError
- test/AppDirs.test.ts > AppDirs > the override guard > a relative state override dies with AppDirsOverrideError
- test/AppDirs.test.ts > AppDirs > the override guard > a relative runtime override dies with AppDirsOverrideError
- test/AppDirs.test.ts > AppDirs > the override guard > the first relative override in kind order is the one reported
- test/Xdg.test.ts > Xdg > layer > rejects a relative HOME "relative/home" with XdgEnvError
- test/Xdg.test.ts > Xdg > layer > rejects a relative HOME "./home" with XdgEnvError
- test/Xdg.test.ts > Xdg > layer > rejects a relative HOME " /home/ada" with XdgEnvError
- test/Xdg.test.ts > Xdg > layer > rejects a relative HOME "~/ada" with XdgEnvError
- test/Xdg.test.ts > Xdg > layer > rejects a relative HOME "C:relative" with XdgEnvError
- test/Xdg.test.ts > Xdg > empty environment values > an empty HOME is a typed XdgEnvError, never a defect

The `AppDirs` failures are the override guard (a relative override used as
rung 1, and `AppDirsOverrideError` absent); the `Xdg` failures are a relative
or empty `HOME` that the old layer kept verbatim, and the reworded
`XdgEnvError` message.
