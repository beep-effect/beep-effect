# Local protected workflow receipt issuer

Status: implementation proposal; no accepted producer authority yet.

The qualification lab needs tamper-evident workflow receipts in addition to
native Turbo artifact signatures. The artifact key cannot serve this purpose:
readers receive it and can forge artifact tags. The issuer must not accept an
observation supplied through a public sign-request API.

## Proposed boundary

Use a supervisor-only symmetric receipt authentication key, distinct from every
artifact signing key and bearer capability. Keep it outside all experiment and
reader mounts; the trusted parent issues a receipt only after its owned worker
completes and the parent validates the returned observation. Native readers
never receive the issuer key. This adds no asymmetric attestation or PKI.

The authenticated envelope must bind the exact observation bytes, source
revision, resolved workflow identity, workflow implementation digest, client
pins, profile, epoch, issuer identity and bounded validity period. Use a
versioned domain-separated encoding and a standard HMAC-SHA256 implementation.
Verification obtains the issuer through trusted configuration, never a key or
key path supplied by the receipt. Binding expectations come from the live
reviewed contract, not fields copied from the same observation.

The local operator and approved supervisor implementation are trusted actors.
This mechanism must not claim protection against a compromised host operator,
root, or an unapproved supervisor that already possesses the issuer key. The
workflow digest must match an independently approved workflow binding before
its records can authorize promotion. An arbitrary checkout cannot self-approve
its workflow by placing its current digest into a receipt.

## Required proof before accepting this design

- Demonstrate that the actual nested reader cannot read or write issuer material
  or producer records, including through parent process state.
- Prove a reader-known artifact key cannot forge a producer envelope.
- Reject edited payloads/envelopes, unknown issuers, wrong source/workflow/client/
  profile/epoch, expired records, duplicated pair identities, rejected uploads,
  absent wire evidence and successful unsigned fallback.
- Verify workflow binding and source/tool pins before and after execution.
- Retain only safe bounded envelopes and references; never key bytes or raw
  artifact bodies. Define issuer lifetime, revocation and failed-verification
  behavior before accepting persistent records.
- Keep observation-only commands and the qualified-transition rejection until
  protected issuance, trusted binding, persistence and adversarial import tests
  are implemented and pass together.

A local JSON file plus its editable digest is not this mechanism. A schema-valid
or internally coherent receipt is still only an observation. The production
trust goal's deployment, credential rotation and observation-window requirements
remain outside this early qualification handoff.

## Standalone boundary control

The admitted isolated control in
[producer-issuer-boundary-control.json](./producer-issuer-boundary-control.json)
passed. Its reader could not read/write the issuer key or producer record;
protected bytes stayed unchanged. Five edited bindings and a forgery made with
the separate artifact key were rejected. The temporary key and record were
removed after the control. This establishes a candidate mechanism only: it has
not yet run against the actual signed-pilot reader and does not supply workflow
approval, durable issuer lifecycle or an operational importer.


## Durable lifecycle component

[The persistent issuer checkpoint](./owned-producer-store.json) records explicit
exclusive creation, restart verification and revocation. Stored material stays
in a canonical owner-only directory and a private, single-link bounded file.
Existing instances revalidate the store on every operation and reject changed
material. Failed initialization reserves the directory and fails closed; an
open operation never creates it. Power loss or partial writes therefore cause
rejection, not silent issuer replacement.

These are trusted-host filesystem checks, not an atomic defense against a
malicious same-uid actor racing path replacement. Reader mount exclusion must
still be proved with the actual stored material. Reopening currently requires
independently trusted binding configuration from the caller; persisted approval
binding and protected supervisor integration are the next contract, not an
implicit property of the storage implementation.

## Approval boundary and next integration

Provisioning is an explicit action by the trusted operator/supervisor. The
binding supplied there must come from reviewed policy and workflow identities;
neither an imported observation nor a receipt-selected location may provision
or select an issuer. The operator has delegated routine implementation and
blocker decisions, so this is an implementation boundary, not a request for a
second human approval of every run.

The next storage revision fixes a domain-separated digest of that entire binding
beside the issuer identity and secret, in the same private file. Opening compares
the independently expected binding to the stored digest before constructing a
signer. Changing source, workflow revision/implementation, policy, client,
channel, runtime, configuration, toolchain, signed root, profile or epoch needs
a new explicit provisioning action. A read/open must never rewrite approval.
This closes caller-driven rebinding; it does not authenticate an arbitrary
caller's decision to create a new store.

The supervised execution path must open the pre-provisioned store, check the
live workflow implementation and source/tool identities, run its owned worker,
verify the returned observations and unchanged identities, and only then issue.
The reader must probe the actual persistent key location, in addition to the
existing producer-record denial. An operational importer must obtain issuer
selection and expected binding from trusted policy, verify that envelope and
all acceptance evidence, and reject the observation-only route. These integration
requirements remain open; the in-memory factory and component test probes are
not a public sign-request mechanism or qualification authority.
