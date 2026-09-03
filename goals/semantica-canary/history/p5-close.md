# P5 close evidence audit

Date: 2026-09-02

Status: archived evidence present; checksum and replay-identity checks passed.

## Audit method

The audit ran `sha256sum -c SHA256SUMS` inside `history/c0`, `history/c1`,
and `history/c2`. Every listed file returned `OK`. Direct `cmp` checks also
confirmed that every archived live/replay `EvalReport` pair is byte-identical:

- C0: the three relation-paper pairs and the full-W1 pair.
- C1: the G pair and the full-W1 pair. The exact-head G replay is also
  byte-identical to the G live and replay reports.
- C2: the full-W1 pair.

The telemetry sidecars are per-run records and are not expected to be
byte-identical. The P1 Cargo record and C2 crash log both exist. No Notion or
atlas state was read or written by this audit, and no atlas sync is claimed.

## P1 records

These records support the lab-mint acceptance criterion. They do not back a
family verdict in `DECISIONS.md`.

- `p1-cargo-check.md`
  SHA-256: `f25054dfc7c914198030ea37dc3f10b2ad39af30a67191588ea88654633c0f19`
- `p1-w1-manifest.md`
  SHA-256: `bb1be5f7d9cca39190b0a9821294a57ea226ae245f5a409a4d3203bb065197ae`
- `p1-gold-v1.md`
  SHA-256: `89326c042d901bb92998594458c919fc423f9c09523c5a9e224c72d57b99c028`

## C0 archive

These artifacts back `DECISIONS.md` entry
`2026-08-30 (C0 pass) — Input and Extraction verdicts`.

- `c0/057e356e94f8.live.eval-report.json`
  SHA-256: `4b54cf0780e098c3c0256aa085865f4e3cae01f339dd2e286f2c725cfd8a00c6`
- `c0/057e356e94f8.live.eval-telemetry.json`
  SHA-256: `4bcf7a7c874a1b82a3d1d9f14b45fcade07b0284cbf10c654e488f9d202978c7`
- `c0/057e356e94f8.replay.eval-report.json`
  SHA-256: `4b54cf0780e098c3c0256aa085865f4e3cae01f339dd2e286f2c725cfd8a00c6`
- `c0/057e356e94f8.replay.eval-telemetry.json`
  SHA-256: `f38dae59b43441a99c9cdab2d09754f589d3dc6cb31565b215a6193cf97d5662`
- `c0/05afbbf3e1e9.live.eval-report.json`
  SHA-256: `9a4fba7286ffee17685335d76d965e763fa13448b8a59165486e79047a3c266f`
- `c0/05afbbf3e1e9.live.eval-telemetry.json`
  SHA-256: `99b4247e7d8ae37321f73da6ef9b4f57a2a41fc52388cde931c2c9fdd8712955`
- `c0/05afbbf3e1e9.replay.eval-report.json`
  SHA-256: `9a4fba7286ffee17685335d76d965e763fa13448b8a59165486e79047a3c266f`
- `c0/05afbbf3e1e9.replay.eval-telemetry.json`
  SHA-256: `72508828fad5a8efa7e06d3bb1d9f0f437acabeff612d97a56bc4735e24f254d`
- `c0/06c93f91ef3d.live.eval-report.json`
  SHA-256: `6e9377c312349ea08b6beeffa001021884ca586005d546ce3195501cd43ecd4f`
- `c0/06c93f91ef3d.live.eval-telemetry.json`
  SHA-256: `1f848a9c69f4411c6341abce50fd97e9c9a2ba8e7c822a63ffbb6fb711b1ac5d`
- `c0/06c93f91ef3d.replay.eval-report.json`
  SHA-256: `6e9377c312349ea08b6beeffa001021884ca586005d546ce3195501cd43ecd4f`
- `c0/06c93f91ef3d.replay.eval-telemetry.json`
  SHA-256: `8f405157cca191a6a58e0231c9a7b6ac62cf53c3912128d124c424e614e6fd0e`
- `c0/full-w1.live.eval-report.json`
  SHA-256: `2d147cd15b79daa09d5c274d3643ff0f0b1dd4df37e7b51ca1f134a2c0248c08`
- `c0/full-w1.live.eval-telemetry.json`
  SHA-256: `3d5270e661e7b904740a30f627e5d4e15afbb1f97ebb434bf1f95b9671c0a58f`
- `c0/full-w1.replay.eval-report.json`
  SHA-256: `2d147cd15b79daa09d5c274d3643ff0f0b1dd4df37e7b51ca1f134a2c0248c08`
- `c0/full-w1.replay.eval-telemetry.json`
  SHA-256: `563baccdbae789fe0fcf8e84d5df2044891cd740a5abb84bd54e8636486536c0`
- `c0/SHA256SUMS`
  SHA-256: `664fdaa34fe55bb8305c7e12218aeda25a8fe2f26e3efb0ec69be2b28a6ea0e2`

Stage record: `p2-c0-r2.md`, SHA-256
`4e8c4413d298d58f3e9aff4c9a97a3886444fde161549f859719da66c69a16d8`.

## C1 archive

These artifacts back `DECISIONS.md` entry
`2026-08-31 (C1 pass) — Storage and Embeddings verdicts`.

- `c1/full-w1.live.eval-report.json`
  SHA-256: `25629ae630a1a9e0b2e116b283e0d46290b4f9db1a18ab4e1387152c320d7e9d`
- `c1/full-w1.live.eval-telemetry.json`
  SHA-256: `9da06ad58bc9540d5f368b24420dcc7be3da129331815b4eb78e84a11c6e3e1c`
- `c1/full-w1.replay.eval-report.json`
  SHA-256: `25629ae630a1a9e0b2e116b283e0d46290b4f9db1a18ab4e1387152c320d7e9d`
