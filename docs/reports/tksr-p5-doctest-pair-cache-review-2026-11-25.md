# P5 doctest script pair: cache review

P5 (text-knowledge-stack-rebuild taxonomy) regenerated the doctest script pair of the
law-practice domain package after its asset-pack move (`efbe8b14b55`). That came after the
package's earlier P5 re-record (`f8cbd3c9f69`). `bun run beep cache audit` then reports nine
blocking `configuration-drift` findings and one `unreviewed-expansion` finding on that
package, and the root subject carries a `turbo.json` source drift. Each input change is
listed below.

- `#build`, `#check`, `#docgen`, `#lint`, `#lint:deprecated-apis`, `#lint:jsdoc`,
  `#lint:laws`, `#test` and `#test:property`: the package manifest gains the generated
  `doctest` and `beep:doctest` scripts, which every task's configuration fingerprint reads.
- `#doctest`: the new task the generated script pair adds. It runs the package's vitest suite
  with `BEEP_VITEST_DOCTEST=1`, like every other package's doctest task.
- Root `//`: only the recorded `turbo.json` source digest changes. The file moved with the
  main merges this branch took (the #3540 squash `b288d08e014` and `f9b9d10be5b`); this PR's
  `turbo.json` is identical to `main`'s, and no root task configuration changed.

No cache flag, output or environment changed for the existing tasks, and no cache qualification
is granted. Both subjects are re-recorded under the checkout's Bun 1.4.5 profile.
