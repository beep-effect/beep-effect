# Owned named Document cleaner protocols

The server now supplies a named list/tuple adapter through the existing
CitationDocumentInputProtocols and CitationCleanerProtocols. Its issued container
handle is shared by constructor truth/membership, plan selection and actual
cleaner iteration. Plan selection performs no iteration; every list/tuple opening
gets a fresh cursor. The existing registry, native hashes, builtins and owned
cleaner work execute each selected step. The adapter captures all dependencies;
returned protocol methods require R=never.

Names are schema-validated server configuration, detached from the caller's
array. They are not callback/iterator request fields. A bounded lifetime work
counter reserves the complete container-plus-elements cost before any value
issuance. Interrupted/failed configuration does not refund that reservation.
Each element yields and checks owner lifetime before obtaining its existing
builtin-name handle. Scope closure clears the plan table and weak issuance map;
all subsequent container access and iterator reads refuse closed ownership.
The value arena authenticates original handles before private lookup; a foreign
owner cannot obtain access by matching a numeric slot.

Exact named lists and tuples implement source emptiness and html membership.
The original insert("html", 0) bug is retained: an exact list rejects the index
with TypeError, and a tuple lacks insert and reports AttributeError. No list is
mutated by that failure. Exact plain native strings use existing display-string
emptiness, which is equivalent to zero native Python points even for literal
surrogates, without copying native storage or normalizing it. Subclasses and
other host values delegate to the captured Document protocol service. Arbitrary
host containers are never coerced, inspected for properties or normalized into
named containers. Without a host adapter, unsupported objects fail explicitly.

The shared original-constructor replay now uses this production adapter for the
ordinary default list and exact tuple cases. Traced subclasses, callback lists,
None and generators continue through their existing captured host protocols.
Test observation wraps iteration to compare the original cleaning phase events;
it does not supply the named-container behavior. Both 30-case source smokes pass
through real cleaning and geometry on Bun and Node, each with twenty independently
confirmed exits. All 112 cases per runtime remain registered for hosted replay.

Five focused tests cover real repeated underscore cleaning from one named
tuple; caller-array mutation cannot change the installed plan; original insertion
errors/empty truth and foreign-owner refusal; lazy host delegation with a throwing
property; owner closure; and complete capacity refusal with no new issued value.
The initial host stub used reusable-Effect opportunities caught by the compiler;
these were changed to Effect.fn without suppressions. One test was initially
placed inside another test, then moved to the suite's top level. Failed receipts
are retained in .beep alongside the passing capacity controls.

The final regression passes all 37 tests across five files in 11.10 seconds,
including both constructor runtimes and actual diff/HTML workers. Package lint
and source/test checks pass (0.4/3.1 seconds).

## Hosted startup schema duplication

Hosted Fallow job 127734620043 on 8b023a7d27 confirms the previous cognitive
correction: health reports zero findings. Its remaining audit failure is clone
dup:9c9a28e5, the duplicated maximum/assetPath fields in DiffWorkerRpc and
HtmlWorkerRpc. Artifact 13479709541 contains the exact two instances. Both now
reuse CitationNativeWasmStartup.fields from the existing shared native-WASM
module. Their version tags, bounds, field order and authentication remain the
same. No baseline, threshold, ignored path or suppression changes.

A tiny isolated source-only Fallow check over the changed protocol modules and
fixtures reports no cognitive/cyclomatic excess and no duplicate group. It lacks
the repository's dependency/coverage graph and is not hosted acceptance proof.
The full hosted gate remains authoritative and pending on the next commit.

## Remaining scope

This is the concrete named-container path, not a complete Python object runtime
or the final public engine Layer. Arbitrary host mutation, reflected protocols,
general exception classes, generator semantics beyond the captured adapter,
pre-populated Document state, whole-engine allocation/scaling proof, every other
unfinished extraction/resolution/codec/accounting duty and reflection/lifecycle
closeout remain required. The existing custom protocols are retained rather than
claimed subsumed. No semantic waiver is added.

## One-shot named generator follow-up

Explicit server configuration can now issue a named generator as well as a list
or tuple. Effect Ref owns its atomic position and source generator state. Unlike
lists/tuples, membership and every cleaner opening use that same cursor. A match
consumes through the matching item; a miss consumes to exhaustion. Matching the
last item leaves GEN_SUSPENDED until the next pull, which sets GEN_CLOSED.
Created and exhausted generators both remain truthy. Reversed insertion reports
AttributeError, preserving the original absent insert attribute.

The existing private observer now returns schema-owned kind, size and optional
generator state; it authenticates the original value and honors owner closure.
It does not inspect a host object. Arbitrary effectful generators, subclass
protocols and host iterators continue through the captured host adapter, with no
conversion into this named configuration. No Stream buffer or prefetch can
consume source items early: the existing cleaner cursor pulls one item at a time
and Ref.modify commits only that pull. Native worker/process ownership is
unchanged.

The sealed original constructor replay now routes generator-empty and
generator-html through the production adapter on Bun and Node. Its state
assertions read the adapter's schema state rather than a fixture-supplied cursor
counter; original errors, event order, aliases, step contents, geometry and exact
physical-exit assertions remain. Ordinary lists/tuples and captured custom
protocol paths retain their prior source checks.

Three new controls show that html membership leaves the following underscore
step for actual cleaning, repeated cleaning never restarts the generator,
empty/exhausted truth is preserved, and matching the final item does not close
the generator prematurely. Actual HTML execution would be refused by that
unit fixture, so successful underscore-only execution is also a negative control
against replaying the consumed html step. Initial compiler diagnostics for
yield-in-call and Option wrapping were fixed using bound effect execution and
Effect.asSome without suppressions.

All nineteen tests across the adapter, Bun/Node constructor and existing registry
files pass in 11.59 seconds. Package lint/source/test checks pass (0.5/3.2 seconds).
An isolated source-only Fallow scan of the three changed files reports no
cognitive/cyclomatic excess or duplicate group. This is syntax-level evidence,
not repository gate proof. The preceding head's hosted Fallow job 127737885031
was still running and full integration job 127738260262 was queued when checked;
full hosted replay of the new head remains required. No baseline, threshold,
timer, resource ceiling or semantic waiver changes.
