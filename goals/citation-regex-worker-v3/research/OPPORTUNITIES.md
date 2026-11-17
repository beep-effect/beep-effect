# Verification friction

- 2026-11-14, B1 merge validation: a Bun-parent focused coverage run of
  `CitationRegexSession.test.ts` left the Node-compatible input sink pending after
  the real child closed all copies of stdin. The Node-parent run reported the
  expected input error. The stuck test child was killed, then its owned Vitest
  worker was terminated; this attempt is recorded as an unsuccessful probe.
  A typed input-adapter failure with a real child now tests parent retirement
  without depending on this backend behavior. A bounded, cancellable EPIPE
  failure in the platform adapter would make the direct OS probe portable.
- 2026-11-14, after the requested B1 merge: the remote branch
  `origin/feat/citation-native-lane` disappeared locally and `git ls-remote --heads`
  returned no matching branch. The completed merge retains the exact requested
  B1 head `b9089f34c6b`; comparison gates use that commit as their base.
- 2026-11-14, B3 comparison gates: `origin/feat/citation-regex-session` was absent;
  fetching the named branch returned "couldn't find remote ref". The initial
  Fallow command could not resolve its base, and default local docgen compared
  with main and requested a full proof because of inherited lockfile changes.
  Explicit B2 tip `8fb3b8c4fa7` makes the bounded audit and docgen meaningful.
  Handoffs should retain the base SHA beside a branch that may disappear.
- 2026-11-14, B3 v2 deletion: the package source importer census did not include
  the qualification child in `goals/citation-extraction-engine/ops/`. Both
  translator integration tests failed before their child started because that
  script still imported the deleted v2 models. A repository-wide executable
  importer census, including packet ops scripts, would have caught it earlier.
  The retained child now uses the shared payload and explicit configuration;
  its corpus and all qualification assertions are preserved.
