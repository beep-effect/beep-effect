---
{}
---

No release: stop `effect-tsgo patch` leaking a ~30 MB binary backup on every install.

`effect-tsgo patch` renames the current binary to a fresh numbered backup each run and never
reuses or removes one, hard-failing at 100 with `BackupRestoreError: Too many backup files
exist (over 100)`. `unpatch` does not reclaim them either — it restores only the unsuffixed
`.original` and leaves the patched binary behind as a `.<uuid>.patched` file.

That ceiling is reachable. The `oip-web` Vercel project restored its build cache across
deployments until the count crossed 100, after which no deployment could get past `install` —
and because the failure happens during install, the build never wrote a fresh cache, so every
later deployment restored the same poisoned one and failed identically. A developer checkout
here had accumulated 42 backups totalling 1.2 GB.

The root `prepare` script now prunes rotated `*.original.<n>` backups and `*.patched`
leftovers before patching, across every `node_modules/@typescript/*` package. The genuine
unsuffixed `*.original` is kept, since it is the only one `patch` cannot regenerate. Steady
state is two files rather than unbounded growth, and pruning never gates the install: if it
fails it warns and lets `patch` proceed.
