# P4 report — skills-lock v1→v2 migration plan (FP-eyeball input)

Status: phase-0 evidence for Workstream B lock materialization (design:
`research/p4-skills-warehouse-design.md`). Read-only. Regenerated on 2026-10-14 for
PR B-3a from two live runs, `bun run beep skills lock-plan --json` and
`bun run beep skills lock-plan`, against the tracked `skills-lock.json` (v1, 35 entries)
and the installed `.claude/skills` and `.agents/skills` trees. Both runs set
`GITHUB_TOKEN` from the operator's `gh` login, because the path-history walk spends one
REST request per examined revision and exceeds the 60-request unauthenticated hourly
budget. Nothing was written by B-3a. PR B-3b then wrote the lock flip and the patch
series from this classification; its receipt and the post-write plans are in
"Write receipt (B-3b)" at the end.

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

## Write receipt (B-3b)

Run on 2026-10-14 in the B-3b worktree with `GITHUB_TOKEN` from the operator's `gh`
login. The plan schema is now `skills-lock-migration-plan/v3`: it seals the digest of
the lock bytes it read and each vendored entry at its proposed pin, and it covers the
two installed skills the v1 lock never named (`closeout`, `orchestrate`, B15).

1. `bun run beep skills lock-plan --json` over the v1 lock (`lockSha256`
   `9d798c5ff6b311e716b3eeab94c1d57adb0b4d0ed4aa8b2ed149e5a3d1f2b4ff`): 6 vendored,
   30 local, 1 unresolved (`adhd`, `no-ratified-seed`, written as `local`), `planDigest`
   `1185e31402639d881e42577d2f84fea90b9390698a47ad535d821f7426607251`. Every
   pristine row's license re-verified at its proposed pin.
2. `bun run beep skills lock-plan --write --expect 1185e314…7251` returned:

   | Field | Value |
   | --- | --- |
   | outcome | `written` |
   | `skills-lock.json` | `version: 2`, SHA-256 `21b48129a203b03b3ebb36fafc5efdf13dd1e011ad78e772399ccd8116f624df` |
   | entries | 6 vendored, 31 local |
   | `.agents/skill-patches/oracle/0001-skill-md.patch` | `f372350a05de1ad843d211b5b9e9d6131d6538dd61f821ef2aaa8f85c5d05d81` |
   | `.agents/skill-patches/oracle/0002-agents-openai-yaml.patch` | `377459f6f5ce60198c70b6398153f1062b08b7c54cf5c6821b345c98e95d6298` |

   Vendored pins: `grill-me` `fcf0071560`, `portless` `c7f38a6f33`, `shadcn`
   `c257f688cf`, `teach` `321658273c`, `turborepo` `b19f6a59cc` (pristine, no patches),
   and `oracle` `d6e773a562` with the two-patch series above (`temporary-drift`, owner
   `@kriegcloud` from the merge-base CODEOWNERS, drop condition "upstream contains an
   equivalent change"). The series replays: applying both patches with `git apply` to
   the fetched `skills/oracle` tree at `d6e773a562` yields the installed tree byte for
   byte. No file under `.claude/skills` or `.agents/skills` changed.
3. Idempotency (B14). The next plan over the v2 lock has `planDigest`
   `ce5af08296283cf8a7adb2e0fd491872e065af11188b3ac37b2a0ff200c78d23` (6 vendored,
   31 local, 0 unresolved). Its rows differ from step 1 only where the baseline moved to
   the lock's pin: the five pristine skills now show no drift, and `adhd` is a plain
   `local` row. Its entries equal the written lock. `--write --expect ce5af082…8d23`
   reported `already-applied` and wrote nothing; `--write --expect 1185e314…7251`
   refused with `digest-mismatch`; a third plan repeated `ce5af082…8d23`.
4. `bun run beep skills update --check` over the v2 lock skips the six vendored skills,
   reports no lock drift, and reports one inherited drift: `.codex/config.toml` does not
   list `closeout` and `orchestrate` (unchanged on `main`). `--skill shadcn` refuses with
   the pinned-bump route.
