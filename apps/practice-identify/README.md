# Practice document identification

A CLI that reads private evidence and writes a client/docket plan. It does not file documents.
All input and output paths are explicit flags. Data outputs must be absolute paths outside git
worktrees, are created exclusively with mode `0600`, and are never printed. Logs contain counts.
Use a new output filename for each run. The USPTO query ledger is append-only, with shapes and
attempt counts; it contains neither results nor numbers.

Run `bun src/bin.ts --help` from this app. Commands:

```sh
practice-identify contacts --csv /private/cards.csv --vcard /private/cards.vcf \
  --output /private/contacts.jsonl --projection /private/projection.jsonl
practice-identify index --input /private/assertions.jsonl --contacts /private/contacts.jsonl \
  --output /private/index.json
practice-identify uspto --input /private/queries.jsonl --output /private/uspto.jsonl \
  --ledger /private/query-ledger.jsonl
practice-identify resolve --input /private/documents.jsonl --context /private/context.json \
  --training /private/train.jsonl --batches /private/batches.json --uspto /private/uspto.jsonl \
  --output /private/resolutions.jsonl
practice-identify evaluate --input /private/ground-truth.jsonl --context /private/context.json \
  --output /private/evaluation.json
```

Paths in these examples are placeholders. The app has no private-data defaults.

The canonical codecs are exported by `@beep/law-practice-use-cases/DocumentIdentification`:

- `contacts` reads Outlook CSV and vCard 3/4, writing `Contact` JSONL and `ContactProjection` JSONL.
- `index` reads `IndexEvidence` JSONL and contacts, writing one `IdentificationIndex` JSON document.
  Each assertion carries explicit provenance, names, references, folders, emails and contact ids.
  Adapt private answer/docket/KG exports into this boundary; the app does not open proprietary
  spreadsheets, mail stores or a live KG. Pair counts retain both client and docket.
- `uspto` reads `UsptoQuery` JSONL (`kind` application or patent; `number` digits only), writing
  `UsptoLookupResult` JSONL. It uses the driver's existing `USPTO_API_KEY` configuration.
  Supply keys through the approved environment wrapper; never place keys in CLI arguments.
- `resolve` reads `IdentificationDocument` JSONL, a `ResolverContext` JSON document, training
  `TrainingDocument` JSONL, a JSON array of batch directories, and public lookup results.
  Use an empty array for no batches and an empty file for no lookup results. It writes
  `ResolutionRecord` JSONL. The index's clients, pairs and contacts become fields of the context;
  aliases, pseudo-clients and excluded domains must be explicitly supplied there.
- `evaluate` reads attorney-filed `TrainingDocument` JSONL and a context, derives a deterministic
  content-hash hold-out, fits only on train, removes identical copies and source folder hints,
  and writes an `EvaluationReport` containing counts and metrics only.

Option fields encode as a value or `null`. Batch records use `{id, extraction}` in `extract.jsonl`
and `{id, verdict}` in `critic.jsonl`. The exported `documentExtractorPrompt` and
`documentCriticPrompt` describe these same codecs. Quotes remain private and must occur verbatim
in the document; critic indexes are validated. Malformed or conflicting batch rows fail closed.

Aliases and unnumbered clients (`new:<input-key>`) are input policy. Administrative form/firm
organisation is available separately as `organiseDocument` with input folder rules. It does not
attribute a client. RDAP is an organisation-only server port and contributes no resolver signal
by default. No command calls RDAP, a model endpoint, or Box.

Evaluation measures client attribution and, where supplied, the docket. A tier with no resolved
predictions has `precision: null`. Duplicate content stays in a single partition. Hash buckets
produce a stable twenty-percent hold-out rate; a small dataset need not split exactly 80/20.
