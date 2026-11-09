# SPEC — Model Arrangement Admission Core

Normative contract, seeded 2026-08-17 from the ratified
[`MAP`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/model-artifact-admission/MAP.md) (candidate 1)
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

## Decision log

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug model-arrangement-admission-core`; add a `kind: decision` file there, never edit this block._

### research-intake-2026-11 routed 56 affirmative findings here, 2026-11-07

The research-intake-2026-11 intake routed 178 findings to this packet (56 affirmative, 9 critiques or disputes; 51 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: https://govtribe.com/file/government-file/sam-dot-gov-announcement-october-15-ai-roundtable-dot-pdf — Vendor requirement for American-built models with model cards and bias/drift monitoring constrains model admission for any USPTO-facing offering.
- citesAsEvidence: https://github.com/voltagent/awesome-openclaw-skills — The source identifies post-inclusion mutability as a risk. Any later evaluation or adoption needs an identifiable version and integrity evidence so its conclusions remain tied to the inspected artifac
- citesAsEvidence: https://www.steptoe.com/en/news-publications/the-mother-court-blog/public-ai-use-not-privileged-takeaways-and-best-practices.html — Steptoe reports that the court treated submission of counsel-derived information to Claude as waiver of existing privilege. This supplies a concrete risk scenario for controlling privileged informatio
- citesAsEvidence: https://arxiv.org/abs/2609.30123 — Machines compiled using qwen3.6-flash development trajectories were reused unchanged with three other executors, improving success over their native baselines in 11 of 12 transferred settings. This su
- citesAsEvidence: https://www.americanbar.org/groups/law_practice/resources/law-practice-magazine/2026/september-october-2026/privilege-work-product-and-the-prompt-box/ — Whether putting confidential information into an AI tool risks waiver depends mainly on the provider's contractual terms, which makes vendor terms of service a gating input for any legal AI route or p

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.

Lane feat/research-intake-2026-11

Reverse: Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl

<!-- beep:decisions:end -->
