# Identity lint: initial computation worksheet

Observed 2026-09-09 UTC from the launched checkout. State: **excluded** after
the [successful-warning canary failure](./unsafe-lint-review.md).
This source inspection identifies the experiment obligations; it does not
prove purity, portability, log safety or a cache qualification.

## Command and profile

- Computation: `@beep/identity#lint`.
- Initial script chain: `lint` → `bun run beep:lint` → `biome check .`.
  The verified capture repair now makes `lint` run
  `biome check . > /dev/null 2>&1`; detailed `beep:lint` remains unchanged.
- Effective Turbo predecessor: `@beep/types#lint`, also `biome check .` through
  its package wrapper. The pilot must retain this dependency observation or
  document an independently reviewed decomposition; it cannot silently count
  the whole graph as the identity computation.
- Proposed initial profile: `local-linux-x64-bun1.4.1`, with exact Turbo
  `2.10.12`, Bun `1.4.1`, Node `24.20.0` and Biome `2.5.6`. OS, libc and binary
  digests are now captured in [local preflight observations](./local-preflight-observations.json);
  this is a profile observation, not qualification.
- Canary `2.10.13-canary.1` is a separate isolated experiment, not production
  authority and not a source of substitute stable evidence.

## Inputs to inspect and perturb

The initial exact Turbo dry plan contains 40 expanded input paths for the
identity node. The current repaired/disabled configuration has 41, including
the new child Turbo file. These include identity sources/tests/manifests, `.bun-version`, `.nvmrc`,
root `package.json`, root `biome.jsonc`, three lint config files and four Grit
rule files. `bun.lock` also participates in Turbo's dependency hashing and must
be perturbed independently; absence from the expanded file map does not mean
it is absent from every Turbo hash component.

Root Biome configuration enables Git VCS integration and ignore-file use. It
loads `no-empty-named-blocks.grit` and `prefer-array-flat-map.grit`; other
plugin registrations depend on overrides. Root/child config discovery,
`.gitignore` behavior, untracked/ignored inputs, Grit rules and any generated
aliases require separate negative cases. Never infer a complete read set
from a dry plan alone.

The task has strict environment mode, empty task `env`, and no task-specific
pass-through list in the resolved definition. Root global environment and
pass-through policy still apply. The experiment must vary relevant environment
families, absent values, locale/timezone, runtime/manager versions and
orchestration-only admission/session inputs independently.

## Outputs, logs and external state

The effective declaration now has `cache: false` through the inheriting child
Turbo configuration. It has no output trees, `outputLogs: full`,
`persistent: false`, `interactive: false` and `interruptible: false`.
`biome check .` has no `--write` flag. These are declarations and command
observations; filesystem tracing and before/after snapshots must still verify
the actual writes and output/log behavior.

Biome diagnostics can include source excerpts and paths, and success messages
can include durations. Any normalization needs an explicit allowlist that
preserves diagnostic meaning and never hides divergence. Synthetic secret
canaries must cover both success and warning/error output before logs are
accepted as safe. Failed commands are a negative observation, not reusable
success. Network, time, randomness and platform dependencies remain unproven
until the isolated runner controls or observes them.

## Required remaining evidence

Three fresh/fresh pairs, three verified signed-remote pairs, at least ten
representative shadow decisions per supported profile, independent input
perturbations, output/log equivalence, linked-root and supported concurrency
checks, and imported conformance/trust receipts remain outstanding. The quiet
capture repair has passed the complete bounded preflight and the identity
package audit/docgen gate. That exploratory matrix supports the script repair;
it does not supply the durable real-pilot qualification matrix. The earlier
`--max-diagnostics=0` candidate was superseded after its insufficient capture
behavior was observed. Production credentials, lab
deployment and broad-family adoption remain outside this task's scope.

Further cross-root attribution check (2026-09-09): all three disputed root
TypeScript configuration files are tracked with identical Git blob IDs in
the main checkout and the isolated pilot worktree. `git check-ignore -v
--no-index` matches none of them in either root. Missing files, staged-byte
differences, and an ordinary ignore-rule match therefore do not explain
the observed input-map difference. The later
[SCM device control](./scm-device-preflight.md) attributes it to the sandbox's
unreadable `/dev/null`; adding a working device mount restores the historical
input maps and task hashes. This does not grant portability to the repaired
task, whose comparison matrix remains outstanding.