- `c1/full-w1.replay.eval-telemetry.json`
  SHA-256: `654479268909fd90bd9ab3b7904994b434513febe159a62113bf80ddbbe893ab`
- `c1/g.exact-head-replay.eval-report.json`
  SHA-256: `5f6448cf51352c088d83ae087687d6e6d61329000ee7236ae4be5c442dfbc9fb`
- `c1/g.exact-head-replay.eval-telemetry.json`
  SHA-256: `4498b75fafe586fba7fcdad02477f868800795e4287619e3698e69d0e20da8fe`
- `c1/g.live.eval-report.json`
  SHA-256: `5f6448cf51352c088d83ae087687d6e6d61329000ee7236ae4be5c442dfbc9fb`
- `c1/g.live.eval-telemetry.json`
  SHA-256: `62224405db16a4d4f7290f8bbfad7caef2514379cdb94595a87402f2f63bfa4d`
- `c1/g.replay.eval-report.json`
  SHA-256: `5f6448cf51352c088d83ae087687d6e6d61329000ee7236ae4be5c442dfbc9fb`
- `c1/g.replay.eval-telemetry.json`
  SHA-256: `2e5784e433df83c1c8e2bf3a934b0ccdd4b97d51adb2a3b1d7d6d6c13b437e41`
- `c1/SHA256SUMS`
  SHA-256: `a1ab63df9a257dbfc3cf3f7c981264568c737238d70bed9cfe59139f07b95199`

Stage record: `p3-c1-r2.md`, SHA-256
`8da9c8e9219e8a0f114e6e7733527a319b19448b39039874e2b009f7dd2924b6`.


## C2 archive

These artifacts back `DECISIONS.md` entry
`2026-08-31 (C2 pass) — Reasoning verdict`.

- `c2/full-w1.live.eval-report.json`
  SHA-256: `d83c382754bd4853a277a05fd5f078c8d27c5275fef96b61a50cd6a37f0ce80c`
- `c2/full-w1.live.eval-telemetry.json`
  SHA-256: `8a84d910de42edd055eb7f59b0786cad13b943935aedafc4be5e0d94a24aefdb`
- `c2/full-w1.replay.eval-report.json`
  SHA-256: `d83c382754bd4853a277a05fd5f078c8d27c5275fef96b61a50cd6a37f0ce80c`
- `c2/full-w1.replay.eval-telemetry.json`
  SHA-256: `3dc9a998a35dad996570942c8ba9b859186a9eebe941c1432e48196b70041133`
- `c2/crash-identity.log`
  SHA-256: `b26ec191499a5fb76999630c00ce433f3d57891cfdb73670926cba506670b392`
- `c2/SHA256SUMS`
  SHA-256: `c4f9ba234607d3bd0654a97b2ccd2faee2d37ecc868c1d5fa2b21867c0ac727b`

Stage record: `p4-c2-r2.md`, SHA-256
`179243b5ecb455bb9ea5b0ee125c5d0b72b7b4edae4c1b945c6e0c57c473f098`.

The C2 checksum manifest covers the four JSON artifacts and `crash-identity.log`.
The archived report pair, `p4-c2-r2.md`, and the dated C2 entry in `DECISIONS.md`
agree on report digest
`2a2089eacaa7f341649b6e1d86991fda526f5d9708e9eaa1f4e9d06e0533b5d1`, the
ratified full-state crash run. At the first closeout pass the merged archive
still held the earlier `7fff1dc0…` run: the commit that archived the full-state
run (authored 2026-08-31 14:33, "archive full-state crash evidence") was never
pushed before #938 merged, so main's archive lagged the verdict by one commit
until the follow-up archive PR landed it. That PR also replaced the replay pair
with a cache-only rerun executed on 2026-09-02 (21:40 CDT, 02:40Z on 2026-09-03)
after the ratified live run, so the archived replay sidecar postdates the live
sidecar as SPEC requires. The
archived live telemetry records cold start 1,183 ms and interactive p95 7 ms;
the C2 entry's original "1 ms / 3 ms" figures came from an earlier probe and
were corrected in place.

## Verdict coverage

All five family verdicts exist as dated `DECISIONS.md` entries:

- Input and Extraction: 2026-08-30, after the C0 pass.
- Storage and Embeddings: 2026-08-31, after the C1 pass.
- Reasoning: 2026-08-31, after the C2 pass.

The archive contains every required report, telemetry sidecar, Cargo record,
and crash log named by the packet. No required artifact was missing.

## Repo quality proof

Three `bun run beep yeet verify` attempts bracket this closeout on 2026-09-02:

1. The Codex closeout lane's sandbox attempt never reached a quality lane: its preflight
   `git fetch` could not write the linked worktree's Git metadata (environment-only; recorded in
   `explorations/semantica-lab/research/OPPORTUNITIES.md` and in the closeout reflection).
2. The orchestrating session's full proof on `dee32f6713` (the first closeout commit, cut from
   `main` at `dbad7e065a`) ran every packet, docs, knowledge, and code lane and failed only
   `repo-sanity:bun-audit` and `pre-push:security` (osv-scan) on `browserslist@4.28.6` and
   `qs@6.15.3` in the shared `bun.lock`. Attribution: inherited. `main` failed the same two
   lanes at that commit, and the dependency-update PR #943 owned the bump.
3. After #943 merged, this branch merged `origin/main` (`c41f0d16c2`, lockfile now resolving
   `browserslist@4.28.7` and `qs@6.16.0`) and the full proof reran green with exit 0 at
   20:03 local time. The SPEC acceptance item for a green `yeet verify` is ticked on that run.
   The final docs-only commit after it is proven by the hosted required checks on PR #944.
