# Cache baseline review: gate certificates after the eighth main merge (2026-11-02)

GitHub reported head `ecc4d94b` of PR #2490 as conflicting with the base, so
the PR merged `origin/main` (`c73737de`) once more. That main includes #2599, #2581
and #2531. The only conflict was `standards/cache-qualification-baseline.json`.
It was resolved to `main`'s version, which keeps every other record exactly as
`main` has it. This re-record then stamps the same single change that the
earlier `cache-baseline-review-2026-11-02*.md` notes reviewed.

Against `origin/main`, `turbo.json` and `standards/policy-tools.fingerprint.json`
still differ by exactly one added input path,
`packages/foundation/modeling/skill-contract/src/GateCertificate.ts`, on
`//#lint:policy-fingerprint:quality`.

- Command, outputs, environment, dependency edges and cache flags are unchanged.
- Qualification scope, profile, epoch and state are unchanged.
- No computation becomes cached, and there are no new computations.

This note reviews the declared configuration change only. It is not evidence
that any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `7c7fe1c2f25ec7cbbbdd2eee97559be0650e742ec065dfea15a31157549fec33`.
