# Cache baseline review: heavy-pool-diet slice 3 policy-fingerprint inputs, 2026-11-13

## Change

`goals/heavy-pool-diet` slice 3 (ORDER and HOST-06 PR 1) makes
`packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` import the change profile's
pinned-diff reader and pattern loader from `CiOperational.service.ts`, so that Heavy
Admission can decide the goals-only and Docgen `lane_skips` without a second classifier.
The new import adds `CiOperational.service.ts` and the `@beep/github-reporting` source it
imports to the import closure of the policy checkers. `bun run beep lint policy-fingerprint
--write` therefore added those files to the generated `inputs` of the root task
`//#lint:policy-fingerprint`, and to the `goals-doctor` and `knowledge` fingerprint tasks, in
`turbo.json` and `standards/policy-tools.fingerprint.json`.

## Review

- Only the root `//` subject's configuration changes, and only through generated input globs
  that widen the task's hash inputs to its real import closure. No command, output,
  environment variable or cache flag changes.
- Adding inputs can only invalidate entries the task could previously have reused wrongly. It
  never lets a stale entry hit.
- No qualification is granted. The scope stays `@beep/identity#lint` and `@beep/types#lint`.
