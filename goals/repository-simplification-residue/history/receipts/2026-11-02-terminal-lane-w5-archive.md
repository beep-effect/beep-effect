# Terminal-lane w5 archive under the 2026-11-02 ruling

Refs #1871. The operator ruled on 2026-11-02 (relayed verbatim by the orchestrator on the issue) that the `residue-reap` apply may proceed on the merged w5 lane under the archive-only rule: the four `checkout-material` rows are archived, never deleted, and each carries its restore command. This receipt records the dry/apply pair, the archive, and a tool defect the pass exposed and fixed.

## Lane

`~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5`, branch `feat/residue-detectors-wave5`, PR #2227 MERGED, HEAD `a892c44f56c143da9b99141be0a47ed89c8abce6` equal to the merged head. A registered linked worktree of `beep-effect3`, clean tree, no process cwd inside it, latest session-ledger row `done` (2026-10-24T21:05Z). The newest operational `.beep` write is 2026-10-24T21:36Z (`.beep/residue-reap/` is bookkeeping and does not count), so the `CHECKOUT_LIVE_DAYS = 7` fence lapsed on 2026-10-31. The lane is otherwise untouched since the 2026-10-24 dry run (#2240): the only later writes are a `.env` refresh on 2026-10-28 and the residue-reap run records below.

## Defect found: the citation index failed closed on every real checkout

The first dry run with the merged tool (run `88bc452c-306a-4f7c-bac2-c56c289106e0`, 2026-11-02T03:23Z) skipped both `checkout-generated` rows as `census-failed`. Cause: the citation index (`citationSkip` in `ResidueReap.ts`) captured `git ls-files -s -z` over the evidence roots through the 512 KiB repo-run output bound and refused a truncated listing. This repository's evidence roots list at 4.3 MB (27,067 entries), so the index could never answer on a real checkout; it then also read all 70 MB of those documents into memory. On 2026-10-24 the write fence fired first, so the defect stayed hidden.

Fix (same PR as this receipt): the index asks git to search instead. One `git --no-optional-locks grep --quiet --perl-regexp` call per row answers by exit status whether any tracked document under the evidence roots contains the relative path, or names an ancestor below `.beep` as a whole token (trailing punctuation aside). Exit 0 is `evidence-referenced`, exit 1 is no citation, anything else still fails closed as `census-failed`. The ruling's evidence path is excluded as before, and a tracked symbolic link is not searched, as before. A new test grows a fixture past the capture bound and checks the ancestor and sibling cases; `residue-reap.test.ts` passes 63/63 on Bun and on Node.

## Dry/apply pair, same decisions

Both runs were made from the lane as the owning checkout with the fixed CLI, over every checkout class:

```sh
cd ~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5
bun run <this-lane>/packages/tooling/tool/cli/src/bin.ts -- quality residue-reap \
  --classes checkout-qa --classes checkout-qualification --classes checkout-generated \
  --classes checkout-jobs --classes checkout-ledgers --classes checkout-pids \
  --classes checkout-material --json            # dry run aa7f2e70-7194-44da-932d-bd0f369412ed, 03:33:41Z
  ... --apply --json                            # apply   c867fb8b-ec42-4399-ba26-8d6b4f145d5b, 03:34:10Z
```

Every row carries owner `terminal-lane#2227`, state `completed`, evidence `pull/2227@a892c44f56…`. The apply reached the same six decisions as the dry run; it moved nothing (`reapedCount 0`, `reclaimedBytes 0`). Bytes are the tool's apparent / btrfs exclusive measurements.

