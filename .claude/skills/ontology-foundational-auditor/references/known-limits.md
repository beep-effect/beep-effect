# Known Limits (honest boundary — read before trusting a green gate)

The validator binds records to records, reviews to byte-closures, facts to
spans, and ratifications to the bytes the steward saw; it cannot bind any of
it to MINDS or to deleted history. What a green gate does NOT prove:

- **Seat independence is self-attested.** `independent_context: true`,
  `blinded: true`, and `first_run: true` are booleans the operator writes; no
  script can prove two invocations shared no context or that a run is truly
  the first. Process discipline + the manifest record are the mechanism.
  The seat command copies only a seat's allowed inputs into a fresh
  directory, but an agent sandbox that can read the disk can still reach
  the primary records by absolute path.
- **Steward identity is a string, and a batch utterance can be scribed as N
  named sentences.** The validator forces per-proposal named verbatims,
  distinct wording, one decision per proposal, and byte-fresh
  `proposal_sha256` — but "accept all of these" templated into per-proposal
  sentences for an invented steward id passes every one of those checks.
  The RATIFICATION SUMMARY printout + structural protection in the TARGET
  repo (write-protected `governance/`, CODEOWNERS named-reviewer
  verification, agent read-only permissions) are the real control; set them
  up when the stakes warrant.
- **Review history is only as durable as the files.** A PASS on ever-FAILed
  bytes, a round gap, and a post-FAIL PASS without a revision_log all fail —
  but an in-place OVERWRITE of the only review file erases the FAIL from the
  scan. Append-only review discipline is a convention; version control
  history is the mechanical control for it.
- **Judgment substance is the adversary's.** Falsity-if-null, listing-CQ
  detection (a real CQ in the file that merely mentions a word still
  warrants, mechanically), and identity-criterion adequacy are
  attacked-by-mandate but their QUALITY is model judgment; the validator
  rejects known boilerplate shapes only.
- **Occurrence is necessary, not sufficient.** Token-bounded, comment-
  stripped occurrence kills substring shadows, comment mentions, and
  JSDoc-as-literal; it cannot stop an adapter that declares a WIDE span
  (whole file) so that another declaration's tokens occur "in span", nor a
  token that occurs inside a string literal, nor prove parsing over
  pattern-matching. Golden fixture + one human spot-check per new adapter is
  the residual control.
- **Canonical ids prove content-consistency, not authorship.** The validator
  recomputes every SO/PO id from the record's own content and joins each
  extractor tuple to a pinned manifest adapter — but any author who runs the
  formula produces a matching id; nothing proves the ADAPTER SCRIPT executed
  and emitted the record rather than an agent hand-building it. Golden
  fixture + spot-check again.
- **Retirement truthfulness is steward judgment.** A prior-unresolved row
  re-dispositioned `irrelevant`, and every carried retirement, is FLAGGED
  into gate output with its reason — the validator surfaces the transition;
  whether the retirement is truthful is the steward's call.
- **Waiver substance is free once the meter is met.** `pin_waived`,
  `empty_corpus_reason`, and `unresolved_fraction_waiver` require substantive
  reasons and are FLAGGED into gate output — the validator surfaces them for
  the steward; it cannot judge them. Scope of the dirty pin waiver, exactly:
  consumed bytes come from the WORKTREE (byte-pinning to HEAD blobs is off),
  while object-type authentication stays live — a stage mode claiming file
  over a HEAD tree object still dies on the waived route; a path with no
  HEAD object at all has nothing to authenticate and rides the waiver.
- **Revision substance is adversary judgment.** The gate proves a revised
  proposal's bytes changed and that its revision_log names every landed
  attack rule of every FAIL — it cannot prove the new bytes actually ANSWER
  those attacks. The re-review is the control: the adversary re-attacks the
  revised bytes, and a dishonest re-review is the disclosed scribe/seat
  residual, not a mechanical one.
- **`reuse.searched: true` attests execution.** The validator requires the
  boolean and, for reuse proposals, mappings with substantive compatibility —
  it cannot prove the scout search actually ran. The scout report in the
  synthesis inputs is the process control.
- **Prose quotes are verbatim modulo whitespace.** The exact accepted
  normalization is defined in the ProseObservation contract: edge whitespace
  is trimmed from the quote, interior runs collapse to one space; nothing
  looser passes, nothing stricter is enforced.
- **Carried authority is content-bound, not execution-bound.** Reviews and
  analyses are content-addressed: after an engine/prompt/contract change the
  MANIFEST stales and must re-lock, but an unchanged artifact whose closure
  still verifies carries forward WITHOUT re-running its seat. A green gate
  proves the carried review described these exact bytes; it does not prove
  the current manifest's engine, prompts, or models produced it. Where
  current-run execution provenance matters, re-review deliberately.
- **Model identity in the manifest is a claim.** Commands pass `-m "$MODEL"`
  and the manifest records it; the ENGINE (validator + schema contracts) is
  digest-locked into the manifest, but nothing cryptographically binds the
  model string to the weights that ran.

Engine note: a deterministic `ontology-review` engine (parsers, drift diff,
profile/SHACL/closure validation, gold benchmark, mutation suite, structural
ratification) is the designed executable substrate that would close these —
specified in the deep-research report "A Reusable Foundational-Ontology
Adversary for Software Repositories" (2026-08-28). Until it exists, this
skill runs with the committed adapter scripts + validator described in
`SKILL.md`.
