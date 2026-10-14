# TsNativeApi and TypeScript 7 walker migration

Implement the scoped TypeScript 7 unstable API service in `@beep/repo-utils`.
Port first-party classic compiler imports, preserve scanner assertions, remove
operator-retired research scripts, and document programmatic access.

Read `SPEC.md`, `PLAN.md`, `README.md`, and `ops/manifest.json` for scope and evidence.
The Claude orchestrator owns git, publishing, merge, reflection, and completion.
This lane must not run git add/commit/push, gh, or Yeet. Keep the packet active.

Run heavy verification through `beep-heavy`; compile dependency dists first.
Check/build use tsc-rs 0.6.0. Editor and native API tooling use @effect/tsgo 0.51.1.
Validate API calls against installed declarations. Record decisions and friction
as they occur. Report to the orchestrator's `ts7-exit/lanes/report-D.md`.
