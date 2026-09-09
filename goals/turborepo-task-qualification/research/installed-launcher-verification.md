# Installed pilot and launcher verification

Both exact clients pass the complete local pilot matrix against the verified
installed dependency view and expanded launcher fingerprint. Stable is
`2.10.12`; canary is `2.10.13-canary.1`. Their binary digests, namespaces and
receipts remain separate. The profile is `local-linux-x64-bun1.4.2`, epoch
`qualification-v2`, with source worktrees at `26ae03d182`. The observer changes
are uncommitted and are bound individually by the
[checkpoint](./installed-launcher-checkpoint.json).

| Per exact client | Observed |
| --- | ---: |
| Selected-task observations | 67 |
| Passing checks | 40 |
| Successful fresh selected executions | 44 |
| Successful local hits | 19 |
| Expected fresh selected failures | 4 |
| Fresh dependency executions | 65 |
| Configuration/manifest/dependency mutations | 8 |
| Setup/absent-script controls | 4 |
| Matching local shadow decisions | 10 |

The final [stable](./pilot-installed-launcher-v4-stable.json) and
[canary](./pilot-installed-launcher-v4-canary.json) receipts bind toolchain
digest `cd534958140e4c797791a78b5cb25cef090ea20154b396734914fdb5f1552964`.
Successful selected executions retain 53-byte logs; expected failures retain
138-byte logs. The observer checks source and tool identity again after the
matrix and verifies the retained dependency tree before returning a receipt.

The [native materialization](./installed-dependency-materialization.json)
contains 226,802 regular files, 249,090 entries, 5,382,236,500 bytes and 355
validated relative links. Its canonical tree digest is
`1d6688b88253605123970d0b4a9051431996c7a7fa70957f10c4c077da6636e6`.
It binds paths, bytes, modes and symlink targets while normalizing ownership,
timestamps and hard-link representation. It does not attest registry
provenance, ACLs or extended attributes.

Eight [fresh installed-view commands](./installed-view-execution-observation.json)
show that the external-deprecation control becomes observable with installed
dependencies present. Ordinary exports pass; the deprecated export fails in
both quiet and verbose modes. The missing installation still hides that
failure. Successful execve records establish the Bun/shell/Node/installed
Biome chain, including `ldd`. These probes verify the original retained tree
before and after execution; their controlled export overlays are separate.
They are not installed-tree cache invalidation tests.

The installed stable Turbo package initially replaced the requested canary
through project inference. The version check stopped that run before matrix
execution. The [native selection observations](./installed-client-selection.json)
and v4 runner use `--skip-infer` for every Turbo invocation. Earlier v3 and
pre-helper v4 receipts retain their original authority and toolchain identities.

The merged baseline contains 1,474 executable computations. It accepts 123
inherited complete-script-map digest changes with no changed task command,
configuration, edge or executable population. The new entrypoint attachment
binds 294 source files and six complete snapshots. Cache policy reports zero
blocking findings and 922 unassessed cached computations. The ledger remains
byte-identical, and identity/types lint remain excluded and cache-disabled.

Full `bun run beep quality package-verify @beep/repo-cli` passes: audit
419.6 seconds and docgen 19.9 seconds. Source and test type checks, all 20
focused cache tests, schema-first policy, cache policy, goal doctor,
exploration integrity and reflection-artifact checks pass. Goal doctor retains
inherited fleet advisories and reports no new blocking findings. These checks
do not replace final Yeet and hosted proof.

The [ELF metadata](./installed-runtime-elf-metadata.json) identifies declared
shared-library dependencies for Bun, Node, Biome and Bash; it does not prove
loaded library identity or cover dynamic loading. Complete shared-library and
ambient-input analysis, installed dependency/runtime invalidation, semantic
read/write/capture adversaries, accepted signed conformance/trust receipts,
dynamic entrypoint coverage, adoption and final Yeet/reflect closeout remain
required. No tuple is qualified and no live reuse is enabled by this slice.
