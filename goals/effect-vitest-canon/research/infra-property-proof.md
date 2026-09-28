# Infrastructure native schema properties

Nineteen encode/decode codec laws now have individually named native Effect
property registrations across the five saved caller files. The existing helper
returns the encode/decode Effect and asserts the same schema equivalence. Each
registration retains its original schema and uses fcRuns(25), so repository run
floors and replay seeds apply. The five original grouped test names remain as
native decode-to-self properties, preserving their generated domain, validity
predicate and decode equivalence from the prior shared assertion utility.

An AST check preserves every other registration byte-semantically after
formatting, and validates all19 schema/arbitrary/helper bindings and25-run floors.
The full package audit passes in8.2 seconds and docgen in5.5 seconds with a400-run
floor and seed20260708. All24 temporarily inverted laws fail with native shrunk
inputs and replay seed information. The six altered test/helper files were
restored exactly to their pre-control hashes afterward.

The typed decoder is used for each decode-to-self law because the compiler
proves the generated input is assignable to that schema's encoded type. This
retains runtime behavior and the original law while satisfying Effect's typed
boundary check. No schema/domain reduction or production source change was made.
