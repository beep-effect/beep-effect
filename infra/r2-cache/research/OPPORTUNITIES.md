# Fleet rollout friction

- Worktree setup on a worker rejected `--base` because its dirty primary checkout
  predates that option. The primary was preserved; qualification used a separate
  checkout at the reviewed revision. A capability check before remote bootstrap
  would prevent the failed invocation.
- SSH wrappers announced a pending hardware touch even for authenticated multiplexed
  channels. The device did not blink. Effective ControlPath inspection plus a
  fail-closed reuse path removed the false prompts; inert and live reuse checks
  passed. Durable wrapper sources and regression checks ship with the fix.
- Full `quality package-verify` produced no first-phase output for more than ten
  minutes. The exact owned CLI was interrupted; lint/check had already passed.
  Hosted validation carries the broader proof. Immediate admission/phase metadata
  would make this hold attributable without scanning processes.
- Native tooling left fontconfig runtime caches under `packages/tooling/var/cache/fontconfig/`,
  causing the source-only publish preflight to refuse. The exact artifact directory
  is now ignored; no authored files or recovery material were removed.
- The repo-cli startup-boundary test caught two eager Effect imports added for host
  cache defaults. They were moved into the entry point's existing deferred module
  group; the allowlist expectation stayed unchanged. Entry-point edits should run
  the narrow startup-boundary contract in the focused proof before publication.

- Hosted coverage on the combined integration head found untested host-default fallbacks for a missing home and an unset config root. Added direct in-process assertions for both safe-local outcomes; keep coverage floors unchanged. This prevents setup probes from being tested only through spawned CLIs, whose execution does not contribute to the parent coverage report.
