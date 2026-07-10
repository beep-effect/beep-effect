# Ontology Server Fixtures

These fixtures are vendored from Ontosphere under Apache-2.0 discipline for
the ontology workbench P1 round-trip proof.

| Fixture | Upstream path | Local path | License |
| --- | --- | --- | --- |
| ontoauthor-mat benchmark tasks | `benchmarks/ontoauthor-mat/**` | `ontoauthor-mat/**` | Apache-2.0 |
| FOAF social network graph | `docs/mcp-demo/foaf-social-network/graph.ttl` | `foaf-social-network/graph.ttl` | Apache-2.0 |
| FOAF demo prose | `docs/mcp-demo/foaf-social-network.md` | `foaf-social-network/README.md` | Apache-2.0 |
| Pizza tutorial prose | `docs/mcp-demo/pizza-tutorial.md` | `pizza-tutorial/README.md` | Apache-2.0 |
| Pizza tutorial seed | `docs/mcp-demo/seeds/pizza-tutorial.md` | `pizza-tutorial/seed.md` | Apache-2.0 |

P1 round-trip tests exercise committed Turtle graphs only. The upstream pizza
tutorial is prose/SVG/seed content rather than a standalone Turtle graph.
