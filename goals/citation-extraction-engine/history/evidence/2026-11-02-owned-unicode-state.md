# Scoped ownership of exact native Unicode state

`CitationCleanerValues` now captures an explicit policy and the Unicode
representation adapter. Every issued text entry retains native storage and
its JavaScript projection separately, including ordinary JavaScript input and
captured subclasses. Native issuance accepts canonical storage directly.

`getUnicode` returns detached native bytes, so mutating an input buffer or a
read snapshot cannot change an owned value. `getText` remains a projection,
not native source identity. Native producers use `materializeUnicode` to retain
their exact output layout. An unchanged allocation requires equal native width
and bytes, not just equal JavaScript text. Subclass flattening retains its
native value while issuing the source-required plain object. Fresh allocation
can retain a pair of surrogate source points without converting it to a scalar.

The existing frozen-handle and weak-issuer checks remain authoritative. Neither
copied slot fields nor decoded data can issue a handle. Empty and replacement-
space caches still have synchronous publication and at most two entries; no
nonempty native-value cache was added. Closure clears owner state and rejects
all native operations. Receiving snapshots do not themselves confer ownership.

Unicode size/deadline failures map to the existing public
`CitationSafetyLimitExceeded` clean-operation variant, selecting the captured
produced-text or actual minimum clean/operation deadline field. Private invalid
layout failures remain sanitized. Native comparison yields every 8,192 bytes,
and materialization has a captured timeout. Issuance still does not spend the
shared produced-text budget: bounded producers must reserve before building
outputs and return their original work tickets.

Validation:

- All 6,412 integrity-bound source snapshots pass native issuance, detached
  read, source-hash comparison, unchanged materialization, and handle identity.
- Fifty schema-derived JavaScript strings pass native ownership round trips.
- Controls cover input/read buffer mutation, equal-projection scalar replacement,
  subclass flattening, fresh native allocation, forged handle rejection,
  captured numeric ceilings, Scope closure, and the captured operation deadline
  without issuing a partial handle.
- The original 340-case cleaner identity/subclass corpus still passes.
- Eight tests across the new/native and existing owner suites passed in 3.42
  seconds with one worker. No native worker qualification was run locally.
- Server source-and-test type checking passed after the integration. Catalog
  and identity profile writers were run; no new catalog entry was required.

Builtin literal composition, primitive hash/callback protocol dispatch, and
HTML worker transport still consume projected text in places. They must be
wired to the retained native state before composed target parity can pass.
These remaining duties are not a normalization exception or semantic waiver.
