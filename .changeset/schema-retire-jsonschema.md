---
"@beep/schema": minor
"@beep/repo-configs": patch
---

Retire the `JSONSchema` concept under the "Upstream-First Foundation/Modeling" decision
(`standards/architecture/DECISIONS.md`, 2026-09-29): the `JSONSchema` namespace export and the
`@beep/schema/JSONSchema` subpath (`Node`, `NodeCodec`, `Document`, `SubSchema`, `TypeName`,
`UriReferenceString` and the other keyword schemas) are deleted with their tests, and no alias is
left behind. Upstream `effect/JsonSchema` covers the document model as open `JsonSchema` records;
the strict runtime `Node` codec is the accepted migration loss recorded in the retirement audit.
Both consumers are scratchpad modules and migrate in the same change: the codemode TypeScript
renderer decodes only the keywords it reads through a file-local view schema, and the microdata
`VCardUriString` checks the absolute scheme, printable ASCII and percent encoding with
`S.isPattern` (upstream has no RFC 3986 URI-reference parser).
