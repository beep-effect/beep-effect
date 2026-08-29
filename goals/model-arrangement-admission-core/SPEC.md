# SPEC — Model Arrangement Admission Core

Normative contract, seeded 2026-08-17 from the ratified
[`MAP`](../../explorations/model-artifact-admission/MAP.md) (candidate 1)
**including its five adversarial amendments** — back-links, not copies.

## Mission

Record which model arrangement is qualified for which role and data class,
under what evidence, with what expiry — as immutable, digest-bound records
with as-of queries.

## The contract (ratified; amendments binding)

1. **`ModelArrangementRevision`** — digest seals the provider-attested
   identity envelope (provider, service, deployment, requested + resolved
   ids, alias-resolution class, assurance tag) plus **ordered component
   digests only** (amendment D): never entity identity fields. Builder lives
   server-side where driver imports are legal; the domain stays driver-free.
2. **Fixture = the CHAT arrangement (amendment B)** with the closed component
   set: materialized model id, `maxTokens`, system-prompt digest,
   tool-wrapper/`toolChoice` semantics, output-parser version, retry plan.
   The repair and filing arrangements are admission candidates two and three.
3. **Kits v1 (amendment C, admission-local):** role
   `[matter-work, internal-tooling, lab]`; data-class
   `[client-matter, public, synthetic]`; modality `[text, image]`; assurance
   `[provider-pinned, provider-resolved-alias, alias-only,
   opaque-deployment]`. The A1 floor is a policy table over
   (role, data-class) → minimum assurance.
4. **`ModelArrangementQualification`** — the ratified evidence envelope;
   completeness = every field present or explicitly not-applicable
   (amendment E). A disposition may reference only a **complete**
   qualification of the **same arrangement revision** (schema invariant).
5. **`ModelArrangementDisposition`** — `admitted | restricted | rejected |
   expired | superseded`; scope kits ride `restricted` only (amendment A);
   human-only supersession; expiry via maintenance disposition; two-axis
   as-of eligibility query over the immutable records.
6. **First consumer contract (ratified):** the professional runtime approval
   gate references an admission-disposition id; wiring is MAP candidate 3.

## Acceptance (the ratified first slice, as amended)

- [ ] The chat arrangement's digest is stable across rebuilds (canonical
      ordering; envelope + components only).
- [ ] A mutated component digest yields a NEW revision; the old disposition
      does not transfer.
- [ ] The fixture disposition is `restricted` scoped
      (internal-tooling, public/synthetic, text) and the as-of query answers
      eligibility at (`validAt`, `knownAt`); a superseding disposition flips
      it without mutating the prior record.
- [ ] The referential-integrity invariant rejects a disposition citing a
      qualification of a different revision.
- [ ] Shipped as a PR driven to mergeable via /yeet.

## Constraints

- No disposition inheritance; no scalar trust score; no credentials in
  records; epistemic edge vocabulary untouched; admission grants eligibility
  only.
- Repo laws: schema-first; LiteralKit; Effect v4 against the reference
  checkout.

## Stop conditions

- The chat arrangement's component set cannot be closed without digesting
  volatile runtime state — stop and reopen the exploration.
- The eligibility query cannot be derived from immutable records alone.
- The same blocker repeats after reasonable investigation.
