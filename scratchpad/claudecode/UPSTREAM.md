# Upstream provenance

The Claude Code Effect harness and its behavioral tests were migrated from:

- Project: `effect-claudecode`
- Repository: <https://github.com/mpsuesser/effect-claudecode>
- Author: Marc Suesser
- Revision: `0730cf6f06ad33577c7accdf9bd5869f052fbb55`
- Revision date: 2026-06-12
- Imported into this workspace: 2026-07-25
- Upstream license: MIT

The original license text is preserved verbatim in
[LICENSE.upstream](./LICENSE.upstream).

## Incorporated material

- The implementation under this directory is a derivative migration of the
  upstream `src/` tree.
- All 23 upstream behavioral suite files are retained under
  `scratchpad/test/claudecode`. The upstream revision collects 233 tests. The
  local current-surface suite currently collects 231 tests across 24 files
  after removing legacy-only scenarios and adding a dedicated Settings schema
  suite.
- Retained scenarios preserve upstream suite organization where the current
  Claude Code contract still applies. Assertions against decoded values use the
  local domain's `Option` semantics, paired with encoded round-trip assertions
  where needed to prove wire keys remain unchanged and absent keys remain
  omitted.
- Further adaptations cover local source imports, Effect Schema JSON codecs,
  effectful test boundaries, deterministic identities and annotations, typed
  errors, repository formatting, safe import organization, and documented
  current-contract updates.
- Tests that mentioned deprecated fields alongside current behavior were
  rewritten around the current fields.

## Local adaptation

The migration is being adapted to beep-effect's Effect-first, schema-first,
identity, annotation, error-modeling, and formatting conventions. The upstream
revision above remains the behavioral oracle: intentional contract changes
should be documented and tested explicitly rather than silently deleting
upstream coverage. For version-gated settings, the official Claude Code 2.1.220
settings reference takes precedence over SchemaStore; this includes `manual` as
an alias for the `default` permission mode.
