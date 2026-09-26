# Business driver wave preparation

This wave covers the eight existing recorded test files in FreshBooks, HubSpot,
Microsoft 365 and USPTO. Their scheduled dependencies on Identity, Schema, Utils
and the accepted runner have landed. Preparation starts from main at
`7980e5aaa1e1b4480df85a20092242a6bf4b9a4c`.

The frozen census remains `662823dd960367046ba7d73dd8fd25d15782865a`.
Five of these eight files differ from that snapshot. The current test directory
membership matches all eight recorded paths: no added or missing test files.
Private receipts preserve both versions, exact hashes and per-file differences.
The existing inventories supply 32 human-lens rows and 53 detector rows.
Full-file review and D12 phase planning completed before remediation. The
phase checkpoint below records current work; inventory closure remains pending.

## Before timings

Configured runs completed successfully on Node and Bun with stable source,
manifest and lockfile hashes. Reports and resource contexts are retained under
`ops/inventory/timings/preparation/business-drivers` and its matching context
subdirectory. These shared-workstation measurements are not controlled speedup
claims; load, pressure and runtime limits are recorded.

| Package | Node whole command | Bun whole command | Passing registrations |
| --- | ---: | ---: | ---: |
| FreshBooks | 7.354 s | 1.978 s | 12 |
| HubSpot | 4.062 s | 3.852 s | 8 |
| Microsoft 365 | 6.311 s | 2.134 s | 12 |
| USPTO | 3.994 s | 1.986 s | 13 |

M365's optional live gate was disabled for these runs with a blank
`M365_LIVE_SITE_ID`. The existing absent-configuration branch reports a passing
placeholder. That registration proves no live Graph behavior; its reporting
must be examined during observability review. No credentials were resolved or
live-provider requests authorized by these baseline runs.

Remediation must retain the original order: scope, assertions, property, flake,
then observability. Native filesystem fixture subjects, callback completion,
network absence, typed errors and existing property domains remain review
obligations. Package proof and final timings follow implementation; this record
is neither package acceptance nor goal completion.

## Scope, assertions and property checkpoint

Scope commits `ed8caeb167`, `ea0aeb2211`, `01721046ec` and `cc5da07b1b`
isolate HubSpot responders, bound M365 fixture acquisition, isolate FreshBooks
token fixtures and replace USPTO provider wrappers with seven native layers.
Each package passed its full package audit and docgen after its scope changes.

Assertion commits `7ee54d6159`, `a7f3752897` and `14bb93d33f` use native
Some/None/Failure assertions. Service failure tests retain their original
first-typed-error observation, class membership and payload fields. They do not
reconstruct or impose equality on the full failure cause. USPTO expectations
retain their literal values through the existing branded schema constructor.

| Package | Assertion audit | Assertion docgen | Result |
| --- | ---: | ---: | --- |
| FreshBooks | 32.3 s | 11.1 s | Passed |
| HubSpot | 10.9 s | 9.8 s | Passed |
| M365 | 9.0 s | 3.3 s | Passed |
| USPTO | 10.1 s | 4.3 s | Passed |

USPTO's property phase adds a connected request capture to the metadata test
and requires the exact URL from that same service call. It retains the original
unconnected empty-array assertion and the separate URL test. Full package
audit (11.6 s) and docgen (4.5 s) passed after that change. Existing native
property registrations, domain arrays, predicates and `fcRuns(50)` blocks in
HubSpot, M365 and USPTO are byte-identical to the preparation commit.

Flake review retains FreshBooks' Deferred cancellation handshake and cleanup
and M365's deterministic TestClock retry. No sleeps, retries, lower run floors
or larger body timeouts were introduced. The absent live environment remains
the local proof mode; no live Graph acceptance is claimed.

Next: observability instrumentation, accurate live skip reporting, final
Node/Bun timings, inventory remediation attribution and publication gates.
These package proofs do not establish hosted readiness or goal completion.
