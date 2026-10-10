# M2 source reuse ledger — 2026-10-09

Checks performed anonymously with curl on 2026-10-09 UTC (last terms fetch
18:33:31Z). HTTP status records describe fetched evidence, not archive validation.
No archive has been fetched yet; no row is admitted before the R3 loader commit.

| Source | Intended files | Licence | Evidence URL | Fetch date UTC / HTTP | Planned load scope | Attribution |
| --- | --- | --- | --- | --- | --- | --- |
| IPC 2026.01 | ipc_scheme_20260101.zip | CC BY 4.0 | https://www.wipo.int/en/web/terms-of-use | 2026-10-09 / 200 | Symbols, hierarchy and labels, transformed locally to SKOS | Source: WIPO, International Patent Classification 2026.01, CC BY 4.0; local XML-to-SKOS conversion changes structure. No WIPO endorsement. |
| Nice 13-2026 | ncl-20260101-classification_texts-20260715.zip; ncl-20260101-classification_top_structure-20250610.zip | CC BY 4.0 | https://www.wipo.int/en/web/terms-of-use | 2026-10-09 / 200 | Classes and goods/services terms with local SKOS hierarchy | Source: WIPO, Nice Classification 13-2026, CC BY 4.0; local XML-to-SKOS conversion changes structure. No WIPO endorsement. |
| CPC 2026.08 (R2) | CPCSchemeXML202608.zip; title archive only if scheme titles absent | CC BY 4.0 for Linked open EP data; scheme XML coverage not named | https://www.epo.org/en/searching-for-patents/data/linked-open-data | 2026-10-09 / 200 | Identifier facts only: symbols, parent hierarchy and titles. No definitions, notes, references or warnings. | Source: EPO and USPTO, CPC 2026.08; identifier projection. Linked open EP data licence is CC BY 4.0; no claim that it covers the scheme XML. |

## WIPO service-specific check

Both edition pages returned HTTP 200 but their content is loaded by JavaScript.
The public `classifications/js/init_version.js` identifies the relative
`ipc_version_template.html` and `nice_version_template.html`; both were fetched
from their edition directories with HTTP 200. These templates link master-file
downloads and specifications and contain no service-specific licence or terms
override. Their containing pages link WIPO's general terms of use. The general
terms grant reproduction and adaptation with source acknowledgement and a
change notice; this supports local storage and transformation of WIPO content.
This is the lane's reuse interpretation, not a source-specific licence claim.

- [IPC edition page](https://www.wipo.int/classifications/ipc/en/ITsupport/Version20260101/)
- [IPC download template](https://www.wipo.int/classifications/ipc/en/ITsupport/Version20260101/ipc_version_template.html)
- [Nice edition page](https://www.wipo.int/classifications/nice/en/ITsupport/Version20260101/index.html)
- [Nice download template](https://www.wipo.int/classifications/nice/en/ITsupport/Version20260101/nice_version_template.html)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## CPC evidence boundary

The [CPC linked-data page](https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/CPCopenLinkedData)
links the scheme to Linked open EP data. The EPO licence covers that product;
its coverage section explicitly limits available CPC data elements. It does
not name CPCSchemeXML or the bulk archives. R2 therefore authorizes the
facts-only projection; FullCPCDefinitionXML is never fetched. The
[CPC bulk page](https://www.cooperativepatentclassification.org/cpcSchemeAndDefinitions/bulk)
returned HTTP 200 and listed edition 2026.08. No CPC row is UNVETTED merely
because the XML is unnamed: R2 settles that scope, subject to archive checks.

Evidence HTML and JavaScript stay in gitignored lane scratch; no third-party
page bytes are committed. Re-check source terms when admitting a new edition.
