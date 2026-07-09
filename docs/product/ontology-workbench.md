# Ontology Workbench

> Status: P6 hardening implemented locally; host verification and reflection
> remain open. Product target: `apps/professional-desktop`.

The ontology workbench is a local-first Turtle authoring surface for user
ontology documents. It adds an `ontology` vertical slice with RDF-backed
sessions, typed change operations, Turtle open/save, hierarchy/search/editing,
GPU-oriented graph projection, SPARQL querying, bounded structural inference,
SHACL validation with verified repairs, and PROV-O plus VoID/DCAT sidecar
exports.

## Product Boundary

The workbench edits user-supplied ontology documents. It does not replace the
foundation `@beep/ontology` package, does not edit repo-internal
identity-as-IRI models, and does not expose an agent/MCP tool surface in this
packet. Shared semantic capabilities route through `@beep/rdf`,
`@beep/semantic-web`, and driver packages such as `@beep/n3`, `@beep/oxigraph`,
and `@beep/shacl`.

## Proof Surfaces

Local P6 proof adds:

- structural Turtle interop tests over ontoauthor fixtures, FOAF data, and a
  small PROV-O ontology subset;
- an ontoauthor-mat t1-t6 competency status suite through Turtle parse,
  Oxigraph ASK, bounded structural inference, and SHACL validation;
- a repeatable node-side graph projection benchmark under
  `goals/ontology-workbench/ops/benchmark-projection.ts`.

Host-side proof still needs Protégé or ROBOT validation, running
professional-desktop browser/Tauri acceptance, `/reflect`, and Yeet closeout.
