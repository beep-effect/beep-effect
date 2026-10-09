# Stage 5 storage cleanup — blocked preparatory receipt

Revision measured: `9914e98a8624e24c3193a1357e593ce0a65404cd`. Final base refresh: `7febc0287bed98ae84659ee7278e3fe8f2e28b65`.
UTC census timestamp: `2026-10-09T17:07:47Z`. Mode: read-only measurements; no apply.

## Census

The refreshed inventory covers git checkouts in `~/YeeBois/projects/beep-effect*`,
their sibling worktrees, and their `.claude/worktrees` directories. Discovery
requires both `.git` and `.beep`; symbolic links are not traversed recursively.
This is a changing workstation snapshot, not an atomic filesystem snapshot.

Commands: `bun run beep cache census --json`, per-entry
`du -B1 --apparent-size -s`, `du -B1 -s`, and
`btrfs filesystem du --raw -s`; `.pid` files are checked with `kill -0`,
`.pid`/`.lock` holders with `fuser -s`, and checkout cwd holders with
`/proc/*/cwd`. Raw results stay under the lane's ignored `.beep/rsc-g-storage/`.

| Measure | Result |
| --- | ---: |
| Checkouts with `.beep` | 202 |
| Top-level entries | 1528 |
| Apparent MiB | 6709.05 |
| Allocated MiB (`du`, distinct from apparent) | 6817.63 |
| Summed btrfs exclusive MiB | 6503.29 |
| Rows with exclusive-byte measurement | 1528 |
| Rows with live PID references | 0 |
| Rows with held `.pid`/`.lock` files | 0 |

Exclusive bytes are summed per entry. Shared extents retained by other paths
are not reclaimed merely by removing one entry. No measured byte count is a
claim of available reclaim. No holder observed is not proof of terminal state
or absence of paused work. The preflight and refreshed census differ in
checkout count and byte semantics; this refreshed snapshot is the baseline
(R66), without a claim that the difference is reclaimed space.

`cache census` emitted `cache-executable-census/v1` rather than storage rows.
Its output is preserved separately; it establishes no Turbo hit.

## Retention preview

All 1,528 surveyed entries are deferred. Below are the 30 largest surveyed
entries; bytes are exact apparent/exclusive measurements. Owner identity here
is the known ownership domain, not verified session or terminal-state proof.
Every source remains in place, so its recovery destination is `source retained`.
This preview is not a `residue-reap/v3` report and authorizes no apply.

