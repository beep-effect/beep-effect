# Cache baseline review: `@beep/repo-cli` manifest edit (2026-10-31)

`bun run beep cache audit` on `feat/hold-ledger` (PR #2404) reports
configuration drift on six tasks of one subject, `@beep/repo-cli`:

| Task | Drift cause |
| --- | --- |
| `@beep/repo-cli#build` | subject manifest bytes |
| `@beep/repo-cli#check` | subject manifest bytes |
| `@beep/repo-cli#doctest` | subject manifest bytes |
| `@beep/repo-cli#lint:deprecated-apis` | subject manifest bytes |
| `@beep/repo-cli#test` | subject manifest bytes |
| `@beep/repo-cli#test:property` | subject manifest bytes |

The only change to `packages/tooling/tool/cli/package.json` is two added lines:

- `"@beep/epistemics": "workspace:^"` under `dependencies`, so the `Holds`
  command group can bind its records to the claim envelope;
- `"./commands/Holds": "./src/commands/Holds/index.ts"` under `exports`.

Script words, task names, project files, inputs, outputs, cache flags and the
cache posture of every task are unchanged. The request re-records the existing
posture for `@beep/repo-cli` only. It grants no qualification and adds no
exception rows (S31b).
