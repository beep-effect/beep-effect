---
"@beep/repo-cli": patch
"@beep/repo-configs": patch
---

Cut the warm `bun run lint` floor: the JSDoc inventory task is cacheable, the
tsconfig-overlay, package-test-typecheck, effect-vitest and JSDoc ratchet checks
run as cached root Turbo tasks instead of uncached repo-cli steps, the root
ESLint program keeps a content-keyed cache, and the git-delta knowledge checks
(`knowledge:semantic-delta`, `knowledge:refs-check`) run in hosted full-scope
plans only. The ESLint cache directory is keyed by a digest of the ESLint configuration sources (the flat config, `tsdoc.json` and the policy-pack configs package source) so a rule or helper edit starts an empty cache; the `beep-jsdoc` plugin `meta.version` from the first round is removed because the directory key supersedes it.
