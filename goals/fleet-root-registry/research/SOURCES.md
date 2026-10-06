# Fleet Root Registry — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back to
its origin. Inherited from the source exploration at graduate (reproduce the
corpus here for implementation convenience AND link the exploration's ledger as
the primary copy). If this goal was authored directly (no exploration), build it
during P0 Research.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here, the exploration's RESEARCH/research, or this goal's
  research/*.md); otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/agent-fleet-layout` — primary ledger:
  `explorations/agent-fleet-layout/research/SOURCES.md`.
- **Provenance:** `explorations/agent-fleet-layout/RESEARCH.md`, `DECISIONS.md`, `research/fleet-census-2026-10-05.md`.

## 1. Mined source corpus

None. No code is ported; patterns only.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| none | — | reference-only | bare-repo worktree layout cited from docs and posts, nothing vendored |

## 3. External research sources

| Title | URL | Used for |
| --- | --- | --- |
| Bun docs, global cache and install backends | https://bun.com/docs/pm/global-cache | hardlink default on Linux; `--backend` |
| Turborepo caching | https://turborepo.dev/docs/core-concepts/caching | linked-worktree cache sharing |
| Turborepo configuration reference | https://turborepo.dev/docs/reference/configuration | `cacheDir` semantics |
| pnpm, git worktrees | https://pnpm.io/git-worktrees | bare store + worktree layout |
| noqta, git worktrees for parallel AI agents (2026) | https://noqta.tn/en/blog/git-worktrees-parallel-ai-coding-agents-guide-2026 | bare-repo pattern |
| Augment Code, worktrees for parallel agent execution | https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution | conflicts move to merge time |

All other claims are workstation measurements recorded in `RESEARCH.md`
"Workstation Census" and "Deferred Items Resolved".

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Fleet mirror (derived checkout view) | `goals/fleet-mirror`, `packages/tooling/tool/cli/src/commands/Worktree/` | reuse (registry joins onto it) |
| Worktree lifecycle | `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts`, `Worktree.constants.ts` | extend (parameterize managed root) |
| `yeet sweep --fleet` discovery | `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` | extend (fleet-root config) |
| Residue reap | `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts` | extend (drain-on-empty class) |
| Timer renderers (`--refresh` forms) | `docs/runbooks/systemd-timers.md` | reuse (re-render against ops seat) |
| Worktree standard | `standards/git-worktrees.md` | rewrite in a graduated goal |
| Seat/lane authored registry | — | NET-NEW |
| Fleet-root config | — | NET-NEW |
| Lane bootstrap (shared caches) | — | NET-NEW |
| ai-metrics retention policy | — | NET-NEW |

This goal's slice of the table: see `SPEC.md` Target Surfaces.

## 5. Cross-links & provenance

- Source exploration: `explorations/agent-fleet-layout` (links.goals lists this packet).
- Sibling goals from the same map: `goals/lane-bootstrap`, `goals/ops-seat-timers`, `goals/legacy-drain`, `goals/ai-metrics-raw-retention`.
- Prior fleet work: `goals/fleet-mirror` (derived mirror this layout builds on), `explorations/fleet-coordination`.
