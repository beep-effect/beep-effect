# Law-test ledger

One row per law-catalogue row of `2026-11-08-rebuild-report.md` section 6 (`L<layer>-<n>`). Every row ends `green` with a test file and a test whose title starts with the row id, or `deleted` with its reason. P0 fills `package` and `test file`; each layer phase moves its rows to `green`. `kind`: `law` rows need a property test over production schemas (`standards/architecture/08-testing.md`); `profile` and `acceptance` rows take the test form named here.

| Id | Layer | Kind | Statement | Package (today, then target) | Test file | Test | Status | Reason if deleted |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `L0-1` | L0 | law | expand ∘ contract = id on registered terms | `@beep/identity` | planned in P0 | planned | planned | |
| `L0-2` | L0 | law | `a ≡ b ⇒ hash(canon a) = hash(canon b)` for records | `@beep/identity` | planned in P0 | planned | planned | |
| `L0-3` | L0 | law | published term set changes only with a deprecation record (snapshot, including module-derived IRIs) | `@beep/identity` | planned in P0 | planned | planned | |
| `L1-1` | L1 | law | `slice(text, position) = quote` | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L1-2` | L1 | law | unit conversion is a bijection on valid boundaries; split surrogates fail closed | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L1-3` | L1 | law | reanchoring is lax-functorial, exact on `Exact`, natural on `Exact` (tested with NFKC and de-hyphenation) | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L1-4` | L1 | law | `OccurrenceId` distinct across repeated boilerplate; stable under serialization | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L1-5` | L1 | law | `resolve` returns `Ambiguous` for repeated passages | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L1-6` | L1 | acceptance | a receipt cannot become a `VerifiedTextAnchor` without re-verification | `@beep/provenance` -> `@beep/text` | planned in P0 | planned | planned | |
| `L2-1` | L2 | law | merge over one text capture is idempotent, commutative, associative on content, and attribution unions | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L2-2` | L2 | law | annotation hash is invariant under target permutation | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L2-3` | L2 | law | every annotation has non-empty attribution; each (annotation, activity) is one generation | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L2-4` | L2 | law | referential integrity survives merge and restriction | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L2-5` | L2 | law | containment is a strict order with a kind tie-break on equal spans | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L2-6` | L2 | law | OA/NIF codec round-trips both ways on the RDF quotient and preserves `resolve` | `@beep/nlp` -> `@beep/annotation` | planned in P0 | planned | planned | |
| `L3-1` | L3 | profile | `skos:broader` acyclic in repo-owned schemes; imported cycles recorded | `@beep/ontology` | planned in P0 | planned | planned | |
| `L3-2` | L3 | law | mapping sets coherent and consistent | `@beep/ontology` | planned in P0 | planned | planned | |
| `L3-3` | L3 | law | audit sound on the typed subset, silent on untyped | `@beep/ontology` | planned in P0 | planned | planned | |
| `L3-4` | L3 | law | a pinned edition is immutable | `@beep/ontology` | planned in P0 | planned | planned | |
| `L4-1` | L4 | law | log prefix-monotone; `R(t)` stable after `t`; knowledge intervals disjoint per key | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-2` | L4 | law | admission requires non-empty grounding that verifies now | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-3` | L4 | law | support and derivation acyclic; challenges may cycle | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-4` | L4 | law | retraction closure over derivation | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-5` | L4 | law | `a ≡ b ⇔ key(a) = key(b)` on generated pairs | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-6` | L4 | law | refusal is a no-op; independent coordinates commute; gates monotone | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L4-7` | L4 | acceptance | `Absent{reason}` never coerces to a number | `@beep/epistemics` | planned in P0 | planned | planned | |
| `L5-1` | L5 | law | Kleisli identity and associativity for fixed `(E, R)` under a declared observation | `@beep/nlp` -> `@beep/nlp-processing` | planned in P0 | planned | planned | |
| `L5-2` | L5 | law | only `Pure` is central | `@beep/nlp` -> `@beep/nlp-processing` | planned in P0 | planned | planned | |
| `L5-3` | L5 | law | `generated` never earlier than `used`; every output attributed | `@beep/nlp` -> `@beep/nlp-processing` | planned in P0 | planned | planned | |
| `L6-1` | L6 | law | dataset equality up to blank-node isomorphism; digest on canonical form | `@beep/rdf` | planned in P0 | planned | planned | |
| `L6-2` | L6 | law | projection deterministic; kept fields satisfy GetPut and PutGet | `@beep/rdf` | planned in P0 | planned | planned | |
