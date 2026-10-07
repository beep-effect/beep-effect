---
"@beep/repo-cli": patch
"@beep/repo-configs": patch
---

Cut the warm `bun run lint` floor: the JSDoc inventory task is cacheable, the
tsconfig-overlay, package-test-typecheck, effect-vitest and JSDoc ratchet checks
run as cached root Turbo tasks instead of uncached repo-cli steps, the root
ESLint program keeps a content-keyed cache, and the git-delta knowledge checks
(`knowledge:semantic-delta`, `knowledge:refs-check`) run in hosted full-scope
plans only. The `beep-jsdoc` ESLint plugin carries a content-derived `meta.version` so the ESLint cache key follows rule edits.
