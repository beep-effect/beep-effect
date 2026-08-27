# Asset Pack

Vetted, license-checked ontology artifacts for the IP-practice DMS/KG.

- `manifest.jsonl` — committed record: one JSON object per line, one line per
  vetted artifact. This is the deliverable; the files themselves are not
  committed.
- `fetch.sh` — reproduces `vendor/` from a clean checkout using only manifest
  rows (curl by `fetchUrl`, verify by `sha256`).
- `vendor/` — gitignored working copies of the fetched `.owl/.ttl/.rdf/.jsonld`
  files (public repo: no third-party redistribution).

## manifest.jsonl row schema

```json
{
  "id": "kebab-case-slug",
  "prefLabel": "Human name",
  "namespaceIri": "http://... (canonical namespace, must resolve)",
  "prefix": "suggested prefix",
  "version": "version or retrieval date",
  "format": "ttl | rdfxml | owl | jsonld | skos | other",
  "fetchUrl": "direct artifact URL used by fetch.sh",
  "sha256": "checksum of fetched file",
  "license": "SPDX id or exact license name",
  "licenseEvidenceUrl": "page/file proving the license claim",
  "maintenanceStatus": "active | slow | dormant | abandoned (with last-release date)",
  "coverage": "what it models, one line",
  "reuseVerdict": "adopt | slice | inspire | reject",
  "verdictRationale": "one or two sentences",
  "phase": "P1 | P2 | P3 | P4",
  "verified": false,
  "loadKind": "folio-alignment (optional; opts the row into the package loader)",
  "loadStatus": "VETTED | UNVETTED (required with loadKind)",
  "path": "vendor-root-relative fetched filename (required with loadKind)",
  "localConceptIri": "https://ns.beep.sh/... (required with folio-alignment)",
  "conceptIri": "exact FOLIO class IRI (required with folio-alignment)",
  "mappingKind": "exactMatch | closeMatch (required with folio-alignment)",
  "notes": ""
}
```

`verified` flips to `true` only when the verification pass has re-checked
license, IRI resolution, and checksum.

Most rows are research references and are not loaded. An asset-pack row opts
into alignment loading by declaring `loadKind`; the loader then requires
`verified:true`, `loadStatus`, and all kind-specific fields. For compatibility
with the original loader API, a `loadStatus`-only row still denotes a complete
`TaxonomySeed` JSON-LD slice. `VETTED` is an implementation admission decision
in addition to `verified`, not a synonym for it.
