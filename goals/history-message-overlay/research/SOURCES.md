# History Message Overlay — Sources & Provenance

- **Source exploration:** `explorations/git-history-rewrite` — primary ledger:
  [`explorations/git-history-rewrite/research/SOURCES.md`](../../../explorations/git-history-rewrite/research/SOURCES.md).
  This copy reproduces the corpus an implementer needs; the exploration ledger wins on conflict.

## 1. Mined source corpus

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| `july-census` | Reviewed 939-row commit-message map + exclusion list + validators | `~/YeeBois/projects/beep-effect-cutover/census/` until slice 4, then `docs/history/` (map) and `~/.local/state/beep/archive/beep-effect-cutover/` (rest) | message map | import map to `docs/history/`; archive the rest |
| `july-cutover`, `july-research` | Rewrite scripts, curation, fleet inventory | same folder → archive | rewrite (rejected) | archive only; never tracked |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `newren/git-filter-repo` | MIT (per `COPYING`) | not used by this goal | nothing; listed because the rejected alternative used it |

## 3. External research sources

- GitHub Docs, "Removing sensitive data from a repository" — <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- GitHub Blog, "Git Notes Display" (2014 update: no longer supported) — <https://github.blog/2010-08-25-git-notes-display/>
- git-filter-repo — <https://github.com/newren/git-filter-repo>

## 4. In-repo capability references

- extend: `@beep/git` `packages/drivers/git/src/Git.ts` (no notes ops today)
- reuse: `KnowledgeCommitSha` `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:510`; `GitCommitSha` `packages/tooling/tool/cli/src/commands/Codex/Findings.capture.schemas.ts:327`
- extend: `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts` (`worktree new`); `scripts/cloud/bootstrap.sh`
- NET-NEW: `History` command family in `@beep/repo-cli`; post-merge notes workflow

## 5. Cross-links & provenance

- Exploration: [`BRIEF.md`](../../../explorations/git-history-rewrite/BRIEF.md), [`DECISIONS.md`](../../../explorations/git-history-rewrite/DECISIONS.md), [`RESEARCH.md`](../../../explorations/git-history-rewrite/RESEARCH.md), [`MAP.md`](../../../explorations/git-history-rewrite/MAP.md)
- `goals/honest-repo-signal` D6 (no filter-repo) — confirmed, not superseded.
- `goals/legacy-drain/SPEC.md:5` — cutover folder archive line, satisfied by slice 4.
