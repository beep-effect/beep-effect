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
