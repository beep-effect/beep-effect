# Registered resources in the callback dictionary

Date: 2026-10-29. Internal registered canonical-resource integration; final
Layer cutover, custom host-key normalization and document projection remain open.

## Source proof

All three previously source-only mutable default-key scenes now execute through
the real callback owner, default full/supra/Id callbacks, authenticated frozen
editions and general-key runtime dictionary. The committed source artifact is
`model-mutation-observations.json`, SHA-256
`dca8b55d551d50c6ca0a2917ebce372b20894d4001b7a9738053c7d96d3cf841`.
Fresh pinned-source replay reproduces all eleven source scenes and the eight
corruption controls pass. No source fixture values were changed for this port.

The target compares every callback event, current semantic object view, resource
object slot, final group and ordered member reference for the three scenes:

- Mutation from page 1 to page 2 before insertion produces one group [0, 1].
- Mutation to page 20 after insertion produces two entries referencing the same
  resource object, with member lists [0] and [1, 2].
- Mutation to page 2 after insertion retains one entry and list [0, 1, 2].

Known mention IDs and genuine anchor objects remain unchanged. Final semantic
snapshots match the source. These are internal callback execution proofs, not
final CitationDocument or complete CitationEngine parity claims.

## Ownership and table integration

Callback resource data and closed failures now live in CallbackResource;
CallbackSession re-exports them for its existing internal consumers. Registered
resource views carry an operation scope and resource-object slot, separately
from list handles and table insertion entries. Scope comes from captured
Crypto entropy. Views are structural data, not source evidence or durable IDs.

CallbackRuntimeIndex captures the frozen-edition adapter and Crypto, then builds
one object registry and one general-key table per owner. The semantic reader and
shared work counter are captured with R = never. Resource references read live
citation fields when hashing. Registration does not hash the citation. Private
registered views are snapshotted, validated against their owner, and rejected
when copied from another operation or altered. Validation also runs before
pair registration and before grouping, so falsifying truthiness cannot bypass
ownership checks.

The owner routes get/set/remove/clear through the runtime index when this
internal factory is supplied. It maintains per-entry list-slot accounting and
retains owned list nodes after key removal or clear. Key presentation remains
from the original entry; repeated key-object entries are not collapsed. Existing
membership/resource ceilings still guard writes. Close revokes registered
objects and clears the table.

Default full callbacks create resources through the owner. Candidate uniqueness
reads their current runtime equality keys. Id. resolution uses the actual
owner dictionary lookup and its selected list, rather than scanning group
snapshots. The latter would pick the old entry when one mutated resource object
occupies two table entries; the source instead uses `resolutions[last][0]`.

Controls preserve retained list handles, shared lookup aliases, writes after
clear and removal of an entry without discarding its list. Forged slots,
foreign operation references and altered registered views are rejected without
changing entries. Falsy unhashable resources still raise the closed unhashable
failure when explicitly hashed. Unregistered custom resources are rejected;
this canonical port assigns them no fabricated numeric hashes.

## Migration boundary and verification

The factory is an internal Context service, not a function-valued request field
or public mode flag. Existing frozen-descriptor callers still use the legacy
adapter route when the factory is absent. That route has not been promoted to
live mutable-key parity. The registered path is not yet the unconditional
production engine Layer. This temporary migration boundary must be removed or
fully reconciled before final completion.

The server package gate passes: audit 33.6 seconds, docgen 10.7 seconds,
including build, source/test type checks, tests, lint and documentation. The
legacy semantic scenes, prior-full/list/detached cases, default corpus and the
new callback owner controls remain green. Model-mutation source replay and
eight corruption controls pass. The source verifier reports source evidence
only; registered target execution is asserted by its separate target suite.

Null-page identity allocation is deliberately not invented by this factory;
the generalized registry's earlier controlled-identity proof remains separate.
Production asset loading, arbitrary host/model behavior, host/canonical equality
interactions, comparison reentrancy, final diagnostic mapping and per-entry
public document relationships remain open. Full parser safety, Bluebook,
exhaustive source/donor accounting, reflection, hosted proof and one-PR closeout
remain required. No canonical, donor, divergence or safety row is promoted.
