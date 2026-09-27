# Phoenix scope checkpoint

Removed the duplicate scoped-layer provider. Each of the five service cases
now owns its original injected SDK through a separate native it.layer block
with an explicit ten-second acquisition-hook budget. The pure SDK layer and
all five original generator bodies remain unchanged; there is no shared
mutable capture or new real Phoenix service. Body deadlines are unchanged.

The token preservation check permits only these five registration replacements
and helper/import removal. The equivalence file remains byte-identical. All
original assertions, transport/config fields, property domains and fcRuns(5)
remain. Configured Node/Bun both pass all nine cases with stable source hashes
(3.370/1.416 seconds). Package audit/docgen pass in 6.5/2.9 seconds.
Assertion, property, flake, runner and inventory work remain.
