# P4 report — skills-lock v1→v2 migration plan (FP-eyeball input)

Status: phase-0 evidence for Workstream B lock materialization (design:
`research/p4-skills-warehouse-design.md`). Read-only. Regenerated on 2026-10-14 for
PR B-3a from two live runs, `bun run beep skills lock-plan --json` and
`bun run beep skills lock-plan`, against the tracked `skills-lock.json` (v1, 35 entries)
and the installed `.claude/skills` and `.agents/skills` trees. Both runs set
`GITHUB_TOKEN` from the operator's `gh` login, because the path-history walk spends one
REST request per examined revision and exceeds the 60-request unauthenticated hourly
budget. Nothing was written. The `--write --expect` lock flip and the patch series are
PR B-3b.

The 2026-10-13 version of this report classified drift against the tracking ref's
current head. Its verdict (`p1-fp-eyeball-verdicts.md`, "Workstream B lock plan")
rejected that classification. This version replaces it with the path-history
classification of design decision B11.

## Result

35 skills: 6 vendored, 28 local, 1 unresolved (`adhd`, a v1 `github` entry with no
ratified resolution). Plan schema `skills-lock-migration-plan/v2`, `planDigest`
`0a67d32321bd9b98d5ea41b3e48b43e1eaba2f716c6e719538d0ee4866bf8cb1`. Both runs produced
the same digest.

| Skill | Seed pin | Path-history head (revisions listed) | Pin proposal | Drift from seed pin: matches an upstream revision | Matches no examined revision (patch candidates) |
| --- | --- | --- | --- | --- | --- |
| `grill-me` | `2ab958093e` | `fcf0071560` (6) | pristine at `fcf0071560` | 1 (`SKILL.md` @ `fcf0071560`) | none |
| `oracle` | `d6e773a562` | `aac815aef6` (20, complete) | keep seed pin `d6e773a562` | 0 | `SKILL.md`, `agents/openai.yaml` |
| `portless` | `84c5012b2f` | `7abf4df5d9` (48) | pristine at `c7f38a6f33` | 1 (`SKILL.md` @ `c7f38a6f33`) | none |
| `shadcn` | `91f21dfe13` | `2d3f1cd436` (30) | pristine at `c257f688cf` | 4 (`SKILL.md` @ `c257f688cf`; `rules/chat.md`, `rules/composition.md`, `rules/styling.md` @ `2d3f1cd436`) | none |
| `teach` | `2ab958093e` | `ad5400b930` (15) | pristine at `321658273c` | 5 (`SKILL.md` @ `321658273c`; four `*-FORMAT.md` @ `ad5400b930`) | none |
| `turborepo` | `6ef1582ec4` | `b19f6a59cc` (100, **truncated**) | pristine at `b19f6a59cc` | 26 (all @ `b19f6a59cc`) | none |

A file's revision is the newest path revision whose bytes and mode equal the installed
file. A pin proposal is the newest path revision whose whole mode-aware tree hash equals
the installed tree. Every seed's pinned license hash re-verified live; the resolver
refuses a skill whose license digest moved.

## Against the verdict

- **portless, shadcn, teach are pristine at historical revisions.** portless pins at
  `c7f38a6f33` and teach at `321658273c`, the revisions the verdict named. shadcn pins at
  `c257f688cf` (2026-09-04), the newest commit touching `skills/shadcn` before the
  2026-09-22 floating pull. The verdict named `6cd3f4c65c` from a `SKILL.md`-only
  comparison. `SKILL.md` is unchanged between the two, but other files under the path
  changed, and only `c257f688cf` equals the whole installed tree. An independent check
  with `git hash-object` over the 15 installed files against the GitHub tree
  `b5791523e0` (`skills/shadcn` at `c257f688cf`) found identical blob ids and paths.
- **oracle keeps 2 local files.** Neither `SKILL.md` nor `agents/openai.yaml` equals any
  of the 20 revisions in its complete path history. They are the B-3b patch series.
- **turborepo's history is truncated** at 100 revisions. That does not weaken its pin:
  the newest revision already equals the installed tree, and nothing older was needed.
  The plan still reports the truncation, because a skill with no pristine revision in a
  truncated window would only prove "no examined revision".

## Asks for the verdict

1. Accept the path-history classification as the B-3b input: pin `grill-me`,
   `portless`, `shadcn`, `teach`, and `turborepo` at their proposed pristine revisions
   with no patches, and keep `oracle` at `d6e773a562` with its two files as the
   `temporary-drift` patch series.
2. The turborepo ruling (keep upstream) and the `adhd` resolution task stand as
   recorded in the 2026-10-14 verdict.
