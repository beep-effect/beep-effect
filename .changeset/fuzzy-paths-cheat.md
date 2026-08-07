---
{}
---

Lint-toolchain-modernization P3: add the oxlint lint-only lane. 5 stateful/path-aware rules (namespace-node-imports, no-global-process-runtime, no-inline-schema-compile, no-manual-effect-runtime-in-tests, no-opaque-instance-fields) ported to @beep/lint-rules/src/rules as oxlint ESTree plugins. no-opaque-instance-fields mandatory; the rest advisory. Internal tooling; no package releases.
