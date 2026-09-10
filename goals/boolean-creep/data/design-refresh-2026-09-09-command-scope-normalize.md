# Command scope and Normalize eligibility handoff — 2026-09-09

## Audit boundary

This bounded audit used checkout source
`7440cb8c4302ce64b87860069a464bafbf65f576` and corpus source
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. Upstream later advanced to
`52fcc8d1353db9481ef9edb6cc9619500f95568d`; implementation and P3 must
refresh source and line citations after that source is merged.

The audit covered only the Round 26 Normalize row, the named
`docgenQualityCommand` scope carrier, and the named `goalsIndexCommand`
mode carrier. No source, tests, inventory, lifecycle state, dependencies,
generated files, or git references changed.

## NormalizePlanEntry: withdraw as outside the net

Withdraw
`r26-cli-commands-d-k-normalize-plan-entry-resized` rather than promoting or
designing it.

`NormalizePlanEntry` at
`packages/tooling/tool/cli/src/commands/Files/internal/Normalize.schemas.ts:191-205`
has one Boolean member, `resized`. `inputDimensions` and
`outputDimensions` are required `MediaDimensions` payloads. Their equality
is not another Boolean, presence, literal, atom, state field, or schema member.
The raw report therefore manufactured a virtual predicate result and counted it
as a second bit. This fails the SPEC net, which requires at least two
Boolean-typed members in one owner. It also fails E3, whose binding definition
is a Boolean duplicating a sibling field's presence.

The production planner at
`packages/tooling/tool/cli/src/commands/Files/Files.service.ts:1397-1408`
does write coherent rows by assigning `resized` from
`mediaDimensionsChanged(inputDimensions, outputDimensions)`.
`packages/tooling/tool/cli/src/commands/Files/internal/Apply.ts:369-391`
copies all three values unchanged while adding output metadata. Those facts
describe one Boolean derived from required payload contents; they do not create
a two-axis Boolean carrier.

The schema-derived arbitrary round-trip at
`packages/tooling/tool/cli/test/files-command.test.ts:839,887-889` proves
codec invertibility for the permissive schema. It does not turn dimension
equality into a stored member and does not establish campaign eligibility.
The explicit command fixtures cover coherent changed/true and equal/false
outputs at `files-command.test.ts:4194-4233,4238-4271`.

Keep the public `NormalizePlanEntry`, versioned
`beep.files.normalize.v1` manifest, all keys/defaults, permissive accepted
values, and `encodeNormalizeManifest` unchanged. Do not add an equality
discriminator, union, refinement, canonicalizer, or compatibility codec for
this withdrawn row.

`outputHash` and `outputSizeBytes` are separate optional members in the same
schema. They were not members of the raw record and do not rescue its invalid
evidence. Any later presence-cluster proposal must independently audit their
writers, readers, cardinality, and evidence under its own owner; this packet
does not adjudicate that separate cluster.

Because this is a scanner-boundary error rather than a D1/D2 judgment, omit it
from the live canonical inventory and retain the raw row only as historical
sweep evidence. No Normalize design file should exist.

## docgenQualityCommand scope: qualify with full package alternative

Design:
`goals/boolean-creep/designs/r26-cli-commands-d-k-docgen-quality-command-scope.md`.

The named `Command.make` carrier at
`packages/tooling/tool/cli/src/commands/Docgen/Docgen.command.ts:778-796`
owns the optional `package` selector and default-false `all` and
`changedFiles` flags together. Their resolver at
`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:107-154`
rejects multiple selected scopes and resolves exactly one of package, all,
changed-files, or default affected. Qualification is E2 at that resolver.
Carrier ownership at the command declaration is not a separate E3 claim.

The complete coarse carrier is
`[package presence, all, changedFiles]`: eight representable combinations and
four legal selections:

| package | all | changedFiles | selection |
| --- | --- | --- | --- |
| None | false | false | affected |
| Some(selector) | false | false | package(selector) |
| None | true | false | all |
| None | false | true | changed-files |

The four multi-selected rows fail with the existing exact `DomainError`.
The raw 4/3 inventory projection omitted package presence and its proposed
LiteralKit could not carry the selector. Parent metadata correction:
members `[package,all,changedFiles]`, cardinality 8/4, stored/internal,
Tier 1, tagged-union.

Reuse the existing `DocgenQualityScopeMode` LiteralKit at
`Quality.schemas.ts:49-70` as the tag owner for a private payload-bearing
selection. Keep the raw CLI fields and their names, aliases, defaults, and
conflict acceptance at the parser boundary. Preserve the existing exported
`resolveDocgenQualityTargets` raw signature and documented invocation; after
its current orphan-config check and exact conflict validation, delegate to a
private resolver that accepts the tagged selection.

Preserve error and I/O order: orphan-config validation precedes scope conflict;
package resolution precedes configured-package discovery; empty targets return
before negative packet-limit validation; affected and changed-files retain
their distinct git behavior. Preserve package-only output-path inference, the
encoded report's existing four `scope` strings, independent `check/json`
behavior, packet/report bytes, and every CLI error.

Guard deletion is downstream of the raw compatibility boundary: replace the
package/all/changed/default conditional tree with exhaustive selection
matching. Keep exactly one raw conflict guard because invalid CLI combinations
must still produce the current error.

## goalsIndexCommand mode: qualify

Design:
`goals/boolean-creep/designs/r26-cli-commands-d-k-goals-index-command-mode.md`.

The named command at
`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:321-326`
owns default-false `write` and `check`. The reader at lines 278-299 rejects
combined true before index generation or I/O, then dispatches write, check, or
default print. This is E2, cardinality 4/3, stored/internal, Tier 1,
LiteralKit.

Resolve the raw pair once to a private `GoalsIndexMode` LiteralKit with
`print | write | check`, preserving the raw Effect CLI flags and exact
combined error at the command boundary. Pass only the literal to the runner and
delete its Boolean parameter record and branches.

Preserve both exact invalid-row messages, rejection before
`buildPortfolioIndexContent`, write bytes/logging, default stdout, and check
semantics. Check intentionally accepts an absent ignored `goals/INDEX.md`
projection and fails only when a present copy drifts. The local index Option is
branch-local evidence, not part of the mode carrier.

## Required verification after implementation

P3 must verify the corrected eligibility/cardinality and the exact boundary
ordering before either design advances. Apply-time proof should include:

- all eight docgen raw scope rows, exact multi-scope error, orphan-first
  precedence, and no downstream analysis/output on conflicts;
- all four goals-index rows, exact combined error before generation/I/O,
  default print, write, absent/matching check, and drift failure;
- focused CLI tests and full package verification;
- post-`52fcc8d1` source and line refresh.

No browser QA is required for these CLI-only carriers.
