# Shared-domain scope checkpoint

The single public-id generation case now uses it.layer(CuidTestLayer) with an
explicit ten-second hook budget. The existing Cuid state and deterministic pure
Crypto stub are unchanged, and no counter is shared with another case. Removed
the duplicate scoped provider helper. The insert audit-default case now yields
its original makeEffect program directly in it.effect; its input and all four
assertions remain unchanged. No body deadline or production code changed.

The nine-file preservation check retains all 329 assertion expressions, five
property callback/registration bodies and sixty-two case names. Three property
registrations were already native; the two remaining manual property call sites
are deferred to the property phase. No membership or codec domain was changed.

Full package audit/docgen passes (7.2/4.0 seconds), and configured Node/Bun each
pass all sixty-two cases with stable source hashes. Timing receipts include
workstation load and pressure and do not claim normalized speed improvements.
Assertion, property, flake, runner and final inventory work remain.
