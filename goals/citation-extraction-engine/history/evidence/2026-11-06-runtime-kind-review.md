# Installer runtime-kind refusal review

Two review threads on PR #2737 identify the same missing negative test:
PRRT_kwDOPbO_N860oskC and PRRT_kwDOPbO_N860o6T5. The production installer
already refuses mismatched build/runtime metadata; the existing suite covered
the happy path and digest sensitivity but did not execute that guard.

The focused effect test installs the actual Bun document/diff fixture and
passes citationFixtureEngineBuild("node") to the production default engine
configuration constructor. It asserts CitationEngineArtifactFailure and zero
spawned/confirmed native children. The guard and production code are unchanged.

Default-configuration and engine-artifact regression passes six tests across
two files in 9.97 seconds. Package lint/type checks and scoped health/duplication
checks pass. Normal commit hooks and hosted confirmation are recorded during
publication. Both review threads receive the fix commit and proof before being
resolved; no canonical behavior or goal acceptance requirement is waived.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
cd packages/law-practice/server
bunx --bun vitest run test/CitationDefaultConfiguration.test.ts \
  test/CitationEngineArtifact.test.ts
```
