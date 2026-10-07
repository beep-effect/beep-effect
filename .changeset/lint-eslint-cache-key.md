---
"@beep/repo-cli": patch
"@beep/repo-configs": patch
---

Key the root ESLint cache directory by a digest of the ESLint configuration sources (the
flat config, `tsdoc.json` and the whole policy-pack configs package source) so an edit to an
in-repo rule module or the helpers it imports starts an empty cache instead of replaying
stale results. The `beep-jsdoc` plugin `meta.version` from the first round is removed because
the directory key supersedes it.
