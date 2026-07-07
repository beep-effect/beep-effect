# @beep/pacer

PACER API driver package

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Keep `PacerAuth` and `PclClient` split. Do not add a top-level `Pacer` facade unless the driver error model changes.
- Keep live PACER execution outside this package. Package tests must remain offline-safe through `makePacerMockHttpClient`.
- Do not commit PACER credential values, vault-specific 1Password secret-reference URIs, or operator-local environment files.
