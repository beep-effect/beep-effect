# RDF ownership, assertions and native properties

The nine saved RDF test files use local schema values, RDF/JS terms and codec
results. They acquire no external resource or network endpoint. The resource,
flake and observability lens reviews found no additional owned-resource leak,
clock nondeterminism or diagnostic gap. Instrumented test registrations are the
observability integration for all nine files.

AST conservation preserves 351 original assertions and 90 registrations, with
118 Boolean/Option conversions and four aggregate Passed-status checks replaced
by native property failures. The eleven previously grouped round-trip laws now
have individual names under their original group. All 21 original laws retain
their schema domains, callback predicates and floors: eleven at 25, nine at 50,
and one at 100. The fixed 0x5eed URI smoke sample and counts 1 and 20 remain.
All 21 independently inverted laws fail with replay seed 20260708 and shrunk
inputs. The positive property suite passes with a 400-run floor.

The original Entity-only generated PROV law remains. A new constructive law
covers eleven records per sample: two entities, activity, agent, software agent,
usage, generation, association, attribution, derivation and primary source.
Unique subject identifiers and coherent links come from schema-derived fields;
there is no post-generation filtering. All three failure-as-false branches and
the final dataset equivalence predicate remain.

## Finding: decoded timestamp range exceeded its canonical encoding

The schema admitted UTC year 10000 while its existing four-digit wire encoder
rejected it. RDF encoding succeeded but decoding rejected the timestamp. The
new supported-core law reproduced this after two runs and 23 shrinks at seed
20260708. The packet section 4 permits schema sharpening demanded by properties;
this repair has its own L-PROP-01 finding and a PR-body callout.

ProvDateTime now uses the public ordered DateTime bound from the first instant
of year 0000 through the final millisecond of year 9999. The built-in check also
provides constructive arbitrary bounds. The existing wire regex and RDF codec
are unchanged. This is the package's canonical wire contract, not a restriction
imposed on the broader PROV-O vocabulary.

Both endpoints encode successfully; adjacent instants fail type validation,
encoding and Usage construction. Offset-normalized timestamps respect the same
bounds. All eight PROV example tests pass. Removing the bound makes both new
boundary tests and the generated supported-core law fail; restoring it passes
all three. Mutation controls restore exact source bytes.

A focused run with BEEP_FC_NUM_RUNS initially produced zero tests because the
shared deep-sweep config intentionally excludes example-only files. That receipt
is not proof. The normal unit configuration runs the boundary file, while the
400-run configuration runs the generated law. Initial typecheck failures from
typed decoder selection and assertion-helper generic inputs were corrected
without changing the original operands, polarity, sample counts or seeds.
