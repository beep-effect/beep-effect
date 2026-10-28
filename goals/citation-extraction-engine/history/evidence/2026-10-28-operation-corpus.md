# Public-operation oracle corpus — 2026-10-28

Scope: P0 normalized input/stage/output evidence for public calls observed in
the official pinned suite. P0 remains open. This is not the final canonical
case ledger, model/helper proof, or a target implementation parity result.

## Source and artifacts

- Oracle commit: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.
- Oracle tree: `a35a58fac03400f71a93a93485b77f1d56f2b02f`.
- CPython: `3.11.15`; all 52 instrumented methods pass.
- Schema/exporter version: `citation-oracle-operations/v1`.
- Oracle lock SHA-256:
  `864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a`.
- Fixture:
  `packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json`.
- Source/runtime exporter: `ops/export-operations.py`.
- Portable validator: `ops/check-operations.ts`.
- Corruption controls: `ops/verify-operation-controls.py`.
- Test-only contract: `CitationOracleOperations` from
  `@beep/law-practice-use-cases/test`.

The exporter reads the AST to inventory public-operation call sites, then
captures runtime invocations without modifying tracked oracle source. Every
observed invocation must refer to its static call site; every inventoried site
must be observed. Source-content hashes cross-check against the independently
retained `oracle-discovery.json` file inventory.

The corpus contains 31 static call sites and 826 runtime observations:

| Operation | Observations |
| --- | ---: |
| `get_citations` | 760 |
| `resolve_citations` | 30 |
| `annotate_citations` | 24 |
| `clean_text` | 12 |

825 observations succeed; one captures the expected invalid-cleaner failure.
The extraction records include 793 filter/disambiguation stages and six
observed logger warnings. The validator checks 2,811 individual span records.
Two tokenizer configurations each contain 6,805 extractor records. These are
pattern instances, not yet classified regex families or JS safety evidence.

## Normalization rules

1. Each observation has one canonical JSON payload containing input, stages,
   and outcome. Its SHA-256 covers the exact UTF-8 bytes. The TypeScript
   consumer hashes those original bytes instead of reserializing Python values
   with JavaScript key-order or integer rules.
2. The fixture codec retains the original JSON string and its derived typed
   value. Coherent decoded data encodes to the identical bytes. A forged
   raw/value pair fails encode. Both decode and encode are partial; the
   information law preserves the original bytes. Tests cover these laws.
3. All citation dataclass fields are retained except the cyclic `document`
   reference. Its source/plain/markup text, token stream, citation-token stream,
   and emphasis tags live in the owning extraction stage. Citation snapshots
   additionally retain corrected text and all three observable span methods.
4. Deeply immutable Reporter/Edition values are shared by content hash.
   There are 4,965 shared artifacts, including the two tokenizer configurations.
   The validator rejects missing, unaccounted, or hash-inconsistent artifacts.
   Frozen Resource objects are not memoized: their citation remains mutable.
5. Python class names are representation tags, datetimes use ISO text, unordered
   sets use sorted membership records, and integers beyond JavaScript's exact
   numeric range use decimal-string records. Unclassified values and floating
   values fail generation rather than being omitted or stringified with repr.
   Exact/variation/all-edition candidate bags sort by normalized artifact
   identity, preserving all candidates and multiplicity. `edition_guess` and
   all actual decisions remain untouched. `edition-candidate-order.json`
   retains six changed case pairs and proves that this is the only difference
   across two seeded, unnormalized runs. `CitationToken.merge` constructs
   edition tuples through sets; `guess_edition` selects only when one candidate
   remains. Normalization version `public-operation-normalization/v1` records
   these rules. The validator rejects a reordered bag even with a fresh hash.
6. Callable identities retain module/name and source hash/location when local
   to the pin. They are evidence for later server-port mapping, not executable
   request callbacks or proof of an adopted extension.
7. Every emitted range explicitly names `plain-text` as its coordinate space.
   Python code-point indices and UTF-16 indices are retained together with the
   exact sliced text. The portable validator uses the public verified-span
   converter to check them. Source/markup text stays separate. These records
   do not claim verified raw-source anchors or solve normalization-to-raw maps.
