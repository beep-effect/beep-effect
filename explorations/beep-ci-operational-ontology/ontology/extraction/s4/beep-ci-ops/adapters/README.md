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

## Engine identity (why the `.ts` bytes are pinned by the sidecar, not the manifest)

The run manifest pins the Python wrapper (`adapter-typescript.py`,
`script_sha256_12` `eef82542944b`), and the wrapper verifies the TypeScript
engine against the `adapter-typescript.ts.sha256` sidecar at runtime. Neither
the manifest nor the record ids bind the engine bytes themselves, so an edit to
the `.ts` file plus its sidecar would pass the wrapper's check while still
claiming `adapter-typescript@1.0.0`. The v1.0.0 engine is therefore recorded
here as well:

- `adapter-typescript.ts` sha256
  `fc6dec099697c4edfaadb813fe64e605cdf7322a591f2fb3b5203b17b12a8d69`
  (equal to the committed sidecar).

v1.1.0 embeds the expected engine digest in the wrapper source (so the
manifest-pinned wrapper transitively pins the engine) and bumps the adapter
version whenever the engine changes.

## v1.1-era addition: adapter-journal v1.0.0

`adapter-journal.py` is the standard-library-only SourceObservation adapter
for the run-2 fleet's admission journals, attempt journals, and verdict
records. It reads only the three fixed `.properties` path families beneath
`corpus/run2-fleet/` and emits `config_key_value` facts accepted by the
validator's properties pairing grammar. Values are preserved verbatim to the
physical end of line; prose-valued assignments outside the closed object
grammar are never truncated into facts.

Granularity is kind-local and vocabulary-bounded. For each of admission,
attempts, and verdicts, files are visited in lexicographic repo-relative path
order. A file emits one whole-file SourceObservation when it contains at least
one validator-representable key not already observed for that kind; that
record contains exactly the first-occurrence pairing for each such key. Files
with no new key emit nothing.

The no-network adapter sandbox cannot run Git when the worktree's gitdir is
outside the read-only bind, so repository mode reads exactly one 40-hex
`commit:` pin from `work/run-manifest.yaml`. This does not weaken provenance:
the independent auditor gate verifies each record's commit against both the
manifest pin and repository HEAD.

Run 2 deliberately does not re-extract the configuration corpus covered by
run 1. Parked configuration candidates are grounded through ProseObservation
transcription, while any ordering-vocabulary re-proposal is grounded in
prose.

## v1.1.0 record — auditor run 3

`adapter-journal-run3.py` preserves the v1.0.0 adapter and golden bytes. It reads
only `.properties` projections under `run3-fleet`, `run3-checkout-identity`,
`run3b-fleet`, and `run3b-synthetic`, with one observation per selected span.
The run manifest supplies exactly one well-formed 40-hex commit declaration;
missing, malformed, and duplicate declarations fail. The independent validator
still authenticates the commit against HEAD and the pinned source blobs.

| Selection | Deterministic rule | Observation contents |
| --- | --- | --- |
| Vocabulary | First representable occurrence of each key per pin and top-level kind; files in lexicographic repo-relative order; root snapshot has its own kind | First-occurrence pairs for newly seen keys; one whole-file record only when keys are added |
| Synthetic pin | Every properties file, including protocol and both attempt projections | All representable pairs and complete source span; synthetic labels remain as recorded |
| Checkout bindings | First file per value of `kind`, `turbo_local_cache_present`, `turbo_remote_cache_configured`, and same/linked/absent relation between `git_dir` and `git_common_dir` | All representable pairs; absent classes select the file but never mint an absence fact |
| Admission tags | First v3 occurrence per tag and root of enqueued, withdrawn, lease-evicted, ticket-evicted, or released with checkoutRoot and branch | Complete event stanza unless an emitted chain already includes it |
| Contention chains | Every per-pin, per-root nonce chain containing an eviction, or enqueue followed by an admitted/withdrawn outcome in the captured chain | All representable pairs from every chain event; one span from first to last event with complete verbatim excerpt |
| Failure signatures | First verdict file per `(failureKind, failedStepId)` value pair | All representable pairs, including repeated step ids and statuses, and complete source span |
| Cache-plan resolution | First verdict file per value of `cachePlan`, `cachePlanTag`, `turboCachePlan`, `turboCachePlanTag`, `cachePosture`, `resolvedCachePosture`, or `resolverResult`; also `tag`/`_tag` values caller-controlled, local-only, remote-read | All representable pairs and complete source span |
| Other attempts and live projections | Vocabulary only; synthetic attempts use the all-files rule | Newly observed representable keys |

Selection rules overlap. A selected whole-file docket record also carries its
new vocabulary keys. A nonce chain already containing a first-tag event needs
no second copy of that event. Keys and values are never renamed or inferred;
record spans, sorted facts, commit, and adapter version determine canonical ids.

The adapter mirrors v14's properties comment stripping and pairing grammar:
CR/CRLF normalize for pairing, a document-start BOM is ignored, and leading
hash/bang comments accept space, tab, and form feed. Quotes and inline comment
markers remain payload. Values remain verbatim through EOL. Whitespace-valued
objects, empty values, cross-line separators, and continuation-shaped values
cannot become config facts. A selected span with only unrepresentable pairs
uses the separate `unrepresentable_construct` escape record; no value is
shortened to make it representable. Symbol occurrence uses v14's separate
union comment stripper.

The golden locks these rules with synthetic inputs and 31 expected records.
The initial run-3 repository proof emits 152 observations from 1,445 projections.
It includes 53 nonce chains and 125 selected events in each fleet pin.

Known limits at this pin:

- Checkout kinds are `clone` and `linked-worktree`; there is no recorded
  `canonical-runtime` kind. Remote-cache configuration is false in every
  binding. This is configuration evidence, not proof of runtime disablement.
- The fleet manifest says verdicts have no cache-plan field, and none of the
  disclosed cache-result keys occur in their projections. That rider remains
  unsupported by this adapter's live observations.
- Flattened properties preserve leaf keys and record stanzas, not full JSON
  nesting. The full excerpt preserves repeated values and event order; facts
  assert syntactic pairings only. In each fleet's selected chain events,
  checkoutRoot is absent in 29 events and branch in 31. No value is filled in
  from another event or capture.
- Interleaved chains require spanning unrelated events. Their bytes are visible
  in the excerpt; the facts include only the selected nonce's stanzas. Nonces
  and owner references are never joined across pin or admission-root boundaries.
