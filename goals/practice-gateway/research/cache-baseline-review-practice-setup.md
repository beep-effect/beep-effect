# Cache baseline review: practice-setup (unit B2)

Reviewed 2026-10-14 for unit B2 of `goals/practice-gateway`
(`history/p1/onboarding-units-brief.md`).

`bun run beep quality cache-policy` reported unreviewed expansions for the new
`@beep/practice-setup` workspace (`#build`, `#check`, `#lint`,
`#lint:deprecated-apis`, `#lint:jsdoc`, `#lint:laws`, `#test`) and
configuration-source drift for its new `apps/practice-setup/turbo.json`.

The workspace was scaffolded by `bun run beep create-package practice-setup
--type app --app-kind service`; its scripts block is the generated task set
(`bun run beep lint package-scripts --write` reports no drift) with the same
commands, inputs, outputs and cache flags as its sibling runtime app
`@beep/practice-claude-mod`, and its `turbo.json` is the scaffold's
(`build.outputs: []`). The extra `package:windows` script is not a turbo task.

The root subject (`//`) changes only through the scaffold's registration:
the `apps/practice-setup` workspace entry in `package.json`, its reference in
`tsconfig.packages.json`, its syncpack source and the regenerated fallow
boundaries. No root task command, input, output or cache flag changes.

Recording them accepts the existing posture for these two subjects only; no
qualification is granted and no other subject changes.