| Row | Class | Apparent | Exclusive | Decision | Why |
| --- | --- | ---: | ---: | --- | --- |
| `.beep/ci/jsdoc-documentation.inventory.jsonc` | checkout-generated | 25,275,614 | 25,276,416 | skip `evidence-referenced` | cited literally by tracked documents (for example `goals/coding-agent-effectiveness-evidence-loop/research/OPPORTUNITIES.md`) |
| `.beep/ci/jsdoc-documentation.inventory.md` | checkout-generated | 196,502 | 196,608 | skip `evidence-referenced` | cited literally by tracked documents |
| `.beep/fallow` | checkout-material | 11,864 | 12,288 | skip `owner-ruling-required` | class policy: `checkout-material` never archives by the tool |
| `.beep/residue-detectors-w5-report.md` | checkout-material | 7,784 | 8,192 | skip `owner-ruling-required` | class policy |
| `.beep/config-census-Ritn8n` | checkout-material | 463 | 0 | skip `owner-ruling-required` | class policy |
| `.beep/w5-proofs.log` | checkout-material | 414,364 | 417,792 | skip `owner-ruling-required` | class policy |

Because the apply had no eligible row, the interruption witness (an apply killed after its intent is journaled, then `--resume`) could not be exercised here; it stays covered by the #2240 fixtures ("resumes an interrupted terminal-lane archive from its intent journal"). The run records sit under the lane's `.beep/residue-reap/<run-id>/` (`plan.json`, `report.json`).

## Archive of the four material rows (operator ruling)

The tool refuses `checkout-material` by class, and the operator ruling is the owner ruling it asks for. The four rows were moved by hand under the receipts' digest convention (a file hashed as itself; a directory as the sha256 of its sorted per-file `sha256  path` manifest, without a trailing newline). The source and the residue store are on the same btrfs filesystem, so each move is a rename. Immediately before each move the fence was re-run and passed: 0 process cwds outside this session's ancestry, ledger `done`, newest operational write 8 days old, clean tree. The digest was recomputed on the archive after the move and equals the pre-move digest in every row; every source path is gone.

| Path (under the lane) | Files | Bytes | SHA-256 (before = after) | Archive | Restore |
| --- | ---: | ---: | --- | --- | --- |
| `.beep/fallow` | 2 | 11,864 | `40caff0df55fb6147eb47b0735400140f07ee47646b52c196baf2bd48b8cf0a0` | `~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/fallow` | `mv -nT ~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/fallow ~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/fallow` |
| `.beep/residue-detectors-w5-report.md` | 1 | 7,784 | `4383275ef63c61cd2c88c4caa65613b75f15669a42712a64dca51cb6e38e9b92` | `~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/residue-detectors-w5-report.md` | `mv -n ~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/residue-detectors-w5-report.md ~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/residue-detectors-w5-report.md` |
| `.beep/config-census-Ritn8n` | 8 | 463 | `e9d1bec8bc901ca78a04ff228781b31efa657214e7d21ee576176c9b872fec35` | `~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/config-census-Ritn8n` | `mv -nT ~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/config-census-Ritn8n ~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/config-census-Ritn8n` |
| `.beep/w5-proofs.log` | 1 | 414,364 | `89bdadc468f69e362738e8ebeb35f8d0ac2c16308a2e236dd80fc8cdf73fc31c` | `~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/w5-proofs.log` | `mv -n ~/.cache/beep/residue/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/w5-proofs.log ~/YeeBois/projects/beep-effect3-worktrees/rsc-residue-detectors-w5/.beep/w5-proofs.log` |

Restore precheck: the original path must be absent, and the archive's digest must still equal the row's (for a directory, run the manifest command from `stage-3-a-local-residue.md` inside the archive). Moved bytes: 434,475 apparent across the four rows. Physical reclamation: **0**, under #1871's rule that archive moves alone count zero. Nothing was deleted.

## Left in the lane

- `.beep/ci/jsdoc-documentation.inventory.{jsonc,md}` (25.5 MB): retained by the citation fence. They leave with the lane's own retirement (`yeet sweep --retire` preserves git-ignored `.beep` material in the worktree archive).
- `.beep/inbox`, `.beep/yeet`, `.beep/residue-reap`: protected names and bookkeeping, outside every class.

The lane itself is now ready for the retirement step the #2240 comment named; this pass did not retire it, since that is a worktree removal and not an archive move.
