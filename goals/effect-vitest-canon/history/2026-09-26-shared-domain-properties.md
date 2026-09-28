# Shared-domain native property checkpoint

The identity namespace loop now registers 32 native properties. Each retains its
original schema, decode/encode sequence, encoded-value assertion, declared
schema-equivalence assertion, diagnostic label and fcRuns(10) floor.

SchemaParity registers its original 18 decode-to-self laws and six codec laws
through two typed native registration helpers. The former public helper was
read before replacement: its oracle combines S.is(schema)(value) with declared
schema equivalence after decoding the generated value. Both terms remain.
Codec laws retain encode then decode and declared equivalence. Seventeen
self-decode laws and all six codec laws retain floor 25; OnePasswordReference
retains floor 10. Installed Vitest compiles these schema inputs through
Arbitrary.schema. The original three native properties are unchanged.

Removing two bundled registrations and exposing their 56 component laws changes
the configured suite from 62 to 116 cases. Node and Bun pass all 116. All other
body tokens across the nine admitted files remain identical to the assertion
checkpoint; the schema/floor comparison preserves all 24 parity laws.
Package audit/docgen pass in 6.6/3.8 seconds. The 400-run seed-20260708 property
lane also passes; its receipt records the configured selected cases separately
from the full suite. Workstation load and pressure accompany all timing results.

No production code, schema, generator domain, independent oracle, deadline or
resource subject changed. Flake, runner and final inventory work remain.
