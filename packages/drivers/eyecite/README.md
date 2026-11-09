# @beep/eyecite

Technical boundary for pinned `eyecite-ts` 0.34.2 recognition. Product semantics,
verified source evidence and document-local authority linking stay in the owning
product slice. This package returns raw parser observations, not verified facts.

The root exports bounded DTOs and a closed, source-free failure. The explicit
`/protocol` subpath defines the Effect RPC procedure. `/recognize` imports the
synchronous SDK and must run only in an owned isolated child. Returning an Effect
does not make synchronous regex matching interruptible. There is no Layer here
that makes direct supervisor-thread parsing safe.

The projection retains six raw forms and selected original-source/component
ranges. It drops donor IDs, confidence, resolution and publication graphs.
Other forms are counted separately; an empty list does not certify that a source
contains no citations. The receiver must validate every range/quote and map the
raw fields into its existing domain schemas before treating them as evidence.

Requests carry source and candidate ceilings, within schema-owned maximums.
Overflow refuses the complete request. The SDK may allocate during recognition
before the candidate count is known; the owning process boundary must enforce
its deadline, cancellation and retirement policy. Frame size, parent resources,
public error mapping and source privacy are caller responsibilities.

String fields use Effect's JSON schema transform before SchemaBinary transport,
preserving isolated UTF-16 surrogates without a private string codec. No custom
framing, scheduler or authority resolver is introduced.

See the root THIRD_PARTY_NOTICES.md for upstream MIT attribution. The selection
receipt and frozen comparison live under goals/citation-extraction-engine.

The upstream tokenizer can warn and skip a failed pattern. The isolated caller
must refuse unexpected parser diagnostics; this synchronous wrapper alone cannot
certify complete discovery after a swallowed upstream failure. That integration
safeguard is required before switching the production service. New workspace
tasks remain explicitly uncached until separately qualified; this driver does
not expand the cache-qualification baseline.
