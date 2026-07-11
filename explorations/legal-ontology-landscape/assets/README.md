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
  "notes": ""
}
```

`verified` flips to `true` only when the verification pass has re-checked
license, IRI resolution, and checksum.
