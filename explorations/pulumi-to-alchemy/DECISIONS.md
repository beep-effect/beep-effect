# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-15 — migration target

**Question:** What does "done" mean for removing TypeScript 6, and should the
infra Pulumi stacks move to Alchemy? (Round 1 also offered: host stacks to
Effect CLI commands vs Alchemy custom providers; isolating the Vercel and
runner-module gaps; a credential-free Alchemy spike as the first slice.)

**Answer:** No Alchemy migration. Operator, verbatim: "We don't need a complete
migration to alchemy. Honestly If pulumi doesn't support ts7 then we can just
isolate it to infra." Pulumi stays; its TypeScript 6 requirement is confined to
`infra/` instead of being patched at the repository root.

**Rationale:** Research found Alchemy v2 still in beta (2.0.0-beta.83) with no
coverage for the Vercel projects, the Terraform-backed GitHub runner module,
KMS grants, Compute Optimizer enrollment or host-level SSH/systemd. A full
migration would mean custom providers for all of them, which is far larger than
the benefit of removing one TypeScript 6 copy. Isolation keeps every stack and
its state untouched. Rejected: the full migration, zero TS6 in the repo, and the
Alchemy spike. The recommendation offered was a TS7-only root with any
leftover Pulumi isolated; the operator's answer goes further and keeps all of
Pulumi.

## 2026-10-15 — packet outcome

**Question:** Graduate, park or kill this exploration?

**Answer:** Killed. Epitaph: Pulumi stays; Alchemy can't cover our providers
yet, and isolating Pulumi's TypeScript 6 need in `infra/` is enough.

**Rationale:** The isolation needs no goal packet. It is one follow-up PR in
the TS7 exit program: an infra-local preload makes Pulumi resolve infra's
nested `typescript` 6, which retires the root `@pulumi/pulumi` patch and its
syncpack hold. RESEARCH.md and research/SOURCES.md stay as provenance if Alchemy
coverage changes; reopen at research in that case.

## 2026-11-02 — reopened at research

**Question:** Does the 2026-10-15 kill still hold now that the TS6 isolation shipped and the
repo runs Alchemy in production?

**Answer:** Reopened. The operator asked on 2026-11-02 (via the orchestrator hand-over) for a
dedicated investigation of "can beep-effect migrate its infrastructure off Pulumi onto Alchemy,
and if not fully, what are the options?" The packet's own exit condition was "reopen at research
only if Alchemy gains coverage for Vercel, the GitHub runner module and host-level resources";
none of those three gained coverage (re-verified against the checkout at `450702936d`), so the
reopen is on the operator's request and on two changed facts: the isolation landed
(`infra/pulumi-typescript6.cjs`), and Alchemy is live for beep-effect.com and the R2 cache
stacks. Status back to `active`; stage `align` with the research refreshed under
`RESEARCH.md` "2026-11-02".

**Rationale:** The 10-15 answer ("isolate it to infra") was to a narrower question (how to
remove the root TS6 patch). The 11-02 question is direction: Pulumi or Alchemy for the whole
estate. Research now records a resource-by-resource matrix (40 kinds covered, 9 gaps, 1
partial), per-gap options, three candidate options with state-migration and rollback plans,
and a recommendation: finish the isolation as "Pulumi stays, precompiled, no TS6" (option C)
and adopt Alchemy-first-for-new as policy (option B), holding a full migration (A) behind named
gates. Nothing here is decided; the eight frontier questions are listed at the end of the
2026-11-02 research and in the manifest for the grill session.

**Not decided (frontier for the grill, 2026-11-02):** goal statement (no TS6 vs no Pulumi);
Alchemy-first policy and canonical state store; OIP hosting (Vercel vs Cloudflare); retiring
the Storybook program; the runner fleet's future; host stacks (Pulumi vs Alchemy vs Effect CLI);
appetite for the credential-free option-C spike; account singletons in or out of IaC.
