# Anti-Patterns to Avoid

- **Syntax-to-T-Box shortcut**: parser output flowing into class lists. The
  observation schema structurally cannot carry an ontology interpretation —
  keep it that way.
- **Null-hypothesis theater**: filling `null_hypothesis.rejected: true` with
  boilerplate. The `discriminator` field exists precisely because rationales
  can be theater: it must state a fact that would be FALSE if the null were
  true. Division of labor is explicit: the VALIDATOR enforces form (non-blank,
  non-trivial length, denylisted boilerplate phrases, distinct from the
  rationale); the ADVERSARY owns falsity-if-null substance — its review must
  cover the `null_discriminator` surface, and a discriminator no seat
  attacked is an unreviewed one. "Insufficient evidence" must be a real
  outcome with real frequency.
- **Adversary self-repair**: the falsifier improving the proposal it attacks.
  Attack and repair are different seats.
- **Consensus ratification**: three agreeing models treated as acceptance.
  Correlated agreement is one data point; the steward decides.
- **Confidence laundering**: `confidence.value` influencing acceptance. It is
  triage metadata only (`use_for_acceptance: false` is load-bearing).
- The full failure-mode table lives in `../_shared/foundational-analysis.md`
  (relative to this skill's directory) —
  run it as a checklist during the adversarial pass.
