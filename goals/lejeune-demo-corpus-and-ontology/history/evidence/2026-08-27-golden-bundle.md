# Golden Bundle Evidence — 2026-08-27

## Scope

This report covers the pre-publication acceptance proof for the single
`apps/labs/lejeune-bolt-workbench` workspace. All fixtures are authored synthetic data. Durable
bundle outputs live under the lab's ignored `.beep/` directory; only schemas, deterministic
generators, frozen expectations, and the sanitized provider recording are tracked.

## Fixture and extraction proof

`bun run --cwd apps/labs/lejeune-bolt-workbench audit` passed on 2026-08-27 with three test
files and 23 tests. Coverage includes schema-derived retention and empty-ledger round trips, the
persisted-contract mutation matrix, and the transactional publication/extension boundary matrix.

The fixture test generated the same four sources twice and matched these frozen SHA-256 hashes:

| Source | Format | SHA-256 |
| --- | --- | --- |
| `rfq-a-outlook-body` | Outlook body table | `ee38c21a1635fa152f1e48914ae2c2ce3761d5ada7f96b8c7c3d5a50e808f3b5` |
| `rfq-a-xlsx-takeoff` | XLSX takeoff | `09c038e5118283ff15382a632ca6c6e9c811ef4e7235128623956f6043b1d4c5` |
| `rfq-b-prose-email` | prose email | `bc1144a4fdde67229b9e2178c09c133cdd48a0b8881e5f9b9f0316f4ba91806e` |
| `rfq-b-pdf-schedule` | text-layer PDF schedule | `bbaa1ae10d94a0680966ed5d1eef8c020b172131d760eb7bc9bc61e8f4831360` |

The frozen manifest contains 20 extracted fields. Every `@beep/langextract` anchor slices back
to its exact source text. The two explicit unknowns remain
`rfq-a|certificationRequirement` and `rfq-b|domesticOrigin`; normalization does not infer them.

## Ontology, rules, and synthetic records

The schema-first ontology test asserts the complete set is exactly 12 classes. The rule matrix
contains six results over exactly three rules:

| Rule | Positive case | Stop case |
| --- | --- | --- |
| matched assembly | `pass` | `mismatch`, human required |
| DTI strength match | `pass` | `mismatch`, human required |
| A490 hot-dip galvanizing | `pass` | `refuse`, human required |

Every result retains its governing URL, revision or access date, matched facts, exact evidence
anchor, disposition, uncertainty, and human stop. All two offers and two lot certificates have
fixed timestamps and the structural `SYNTHETIC` label.

## Projection proof

The projection test rebuilt fresh PGlite, in-memory DuckDB, and bounded in-memory Oxigraph
stores twice from the same normalized input. The snapshots were equal and returned:

- four source documents and four citations;
- two quote-line totals;
- all 12 ontology classes from the bounded RDF query;
- six rule dispositions;
- four timestamped `SYNTHETIC` commercial records.

The durable bundle build additionally produced a PGlite directory and DuckDB database under
the immutable machine-local root. Mutable approvals and claims live in a separate review
ledger.

## Provider-smoke proof

The live command was run with 1Password reference injection; no secret value was printed or
stored:

```sh
op run --env-file=.env -- bun run --cwd apps/labs/lejeune-bolt-workbench provider:smoke
```

`@beep/anthropic` succeeded with `claude-opus-4-6` at `2026-08-27T12:25:18.044Z`. The sanitized
recording contains three source-grounded candidates and only versioned source/extraction
contracts, the recording status, synthetic document id, provider, model, timestamp, response
SHA-256, and candidate label/text pairs. It contains no request envelope, authorization
header, credential, usage record, or real data.

## Offline replay and retention proof

Two fresh post-Round-5 durable builds completed with provider and network availability forced to
`false`.
Both produced bundle identity
`395e10a9282d39ead0fcc8b601e3bdb3c087916c43e61504dcb3638688fb9815`; their `bundle.json`,
`golden-replay.json`, `projection-metadata.json`, separate `review-ledger.json`, and
`retention-metadata.json` files were byte-identical. The versioned receipt declares replay mode
`recorded-offline` and retains the committed queries, citations, rule results, and synthetic
records. The projection metadata binds both durable stores to the same bundle identity and
explicit projection contract.

The separate mutable ledger is empty and declares `delete-or-promote` with disposition date
`2026-09-30`. Both final children are staged beneath one builder-owned container and become
visible through one publication-root rename. The builder refuses an existing publication root,
shared/nested children, or children with different parents. Clock-controlled integration tests
also prove that the builder publishes no root on the disposition date without authority, and
accepts only a schema-decoded reviewed extension whose authorization timestamp is not in the
future and whose new disposition is later than build time. The effective authority and date are
read-validated from the mutable retention metadata before publication.

## Acceptance audit

| Criterion | Result |
| --- | --- |
| two split RFQ layouts with explicit missing fields | pass |
| exact source slices through `@beep/langextract` | pass |
| exactly 12 lab-local ontology classes | pass |
| three cited rules with pass and human-stop cases | pass |
| timestamped, visible `SYNTHETIC` offers and certificates | pass |
| deterministic PGlite, DuckDB, and bounded Oxigraph projections | pass |
| live `@beep/anthropic` recording without secrets | pass |
| complete provider-offline and network-offline replay | pass |
| raw/customer/third-party payloads and secrets absent | pass; final tracked inventory runs before publication |
| 2026-09-30 mutable-corpus disposition | pass; fail-closed boundary and reviewed-extension test |
| unrelated churn absent | pass; unrelated `.codex/` work remains unstaged |

Repository-wide Yeet and hosted merge-readiness evidence is appended during publication.
