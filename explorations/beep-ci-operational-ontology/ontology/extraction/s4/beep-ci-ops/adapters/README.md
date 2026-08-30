# S4 §4b adapters — v1.0.0 record and known limitations

The three scripts here (`adapter-typescript.ts` + its `adapter-typescript.py`
wrapper, `adapter-config.py`, `po_from_evidence.py` / `runtime_po_capture.py`)
and the `golden/` fixtures are the SourceObservation extractors of the
2026-08-29 `ontology-foundational-auditor` run. Their bytes are pinned by
`script_sha256_12` in the archived run manifest
(`explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/orun-2026-08-29T08:20:55Z.manifest.yaml`)
and by the `adapter-typescript.ts.sha256` sidecar the wrapper verifies. Changing
them would falsify the recorded run, so behavioral fixes ship as **adapter
v1.1.0 in auditor run 2** (`first_run: false`, prior index
`runs/orun-2026-08-29T08:20:55Z.index.yaml`), never as edits to v1.0.0.

Every adapter predicate check is a deliberate MIRROR of the skill's validator:
an adapter that emits more than the validator authenticates produces records
that fail the gate, so under-emission falls through to the honest
`unrepresentable_construct` escape hatch instead.

## Known limitations of v1.0.0 (PR #889 review, 2026-08-30)

1. **JSON unquoted scalars never pair.** `config_pair_occurs` requires an
   unquoted value to terminate at end-of-line (the validator's grammar; `,`
   `}` `]` are not terminators), so `"cache": true,` / `"timeout": 300` in
   `turbo.json` are not emitted as `config_key_value`; a task with no
   pairable fact becomes `unrepresentable_construct` (the config golden locks
   this). Relaxing the adapter alone would fail the gate — the remedy is a
   validator pairing-grammar change upstream in the skill, then a mirrored
   v1.1.0.
2. **Comment stripping is the validator's UNION stripper, not its
   syntax-aware pairing stripper.** `strip_comments` removes `//…` without
   string awareness, so URL values (`$schema`) are truncated before pairing.
   For `.jsonc` corpus files the validator's own pairing path (`cline`
   family) truncates them too; for `.json` files (`turbo.json`, the hubspot
   `package.json`, the boundaries schema) the validator strips nothing, so
   v1.0.0 under-emits pairs the gate would accept. v1.1.0: mirror the
   validator's per-extension `strip_comments_config`.
3. **Objects containing `/` are inexpressible.** The validator forbids
   slashes structurally in object identifiers, so `ident_ok` drops them. The
   corpus has exactly one package-qualified `dependsOn` edge
   (`@beep/api-docs#build`); it is not emitted as
   `task_depends_on_syntactically`, while bare `^build` / `codegen` edges are.
   Inexpressible by contract; recorded here rather than relaxed.
4. **`adapter-config.py` does not fail closed on `git rev-parse HEAD`.** It
   ignores the return code and does not require a 40-hex SHA (the TypeScript
   wrapper does both). Harmless in the recorded run — the gate verifies every
   record's commit equals the manifest commit and HEAD — but v1.1.0 adopts
   the wrapper's check.
