# Instance

- id: `r36-cli-commands-a-c-cache-task-selection-pending`
- file:line: `packages/tooling/tool/cli/src/commands/Cache/Cache.census.ts:256`
- symbol: `cacheTaskSelectionArgs`
- members: `cacheValuePending`, `optionalBooleanPending`
- E1: line276 clears optionalBooleanPending before classifying the current token; cache/control match arms set at most one latch.
- E4: lines268-274 consume and return for pending cache values before another latch can be armed.

# Current shape

Both mutable Boolean locals are initialized false at256-257 and coexist for one invocation. Effect.forEach at265-303 runs sequentially by default and aborts on a failed effect. Cache pending clears before validating/consuming one token and always returns. Otherwise optional pending is read for exact true/false consumption and cleared at276 before fallthrough. The --cache arm sets cache pending; the control arm sets optional pending only for exact --force, --remote-only, --remote-cache-read-only. No path sets both. selected is an output string array, skipBoolean is a per-token derived decision, and no other stored Boolean belongs to this latch owner.

# Cardinality gap

Two bits represent4 states; reachable3 are idle(false,false), cache-value(true,false), optional-boolean(false,true). Reach witnesses are invocation start, after --cache, and after --force. Cache-value consumption returns with idle; optional-boolean consumption or fallthrough clears to idle before any new classification. Both-true has no writer path. Errors terminate rather than add a fourth live phase.

# Target schema

Use a private annotated LiteralKit for the two pending obligations, with Option.None as idle. Keep it local to Cache.census.ts; it is parser implementation state, not an exported command or cache policy domain.

```ts
const CacheTaskPendingValue = LiteralKit(["cache-value", "optional-boolean"]).pipe(
  $I.annoteSchema("CacheTaskPendingValue", {
    description: "The next token obligation while replacing Turbo cache controls.",
  })
)
type CacheTaskPendingValue = typeof CacheTaskPendingValue.Type
const CacheTaskPendingState = S.Option(CacheTaskPendingValue).pipe(
  $I.annote("CacheTaskPendingState", {
    description: "Idle or one pending cache-selection token obligation.",
  })
)
type CacheTaskPendingState = typeof CacheTaskPendingState.Type
```

Add LiteralKit to the existing @beep/schema import and $RepoCliId/$I for commands/Cache/Cache.census. Use existing O, S, Match, A, Str and Effect imports. No new file or public barrel export is needed.

Replace both locals with `let pending: CacheTaskPendingState = O.none()`. At each token, snapshot pending to a local prior and immediately reset pending to None. Match prior using O.match and the kit's exhaustive $match: None classifies current token; cache-value validates nonempty and not starting '-' then consumes/returns; optional-boolean consumes only exact lowercase true/false, otherwise classifies the same token. The token classifier remains one local effectful closure containing the existing Match chain: inspection/directory checks first; --cache stores Some(cache-value); existing cache-control predicate stores Some(optional-boolean) only for its three exact optional forms and None for inline/no-cache forms; otherwise append unchanged.

Do not store a separate handled/skip/pending Boolean in the replacement. The match branches return the consume or classify Effect directly. Preserve sequential forEach (make concurrency:1 explicit if desired), errors and short-circuiting. After traversal, fail only when pending is Some(cache-value); Some(optional-boolean) is legal at end. Use O.exists with CacheTaskPendingValue.is["cache-value"] for that final predicate. None is explicit idle, not an undefined sentinel.

# Migration inventory

- Cache.census.ts imports and local declarations: add annotated private literal/Option schema and identity composer; reuse existing modules.
- Lines256-257: replace two mutable latches with one Option state.
- Lines268-278: replace priority/clear/skip control flow with one exhaustive pending-state dispatch; keep token validation and consume/fallthrough order.
- Lines279-300: reuse the classification Match in one local Effect closure; modify only the pending-state writes in --cache and cache-control arms. Keep inspection/directory predicates and selected append unchanged.
- Lines305-306: final missing-cache-value test becomes a cache-value variant test; trailing optional-boolean stays accepted.
- Lines258-264 and307: preserve first separator split and final injected --dry=json/--cache=local: plus exact forwarded suffix.
- Cache/index.ts and cacheTaskSelectionArgs callers: no signature or export changes.
- test/cache-runtime.test.ts: extend the existing native task selection arguments suite rather than create a duplicate parser harness.

# Guard-deletion accounting

- Delete cacheValuePending and optionalBooleanPending independent initialization256-257 and separate writes269,276,289,294.
- Delete priority dependence between cache pending268 and optional pending275: one state match cannot take both obligations.
- Delete skipBoolean275/277 as a carrier of the old latch conjunction; consume directly inside the optional-boolean branch.
- Retain the nonempty/no-leading-dash check270 and the final missing cache value error305; these validate legitimate syntax and are not redundant coherence guards.
- Retain exact optional-Boolean token recognition and cache-control classification; no input acceptance or error boundary is tightened.
- Do not count selector array append, general cache posture predicates or unrelated flags as this instance's guard reduction.

# Encoded-side impact

none (internal). Public input stays ReadonlyArray<string> and output stays the same ordered string array or CacheCommandError with the exact existing message. No CLI grammar, environment, cache wire config, stored data or service changes.

# Test impact

Preserve existing fixtures and add table cases for the following exact semantics:

- run required; empty args or any first token other than exact run gives the existing explicit-invocation error.
- --cache requires a following nonempty token not starting '-'; it accepts arbitrary other strings, including true,false and whitespace. Do not add a cache grammar decoder.
- --cache followed by -- separator or end is missing value; a leading-dash next token errors before inspection classification.
- --force/--remote-only/--remote-cache-read-only consume a following exact true/false only. Any other token falls through the normal classifier in the same iteration. A trailing such flag is accepted.
- Adjacent optional flags, optional followed by --cache, cache followed by an optional-looking token, repeated cache controls, and boolean tokens following an already-consumed Boolean preserve existing behavior.
- Inline --cache=..., --force=..., --remote-only=..., --remote-cache-read-only=... are removed without consuming the following token; --no-cache does not arm optional consumption. Unknown inline values remain removed as today.
- Empty strings after optional flags are forwarded as selector tokens, while empty strings after --cache fail. Case variants True/FALSE are ordinary tokens.
- Inspection/directory controls before -- error with the same message, including --option=value forms. After first --, every byte/token is forwarded unchanged without parsing.
- Independent invocations cannot share pending state. Selection argument order and injected flags remain exact.

A private bounded symbolic enumeration compares original and proposed transition algorithms over a representative token alphabet. This verifies proposal reasoning only. Implementation must run focused cache-runtime tests and @beep/repo-cli package verification; no runtime implementation or quality credit is claimed here.

# Risk & sequencing

Tier1 internal stored parser state. Main risks are accidentally treating all values after optional flags as consumed, rejecting trailing optional flags, validating the forwarded suffix, or validating cache payload grammar beyond the existing leading-dash/empty rule. Keep the same token partition and one sequential classifier. Land independently of other Cache schema/policy designs; duplicate search found no existing inventory member set for these latches. Use no new finite Boolean-domain restrictions on other parser functions.
