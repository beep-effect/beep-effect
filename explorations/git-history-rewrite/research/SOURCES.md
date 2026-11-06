# Git History Rewrite Cutover — Sources & Provenance

- **Cluster / origin:** the July 2026 cutover workspace (out of repo, untracked)
  and a 2026-11-06 re-measure of `origin/main`.
- **Provenance:** [`../CAPTURE.md`](../CAPTURE.md) 2026-11-06 section.

## 1. Mined source corpus

| Source | Title | Location | Theme | Disposition |
|--------|-------|----------|-------|-------------|
| `july-census` | Commit-message rewrite map and fleet validation | `~/YeeBois/projects/beep-effect-cutover/census/` | message rewrite | reference; ownership decision pending (align) |
| `july-cutover` | Gated cutover and reconvergence scripts, branch curation, decision sheet | `~/YeeBois/projects/beep-effect-cutover/cutover/` | execution plan | reference; ownership decision pending |
| `july-research` | Blast radius, checkout fleet inventory, `.repos` coupling | `~/YeeBois/projects/beep-effect-cutover/research/` | impact | reference; inventory needs redaction before any tracked copy |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `newren/git-filter-repo` | MIT (dual-usable under git.git GPL terms; test harness GPL-2.0), per `COPYING` | run as an external tool; nothing vendored | rewrite engine, `commit-map`, message callback |

## 3. External research sources

- GitHub Docs, "Removing sensitive data from a repository" — <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository> (RESEARCH.md, GitHub section)
- git-filter-repo README — <https://github.com/newren/git-filter-repo>
- git-filter-repo `COPYING` — <https://raw.githubusercontent.com/newren/git-filter-repo/main/COPYING>
- git-filter-repo manual — `docs/man1/git-filter-repo.1` on the `docs` branch of `newren/git-filter-repo` (RESEARCH.md, filter-repo section)

## 4. In-repo capability references

See RESEARCH.md "in-repo capability inventory" for the full table.

- reuse: `@beep/git` (`packages/drivers/git/src/Git.ts`), `KnowledgeCommitSha`, `GitCommitSha`
- reuse/extend: residue reap and `drainable` class (`goals/legacy-drain`), `beep worktree remove --archive`, `yeet sweep --retire`
- affected: 11 ancestry-check call sites, Yeet inbox `headSha` keys, goal completion gate (slug in commit message)
- NET-NEW: rewrite runner, reconvergence command, tracked-file SHA-citation rewrite

## 5. Cross-links & provenance

- `goals/honest-repo-signal/SPEC.md:16,81` — prior non-goal and D6 (no filter-repo).
- `explorations/agent-fleet-layout/DECISIONS.md:160-162` — archive-then-remove ruling for the cutover folder.
- `goals/legacy-drain/SPEC.md:5` — "`beep-effect-cutover` is archived."
