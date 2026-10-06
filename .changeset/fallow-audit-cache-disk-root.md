---
"@beep/repo-cli": patch
---

Keep Fallow's reusable audit base snapshots off tmpfs. `beep quality fallow`
now runs Fallow with `TMPDIR` pointed at `~/.cache/beep/fallow` (override with
`BEEP_FALLOW_CACHE_ROOT`) and forwards a two-day `FALLOW_AUDIT_CACHE_MAX_AGE_DAYS`
so Fallow's own per-run GC reclaims idle snapshots; `yeet sweep --retire`
deletes the retired lane's snapshot; `quality tmpfs-reap` also scans that root,
reaps an abandoned snapshot (recorded owner root gone) immediately, and holds a
live owner's idle snapshot for one hour instead of six.
