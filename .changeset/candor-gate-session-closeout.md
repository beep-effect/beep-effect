---
{}
---

No release: close out the candor-gate session by giving its chat-only and
un-owned outputs a durable home, and correct three claims that were wrong.

Nothing here changes behaviour. The candor gate shipped in #575 and #589; what was
still loose afterwards was knowledge — three reflection TODOs nobody had codified,
five follow-ons no packet owned, and a set of yeet-operator receipts whose ledger
had closed underneath them.

Two laws land where they are enforced. `EF-22b` states that a `Result` is not an
`Effect` and must be lifted with `Effect.fromResult`; the reflection recorded this
as a runtime-only trap, which is wrong — it is a compile error, just an opaque
`TS2769` overload wall in the `it.effect(name, Effect.fnUntraced(function* () {}))`
shape, which is why it read as runtime-only. The JSDoc pattern law gains the `Fn`
requirement-channel rule (the `R` travels from the `output: EffectSchema<A, E, R>()`
schema, so an example provides its requirements or composes without running) and
the `docgen:local` mechanic: it does not silently escalate when `bun.lock` moves,
it refuses with `full docgen proof required`, which is why a dependency-adding
branch loses the bounded edit loop entirely.

The yeet receipts open a ledger on `coding-agent-effectiveness-evidence-loop`, the
active packet whose SPEC already names `Verdict.ts`, `ProofState.ts`, `Handler.ts`,
`Status.ts`, and `yeet doctor`. `speed-loop`'s ledger closed on 2026-08-08 and its
own closeout routes new incidents to the active packet, so these cite its retained
ids rather than extending them. Three carry corrections. The 3-lane green
`verdict.json` is not the design property #76 describes — the writer already
flattens the composite's sub-lanes, and a 512 KiB head-retaining capture bound
discards the payload line, which is printed last on a run long enough to exceed it.
#78's hosted-only list is wrong in both directions: `Lint Policy` is covered
locally and is in fact a superset, `Property Laws` is `required: false`, and
`Commitlint` plus `dependency-review` are missing. Neither ratchet fails on a
tightening, though refreshing a baseline is still a separate invocation.

The #78 correction leaves a real open question rather than closing one: PR #575
lived a local 21/21 green followed by hosted `Lint Policy` red, which the source
says cannot happen. The receipt records both observations, names the untested
hypotheses, and marks resolution as a prerequisite for the parity footer.

The candor packet gains an audited unowned-follow-ons section. Two items were
already normative in its SPEC and are listed for routing; three existed only in the
reflection — the missing ST.13 conversion whose named owner turns out not to exist
as a packet, the unindexed jsonb filter, and the absent crypto test layer, where
the audit found the identity stub rather than the real Web-Crypto layer is what has
repeated enough to earn promotion.
