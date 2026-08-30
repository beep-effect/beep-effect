# Opportunities

## 2026-08-30 - scheduler wait hint omitted a required flag

- **Work:** Inspect a live Yeet scheduler holder after the verification wait
  crossed ten minutes.
- **Evidence:** Yeet suggested `bun run beep quality scheduler status`, but the
  command exited with `Missing required flag: --json`; adding `--json` returned
  the healthy scheduler snapshot.
- **Impact:** The operator-facing recovery hint led to an avoidable failed
  command while diagnosing normal backpressure.
- **Prevention:** Include `--json` in Yeet's wait hint, or make scheduler status
  provide a human-readable default when the flag is omitted.

## 2026-08-30 - prose triggered the generic API-key detector

- **Work:** Run the Yeet pre-push secrets lane for the Todox branch history.
- **Evidence:** Gitleaks reported two `generic-api-key` findings in the Todox
  product and goal specifications. Redacted inspection showed both matches were
  short English scope statements with no digits or assignments, introduced by
  the same immutable documentation commit.
- **Impact:** The canonical full proof stopped before its heavy lanes even
  though neither finding contained a credential.
- **Prevention:** Keep credential-like vocabulary out of prose where an
  equivalent phrase is available, or register exact immutable fingerprints in
  `.gitleaksignore` when the wording is part of the accepted specification.

## 2026-08-30 - repair ran before the merged lockfile was installed

- **Work:** Run `bun run beep yeet repair` after merging `origin/main` into the
  Todox branch.
- **Evidence:** Docgen could not resolve `typedoc`,
  `mdast-util-find-and-replace`, `rehype-stringify`, or `remark-gfm`, while
  Fallow 3.17.0 returned exit 1 despite a `status: "ok"` envelope. After
  `bun install --frozen-lockfile` installed Fallow 3.20.0, both Fallow gates
  passed with zero findings.
- **Impact:** The first repair pass spent time on a full quality graph whose
  docgen and Fallow results reflected stale installed dependencies rather than
  the committed branch.
- **Prevention:** Make Yeet repair fail fast on lockfile/install drift, or run
  its frozen-install preflight before any quality gate that loads workspace
  tooling.

## 2026-08-30 - long-lived branch crossed configuration and packet-projection migrations

- **Work:** Merge the latest `origin/main` into `todox-init` while preserving
  the Todox workspace and packet.
- **Evidence:** Git reported content and add/add conflicts in Claude/Codex
  configuration, plus modify/delete conflicts for `explorations/ATLAS.md` and
  `goals/INDEX.md` after those tracked projections were retired on `main`.
- **Impact:** A routine base sync required stage-by-stage resolution to keep
  the Todox workspace registration while adopting the current configuration
  and packet-projection model.
- **Prevention:** Keep feature branches closer to `main`, and provide a
  canonical post-merge config/projection reconciler that preserves newly added
  workspaces while applying repository-wide migrations.

## 2026-08-27 - canonical Impeccable payload fails the whitespace check

- **Work:** Verify the provider update with the repository's ordinary diff
  hygiene check while preserving byte-for-byte equality with the official
  forward-fixed 4.1.2 provider tree.
- **Evidence:** `git diff --check` reports trailing spaces in
  `reference/harden.md` and `reference/optimize.md`, plus an extra blank line at
  EOF in `reference/extract.md` and `scripts/lib/concept-catalog.mjs` inside the
  pinned Claude payload.
- **Impact:** The whole-diff check cannot pass without changing the official
  provider tree or excluding that exact vendored path. Changing it would break
  the release-integrity proof.
- **Prevention:** Publish whitespace-clean provider artifacts upstream, or give
  the repository verifier a narrow pinned-third-party exclusion paired with an
  exact-tree comparison.
