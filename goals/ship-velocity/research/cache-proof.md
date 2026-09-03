# Cache proof — 2026-08-27

## Service warmth

- The production write Lambda's three-day CloudWatch window contained 93 PUT-like events and 97
  HIT/200-like events. The first later hit followed the first PUT (timestamps
  `1787570148052` → `1787570148180`); the last observed hit also followed the last PUT
  (`1787581145867` → `1787581145952`). Only aggregate classifications and timestamps were
  inspected; authorization headers and tokens were never rendered.
- Main-push Check run `33047856351`, Build job `98435993179`, enabled remote caching, completed
  successfully, and restored 86 of 134 tasks. The service-side PUT/HIT sequence proves that the
  same production path both uploads and subsequently serves artifacts; console `cache hit` alone
  would not distinguish local from remote.
- The encrypted infrastructure read-only token now exists as repository secret metadata under
  `TURBO_READ_TOKEN`. Same-repository pull requests use it with `remote:r`; forks remain tokenless.

## Local measurement and restoration

`beep cache dashboard` ingested 187 existing Turbo summaries before the focused probes. Using the
locked first-touch denominator, it found 8,278 eligible first touches and 115 remote hits (1.39%);
10 forced/disabled runs were excluded. The run set is a checkout-history sample, not a
representative-week claim, and no Lambda export was mixed into that local sample.

Two isolated `beep cache probe` runs bracketed key de-fragmentation:

| Probe | Cold pass | Warm local-only pass | Result |
| --- | ---: | ---: | --- |
| Before | 0/8 cached, 16.67 s | 8/8 cached, 58 ms | full restoration |
| After | 0/8 cached, 19.22 s | 8/8 cached, 60 ms | full restoration |

The after probe validates that removing per-clone root `.env*` and cross-package story globs did
not break cache restoration. `vitest.setup.ts` remains an explicit input for every test family.
The dashboard's changed-source tripwire is empty on the live sample and is fixture-tested to fail
when a changed package task reports a hit.

## Recovery contract

`beep cache warm` refuses a dirty checkout, any revision other than exact `origin/main`, a Bun
version other than `.bun-version`, missing ephemeral cache credentials, and unresolved `op://`
write-token references. It executes the cacheable build/check/lint/test graph with
`remote:rw --force --summarize` and writes a `cache-warm/v1` receipt. The `Cache Warm` workflow is
manual plus twice-monthly, uses the protected `turbo-cache-write` environment, and retains
receipts and Turbo summaries for the cache's 30-day lifecycle. No workstation write credential is
stored.

## Cache authentication repair — 2026-09-02

### Root cause and repair

The 2026-08-31 timestamp-drift hypothesis is retracted. Digest-only comparison proved that the
infra-vault read-only item and the SSM source are identical. The failing checkouts instead pointed
at a February developer-vault item that predates the AWS cache, and that older item had a different
digest. The legacy root that held a resolved token value matched the February item too. No token
value was printed, copied, or stored during the comparison.

The sanctioned helper now has an explicit `TURBO_TOKEN_REPLACE=1` mode. Its default behavior is
unchanged; replacement mode compares a nonblank `TURBO_TOKEN` with the supplied `op://` reference
and rewrites it only when they differ. It reports the prior state as a vault/item reference or as
`raw value (not shown)`, rejects a non-reference replacement, and never resolves the credential.
The helper corrected or completed the ignored four-name read-only quad in 27 roots: every frozen
live root and every non-live root that already carried a `TURBO_*` name. All 27 passed the
post-repair quad and `git check-ignore .env` checks.

The old reference returned HTTP 403 for a known hosted artifact before repair. After repair, every
root whose exact `op run --env-file=.env` preflight completed returned HTTP 200 for the same
authorization-only GET.

### Frozen liveness snapshot

Snapshot: `2026-09-03T00:11:59Z` (local date 2026-09-02).

The snapshot reused the exact `worktree fleet` rule used by the August 31 scan, identified by the
existing fleet-scan receipt in `research/OPPORTUNITIES.md` and implemented by
`classifyFleetLiveness` in
`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts`. A checkout is live when any
positive probe reports activity: a process cwd inside the root, a confirmed Claude session, or a
Claude transcript or top-two-level non-ignored worktree mtime newer than the 900-second window in
`packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts`. The six in-scope roots were:

- `~/YeeBois/projects/beep-effect`
- `~/YeeBois/projects/beep-effect11`
- `~/YeeBois/projects/beep-effect16`
- `~/YeeBois/projects/beep-effect2`
- `~/YeeBois/projects/beep-effect3`
- `~/YeeBois/projects/beep-effect5`

### Authenticated remote-read sample

Each successful probe used a fresh local cache directory. The counts below are only the first cold
lane touching each task, per the C5 law; the second local-only restoration pass is excluded.

| Root | Preflight | GET | REMOTE | LOCAL | Miss | Classification | Cold summary |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `~/YeeBois/projects/beep-effect` | 0 | 200 | 8 | 0 | 0 | `remote-hit` | `.turbo/runs/3InKBXhXNXcAk7lhkCDER7G32rZ.json` |
| `~/YeeBois/projects/beep-effect11` | 0 | 200 | 8 | 0 | 0 | `remote-hit` | `.turbo/runs/3InKFqn4Snqu14rxS3HFTC364rJ.json` |
| `~/YeeBois/projects/beep-effect16` | 0 | 200 | 8 | 0 | 0 | `remote-hit` | `.turbo/runs/3InKJaLInkk3N4holkAJxnLdg16.json` |
| `~/YeeBois/projects/beep-effect2` | 0 | 200 | 0 | 0 | 8 | `authenticated-cold` | `.turbo/runs/3InKQaPvXmejlDn2UJ78CUBiNN3.json` |
| `~/YeeBois/projects/beep-effect3` | 0 | 200 | 8 | 0 | 0 | `remote-hit` | `.turbo/runs/3InKUEV1VV8ZsaTyuIWflzQiOdF.json` |
| `~/YeeBois/projects/beep-effect5` | 1 | — | — | — | — | `skipped` | — |

The authenticated-cold root was on a different revision and its `bun.lock` digest differed from
every sampled remote-hit root. Because the lockfile contributes to Turbo's global hash, eight
namespace misses are consistent with absent revision-specific hashes rather than authorization
failure. Its GET 200 distinguishes that condition from the old-reference 403.

The skipped root never started an HTTP request or Turbo process: an unrelated non-cache reference
in its `.env` names a field absent from its item, so the exact all-file preflight failed closed.
The scope rule allowed only `TURBO_*` edits in sibling roots, so that unrelated reference was not
changed. This is a visible sample limitation, not a cache authentication failure.

To test the cache configuration without changing the unrelated line, a second canary passed only
that root's four `TURBO_*` assignments to `op run`. This narrow canary is reported separately from
the sanctioned exact-wrapper result:

| Root and canary | Preflight | GET | REMOTE | LOCAL | Miss | Classification | Cold summary |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `~/YeeBois/projects/beep-effect5` — TURBO-only subset | 0 | 200 | 8 | 0 | 0 | `remote-hit` | `.turbo/runs/3InOVsFrddi4BHSO7ayVrd5laqw.json` |

The three evidence levels are therefore: reference coverage in 6/6 live roots; exact all-file
authenticated resolution plus artifact authorization in 5/6, with one unrelated-wrapper skip,
while the TURBO-only canary establishes cache authentication in 6/6 and zero cache 401/403
outcomes; and observed first-touch remote hits in 5/6, with one authenticated-cold root. The main
checkout is a `remote-hit`, and no root is `auth-failed`.
