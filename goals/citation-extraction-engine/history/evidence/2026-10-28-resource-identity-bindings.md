# Trusted resource identity bindings

Date: 2026-10-28. Private identity/persistence foundations; custom callback
execution, host equality normalization and complete parity remain open.

## Identity descriptor boundary

The pinned custom-callback observations require resource groups without full
members and permit a callback to merge full citations with different default
keys. A document receipt cannot authorize that override itself.

Private server `ResourceIdentity.ts` defines two schema-owned descriptors:

- `Canonical` carries the existing canonical authority input and delegates to
  the existing ca1 producer. This preserves fallback resource identity.
- `External` carries adapter-scope and equality-key SHA-256 fingerprints.
  These are trusted adapter assertions, not arbitrary host objects, raw client
  input or a claim that hashing certifies resource equality.

The external ID hashes UTF-8 bytes of compact JSON:

```text
["citation-authority/v1","external-resource",scopeFingerprint,keyFingerprint]
```

It retains the ca1 token format with a preimage domain distinct from the
existing case, case-occurrence, law and journal protocols. A descriptor is
snapshotted before hashing. The encoded receipt stores only its authority ID,
representative and resolution edges; it stores no descriptor or binding table.

The captured adapter must map equal resources to the same descriptor and
preserve distinctions between unequal resources. Canonical fallback can use
the canonical descriptor instead of creating an unrelated external key.
Callback truthiness and the first returned resource representation are separate
state: they must not become part of equality or be inferred from an opaque ID.
This checkpoint does not implement or approve a host-object normalizer.

## Trusted expected membership

Private document projection/restoration accept optional `resourceBindings`
beside the runtime document or receipt. They default to an empty list for the
existing default path. Each binding supplies a descriptor and a nonempty,
unique member set. The list and total member count use the published hard
authority/mention ceilings. The future composed service must capture this
trusted adapter input; it must never forward caller-supplied receipt fields
as authorization.

The verifier recomputes each bound ID and requires every named occurrence to
resolve to it. It also requires every document member of that group to be
explicitly named. Duplicate group bindings, missing occurrences, incomplete or
extra members and changed keys fail. Expected membership is a set; document
membership order remains owned by the ordered mention sequence.

A checked binding can override a full member's default semantic key, matching
the canonical ability to merge full citations with a custom resolver. Every
unbound resolved full member still has its default key rechecked. A group with
neither a binding nor a checked full-member key still fails with the private
`authority-key-unavailable` reason.

Bindings, edition data and structural receipts are copied before the first
asynchronous hash. Source verification, anchor restoration, occurrence digest
checks, graph coherence and expected source/engine identity remain required.
The new helper errors retain only finite reasons, without adapter descriptors,
source text or nested causes. They remain private pending final boundary
translation into the closed engine error union.

## Focused proof

Four identity tests cover all 13 existing canonical fallback vectors, external
scope/key vectors, mutation during hashing and redacted invalid/digest errors.
The two external expected hashes were independently calculated with Python
`hashlib.sha256` over `json.dumps` using separators `(',', ':')` and UTF-8:

- Scope `a` repeated 64 times, key `b` repeated 64 times:
  `5acc85a268eb93b214b7de9d7db57f3cde49b77d59efe04e6c2582ca5bb9c90b`.
- Scope `b` repeated 64 times, key `a` repeated 64 times:
  `e1df0e52299f97791ddd0bb524ad1bc790a980be12948c305acd2b39a16eb258`.

Three new persistence tests cover an external resource with only an Id. member,
canonical fallback with no full member, distinct full keys merged under one
external key, and mutation of expected membership during the first hash.
Negative checks cover omitted bindings, receipt-carried self-authorization,
incomplete/extra membership, duplicate groups, changed keys and source drift.
The existing default persistence and nine-test resolver suites remain gates.

These tests establish the private descriptor protocol and trusted binding
checks. They do not execute the five callback branches, implement mutable
callback state, prove Python hashable semantics or promote a canonical/donor
accounting row. The existing 76-context/210-mention default resolver total is
unchanged. Full service integration, host normalization, bounded runtime,
Bluebook transforms and the complete target comparator remain unfinished.

The final server package gate passes (audit 33.9 seconds, docgen 11.8 seconds),
including build/type checks, tests, lint and documentation. The ten-component
source evidence audit and goal index pass; goals doctor reports no new blocking
findings. New-note/README Markdown checks pass. The strict target parity
entrypoint remains pending. Logs use the `resource-binding-` cache prefix.
