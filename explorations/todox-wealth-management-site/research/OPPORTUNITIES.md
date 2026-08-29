# Opportunities

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
