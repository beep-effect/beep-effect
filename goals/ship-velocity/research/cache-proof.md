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
