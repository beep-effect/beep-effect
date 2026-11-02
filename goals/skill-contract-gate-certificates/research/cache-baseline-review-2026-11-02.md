# Cache baseline review: gate certificates (2026-11-02)

PR #2490 adds `packages/foundation/modeling/skill-contract/src/GateCertificate.ts`.
`bun run beep lint policy-fingerprint --write` therefore appends that one path to
the declared inputs of `//#lint:policy-fingerprint:quality` in `turbo.json` and to
`standards/policy-tools.fingerprint.json`. No other root task changes.

The task's command, outputs, environment, dependency edges and cache flags are
unchanged. The only change is one more input file, which is the policy sources
the task already fingerprints. No qualification scope, profile, epoch or
qualification state changes, no computation becomes cached, and there are no
new computations.

This reviews the declared configuration change only. It is not evidence that
any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `5df5957c050f4e29f7b314a782e7fd6fdfa9aa9bbfec64dbcc75b0b697773bad`.

Drifted computation (subject `//`): `//#lint:policy-fingerprint:quality`.
