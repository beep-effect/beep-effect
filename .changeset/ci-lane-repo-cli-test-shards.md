---
"@beep/repo-cli": patch
---

Split the hosted Test Unit repo-cli partition into two Vitest `--shard` halves (`repo-cli-1`,
`repo-cli-2`) via an optional shard field on the CI lane partition model.
