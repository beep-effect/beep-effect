# P6 after the P5 merge: cache review

P6 (text-knowledge-stack-rebuild operations) merged the P5 head `32c7cc87987`, which
re-recorded the law-practice domain package and the root after P5's doctest script pair
change. The merge took P5's two baseline files as they stood. Those files do not carry P6's
manifest edges, and P6's writer-check fix commit `adc3edcab56` changed three more manifests.
`bun run beep cache audit` then reports 26 blocking findings on five subjects. Each input
change is listed below.

- `@beep/law-practice-domain`: P5's re-record predates P6's dependency edges on epistemics
  and jsonc for the law-owned claim core and the matter scope values. The task configuration
  fingerprints read the manifest, so build, check, doctest, lint:deprecated-apis, test and
  test:property drift.
- `@beep/law-practice-use-cases`: the manifest drops its semantic-web development
  dependency. P6 removed the SHACL validation imports from the office-action flow and signal
  tests, and nothing else in the package imports it.
- `@beep/nlp`: the manifest drops its text dependency. P6 moved Core, which was the package's
  only reader of text positions, to nlp-processing.
- `@beep/jsonc`: the generated doctest script pair is added and the package lists the test
  runner its ActivityRecord test imports. The doctest task is the new expansion. It runs the
  package's vitest suite with `BEEP_VITEST_DOCTEST=1`, like every other package's doctest task.
- Root `//`: only the recorded `turbo.json` source digest changes. P6's shared
  policy-fingerprint task reads jsonc's ActivityRecord module as an input, and that input
  was recorded in the P6 L5 and L7 review.

No cache flag, output or environment changed for the existing tasks, and no cache qualification
is granted. All five subjects are re-recorded under the checkout's Bun 1.4.5 profile, keeping
the qualification-v3 epoch and the existing lint scope.
