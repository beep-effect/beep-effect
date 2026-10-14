# P4 report — skills-lock v1→v2 migration plan (FP-eyeball input)

Status: phase-0 evidence for Workstream B lock materialization (design:
`research/p4-skills-warehouse-design.md`). Read-only: produced by
`bun run beep skills lock-plan --json` on 2026-10-13 against the tracked
`skills-lock.json` (v1, 35 entries) and the installed `.claude/skills` and
`.agents/skills` trees. Nothing was written. The `--write` path, the lock flip, and
the patch series (PR B-3) wait for this report's verdict.

## Result

35 skills: 6 vendored, 28 local, 1 unresolved (`adhd`, a v1 `github` entry with no
ratified resolution).

| Skill | Provenance | Pin | Upstream head now | Differs from upstream head (patch candidates) | Matches upstream head |
| --- | --- | --- | --- | --- | --- |
| `grill-me` | exact/high | `2ab958093e` | `49dd158d10` | none | 1 |
| `oracle` | inferred/medium | `d6e773a562` | `bf80d4994e` | `SKILL.md`, `agents/openai.yaml` | 0 |
| `portless` | exact/high | `84c5012b2f` | `27598545f0` | `SKILL.md` | 0 |
| `shadcn` | exact/high | `91f21dfe13` | `30a58d4498` | `SKILL.md` | 3 |
| `teach` | exact/high | `2ab958093e` | `49dd158d10` | `SKILL.md` | 4 |
| `turborepo` | exact/high | `6ef1582ec4` | `b5a179deaa` | none | 26 |

Every seed's pinned license hash re-verified live (the resolver refuses on a mismatch).

## Candidate false positives (resolved during this run)

1. **Drift classified against the recorded head.** The first implementation classified
   drift against each seed's `observedHeadRevision` (the head recorded on 2026-07-28).
   `teach` then showed all five files as differing, although the floating updater had
   pulled them from upstream `main` since then. Fixed before this report: the source
   contract gained `resolveRevision`, and drift is classified against the tracking
   ref's live head, recorded per row as `upstreamHead`. After the fix `teach` has one
   file that differs from the head (`SKILL.md`) and four that match it. This was a systematic
   false-positive class, not an isolated row; the fixture test
   (`skills lock migration plan`) pins both classes.

## Findings for the verdict

1. **The floating updater has been rewriting vendored skills.** `turborepo` was
   recorded on 2026-07-31 as a substantial local fork (curated anti-patterns
   reference, compressed routing `SKILL.md`). All 26 of its installed files now equal
   upstream head, so those local customizations are gone from the installed tree.
   `grill-me` and most of `teach`/`shadcn` likewise track upstream `main`, not their
   pins. Design decision B10 (vendored skills stop floating after the lock flip)
   addresses the cause. Whether to restore the turborepo fork from git history is an
   operator content decision, recorded here and not acted on.
2. **Patch candidates are few.** Five files across four skills differ from the current
   upstream head: `oracle` (2), and `portless`, `shadcn`, `teach` (`SKILL.md` each).
   Each is a repo customization or an intermediate upstream pull, and the HITL hunk
   review decides which (review on #1633).
3. **`adhd` needs a resolution** before it can be vendored. It stays local and is
   reported as `unresolved`, never guessed.

## Asks for the verdict

1. Accept the classification (after the fix above) as the B-3 input. Skills whose drift
   all matches the upstream head (`grill-me`, `turborepo`) get pin bumps to
   `upstreamHead` instead of patches, and the five differing files become the initial
   `temporary-drift` patch candidates.
2. Rule on restoring the turborepo local fork (finding 1), or accept upstream as the
   new base.
3. Queue the `adhd` upstream resolution as its own small research task.
