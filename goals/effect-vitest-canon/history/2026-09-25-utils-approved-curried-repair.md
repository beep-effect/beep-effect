# Utils approved curried-form repair

Benjamin approved a narrow production-code exception for `Str.mapPrefix` and
`Str.mapPostfix`; see the dated decision in `../DECISIONS.md`.

The original `dual(2)` implementations used affix-first argument order. Their
curried calls supplied the array in the wrong position and failed at runtime.
Explicit overload implementations preserve the existing affix-first two-argument
API, the curried API, and the template-literal return types. Both previously
omitted data-last cases now compare actual piped calls with their two-argument
counterparts and concrete expected output.

## Verification

- Before repair: the two restored parity tests failed; 48 existing tests passed.
- After repair: `CI=true bunx vitest run test/Str.test.ts`, run from the utils
  package, passed all 50 tests on Vitest 5.0.1.
- `bun run beep quality package-verify @beep/utils` passed audit (4.7 seconds)
  and docgen (2.4 seconds) against the current Wave B worktree.
- `git diff --check` passed.

These results include the other local utils migration edits. They establish
local correctness, not publication, hosted readiness, or goal completion.
The affected inventory rows remain open until a fix commit can be cited.
Runner adoption and final Wave B publication remain separate work.
