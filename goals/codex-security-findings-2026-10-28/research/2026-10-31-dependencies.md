# Supplemental dependency remediation — 2026-10-31

The live GitHub REST open-alert inventory contains 20 exact IDs, #450–#469,
recorded in `ops/dependabot.json`. These are additional to the 123 historical
alerts in the October 20 packet and seven Cloud findings in this packet.
No alert was dismissed. Version-based upstream remediation is used regardless
of whether a particular vulnerable path is reachable in current use.

| Library | Prior lock | Fixed lock | Alerts | Owning manifest |
| --- | --- | --- | --- | --- |
| setuptools | 84.0.0 | 84.2.1 | 450 | photo-face uv.lock |
| filelock | 3.32.4 | 4.2.5 | 451–453, 459–467 | photo-face uv.lock |
| rustls | 0.23.45 | 0.23.46 | 454–457 | desktop Cargo.lock |
| zip | 4.6.1 | 9.2.0 | 458, 468–469 | desktop Cargo.lock |

GitHub advisory metadata identifies first-patched releases of setuptools
84.1.0, filelock 4.2.1, rustls 0.23.46 and zip 9.0.5 (the strictest zip bound).
Representative primary records:
[filelock](https://github.com/advisories/GHSA-v4x8-3wr5-3wq8),
[rustls](https://github.com/advisories/GHSA-vp88-798v-h67f),
[zip](https://github.com/advisories/GHSA-m665-v7pm-7grj).

## Resolver changes

`uv lock --upgrade-package filelock --upgrade-package setuptools` changed only
these two Python package versions. Exact constraint pins preserve the selected
fixed versions; a subsequent generated lock and `uv lock --check` pass. Both
PyTorch cohorts, model declarations, wheel identities and other package
versions remain unchanged.

The desktop updater 2.10.1 requires zip ^4 on Windows, so Cargo correctly
refused a direct zip 9.0.5 update. The compatible automatic updater selection
2.12.0 still required zip ^4. Official updater 2.14.1 requires zip ^9, Tauri
^2.12 and Rust 1.90; the manifest now requires updater >=2.14.1 within v2.
`cargo update -p tauri-plugin-updater --precise 2.14.1` generated the associated
Tauri 2.12 dependency-family update and selected zip 9.2.0.
`cargo update -p rustls --precise 0.23.46` applied the TLS patch.
No registry checksum, package version or lock entry was hand-authored.
The existing licensed GLib source backport remains wired and unchanged.

## Qualification

- Frozen Python environments are disposable; existing worker environments and
  model stores were not changed. Default suite: 53 passed, three expected
  absent-torch skips. CPU and ROCm cohorts: 56 passed each, zero skipped.
- Python Ruff and uv lock validation pass. This is worker compatibility proof,
  not real-photo inference, model-quality certification or GPU benchmarking.
- Desktop sidecar builds; `cargo check --locked -j 2` and
  `cargo clippy --locked -j 2 -- -D warnings` pass on Linux. The first check
  lacked the generated sidecar, so the normal sidecar build ran before retry.
- Affected desktop and CLI `quality package-verify --quick` lint/check pass.
  Native Cargo and Python proof cover the edited dependency surfaces directly;
  hosted checks provide the publication gates.
- The zip dependency is Windows-only in the updater; all-target dependency
  resolution includes the fixed release. The Linux compilation is not a claim
  of native Windows updater execution.

Merged-revision dependency graph ingestion and exact external alert closure
remain pending. Do not complete the expanded packet until they are observed.
