# Feature-base isolation — 2026-10-28

The initial worktree was created from the shared checkout's current HEAD,
`4cf7cbef916cdc0d0b8a13c1bc44f7ea8d35de94`. A later scope audit found seven
inherited commits beyond `origin/main`, including 209 unrelated file changes.
Those changes must not enter the citation engine's one delivery PR.

The original checkout and its branch were preserved. The complete pre-rebase
feature history is also retained locally under
`backup/citation-extraction-engine-before-base-isolation-20261028`.
Only this goal's two local commits were replayed onto
`origin/main` at `d3c684edea26987cea6384b296d86960b0bb5d1a`.

Observed scope after isolation:

- `origin/main...HEAD` is zero commits behind and two goal commits ahead.
- Changed paths are limited to this packet, law-practice use-cases, attribution,
  and the exact-file formatter/spelling exclusions required by the corpus.
- The prerequisite and consuming package sources did not differ between the
  inherited base and the selected main base. Effect remains `4.0.6`.
- A frozen install reconciled the worktree dependencies without changing the
  lockfile. The shared checkout's working files were not modified.

Verification repeated after isolation:

```sh
bun install --frozen-lockfile
bun run beep quality package-verify @beep/law-practice-use-cases
bun run goals/citation-extraction-engine/ops/check-discovery.ts
bun run goals/citation-extraction-engine/ops/check-operations.ts
```

Result: full package audit/docgen pass; discovery validates 342 source rows and
1,583 assertion events; operation validation accepts all 826 observations and
4,965 artifacts with source, hash, selection, membership and coordinate checks.
Sanitized verification summaries are retained in `history/evidence/logs/`.
The scope audit is local evidence, not hosted readiness or final goal proof.
