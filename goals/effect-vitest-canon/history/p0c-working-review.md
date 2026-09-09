# P0c working-snapshot review

Observed during implementation, before lane handoff. Re-check every item against
the finished code; intermediate code is expected to change. This is gate review,
not a substitute for the mandatory Grok adversarial rounds.

## Items requiring proof at handoff

1. The current import collector registers namespace imports but misses the
   dominant root named imports such as { Effect, Layer } from effect. Test named,
   namespace and renamed imports without trusting shadowed locals.
2. EV001 and EV007 currently require an effect/live callback. Their primary
   migration cases are runners or fc.assert inside plain it/test callbacks.
3. EV006 currently examines the expect call's own arguments and can miss
   expect(value).toEqual(O.some(...)); matcher arguments are part of the assertion.
4. EV003 currently visits getFunctions only. Most resource wrappers are const
   arrows or Effect.fn generator declarations. Include complete definitions.
5. EV015 currently tests whether the nearest harness is layer, which misses a
   TestClock.adjust inside an inner it.effect. Track both test and enclosing block.
6. EV010 currently flags every import declaration containing FileSystem, including
   the generic Effect FileSystem service. That would flag the canonical replacement
   itself. Only actual platform/raw filesystem candidates belong to this rule.
7. EV013 currently searches call member names. The contract requires hand-rolled
   retry/attempt loops, so loop syntax needs positive and negative proof.
8. The Finding ruleId schema currently only accepts EV identifiers, although the
   shared ledger must also decode L-RES and other lens rules. Exception reason and
   ordered line bounds also need schema-level validation, not a later convention.
9. The current EffectVitestTiming is a scan receipt, not the requested package
   timing shape in SPEC section 5.4. Keep the two meanings separate.
10. Scope omitted mjs/cjs and excluded all build/dist directories by name; reconcile
    exact paths against P0a and do not silently exclude source fixtures. The same
    glob/extension contract must drive both discovery and kind classification.
11. New exported symbols currently have one-line JSDoc with no titled examples.
    Full package docgen is required; placeholders do not satisfy the rubric.
12. The current source uses new Error, native Object.entries, raw JSON-ish models,
    hardcoded Layer spellings, and several apparent Effect helper/API mismatches.
    The lane's required lint and check should expose these before handoff.
13. Inventory key uses an absolute source offset. Verify unrelated edits do not
    turn unchanged occurrences into new instances or drop reasoned exceptions;
    same-line distinct occurrences must still remain distinguishable.
14. The existing diffMembership API returns introduced/resolved and requires order;
    current scan code expects added and omits order. Compile and behavior proof
    must exercise the actual shared helper, not a duplicate ratchet algorithm.
15. Store paths currently derive from process.cwd; validate invocation from a
    package cwd or resolve the repository root through existing repo-utils.

Do not preemptively mark any item resolved. The completed source, exact fixtures
and command behavior must supply the evidence.

## Initial fixture review

- EV009's negative fixture uses it.live merely to call Effect.log. D7 explicitly
  forbids live conversion for logging, and D5 permits plain assertions in effect
  tests. A test name mentioning Console does not establish a live-console need.
- The common fixture import places TestClock in the effect root, although the
  pinned API uses effect/testing/TestClock. Validate fixture examples against the
  tag so nonexistent API forms cannot make predicates appear correct.
- The initial fixture list has one pair per rule but lacks plain-test runner and
  property cases, matcher-argument Option assertions, alias/shadowing, arrow
  wrapper definitions, and actual retry loops. A green 31-test run alone will not
  meet the supplied behavior contract.
- Verify intentional short scopes as judgment rows separately from mechanical
  EV004 output. A negative fixture must not force the implementation to silently
  discard a required Resource judgment candidate.

A targeted search of the existing internal/tsmorph and Lint helper modules did
not find an existing lexical import/shadowing resolver to reuse. The new syntax
helper is justified, but it must remain independent of the type checker.
