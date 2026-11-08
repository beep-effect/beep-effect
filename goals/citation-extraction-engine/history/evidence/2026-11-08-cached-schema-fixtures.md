# Reuse Effect parser caches in original replay fixtures

Hosted Heavy / Lint Policy reported no-inline-schema-compile in citation replay
fixtures owned by PR #2927. The repository-wide lint:oxlint command reproduced
17 sites in twelve files, including the new builtin dump profile decoder.
Package-scoped lint/types had passed but did not cover this root rule.

Each schema expression is unchanged and now has one module-level binding. Its
compiler call retains the same decode direction and input. The original schemas,
source captures, expected values, assertions, cleanup checks and timeout limits
are unchanged. Only allocation of the schema AST moves out of the function body,
allowing Effect's existing parser cache to work. No rule suppression or new cache
implementation is added. Repository-wide lint:oxlint and server lint/types pass.

A syntax comparison parses old and new TypeScript, removes only the added module
bindings and substitutes their unchanged initializers back into the same compiler
calls. All twelve expanded syntax trees are identical after excluding source
locations/comments. This establishes that no input, assertion or algorithm changed.
The affected finite replay run passes 26 of 27 tests. The Node page-correction
replay returns CitationSafetyLimitExceeded from the existing captured deadline;
its Bun counterpart passes. This is retained as an unresolved timing/safety
observation, not explained away as contention or repaired by raising a limit.
The separate Node-only replay passes the same test at unchanged limits. This does
not establish the cause or eliminate the broader timing/safety obligation. Existing full proof
receipts remain historical evidence; the source-reference refresh is justified by
unchanged expanded syntax plus the recorded reruns, not a claim that every original
workflow was rerun on this head.
This change promotes no further original assertion, source capability, law or
fidelity question. Totals remain 158 complete canonical events, zero nonterminal
bindings and 15,340 rows without completion proof. Hosted exact-head acceptance
remains separate; exhaustive source/donor, retained protocols, identity allocation,
production attestation, safety/scaling and lifecycle work remain open.
