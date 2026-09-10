# Align the hosted scanner with the reviewed policy syntax

PR #1087 placed the bounded evidence exceptions on main, but PR #1068's hosted
Secret Scanning job still reported 21 historical findings. Job `102970699866`
in workflow run `34506747394` used the pinned Gitleaks 8.24.3 image. The installed
local package is 8.30.1. The global `[[allowlists]]` syntax and `targetRules` field
were introduced in [Gitleaks 8.25.0](https://github.com/gitleaks/gitleaks/releases/tag/v8.25.0).

Use [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
with the verified immutable container digest:

`sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`

The scanner's policy source remains `origin/main`; the PR cannot change the
allowlist or ignore-file authority used by its own hosted scan. The workflow
still scans the complete branch commit range and fails on findings. This change
updates only the scanner executable, with a comment correcting the old version
reference in the configuration.

| Verification | Gitleaks 8.24.3 | Gitleaks 8.30.1 |
| --- | ---: | ---: |
| Bounded fixture findings | 10 | 6 |
| Negative controls retained | 6 | 6 |
| Historical PR findings | 21 (hosted job) | 0 (exact container replay) |

The 8.30.1 replay inspected 36 commits and approximately 20.13 MB using the
base-branch configuration. Negative controls include unreviewed paths, an
unexpected digest-shaped field, non-digest credentials on reviewed paths and a
non-canary secret on the exact synthetic runner path. The four intended fixture
exceptions are the reviewed digest fields and the fixed public canary.

Raw redacted reports remain in the local verification directory. No runtime
qualification evidence or cache-enabled state changed.
