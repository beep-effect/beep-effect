# Private callback execution session

Date: 2026-10-28. Focused callback dispatch/state proof, not complete custom
resolver parity or final public service integration.

## Implementation

The private `CitationResolutionCallbacks` service captures all five callbacks.
Every method returns an Effect with no remaining requirements. No callable
value enters raw request data. The private session operation consumes the
service and Crypto; the eventual composed engine must capture these services
before exposing its own methods with R = never.

`ResolutionInput.ts` now owns the shared preparation previously embedded in
the default resolver. Both paths snapshot semantic inputs before hashing,
require a genuine source capability, check source/mention ceilings and edition
uniqueness, then restore every occurrence against the same source capability.
The default path maps the shared private failures into its existing error.

Callback resources distinguish None, hashable values and unhashable values.
Identity, truthiness and presentation are separate. The session retains the
actual last callback result, including False/zero/empty values, instead of
collapsing it into an optional last successful authority.

Full callback results enter the prior-full list before grouping, even when
falsy. Short/supra/reference callbacks receive the ordered prior-full list
and return an explicit list update. Id. callbacks receive the actual last
result and resource groups before current append, and return an explicit
dictionary update. Unknown citations dispatch no callback and reset last.

Truthy values are grouped by the trusted resource identity producer. Equal
keys append members while retaining the first key presentation. A truthy
unhashable result fails at grouping; a falsy unhashable value can remain in
prior-full state until a later operation actually needs its hash.

The session checks basic iteration, group, member-edge and prior-full budgets.
Callback updates must reference known verified occurrences; prior-full entries
must reference full occurrences. Id. dictionary updates reject duplicate
normalized keys and unhashable keys. These are private protocol checks, not
proof of complete deadlines, message caps, field caps or process isolation.

The session returns schema-owned prepared evidence and transient state. It
does not yet project arbitrary callback-mutated groups into CitationDocument
or issue trusted persistence bindings automatically. Empty groups and mutable
membership remain visible at this private stage rather than being silently
dropped to satisfy the current document graph.

## Id. helper correction

The oracle's cast of the first grouped citation to FullCitation imposes no
runtime check. A custom callback may introduce a resource from a non-full
citation. The private pin helper now accepts the canonical Citation union for
that first member, retaining the exact case-only missing-page check and all
existing Unicode/integer behavior. Non-full first-member behavior is exercised
by the callback observations, using the real production pin helper.

## Oracle-bound test lane

The new session test reads the existing committed custom observations, checks
their exact SHA-256, all 18 unique contexts, 56 input occurrences and 53 callback
events. Every context is executed; both successful groups and source failures
are compared, and the entire callback event sequence must match. The source
fixture remains unchanged at:

`19ce5a31fbcae943e71a0d580145d499a9fb911cd8fe5cf16226dc08a686a7af`.

Synthetic witness text gives each semantic occurrence a genuine source anchor
and reproducible occurrence ID. Relevant kind, component, party, antecedent
and pin inputs reproduce the source probe's scenes. Canonical model templates
are reused from the prior focused corpus; this is no claim of original-source
extraction, every metadata field's equality, or donor class layout parity.

Captured test-only callbacks implement the fixture behaviors and focused
default callback rules needed by these scenes. Their finite primitive adapter
maps True and integer 1 to the same equality fingerprint while retaining their
different presentations. The source test confirms first-key retention, all
five dispatch branches, falsy results in prior/last state, pre-append Id.
groups, merged-resource first-page validation, a cleared prior-full list and
stopped dispatch after TypeError/ValueError equivalents.

The fixture adapters are not production host-object normalizers or the final
default callback implementations. The existing production default resolver is
still a separate regression path. These 18 session contexts do not increase
its 76-context/210-mention total or close the full custom-resource row.

## Remaining proof

Public use-case port publication, production callback defaults, final document
projection/binding integration, alias/object identity, arbitrary model mutation,
foreign-citation handling and general host equality normalization need further
source-bound work. The explicit transition protocol has focused boundary-state
proof; it does not approve a read-only replacement for every source mutation.
No canonical, donor, divergence or safety row is promoted. The complete goal
and current phases remain active.

The session suite has three tests: the complete 18-context trace comparison,
evidence-before-callback/exact-dispatch-budget controls, and rejection of state
references outside the verified input with redacted failure payloads. The
final server package gate passes (audit 32.4 seconds, docgen 12.4 seconds),
including build/type checks, tests, lint and documentation. Existing default
resolver, persistence, identity and Unicode/pin suites also pass.

Fresh pinned Python replay matches all decoded values of the retained source
observations. The ten-component evidence audit and goals index pass; goals
doctor reports no new blocking findings. New-note and README Markdown checks
pass. The complete target comparator remains pending. Verification logs use
the `callback-session-` cache prefix.
