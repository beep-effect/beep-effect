---
"@beep/repo-cli": patch
---

Add `bun run beep knowledge refs`, a read-only reference census over one Git tree: repository paths,
machine-local host paths, and `repo://goal/*` identities are extracted, resolved against the tree's
tracked entries alone, and classified by a pure twelve-class rule table. The shared Markdown scanning
machinery — governed path normalization, fence-aware line reading, inline-span reading, and the
length-prefixed digest discipline — moves into `Knowledge.refs.ts` so Stage-1 enforcement and the
census read documents through one grammar.
