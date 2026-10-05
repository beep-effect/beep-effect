# Agent Fleet Layout — Sources & Provenance

- **Cluster / origin:** operator grilling session 2026-10-05 in `beep-effect8`
  plus a workstation census run from lane `agent-fleet-layout`.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md),
  [`../DECISIONS.md`](../DECISIONS.md),
  [`fleet-census-2026-10-05.md`](./fleet-census-2026-10-05.md).

## 3. External research sources

None yet. The external landscape sweep is DEFERRED (see `DECISIONS.md`
"external-landscape"). Every claim in `RESEARCH.md` today is a workstation
measurement or an in-repo citation.

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

## 5. Cross-links & provenance

- Sibling exploration: [`../../fleet-coordination`](../../fleet-coordination)
  (graduated 2026-08-06 into `goals/fleet-mirror`). This packet is about
  where checkouts live; that one was about what they know of each other.
- Related memory (agent-local): `agent-post-merge-closeout`,
  `sibling-sweep-flips-primary-clone-branch`, `beep-effect-private-duplicate`,
  `disk-footprint-audit-2026-09-25`.