| Path | Apparent bytes | Exclusive bytes | Owner | State | Recovery destination | Retention reason |
| --- | ---: | ---: | --- | --- | --- | --- |
| `~/YeeBois/projects/beep-effect2/.beep/qualification-local-preflight` | 977040162 | 953040896 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa` | 682932709 | 683864064 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/research-library` | 608709631 | 513482752 | research/corpus owner | deferred; terminal unverified | source retained | owner-ruling-required; scope-limited launch |
| `~/YeeBois/projects/beep-effect5/.beep/qa` | 346530461 | 348127232 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect/.beep/professional-desktop` | 210592354 | 210595840 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/qa` | 173475064 | 134868992 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect8/.beep/professional-desktop` | 122179788 | 122175488 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect3/.beep/deps-green` | 107183880 | 110034944 | qualification/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect19/.beep/qa` | 93966735 | 94830592 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect/.beep/qa` | 93828295 | 95358976 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect5/.beep/yeet` | 92870719 | 92721152 | clone / PR / run owners | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect8/.beep/qa` | 79154006 | 79900672 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-pilot-a1/.beep/qualification` | 78822628 | 78811136 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect15/.claude/worktrees/codex-ui-linting/.beep/qa` | 54909083 | 55640064 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect/.beep/yeet` | 54883875 | 54824960 | clone / PR / run owners | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-capture-source/.beep/qualification-procfs-attribution` | 52666629 | 52670464 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-dependency-exclusions/.beep/dependency-exclusions` | 47109349 | 46841856 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect19/.beep/professional-desktop` | 43117521 | 43114496 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect21/.beep/professional-desktop` | 43084753 | 43081728 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect15/.beep/qa` | 43020941 | 43487232 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect15/.beep/professional-desktop` | 42912721 | 42909696 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect17/.beep/professional-desktop` | 42863634 | 42860544 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect6/.beep/professional-desktop` | 41110569 | 41107456 | session/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect3/.beep/professional-desktop` | 39464101 | 39460864 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect5/.beep/professional-desktop` | 39461202 | 39460864 | session/run owner | deferred; terminal unverified | source retained | live-cwd-ref; scope-limited launch |
| `~/YeeBois/projects/beep-effect7/.beep/research` | 36677678 | 36704256 | research/corpus owner | deferred; terminal unverified | source retained | owner-ruling-required; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-census-refresh/.beep/dependency-exclusions` | 33591613 | 33480704 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect2-worktrees/fix-mail-tagging-m365-fixture/.beep/mail-tagging-fixture` | 33054047 | 8192 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |
| `~/YeeBois/projects/beep-effect5/.beep/research` | 31508523 | 32067584 | research/corpus owner | deferred; terminal unverified | source retained | owner-ruling-required; scope-limited launch |
| `~/YeeBois/projects/beep-effect2/.beep/task-qualification-all-dry.json` | 28537039 | 28540928 | qualification/run owner | deferred; terminal unverified | source retained | terminal-state-unverified; scope-limited launch |

## Existing command dry run

At `2026-10-09T17:05:54.657Z`,
`bun run beep quality residue-reap --classes turbo-cache --classes turbo-runs --json`
returned `residue-reap/v2`, zero candidates, zero reap count, zero reclaimed
bytes, and no warnings. It examined the current lane, not the whole fleet.
The current command lacks the requested checkout `.beep` classes.

## Apply and recovery

Applied rows: **0**. Reclaimed apparent/exclusive bytes: **0 / 0**.
No archive destinations or journals were created. Sources need no restoration.
No owner notification or orchestrator apply acknowledgement has been received.
A later operation must produce the v3 dry run, verify owner/terminal state,
exclude cited proof and protected state, and receive acknowledgement before
applying. This receipt is a blocked preparation result, not storage acceptance.

Raw census SHA-256: `3fd8c2aa31354de9d3e8f929dfc66b74775c20545420753b471d1679b4402185`.
Executable census SHA-256: `3086bff381cebf0364cbf5f15a2713822d998b0eea405c860f6a47dd0cf1ea7c`.
Existing v2 dry-run SHA-256: `a9adc27c8edcd02887546a651c2cb228d5abc9c231a5f9bb151bdeecc8b1175d`.

## V3 dry-run publication — 2026-10-09

Revision: `7febc0287bed98ae84659ee7278e3fe8f2e28b65` plus the lane's
retention implementation. UTC: 2026-10-09T17:40:35.938Z. Command:

```sh
bun run beep quality residue-reap --fleet --classes checkout-generated \
  --classes checkout-qa --classes checkout-qualification --classes checkout-jobs \
  --classes checkout-ledgers --classes checkout-pids --classes checkout-material --json
```

The persisted `residue-reap/v3` report contains 2354 rows across
260 enumerated checkout roots. Every row is deferred: 2351
require an owner ruling and 3 fail the bounded filesystem census. This is a
different discovery surface from the top-level 1,528-entry storage census:
QA/qualification/report/job containers are expanded into their owned entries,
protected state is excluded, and the fleet inventory has grown. These counts
must not be subtracted from the earlier census to claim reclamation.

The complete report is persisted privately at the lane's
`.beep/residue-reap/<run-id>/report.json`; its SHA-256 is
`2a5571c89bff30ddd6cc9464a735b286ef58d68442a2ba1997e0837b85cc7e5a`. The public rows below are the
30 largest measurements from that report. `bytes` in this first v3 snapshot
is the sum of regular-file apparent bytes; directory overhead is excluded.
Exclusive bytes are btrfs measurements and may exceed apparent file bytes.
The implementation now also probes `du --apparent-size`; the final fingerprinted
report will record that measurement when the gate wave finishes.

No apply acknowledgement or live-clone owner notice is recorded. No row
was moved, deleted, or purged. Apparent/exclusive physical reclamation remains
**0 / 0 MiB**. Archive paths below are proposed recovery destinations only.
Protected inbox/drafts/packets/proof ledgers and the clone proof identity remain
in place. Research/corpus/runtime classes remain `owner-ruling-required`.

| Source | Apparent file bytes | Exclusive bytes | Owner | State | Proposed recovery destination | Retention reason |
| --- | ---: | ---: | --- | --- | --- | --- |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/research-library` | 608709631 | 513482752 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1609` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-7` | 339528215 | 339124224 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/154` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect/.beep/professional-desktop` | 210592354 | 210595840 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/48` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-8` | 198092022 | 198094848 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/155` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect8/.beep/professional-desktop` | 122179788 | 122175488 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2120` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect3/.beep/deps-green` | 107183880 | 110034944 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1745` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/qa/round-9` | 88435492 | 78409728 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1633` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-12` | 80450355 | 80449536 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/159` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-pilot-a1/.beep/qualification/preflight-stable-native` | 61995167 | 61997056 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1572` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-capture-source/.beep/qualification-procfs-attribution` | 52666629 | 52670464 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1482` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-4` | 46364553 | 46542848 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2021` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-2` | 45068834 | 45252608 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2019` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-5` | 44023960 | 44208128 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2022` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect19/.beep/professional-desktop` | 43117521 | 43114496 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/925` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect21/.beep/professional-desktop` | 43084753 | 43081728 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1680` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect15/.beep/professional-desktop` | 42912721 | 42909696 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/865` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect17/.beep/professional-desktop` | 42863634 | 42860544 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/911` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect6/.beep/professional-desktop` | 41110569 | 41107456 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2065` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-6` | 40001652 | 40181760 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2023` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-7` | 39745625 | 39915520 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2024` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect3/.beep/professional-desktop` | 39464101 | 39460864 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1738` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/professional-desktop` | 39461202 | 39460864 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2010` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect7/.beep/research` | 36677678 | 36704256 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2094` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-census-refresh/.beep/dependency-exclusions` | 33591613 | 33480704 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1483` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/fix-mail-tagging-m365-fixture/.beep/mail-tagging-fixture` | 33054047 | 8192 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1442` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/research` | 31508523 | 32067584 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2016` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2/.beep/task-qualification-all-dry.json` | 28537039 | 28540928 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/967` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-capture-source/.beep/qualification-current-matrix` | 28536192 | 28561408 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/1478` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect/.beep/branch-green` | 28426526 | 28663808 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/75` | owner-ruling-required |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-11` | 28180796 | 28336128 | owner-unverified | unverified | `~/YeeBois/projects/beep-effect3-worktrees/rsc-g-storage/.beep/residue-reap/<run-id>/archive/2028` | owner-ruling-required |

