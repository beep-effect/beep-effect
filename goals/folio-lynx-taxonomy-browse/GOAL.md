# GOAL: Ship vetted taxonomy browse

Outcome: pinned FOLIO and Lynx slices share the repo's TaxonomySeed conversion
and load path and are navigable through read-only existing ontology-toolkit
handlers.

Read both source explorations and this packet first. Stop unless exact FOLIO
pin/license and Lynx-owned `lkg.ttl` vetting/license proof exist.

Do not ingest full FOLIO, add live APIs, create a new MCP server, add write
tools, infer Lynx patent semantics, or create parallel vendor machinery.

Prove a small two-source load and browse fixture, then publish through Yeet and
close with a reflection.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug folio-lynx-taxonomy-browse` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/folio-lynx-taxonomy-browse/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
