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
Full-file review and D12 phase planning are in progress; no source remediation
or inventory closure is claimed by this preparation record.

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
