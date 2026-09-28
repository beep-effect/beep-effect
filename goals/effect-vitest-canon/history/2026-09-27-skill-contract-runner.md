# Skill Contract instrumented runner

All eight files now register through @beep/test-runner. Full package audit and
docgen pass, and all 47 tests pass under Node and Bun with stable source hashes.
The runner dependency adds two generated TS references, two Fallow allowances
and nine reviewed cache dependency lists; commands and qualification state
remain unchanged. No new resource, clock, filesystem or provider seam is used.
