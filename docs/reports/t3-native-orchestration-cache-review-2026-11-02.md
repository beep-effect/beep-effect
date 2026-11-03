# Cache baseline review: agent-to-agent stack removal (2026-11-02)

Branch `feat/t3-native-orchestration` (`goals/t3-native-orchestration`). The re-record covers
every subject `bun run beep cache audit` reported as drifted after the deletion:
`@beep/repo-cli`, `@beep/ai-provider-cli`, `@beep/repo-ai-metrics` and `//`.

## What changed

- **`@beep/repo-cli`** dropped the `commands/AgentMessage` export and its
  `@beep/ai-provider-cli` and `@beep/t3-code` dependencies, so its manifest bytes and its
  `tsconfig*.json` project references changed. Every task whose review basis includes the
  manifest drifts (`build`, `check`, `doctest`, `lint:deprecated-apis`, `test`, `test:property`).
- **`@beep/ai-provider-cli`** dropped the eight `AiProviderCliSession.*` null exports and the
  `@beep/acp` dependency; same task set.
- **`@beep/repo-ai-metrics`** dropped its `@beep/ai-provider-cli` dependency; same task set.
- **`//`**: `turbo.json` no longer lists the deleted `@beep/t3-code` manifest among the
  `//#lint:policy-fingerprint` inputs, and
  `standards/policy-tools.fingerprint.json` was rewritten by its writer.

No command, output, cache flag or env key of any task changed. This review re-records the legacy
posture of those subjects at the new manifest bytes and grants no qualification.
