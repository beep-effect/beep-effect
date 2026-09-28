# Ontology server canonical test proof

Source commit: `411e0d7d2c`. This batch closes the 41 saved actionable findings
for `@beep/ontology-server` in the consolidated PR. It does not close the goal.

Public layer fixtures replace the four private scoped-layer helpers. Native
fixture services own temporary roots through acquisition and test execution;
the toolkit receives fresh state for each case. Acquisition has an explicit
30-second deadline. Existing body deadlines and real Turtle, Oxigraph, SHACL,
canonicalization and filesystem subjects remain. Native security cases retain
outside and in-root symlinks, literal POSIX backslashes, startup-root swaps,
atomic rename failures and unchanged victim/link assertions. The POSIX guard
remains in the body: its empty temporary root and file-store layer now acquire
before the guard, and are still released on non-POSIX platforms.

A preservation check accounted for all 98 original assertions and 26 original
registrations, including 15 public helper conversions. Three named codec
properties preserve their schema-derived inputs, encode/decode equivalence and
`fcRuns(10)` floors. Their independent inverted controls each reported the
native seed `20260708` and shrinking. One aggregate `Passed` assertion retires;
separating the laws increases the normal suite from 26 to 28 tests.

The publish success case now captures the request reaching its existing HTTP
stub and checks POST, destination, Turtle content type and the entire sidecar
body. Four temporary mutations to the actual handler each passed the old
assertions and failed the new witness. The real-engine tool case retains its
200-row cap and select profile assertions, then queries the known item-0 value
and compares the complete typed select result. Corrupting the literal lexical
value or replacing it with a named node passed the old assertions and failed
the new witness. All temporary production changes were restored exactly. This
proves local request construction and real Oxigraph conversion, not remote HTTP
publication.

Three additional controls forced an acquisition defect, body defect and body
interruption in the actual toolkit fixture. Each failed as intended and an
outer teardown assertion confirmed that its native temporary root was gone.
All control edits were restored to the final timing hashes before commit.

The shared runner covers all four files. Its development dependency adds two
TypeScript references, two generated Fallow edges and nine reviewed cache
edges across 14 owned computations. Commands, effective configuration and
unrelated qualification state are preserved; this is not cache promotion.

## Verification

- Full package verification passed with `BEEP_FC_NUM_RUNS=400` and
  `BEEP_FC_SEED=20260708`: audit 8.7 seconds and docgen 3.8 seconds.
- Root Oxlint, Sherif, Fallow health, Fallow audit, cache policy and schema-first
  checks passed. Inherited advisory Fallow/cache notices remain attributed.
- Normal Node and Bun runs both passed all 28 tests with no skips and stable
  source hashes. The prior suite passed 26 tests with no skips.
- Whole-command Node observations were 5.1724 seconds before and 6.3744 after;
  Bun observations were 2.8184 before and 2.3175 after. Recorded load, CPU,
  memory and I/O pressure accompany the timing artifacts. These are contextual
  observations, not a causal speedup claim.
- Four current detector exceptions remain: three actual native platform
  imports and the deliberate layer-construction failure scope. The latter
  continues to distinguish typed failure from a defect.
- Reconciliation preserves all 683 unrelated ledger hashes and unrelated raw
  root/census objects. Seventeen packages and 984 saved actions remain.

Exact-head full repository proof and hosted review closure remain PR-level
acceptance work. No intermediate green package or monitor result authorizes
claiming the consolidated goal complete.
