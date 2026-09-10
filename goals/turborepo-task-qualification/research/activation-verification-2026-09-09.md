# Activation projection checkpoint: 2026-09-09

The Cache activation preview now binds a disabled live task to a proposed
enabled contract. It checks immutable configuration artifacts and permits only
the selected workspace task's cache flag to change. Candidate and shadow
audits reject enabled ordinary reuse. Identity lint remains excluded at ledger
revision 1; the checkout's child configuration still disables its cache.

## Reproduction and evidence

Run the read-only preview from the checkout root:

```sh
bun run beep cache activation \
  --request goals/turborepo-task-qualification/research/activation/preview-request.json \
  --output .beep/qualification-local-preflight/activation-preview-main.json
```

The current request references [disabled](./activation/identity-turbo.disabled.v2.json)
and [enabled](./activation/identity-turbo.enabled.v2.json) configuration artifacts.
Their SHA-256 values are respectively
`20aa945348385b7947c2ee01f1a23d3ee4f73ebc517842861a55bcb750d8051e`
and `218501e001cdb90a811c9cfe43fdf6198d8be2740f18728cbead902226fb9ecf`.
Both artifacts are separate from the live destination so later activation
cannot overwrite the retained pre-activation evidence.

The observed main-checkout preview produced these identities:

| Identity | SHA-256 |
| --- | --- |
| Disabled configuration | `b7255729d4a83e00e17a66405c32644432360f76851caf34a0aff03e2c415ea2` |
| Proposed enabled configuration | `e9242a98930cc7bfe1b088ca2fedd8fda27412b1c608807a3d20a186aef3537e` |
| Toolchain, identical for both | `b0ab7f5f428f53d83a073f183e3dbb6715f8ccf45e2b36a5dd409d0afad4a437` |

The [checkpoint](./activation-checkpoint.json) binds all 25 owned source/config
files and the retained/current proposal artifacts by SHA-256.
These are computed configuration identities. They grant no execution or
qualification credit and must be refreshed when the bound configuration or
toolchain changes.

## Verification

- The policy suite passed 23 tests, including disabled-target rejection,
  per-client activation-invariance requirements and candidate/shadow rejection
  of ordinary reuse under an inherited cache-enabled baseline.
- The census/projection suite passed 10 tests. Its schema-derived property
  tests 50 alternate task configurations with correctly rebound artifact
  hashes; semantic changes remain rejected. Other cases cover stale source
  fingerprints, tampered artifact bytes, wrong workspace paths and mutable
  evidence references.
- Before adding that property test, the three focused Cache suites passed
  all 22 tests. The property test adds one test, verified in the census suite.
- The current repo-configs full package gate passed audit in 9.6 seconds and
  docgen in 4.1 seconds. CLI source and test type checking passed before the
  final property-test addition; docgen passed 1,538 examples.
- The repo-configs inbox row dated 02:31 UTC remained unacknowledged after
  its introduced formatting/property-coverage findings were repaired. It is
  now acknowledged to this task. Both later package logs pass, at 03:17 UTC
  and 05:24 UTC; their digests are retained in the checkpoint. Current source
  bytes still match the 25-file verification checkpoint.
- The final CLI full package gate, including the property-test addition,
  passed audit in 382.7 seconds and docgen in 20.5 seconds. Schema-first
  validation has zero advisories, missing entries or stale entries.
- Goal doctor reports zero blocking findings and four inherited advisories;
  exploration checks report zero findings. The checkout passes
  `git diff --check`.
- The first admitted native comparison failed before its census because the
  standalone probe omitted `FsUtilsLive`. Cleanup left the owned worktree clean.
  The corrected exact-stable probe passed: the actual enabled native dry census
  matched the predicted fingerprint, and identity lint was the only changed
  configuration node. Cleanup removed its temporary child file and tool aliases;
  the owned worktree is clean and the main disabled file is byte-identical.
  The [sanitized receipt](./activation-native-stable.json) records the two
  fingerprints and exact client pin. The failed setup receives no parity credit.

The initial enabled artifact used expanded array formatting that the real
Biome check rejected. The v2 artifact preserves the disabled file's valid
formatting and changes only `cache`. Original artifacts remain retained.
The disabled source and toolchain fingerprints are unchanged; the read-only
preview was refreshed for the new enabled artifact. The main pilot's child
configuration needed no formatting change.

The existing main/linked-root expanded-input difference remains unresolved.
The native dry-census check cannot establish input portability or
task-output invariance. The real lint capture repair, complete local/shadow
matrix, accepted signed sibling receipts and final Yeet proof remain required.

Private runner logs and the temporary native probe live beneath ignored
`.beep/qualification-local-preflight/` with seven-day retention. No raw task
logs, credentials, home paths or local session identifiers are published here.
