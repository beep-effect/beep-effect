# Session B research — 2026-08-26

Seven lanes dispatched for the Session B grill that chartered the fleet
convention-migration campaign (candidate 6) and ruled on the three amendment
candidates queued on 2026-08-25. Three lanes audited this repository, three
swept external prior art, and one implemented the goal's rung-4 hardening.

Repo lanes ran on GPT-5.6 Sol at xhigh effort; web lanes ran on Grok with
native X search. Every lane was told to create its report file first and append
as it worked, and to carry a `path:line` citation or a fetched link on every
claim.

| Lane | Question | Verdict |
| --- | --- | --- |
| [`C2-amendment-J.md`](./C2-amendment-J.md) | Does the repo already model gate certificates, and which gates lie today? | Pull J forward; reshape onto the existing `@beep/skill-contract` kernel |
| [`C3-amendment-H.md`](./C3-amendment-H.md) | Is `GOAL.md` really determined by the manifest? | No — 0% irreplaceable prose but 57.1% of launcher characters need absent fields |
| [`C4-amendment-I.md`](./C4-amendment-I.md) | Does the repo have the substrate, and what is "one real join"? | Substrate exists; no acceptance-grade join does, and the wording collides with ratified IRI doctrine |
| [`G1-amendment-I-prior-art.md`](./G1-amendment-I-prior-art.md) | Has anyone shipped a PROV-O/P-Plan projection of plan state? | Refuted by the people who tried it — CWLProv, Nextflow, P-Plan, AgentO |
| [`G2-amendment-J-prior-art.md`](./G2-amendment-J-prior-art.md) | Is there a standard for honest gate verdicts? | Every component is standardized; only the concatenation is new |
| [`G3-amendment-H-prior-art.md`](./G3-amendment-H-prior-art.md) | Is generating an agent launcher from typed plan data better than authoring it? | Not supported; the closest shipped analogs all kept the prompt authored |

The rung-4 implementation lane's report is process evidence rather than packet
content and is not carried here; its evidence is PR #848 (merged 2026-08-26,
squash 80c5693d2a) and the rung-4 paragraph in
[`goals/packet-control-plane-core/PLAN.md`](../../../../goals/packet-control-plane-core/PLAN.md).

## Citation baseline

The lane reports promise a `path:line` citation on every repo claim. Those
line numbers resolve against the tree the lanes audited — `main` at
`5c6fa7c2e109` (2026-08-26, before the Session B docs PR). The Session B
section that PR inserts into `MAP.md` shifts later line numbers, so resolve
`MAP.md:<line>` citations from C2/C3/C4 against that revision, not the current
file. The reports are frozen evidence and are not renumbered after capture.

## Reading order for the rulings

Read [`../../DECISIONS.md`](../../DECISIONS.md) D17–D23 for what was decided
and why, then the "Session B amendments (2026-08-26)" section of
[`../../MAP.md`](../../MAP.md) for the binding text. These reports are the
evidence under those entries, not a substitute for them.

## Caveats carried from the lanes

- The web lanes flag their own unconfirmed items in a method-caveats section;
  read those before citing a number downstream. G1 could not verify AgentO
  download statistics or GitHub IRI code-search results, and G3 could not
  retrieve several primary sources it cites secondarily.
- C3's launcher census sampled 14 launchers, not all 139 packets carrying
  `agentLaunchers`. The 57.1% figure is the sampled character share.
- External repositories examined by C2's companion recon (ontoskills,
  open-ontologies, mykg) are reference-only. Nothing is vendored.
