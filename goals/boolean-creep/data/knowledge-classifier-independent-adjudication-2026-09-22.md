# Independent bounded adjudication: KnowledgeRefClassificationInput

Exact source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Scope: the public classifier input's supported grammar-flag contract. This is an
independent reading of the earlier hold, not campaign P3 approval, a census round,
a proposed implementation, or a qualification verdict. No canonical files changed.

## Conclusion

**Inconclusive: retain the contract hold.** The binding documents establish what
reference observations mean and how the census constructs them. They do not
establish whether the separately exported raw classifier deliberately supports
kind-mismatched or simultaneous grammar flags as normalization inputs.

There is stronger evidence for coherent reference semantics than for independent
flags. In particular, the current input's own documentation says pairingAmbiguous
is for goal URIs only and ungoverned is for repository paths only. This is actual
public-surface documentation, not merely a fact inferred from private producers.
Nevertheless, it does not explicitly specify an input-validity precondition,
rejection behavior, or whether the total cascade intentionally accepts incoherent
facts from other callers. The classifier's neighboring promise of an ordered,
total cascade is consistent with either a total function over semantic inputs or
a raw precedence policy. Neither reading alone resolves that discrepancy.

The existing D1 justification cannot be restored as proved: independence has not
been established. Conversely, replacing the public product with a coherent-only
union now would decide the missing public acceptance policy by implementation.
No aggregate legal cardinality is established by this audit.

## Binding evidence examined

1. `goals/knowledge-surface-automation/SPEC.md:98-102` describes the read-only
   census, tracked reference resolution and split-brain identity risk. It does
   not specify the raw classifier API or mixed flag acceptance.
2. Ratified `research/p2-grill-decisions.md:164-175` defines goal identity
   pairing: at most one ref per line, ambiguity a hard failure. It gives no
   contract for applying pairing flags to a host/repository/upstream input.
3. `research/p1-refs-tree-design.md:28-43` defines a three-member observation
   reference union, with upstream reserved. Lines155-173 define per-bus
   extraction and goal-only pairing ambiguity; lines186-191 define repository
   root escape as ungoverned syntax. Lines206-223 say the rule table is total
   over kind/anchor/surface/resolution, then list semantic triggers. This table
   never names the raw two-Boolean product, a combined-true input, or its
   precedence policy. Its fixture matrix286-309 likewise uses coherent cases.
4. Ratified `research/p1-t2-mini-grill-decisions.md:22-24` preserves the
   upstream domain without a census member class. It does not authorize
   deleting the public classifier's upstream branch/fallback behavior.
5. Current `Knowledge.refs.ts:1842-1864` documents kind-specific flag meaning
   but declares the full product. Lines1904-1920 describe ordered total
   classification, syntax precedence, and intended not-applicable reachability.
   Lines1960-1987 implement precedence without kind validation. The examples
   are coherent. This is the central ambiguity, not evidence of an agreed
   normalization or rejection contract.
6. Exhaustive scoped Graft symbol search found the production call2958-2967
   and direct tests747-784. Production projects RefCandidate fields. The two
   syntax tests use only goal/ambiguous and repo/ungoverned inputs, both with
   not-applicable resolution. Their title 'outrank every resolution outcome'
   is broader than their assertions and proves neither all resolution cases
   nor combined/wrong-kind acceptance.
7. Private producers2512-2535,2622-2651,2668-2692 are coherent and establish
   the private owner's invariants. They are useful corroboration of semantic
   meanings but cannot establish all legitimate inputs to the public function.

No discovered document expressly promises that both flags may be true, nor
expressly declares the public raw input outside contract when the flags mismatch
kind. A lexical scan of the original knowledge packet's research documents did
not locate a later raw-classifier ruling. This is bounded evidence discovery,
not proof that no external decision exists.

## Exact policy question that resolves this owner

