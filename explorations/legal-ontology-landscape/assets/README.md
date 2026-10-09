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
  "format": "ttl | rdfxml | owl | jsonld | skos | xml | other",
  "fetchUrl": "direct artifact URL used by fetch.sh",
  "sha256": "checksum of fetched file",
  "license": "SPDX id or exact license name",
  "licenseEvidenceUrl": "page/file proving the license claim",
  "maintenanceStatus": "active | slow | dormant | abandoned (with last-release date)",
  "coverage": "what it models, one line",
  "reuseVerdict": "adopt | slice | inspire | reject",
  "verdictRationale": "one or two sentences",
  "phase": "P1 | P2 | P3 | P4 | M2",
  "verified": false,
  "loadKind": "concept-alignment | classification-scheme (optional)",
  "loadStatus": "VETTED | UNVETTED (required with loadKind)",
  "path": "vendor-root-relative fetched filename (required with loadKind)",
  "localConceptIri": "https://ns.beep.sh/... (required with concept-alignment)",
  "conceptIri": "exact external class IRI under namespaceIri (required with concept-alignment)",
  "mappingKind": "exactMatch | closeMatch (required with concept-alignment)",
  "notes": ""
}
```

`verified` flips to `true` only when the verification pass has re-checked
license, IRI resolution, and checksum.

Most rows are research references and are not loaded. An asset-pack row opts
into alignment loading by declaring `loadKind`; the loader then requires
`verified:true`, `loadStatus`, and all kind-specific fields. Concept-alignment
rows must keep `conceptIri` and `fetchUrl` under their declared `namespaceIri`,
and `localConceptIri` must use the repository-owned `https://ns.beep.sh/`
authority. A `loadStatus`-only row still denotes a complete, verified
`TaxonomySeed` JSON-LD slice, but legacy slices carrying alignments are rejected;
all external mappings use the explicit concept-alignment path. `VETTED` is an
implementation admission decision in addition to `verified`, not a synonym for
it. `fetch.sh` writes loadable rows to their manifested vendor-relative `path`.

## Classification archives (M2)

`loadKind` is the `VendorLoadKind` domain. `concept-alignment` routes to the
M1 taxonomy loader; `classification-scheme` routes away from M1 and belongs
to the pinned classification registry. Every classification row must carry
that kind, `schemeKind` (`ipc`, `cpc`, `nice`) and `edition`. `version` is the
same edition; the archive revision remains in its exact URL and checksum.

`archivePath` is the vendor-relative ZIP filename. `path` is the vendor-relative
unpacking directory. `entryPath`, where present, selects an English XML member
inside that directory. CPC scheme titles are included in its XML, so there is
no separate title-list row. Nice texts and top structure are two rows with the
same scheme edition. The 20260715 text archive includes English texts dated
20250610 and later Spanish revisions; the archive pin retains that distinction.

`fetch.sh` requires host curl, jq, sha256sum, realpath, Python and unzip. It
checks the archive before unpacking, rejects symlink members and escaped member
paths, and writes only under vendor/. `--verify-only` checks recorded archive
bytes and safe membership without unpacking. Source reuse evidence and
attribution are in the packet
[M2 licence ledger](../../../goals/semantic-foundation/research/2026-10-09-m2-licence-ledger.md).
CPC is the R2 facts-only projection: symbols, parent hierarchy and titles;
definitions, notes, references and warnings are never exposed by the loader.
