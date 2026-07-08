# Default Vault Folder Structure

Freshness: 2026-07-08

## Survey

### Organization patterns

Matter-centric organization is the dominant legal DMS pattern in the surveyed
sources: a legal DMS is described as tying documents and emails to the matter
or case, and both vendor-neutral legal DMS summaries and vendor docs present the
matter workspace as the place where matter-related documents, emails, notes, and
folders are gathered for work. Sources:
[Centerbase legal DMS overview](https://www.centerbase.com/blog/document-management-systems-for-law-firms),
[NetDocuments glossary](https://support.netdocuments.com/s/article/206239666),
[NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

Client-centric organization appears mainly as the outer grouping above matters
or as a shared-drive fallback: legal-file guidance describes solo or small firms
creating folders per client or per matter, and NetDocuments says that if a firm
uses firm-wide folders for clients or projects instead of workspaces/profile
values, it should avoid overloaded top levels by grouping alphabetically, then
client, then matter. Sources:
[LexWorkplace file organization guide](https://lexworkplace.com/organize-legal-files/),
[NetDocuments workspaces vs. cabinet folders](https://support.netdocuments.com/s/article/205220300).

Document-type-first organization is useful as a secondary structure inside a
matter, not as the vault's first axis: law-firm templates commonly use folders
such as Correspondence, Pleadings, Discovery, Legal Research, Billing, and
Agreements within a client/case file, while NetDocuments and iManage both model
document type as profile/filter/folder metadata inside workspaces. Sources:
[LexWorkplace file organization guide](https://lexworkplace.com/organize-legal-files/),
[Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/),
[NetDocuments using folders and filters](https://support.netdocuments.com/s/article/205212620),
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

### NetDocuments norms

NetDocuments organizes documents inside cabinets and supports two cabinet-level
organization modes: workspaces and cabinet folders; its workspace docs describe
a law-firm matter workspace as a table/profile-attribute-based view for a
specific matter, while cabinet folders are a hierarchy-like organizing surface
and are virtual rather than physical storage containers. Sources:
[NetDocuments workspaces vs. cabinet folders](https://support.netdocuments.com/s/article/205220300),
[NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420).

NetDocuments' matter-centric workspace model is metadata-led: workspaces are
based on profile attributes such as Matter, Client/Matter values can be searched
by key or description, and documents can appear in workspace folders, filters,
or saved searches based on profile values. Sources:
[NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
[NetDocuments glossary](https://support.netdocuments.com/s/article/206239666).

NetDocuments warns against mixing workspace folders and auto-created organizing
filters because folders require filing actions while filters move documents by
profile changes, and because the same document can appear in multiple apparent
containers when folder and filter semantics are mixed. Source:
[NetDocuments using folders and filters](https://support.netdocuments.com/s/article/205212620).

### iManage norms

iManage Work uses libraries, workspaces, tabs, folders, and documents as its
container model: libraries are the highest-level container, only workspaces may
exist at the library root, workspaces organize documents and emails related to a
project or legal matter, and workspaces contain folders and tabs. Source:
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

iManage treats client, matter, attorney, jurisdiction, status, and similar
fields as document or container metadata, and it recommends using as few
root-level folders as possible inside a workspace. Source:
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

iManage workspace templates enforce naming and folder-structure standards, and
Flexible Folders can enforce template-defined container structure across created
workspaces and folders. Source:
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

### Conventional client/matter/doc-type hierarchy

The conventional shared-drive-friendly hierarchy is client or matter first,
then practice/matter subfolders by document class; example template folders
include Case Notes, Correspondence, Drafts, Pleadings, Discovery, Settlement
Documents, Accounting, Estate Planning Documents, Legal Research, Trial Prep,
and Billing. Sources:
[LexWorkplace file organization guide](https://lexworkplace.com/organize-legal-files/),
[Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/).

The stronger DMS convention is matter-first by behavior even when the visible
tree contains a client level: legal DMS summaries say legal users think, bill,
and report by matter, and vendor workspace models treat the matter workspace as
the governing context for document filing, security, and retrieval. Sources:
[Centerbase legal DMS overview](https://www.centerbase.com/blog/document-management-systems-for-law-firms),
[NetDocuments glossary](https://support.netdocuments.com/s/article/206239666),
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).

## Recommendation

### Default vault layout

Use a matter-centric, client-scoped vault layout: client is the outer human
navigation group, matter is the filing workspace, and taxonomy concepts supply
all document-class folders below the matter. This satisfies the packet's D5
requirement that local folder layout be a deterministic taxonomy projection,
keeps the P0 matter-centric hypothesis, and preserves D4's local-vault-is-
canonical sync model. Source:
[goals/legal-document-intake/SPEC.md](../SPEC.md).

```text
{vaultRoot}/
  00-inbox/
    {intakeBatchId}/
      {safeOriginalFileName}
  matters/
    {clientSegment}/
      {matterSegment}/
        {taxonomySegment}/
          {...taxonomySegment}/
            {documentFileName}
```

Example:

```text
{vaultRoot}/matters/
  c-10042-acme-corp/
    m-2026-001-smith-v-acme/
      10-pleadings/
        20-motions/
          motion-to-dismiss--8f3a91c2.pdf
```

This deliberately makes document type a taxonomy-derived subpath inside the
matter, matching NetDocuments/iManage workspace practice and the law-firm
template pattern of document-class subfolders under the case or matter. Sources:
[NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html),
[Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/).

### Projection rule contract

Inputs -> path:

1. `workspace.vaultRoot` -> absolute vault root selected during onboarding.
   This comes from the workspace vault configuration required by the packet
   objective and acceptance criteria. Source:
   [goals/legal-document-intake/SPEC.md](../SPEC.md).
2. Reserved projection namespace -> `matters/`. This fixed segment records that
   the default projection is matter-centric, consistent with the DMS survey and
   D5's working hypothesis. Sources:
   [goals/legal-document-intake/SPEC.md](../SPEC.md),
   [Centerbase legal DMS overview](https://www.centerbase.com/blog/document-management-systems-for-law-firms).
3. `client.pathKey` + `client.displayNameAtPathCreation` -> `{clientSegment}`.
   Format: `{stableClientKey}-{slug(displayNameAtPathCreation)}`; if the firm
   has no client number, the system assigns a stable generated key before first
   filing. Source for using client/matter metadata as profiles:
   [NetDocuments glossary](https://support.netdocuments.com/s/article/206239666).
4. `matter.pathKey` + `matter.displayNameAtPathCreation` -> `{matterSegment}`.
   Format: `{stableMatterKey}-{slug(displayNameAtPathCreation)}`; if the firm
   has no matter number, the system assigns a stable generated key before first
   filing. Sources for matter workspace/profile norms:
   [NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
   [iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).
5. `taxonomy.documentTypeConceptPath` -> one or more `{taxonomySegment}`
   entries. The path is the ordered ancestor-to-leaf concept path under the
   document-type taxonomy scheme, excluding the scheme root; each segment is
   `{sortKey}-{preferredSlug}` when `sortKey` exists and `{preferredSlug}`
   otherwise. Filing fails validation if the selected concept is not in the
   repo-owned SKOS-style taxonomy seed required by D5. Source:
   [goals/legal-document-intake/SPEC.md](../SPEC.md).
6. `sourceFile.safeStem`, `sourceFile.extension`, and `document.contentDigest`
   -> `{documentFileName}`. Format:
   `{slug(safeStem)}--{shortContentDigest}.{lowercaseExtension}`. Do not encode
   client, matter, or full taxonomy metadata into the file name because legal DMS
   guidance treats those as profile/metadata fields, while file-name guidance
   emphasizes short, clear, filesystem-safe names. Sources:
   [LexWorkplace file organization guide](https://lexworkplace.com/organize-legal-files/),
   [Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/).

Formatting rules:

- Generated path segments are lowercase ASCII kebab-case, with whitespace
  collapsed, path separators removed, reserved filesystem characters stripped,
  repeated dashes collapsed, and leading/trailing punctuation removed. This
  follows legal file-name guidance to avoid special characters and keep names
  concise. Source:
  [Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/).
- Stable keys always lead the client and matter segments, so two clients or
  matters with the same display name still project to different paths. This
  follows the DMS pattern of using client/matter keys/profile values rather than
  display names alone. Sources:
  [NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
  [iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html).
- The taxonomy segment labels come only from taxonomy data, not from hardcoded
  filing logic, because D5 requires the taxonomy to be data plus derived schema
  and forbids hardcoded folder names outside the projection. Source:
  [goals/legal-document-intake/SPEC.md](../SPEC.md).

### Edge cases

Unfiled or inbox documents: files that lack a valid client, matter, or taxonomy
concept land in `00-inbox/{intakeBatchId}/` and are not considered filed
documents until validation succeeds. This keeps P1/P2 filings taxonomy-valid
while still preserving intake artifacts for review. Source:
[goals/legal-document-intake/SPEC.md](../SPEC.md).

Multi-matter documents: require one `primaryMatter` for the canonical file path;
secondary matters are recorded as metadata/KG relationships rather than duplicate
physical files. If no primary matter can be selected deterministically, keep the
document in `00-inbox/{intakeBatchId}/` for user review. This avoids duplicate
local canonical files and keeps the one-way Box mirror's create/move/rename
state tractable under D4. Source:
[goals/legal-document-intake/SPEC.md](../SPEC.md).

Client or matter renames after filing: paths stay stable by default because the
projection uses immutable `pathKey` and `displayNameAtPathCreation` fields; a
display-name rename updates metadata and UI labels, not existing directory
names. A later user-approved "relabel paths" operation may move directories and
then sync that explicit move, but automatic rename cascades should not be part
of the default filing contract because D4 makes local moves/renames observable
sync events. Source:
[goals/legal-document-intake/SPEC.md](../SPEC.md).

## Proposed Superseding Entries

Proposed D5 superseding entry dated 2026-07-08: keep D5's repo-owned
SKOS-style taxonomy and deterministic projection, and replace "matter-centric is
the working hypothesis" with "the default vault projection is matter-centric:
`{vaultRoot}/matters/{clientSegment}/{matterSegment}/{taxonomyConceptPath}/{documentFileName}`,
with `00-inbox/{intakeBatchId}/` reserved for unfiled intake artifacts." Rationale:
the surveyed NetDocuments and iManage workspace models are matter-centric, legal
file-tree guidance places document-class folders inside client/case files, and
this projection keeps taxonomy concepts as the only document-class folder source.
Sources:
[goals/legal-document-intake/SPEC.md](../SPEC.md),
[NetDocuments workspace overview](https://support.netdocuments.com/s/article/205233420),
[iManage containers and documents](https://docs.imanage.com/cc-help/10.4.0/en/Containers_and_Documents.html),
[LexWorkplace file organization guide](https://lexworkplace.com/organize-legal-files/),
[Bill4Time file-tree templates](https://www.bill4time.com/blog/5-file-tree-structure-templates-for-law-firms/).

No other D1-D11 superseding entries are proposed by this research note.