8. Filter stages retain pre-filter candidates and selected occurrence indices.
   Selection indices must exist, and the last selection must equal extraction
   output. Resolution indices similarly retain observable occurrence membership
   without copying Python memory addresses. They are oracle comparison data;
   production relationships still require stable mention/authority IDs.
9. Warning templates and arguments are captured as fixture evidence. This does
   not authorize emitting raw text or arguments in production trace attributes.

## Clock and dependency inputs

Unseeded regeneration initially differed in the two tokenizer-configuration
artifacts; all 760 extraction observations differed only in the configuration
hash within input. A structural comparison found set-derived extractor string
ordering, while observed stage/output values stayed equal in that unseeded
comparison. The exporter now
requires `PYTHONHASHSEED=0` at interpreter startup and verifies that Python hash
randomization is disabled. The seed is explicit metadata. No generated ordering
is silently sorted into a different executable tokenizer configuration.

The pin observes the current year in `Edition.includes_year`, the helper's
highest-valid-year boundary, and one upstream test. The exporter fixes that
environment input to `2026-10-28`, replacing only in-process clock bindings.
Tracked source is unchanged, and the fixed year is explicit corpus metadata.
The later engine must reproduce these cases through a controlled Effect clock.

The oracle's lock uses `reporters-db 3.2.53` and `courts-db 0.10.22`; the public
vocabulary artifact uses newer pinned data. The corpus also records exact
versions of eyecite, regex, lxml, fast-diff-match-patch, and pyahocorasick.
Do not silently replace oracle data with the newer vocabulary data. Mapping
oracle reporter/court observations to the public stable IDs, including version
differences, remains explicit P0 compatibility work before semantic schemas
freeze. Raw generated vocabulary imports are still prohibited.

## Reproduction and proof

```sh
PYTHONHASHSEED=0 "$EYECITE_ORACLE_ROOT/.venv/bin/python" \
  goals/citation-extraction-engine/ops/export-operations.py \
  --oracle-root "$EYECITE_ORACLE_ROOT" \
  --output packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json
bun run goals/citation-extraction-engine/ops/check-operations.ts
python goals/citation-extraction-engine/ops/verify-operation-controls.py \
  --scratch-root "$HOME/.cache/beep/citation-extraction-engine"
bun run --cwd packages/law-practice/use-cases test -- \
  test/CitationOracleOperations.test.ts
bun run beep quality package-verify @beep/law-practice-use-cases
```

Observed: portable validator passes; five focused schema/codec tests pass;
full package audit and docgen pass. Actual-validator controls reject stale
payload hashes, missing artifacts, unknown operations, unobserved source sites,
independent source-hash mismatches, dangling tokenizer references, invalid
filter selections, selection/output inconsistencies, incorrect UTF-16 ranges,
absent resolution occurrences, and unnormalized edition candidate order. The
semantic corruptions have recomputed
payload hashes so they cannot fail merely through the integrity check.

Logs are archived beside this receipt under `logs/`. A second generation from
the same clean pin produced byte-identical corpus bytes (`cmp` exited zero).

## Remaining accounting work

- Integrate the separately normalized 1,583 assertion observations and their
  source-loop evidence into the final semantic cases. See the
  [assertion receipt](./2026-10-28-assertion-corpus.md).
- Independently expand source fixture/parameter declarations into semantic
  case IDs. Static public call-site coverage does not prove that no repeated
  observation within a site was dropped.
- Add runtime probes for required source-defined public behaviors not exercised
  by this suite; observed suite calls alone are not exhaustive capability proof.
- Build the final `source-inventory.json`, `canonical-cases.json`, extension,
  divergence, and regex ledgers plus `citation:parity-check` and its full
  negative-control matrix. No terminal disposition or target proof is implied.
- Reconcile the frozen oracle data with public stable IDs; prove exact raw
  anchors through all cleaning/markup paths; freeze safety limits and prove
  regex execution strategy before P1.

The separate operation corpus is an intermediate evidence artifact. It must
be integrated into the final case-level accounting rather than becoming an
alternative completion gate.
