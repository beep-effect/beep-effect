# Test Crypto promotion audit

Date: 2026-08-13

## Live census

Seven `Crypto.make` test providers exist across five files:

- `CandorPolicy.test.ts`: one genuine Web Crypto provider used to prove real
  SHA-256 anchor verification without adding a runtime-specific platform
  dependency to the use-case package.
- `EntityKernel.test.ts` and
  `ContradictionTriage.observability.test.ts`: two identical identity-digest,
  fixed-random fixtures.
- `ThreadStore.test.ts`: three behavior-specific providers for yielding,
  fail-after-first-call, and fail-on-initialization scenarios.
- `VerifiedTextAnchor.test.ts`: one deliberate digest-failure provider.

The repository also uses `BunCrypto.layer` and `NodeCrypto.layer` directly where
the test wants the real platform implementation.

## Disposition

No shared test Crypto layer is promoted. Five of the seven providers encode
distinct behavior under test. The only exact duplicate has two consumers and
implements cryptographically false identity-digest semantics; publishing it as
a general helper would make misuse easier while saving roughly ten local lines.
That does not meet the shared-helper promotion bar. The census is terminal and
does not reserve a future build item.
