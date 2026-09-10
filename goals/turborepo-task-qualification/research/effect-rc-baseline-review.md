# Integrate the reviewed main configuration after the Effect upgrade

This integration follows the operator request to merge `main` after PR #1060.
The imported base is `6b1ebc8d33a386a3c57eb990b74a656dd17680a1`. The root `turbo.json` is byte-identical to that
base. The only task configuration files this branch adds are the existing
identity/types lint overrides, both with `cache: false`.

The exact-client census now includes Turbo's `//` root workspace, whose scripts
come from the root manifest. It records 143 workspaces including that root and
1751 executable computations. The prior baseline had 1474 executable computations.
The 277 additional identities are root and package lint tasks already registered
and cached by the merged main configuration. The machine-readable
[delta](./effect-rc-baseline-delta.json) enumerates additions, removals and changes
to existing definitions.

Accept this inherited configuration as the legacy audit baseline for the paused
qualification pilot. This is an integration review of declared configuration,
not evidence that those computations satisfy the runtime qualification contract.
Cached legacy computations remain unassessed unless their ledger says otherwise.

Retain the identity/types scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch. Preserve the qualification ledger bytes and its
excluded states. The new root workspace is explicit: unknown workspaces and
root command mismatches still fail census validation. Earlier runtime matrices
retain their historical pins and receive no credit for the upgraded runtime.
