---
title: "Review fixes: calibration file, latest retention, shown-bucket freshness, lease token"
date: 2026-11-10
reversal: "Revert the review-fix commit; the ledger falls back to scanning raw hours for calibration, keeps every latest reading, and judges the parcel by its oldest bucket."
---

Independent behaviour and laws reviews of the P1 slices found that the design as built made the hot parcel read stale and slow. Five deviations from the normative design (2026-11-10-design.md) fix that:

- **Calibration pairs also go to `calibration.jsonl`** at the ledger root, beside their raw-hour rows. The read side and every prune judge calibration from that small file. They no longer decode seven days of raw hours, so `session open` stays inside its 2 s budget for an `OpRef` identity that only the timer samples. Retention keeps that file to the 7-day calibration window.
- **Prune drops `latest/` transport and sample readings older than 24 h.** A key seen once, such as a reviewer App run, the `unresolved` mint or an old token hash, no longer stays in every read.
- **The parcel's envelope freshness covers only the buckets the summary shows**: the fresh `core`, `graphql` and `search` buckets. This changes section 8's "the oldest reading". With no bucket shown, every bucket decides, so a stale ledger still never reads as headroom.
- **The parcel shows each bucket's newest usable reading** (ledger `latestUsable`, the reading `reserveOf` judges). Its numbers and its verdict therefore always come from the same reading. A `graphql` bucket with only uncalibrated REST samples has no usable reading and is left out.
- **The sampler lease body is `{pid, at, token}` JSON with a random token**, as section 4.2 intended. The holder deletes the lock only while the lock still holds its own token. Each `sampleAll` entry is capped at 60 s, under the 120 s staleness bound.

Spawn rows now take the identity the spawned `gh` spends. That is the env token's `token:` hash when `GH_TOKEN` or `GITHUB_TOKEN` is set, mapped through the alias map at record time. Otherwise it is the hosts.yml login. The label stays the hash rather than `unresolved`, so spawn rows land on the same key as that token's transport rows.