For the exported `classifyKnowledgeRef(input)`, is `KnowledgeRefClassificationInput`
a supported raw precedence API whose accepted inputs include **every pairing of
kind and the two grammar flags**, including both true (pairing ambiguity wins),
or is the public input required to obey the semantic invariants
`pairingAmbiguous => kind === "goal-uri"` and
`ungoverned => kind === "repo-path"`, making combined/wrong-kind flags outside
its supported contract?

An authoritative answer should explicitly choose the acceptance contract; the
runtime's present return value and private producer reachability cannot stand in
for that answer. A supported raw-product answer permits a corrected D1/raw-policy
record after documenting the exact domain. A coherent-only answer supplies the
missing premise for qualification and a schema-first design. A third policy
(partial normalization or rejection) must state its actual accepted combinations
before cardinality and compatibility can be proved.

## Preserve these independent contracts under either answer

- patternContext remains independent; it can accompany semantic syntax states.
- Host anchor None still yields actionable-host-path before pattern/archival
  classification. Host token None still supplies the empty string. Do not turn
  the coherent flag ruling into an unrelated both-present host invariant.
- All five resolution statuses remain accepted by the current public input;
  host classification ignores them, grammar rules outrank them, and nonhost
  unflagged not-applicable still maps to ambiguous-ref-pairing.
- Reserved upstream remains in the declared kind domain. No producer does not
  mean no supported public input.
- Public raw input is not the report encoding. Any future migration must prove
  supported classification and report/CLI output compatibility separately.

If coherent flags are ratified, kind × flag-pair would have16 representable /
6 allowed projections under that rule (host1, repo2, goal2, upstream1), and
independent patternContext doubles both. This is a conditional calculation,
**not an adjudicated legal cardinality**, and says nothing about narrowing
anchor/token/resolution payloads. If the raw product is supported, the paired
flags are independent policy inputs even though output selection has precedence.

## Verification and limitations

Read-only source, public examples, tests and original contract review. No new
runtime probe was needed: successful execution cannot answer this semantic
policy question. The previous 1280-case probe's totality is not used as a
legitimacy proof. No tests, builds, package verification, mutation, or external
publication performed. This audit neither passes GATE2 nor supplies independent
review credit for other designs.

## SHA-256 input bindings

- `goals/boolean-creep/data/knowledge-classifier-hold-2026-09-22.md`: `22b361878f412fa0650b52a457462cce6c90256c4f3c62113fafafcb096f1321`
- `goals/boolean-creep/data/knowledge-classifier-contract-addendum-2026-09-22.md`: `c5df9a06f56e44493434998971287e46eabd2e018bb010c8c435f2d215eff847`
- `goals/knowledge-surface-automation/SPEC.md`: `6acbefd972e2628c152cfbb43189143377f1d07f8470dfeb44087f726728e265`
- `goals/knowledge-surface-automation/research/p2-grill-decisions.md`: `a399c231a679033e689e3e815df448e58adb46554e7953b386fb0f036eeb7d10`
- `goals/knowledge-surface-automation/research/p1-refs-tree-design.md`: `82372837cf2b9def0ca8a61b9e39d7e8a963cb3e8cdbd780926af9a21088b35e`
- `goals/knowledge-surface-automation/research/p1-t2-mini-grill-decisions.md`: `24e21d708bc5cbe0804c605f21bfb2cf794f460d1f92ad0b4cb25ed31521e3fb`
- `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts`: `d5e890c27397f55dd21d003a13426430b65360ec76d572565e71787a03292aa8`
- `packages/tooling/tool/cli/test/knowledge-refs.test.ts`: `94cf4a86180258f8c938d9a50eb55640ec039c799d2ab6e640d6f6f893298ecb`

Graft saved42,084tokens (1call) in this bounded adjudication.

## Subsequent owner ruling

Benjamin answered **Require kind-specific grammar flags** after this bounded
adjudication. See `../DECISIONS.md` for the recorded ruling. The inconclusive
analysis above is retained as evidence of why the question was necessary;
it no longer represents an unanswered contract question. Qualification and
design reconciliation remain required.
