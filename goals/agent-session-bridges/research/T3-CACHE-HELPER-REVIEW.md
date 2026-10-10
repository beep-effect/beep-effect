# T3 header helper dependency cache review

Reviewed 2026-10-09 with GPT-6.1-Sol at medium effort. The schema-policy repair replaces the inline Option-record projection with the existing `@beep/utils` helper and adds its direct workspace dependency.

Compared the canonical census against the preceding reviewed baseline. Only these T3 dependency edges change; commands, command digests, task configurations, cache flags, environment and outputs remain equal:

- `@beep/t3-code#audit`: adds `@beep/utils#audit`.
- `@beep/t3-code#build`: adds `@beep/utils#build`.
- `@beep/t3-code#check`: adds `@beep/utils#build`.
- `@beep/t3-code#coverage`: adds `@beep/utils#build`.
- `@beep/t3-code#lint:deprecated-apis`: adds `@beep/utils#transit`.
- `@beep/t3-code#package-test-typecheck`: adds `@beep/utils#transit`.
- `@beep/t3-code#test`: dependency list ordering changes; the dependency set is unchanged.
- `@beep/t3-code#test:integration`: adds `@beep/utils#build`.

The four cached tasks are build, check, deprecated-API lint and test; audit, coverage, package-test-typecheck and test:integration remain noncached. The canonical writer records only the T3 subject. Preserve the existing qualification scope, profile, epoch and unrelated subjects. This is dependency-posture review and grants no cache correctness qualification.
