# Provider repair measurement and structural projection decision

The goal remains active. Neither the provider repair nor the structural plan
review described here establishes usefulness acceptance.

## Measured result and retention

The unchanged legacy evaluation at implementation commit
`aee7071a8c5f9f9417993df2a5fce3a3fff71df5`, result
`product-clauses-provider-001`, measured **39/538 strict matches**, 537 parsed
claims and 460 abstentions. Its results SHA-256 is
`e80d37428470bbc1f7fbe4e1d0c747ceaf61db3fb8b3b2b8eae5bd55f7f80938`.
The runtime closure digest is
`fe8f3297c624ce6f179533f4656433dab9f37ba502a7376dab92deb26d6fe92e`.

This candidate fails retention: it preserves 36 of the accepted 43 matches,
including only 30 of the original 37. The seven lost identities are
`12360911-root-1:9`, `15958729-root-1:4`, `13070851-root-1:3`,
`13822885-root-1:9`, and `12749812-root-1:3`, `:5`, `:10`.
Three new matches, `14659462-root-1:4`, `:6` and `13070851-root-1:2`, are tracked
separately so that a subsequent repair cannot silently trade them away.
The protected 43 manifest is unchanged.

The accepted best remains `product-owner-integrated-003`: **43/538 strict**,
537 parsed, 453 abstentions, results SHA-256
`59015d87da6b14de7c7ba04a432deba035e415baea9c6d15de83c13f1963f7bb`.
All prior results, including the original 0/538 result, remain historical
evidence. No reference labels, source fixtures, selection identities, scoring
rules or usefulness thresholds were changed.

## Operational repair proved separately

The observational 60-family run constructed exactly one real tokenization
engine, recorded zero initialization failures and scored every family. A
separate official run produced byte-identical results and all 120 corresponding
service/prediction files. The historical 39-family control recorded 39 engine
initialization attempts: 21 successes and 18 typed out-of-memory failures.
The repair changes provider lifetime, without increasing memory settings,
budgets, concurrency, model assets or retry counts. Dependable execution does
not establish grammatical accuracy or performance acceptance.

## Structural diagnosis and implementation decision

An independent reproduction checked per-claim node and edge scorer parity for
both the accepted and latest results. The latest result's disjoint first
blockers are: 246 element span/count failures, 35 kind failures after spans
match, 155 term-payload failures after node identities match, 62 edge-only
failures, one missing tree and 39 strict matches. These are diagnostic counts,
not promised recoveries. The 460 abstentions also require substantive source
role and route-work repairs; correct topology alone cannot establish coverage.

The existing enhanced projection still obtains its element boundaries and
parents from legacy segmentation. The next integrated implementation must
instead project validated source frames into actual element spans, kinds,
parents, owned terms and functional partitions. Adding unused frame schemas
or changing terms within the old boundaries does not complete this work.

Targeted independent plan review 002 closed three required decisions with zero
remaining required findings: deterministic production and separator rules;
core/head/outer nominal projection; and immutable per-source admission/fallback
before dependency-route resolution. It checked 27 authored expected-plan
fixtures and seven registry controls for consistency. These checks did not
execute the proposed grammar or certify retention. The sealed amendment SHA-256
is `a4637e83a1bc1a86cb6b48b4aff04927a0d6a49672449d43f6d5677fa6de8f46`.

Implementation was authorized on clean commit
`3868d109a213e5e9627616b495c810339e825bfe`, which includes accepted main commit
`6b0a8332b2173cd4ba8b5c80aac044998aed61f0`. Current and ancestor construction
must reuse one fixed source tree. Different source claims may have different
admission modes; rejected candidate roles must never mix with legacy nodes of
that same source. Route uncertainty stays adverse. Existing public input
ordering, strict APIs, tree wire shape, resource limits and runtime exclusions
remain binding.

Concrete source review, focused integration proof, a fresh runtime capture and
the unchanged 538-claim evaluation remain required. The fresh comparison must
report every protected identity, the separately tracked gains and all coverage
and substantive finding changes. The independent new cohort and natural alert,
defect and control truth requirements remain incomplete; attorney attendance is
not a prerequisite for continuing the work.
