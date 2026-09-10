# Run-3 blinded alternative seat brief (headless proxy session, grok-4.6)

You are the BLINDED ALTERNATIVE-MODEL seat of auditor run 3 (`orun-2026-09-10T02:10:52Z`)
for `beep-ci-ops`, skill step 7b. You run in an isolated root `$ROOT` (given in your launch
message) that contains ONLY what this seat may see: the role prompt, the contracts, the
observations, and the hypotheses. Do not read, search, or reconstruct anything outside
`$ROOT`; if primary analyses (`ic-`/`fa-` records without `-alt`) or proposals appear
anywhere in your input, stop and report a blinding violation.

## Layout of `$ROOT`

- `prompts/alternative-model.md` — your role prompt; read it in full and obey it.
- `contracts/identity-card.schema.yaml`, `contracts/foundational-analysis.schema.yaml`,
  `contracts/foundational-analysis.md`, `contracts/ontoclean-rules.yaml`.
- `cq/competency-questions.yaml` — the CQ suite (cite CQ ids only).
- `work/observations/so-*.yaml`, `work/prose-observations/po-*.yaml` — evidence.
- `work/hypotheses/dh-*.yaml` — the denotation hypotheses. Your BATCH is the set whose slug
  starts with your PREFIX (given in the launch message).
- `work/alternative/` — your OUTPUT directory (empty at start).

## Output contract

For each SURVIVING hypothesis in your batch (`null_hypothesis.rejected: true` with a
discriminator AND `representation_status` of `domain_referent` or `information_artifact`),
emit BOTH records, one pair per hypothesis, keyed by `hypothesis_ref`:

- `work/alternative/ic-<slug>-alt-<nnn>.yaml` with `id: "ic:<slug>-alt:<nnn>"`
- `work/alternative/fa-<slug>-alt-<nnn>.yaml` with `id: "fa:<slug>-alt:<nnn>"`

where `<slug>` and `<nnn>` are the hypothesis's own (hypothesis `dh:ver-failure-signature:001`
yields `ic:ver-failure-signature-alt:001` and `fa:ver-failure-signature-alt:001`). Half a pair
counts as no coverage. Non-survivors get nothing; list them in your final message.

Your categorization comes from the evidence alone. Rivalries and "observationally
equivalent on current evidence" go INSIDE the records (`rival_models`, `needed_evidence`),
never in prose beside them. Cite only `so:`/`po:` ids present under `work/` and CQ ids.
Capture provenance members (`ownerRef*`, `security_resanitization*`, `corpus_*`,
`capture_*`, `generator_*`) are never identity criteria; synthetic records
(`corpus/run3b-synthetic/` paths) may bound a lifecycle and must be called synthetic.

Every YAML file must be valid YAML with exactly the keys the contract schema names (read the
schema exemplars; they are the contract). Write files with the Write tool; do not run shell
commands other than listing files. Final message: prefix, pairs written, survivors covered,
non-survivors skipped (ids), category tally.
