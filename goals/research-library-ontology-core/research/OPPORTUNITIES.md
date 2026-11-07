# Opportunities and friction receipts

## 2026-11-06: new decoding defaults broke 104 hash-bound correction receipts

- **Doing:** converted the library models to `S.Class` and added
  `accessClass` with a decoding default (lane B1).
- **Evidence:** `bun run beep research library verify` on the real library
  reported 104 `correction does not bind immutable before and demoted after
  state` issues. The same command on `main` reported 0. Package tests stayed
  green, because the acquisition test computed the expected hash with the same
  generic encoder.
- **Cause:** `encodeLibraryJson` serializes decoded values through
  `S.fromJsonString(S.Unknown)`. It writes the Type side, including every
  decoding default added later, so a re-encoded legacy capture no longer
  matched its recorded SHA-256.
- **Fix:** hash-bound records encode through their own schema
  (`encodeLibraryCaptureJson`), and `LibraryAccessClassField` omits the
  `public` default on encode.
- **What would have prevented it:** a real-library or fixture-replay
  verify in the package gate whenever persisted models change, and one rule:
  anything that is hashed is encoded by its schema, never by `S.Unknown`.

## 2026-11-06: an unquoted heredoc ate a Codex brief line

- **Doing:** appending an addendum with `$HOME` expansion to a lane brief.
- **Evidence:** `zsh: command not found: shacl:` when the brief was written.
- **What would have prevented it:** a quoted heredoc plus an explicit `sed`
  substitution for the single variable.