## Reviewed census refresh

UTC: `2026-10-09T18:16:17.588Z`; source wave `4decfe96d35fdd2802db7d7567449af2408da99b` plus
review corrections. Same fleet command as above, `residue-reap/v3`.
Report SHA-256: `4f2d0a0b46097cae9b9e1a96ac15460aae8376f5f6f809bab1c49baf5809979d`.

2475 rows across 262 roots; 2474 owner-required and 1 census-failed.
All deferred, zero applied, zero physical reclamation. Foreign checkout archives
are now observation-only and must be run from their owning checkout. The prior
proposed foreign destinations above are superseded; no data was moved there.

| Source | Apparent bytes | Exclusive bytes | Owner | State | Recovery destination | Retention reason |
| --- | ---: | ---: | --- | --- | --- | --- |
| `~/YeeBois/projects/beep-effect2/.beep/qualification-local-preflight` | 977040162 | 953040896 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/research-library` | 608709631 | 513482752 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-7` | 339528215 | 339124224 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect/.beep/professional-desktop` | 210592354 | 210595840 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-8` | 198092022 | 198094848 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect8/.beep/professional-desktop` | 122179788 | 122175488 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect3/.beep/deps-green` | 107183880 | 110034944 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/research-corpus-synthesis/.beep/qa/round-9` | 88435492 | 78409728 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect-worktrees/recorded-qa-followup/.beep/qa/round-12` | 80450355 | 80449536 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-pilot-a1/.beep/qualification/preflight-stable-native` | 61995167 | 61997056 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-capture-source/.beep/qualification-procfs-attribution` | 52666629 | 52670464 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-dependency-exclusions/.beep/dependency-exclusions` | 47109349 | 46841856 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-4` | 46364553 | 46542848 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-2` | 45068834 | 45252608 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-5` | 44023960 | 44208128 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect19/.beep/professional-desktop` | 43117521 | 43114496 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect21/.beep/professional-desktop` | 43084753 | 43081728 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect15/.beep/professional-desktop` | 42912721 | 42909696 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect17/.beep/professional-desktop` | 42863634 | 42860544 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect6/.beep/professional-desktop` | 41110569 | 41107456 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-6` | 40001652 | 40181760 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/qa/round-7` | 39745625 | 39915520 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect3/.beep/professional-desktop` | 39464101 | 39460864 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/professional-desktop` | 39461202 | 39460864 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect7/.beep/research` | 36677678 | 36704256 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-census-refresh/.beep/dependency-exclusions` | 33591613 | 33480704 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/fix-mail-tagging-m365-fixture/.beep/mail-tagging-fixture` | 33054047 | 8192 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect5/.beep/research` | 31508523 | 32067584 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2/.beep/task-qualification-all-dry.json` | 28537039 | 28540928 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
| `~/YeeBois/projects/beep-effect2-worktrees/qualification-capture-source/.beep/qualification-current-matrix` | 28536192 | 28561408 | owner-unverified | unverified | `run from owner checkout` | fleet observation only; archive from the owning checkout |
