# Cache baseline review: practice-gateway onboarding wiring

Reviewed 2026-10-14 for the merge of `feat/practice-gateway-onboarding` into
`feat/practice-gateway` and the onboarding-skill wiring commit.

`bun run beep quality cache-policy` reported configuration drift for
`@beep/practice-gateway` `#build`, `#check`, `#docgen`, `#lint`,
`#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws` and `#test`.

The drift comes from the package manifest only: the new
`sync:onboarding-skill` script (`bun run scripts/sync-onboarding-skill.ts`,
which regenerates `src/OnboardingSkill.generated.ts` from the shipped
`plugin/skills/practice-onboarding/SKILL.md`). The package's turbo task
commands, inputs, outputs, env and cache flags are unchanged; no turbo task
was added or renamed.

Recording it accepts the existing posture for `@beep/practice-gateway` only;
no qualification is granted and no other subject changes.
