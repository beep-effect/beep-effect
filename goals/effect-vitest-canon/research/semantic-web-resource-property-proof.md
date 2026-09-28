# Semantic-web native layers and preserved properties

Two custom scoped Layer.build wrappers are removed. Each registry lookup case
uses a native layer fixture built from the same encoded identity entry and the
same layerDataset overload. The data-last test still invokes the curried overload;
the data-first test retains exact identity/IRI/CURIE lookup and typed-miss checks.
These are local in-memory registries. Their native startup boundary is bounded
at 30 seconds; body deadlines remain unchanged. The separate canonicalization
and unsupported-SPARQL services are stateless Layer.succeed values. Operation
work limits and the canonicalizer's one-second deadline are unchanged.

Five native property registrations preserve seven original predicates: unique
binding predicates, unique required fibers, exact generated identity entry codec,
encoding through the schema generation link, and three DTO boundary equalities.
Run floors remain 40 for the two uniqueness laws and entry codec, 50 for the
generation link, and 5 for the jointly generated DTOs. fcRuns now delivers the
configured run floor and seed to all five. The bounded dataset still has at most
three quads, with the same schema-derived maps into concrete DTOs. The separate
SHACL sample retains count 20 and fixed seed 0x5eed.

All seven independently inverted predicates fail with native replay seed
20260708 and shrunk inputs. Positive properties pass with a 400-run floor.
Four aggregate Passed-status checks retire in favor of native property failures;
all 74 original assertions and 31 registrations are preserved. Twelve Boolean
conversions retain operands, polarity and conditional payload checks.

## Finding: failure equality did not establish a round trip

The DTO law compared each initial encoding with its decode/reencode result. If
the initial encoding failed, both results could be the same Failure. The three
original whole-value equalities remain, with three initial-success assertions
added. Independently replacing each encoder with a fixed failure passes the
original law and fails the strengthened law. Those controls restore exact test
bytes, and the positive law passes with 400 runs. No production repair is retained.

The generation-link presence and transformation checks remain inside the native
property, so failures belong to that property and preserve the diagnostic. The
codec is reconstructed for each sample; final timing observations include that
work. Public-family metadata assertions keep their dynamic member diagnostics.
All four files register through the instrumented runner, with reviewed dependency
references and cache edges and no qualification promotion.
