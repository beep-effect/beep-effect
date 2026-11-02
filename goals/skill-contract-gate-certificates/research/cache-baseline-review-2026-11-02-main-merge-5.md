# Cache baseline review: gate certificates after the fifth main merge (2026-11-02)

PR #2490 merged `origin/main` again (`b5c2b466`, which includes #2593, #2595, #2602 and
#2605) so its open lint and unit gates run against the current base. The only
conflict was `standards/cache-qualification-baseline.json`. It was resolved to
`main`'s version, so every other record stays as `main` has it. This re-record
then stamps, on top of that version, the same single change reviewed in the
earlier `cache-baseline-review-2026-11-02*.md` notes.

Against `origin/main`, `turbo.json` and `standards/policy-tools.fingerprint.json`
still differ by exactly one added input path,
`packages/foundation/modeling/skill-contract/src/GateCertificate.ts`, on
`//#lint:policy-fingerprint:quality`. Command, outputs, environment, dependency
edges and cache flags are unchanged. No qualification scope, profile, epoch or
state changes, no computation becomes cached, and there are no new computations.

This note reviews the declared configuration change only. It is not evidence
that any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `84421ab63e5db7b4e7bcc6e0fe33249e517e1f8cfeccc94c8cf25a9571ff4a54`.
