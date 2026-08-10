# Verification-Round Charter (post-Wave-C)

Three read-only Sol-medium lenses. All read `review-context.md` and
`inventory-round1.md` (including all three fixer reports) first.

## Lens V1 — fix verification

Re-verify every round-1 finding against the current tree: is each fix real,
both-sides, tested, and free of regressions? Confirm the rulings were applied
as written (not the overridden reviewer suggestions). Report per-item
`verified` / `incomplete` / `regressed` with evidence.

## Lenses V2 (pg) and V3 (sqlite) — SQL-invariant exhaustiveness audit

Operator directive: ensure BSL's SQL invariants are TRULY EXHAUSTIVE per
dialect. Method — enumerate, from installed drizzle source AND live probes
against the real database (pglite / bun:sqlite), the rules the database itself
enforces or silently mangles. For each rule, classify BSL's posture:

- `validated` — BSL rejects/handles it (type+runtime, tested);
- `deferred-loudly` — documented boundary (README/Gotchas/graduation agenda);
- `SILENT-GAP` — BSL accepts input the database rejects, or the database
  silently alters what BSL promised → this is a finding.

Candidate areas to probe (not conclusions — probe them and more):

- identifier length limits (PG truncates >63 bytes SILENTLY — table, column,
  constraint, index, enum-type names; our generated names like
  `<table>_<field>_<target>` aliases and check names can exceed it);
- snake_case physical-name collisions: two model fields whose snake_case forms
  coincide (`userId` + `user_id`) — silent duplicate column?
- enum label length limits (PG NAMEDATALEN) and empty-string labels;
- varchar/char length bounds (PG max 10485760); numeric precision/scale legal
  ranges per dialect; negative/zero lengths at type level vs runtime;
- default-value validity vs column type at the DDL level (typed default_ is
  carrier-checked — but is the SQL literal rendering safe for all carriers:
  strings with quotes, Infinity/NaN for real columns, bigint rendering?);
- composite PK/unique on nullable columns; duplicate columns within one
  composite constraint; empty extras arrays;
- FK referential-action constraints (SET NULL onto NOT NULL source — pg
  rejects at ALTER or at action time? sqlite behavior?);
- sqlite specifics: WITHOUT ROWID interactions, AUTOINCREMENT requires
  INTEGER PRIMARY KEY exactly, CHECK expression restrictions beyond
  parameters, type-affinity surprises for numeric/blob modes;
- generated-column expression restrictions per dialect (immutability
  requirements, references to other generated columns);
- model-level: zero-field models, models with only generated fields,
  identifier-safe field keys (keys with quotes/backslashes reaching DDL).

Evidence bar: a SILENT-GAP finding needs a live reproduction (accepted by BSL,
rejected/mangled by the database) exactly like round 1's findings. Respect the
deferred-boundaries list in review-context.md and the residual-risk notes in
the fixer reports — those are documented postures, not gaps, unless the
documentation itself is wrong. Findings use the round-1 format with lens
prefix `v2-pg-` / `v3-sqlite-`.

## Wave D (post-verification, operator-directed): type-level name invariants

Operator direction: enforce string/name/title invariants at the type level
across the naming surfaces — `columnName(...)`, `enum(name)`, table-extra
names (`index`/`compositeUnique`/`compositePrimaryKey`/`check`), model
identifiers, and kit config — in the spirit of `@beep/identity`'s composer
validation (the TECHNIQUE ports; the package cannot depend on `@beep/*`).

Design constraints:

- Cheap structural checks live at the type level: non-emptiness,
  `Lowercase<S> extends S` casing, no-whitespace, no-leading/trailing
  underscore — template-literal patterns with BOUNDED instantiation cost.
- Expensive checks stay runtime with the same policy (byte-length limits like
  PG's 63-byte identifier bound, full charset validation): both-sides law
  holds — the runtime side is always complete; the type side is the cheap
  prefix of it.
- NO recursive character-walking type validation — that is an instantiation
  bomb; the perf fixture (`test/perf.consumer.ts` + extendedDiagnostics)
  gates the wave: instantiation growth must stay proportionate.
- Error carriers use the existing `~effect-drizzle.error` literal-message
  pattern so callsite diagnostics stay readable.
- Scope is informed by V2/V3 findings: every confirmed name-related
  SILENT-GAP gets its invariant here; speculative invariants the databases
  don't care about are NOT added.
- Mechanism (operator): **`Exclude` over unions** — express invariants by
  SUBTRACTION, not by enumerating allowed shapes. Pattern:
  `[S] extends [Exclude<S, Violation1 | Violation2>]` where each `ViolationN`
  is a template-literal pattern describing a violation (e.g.
  `` `${string} ${string}` `` for embedded whitespace). Subtraction chains
  compose per-invariant, distribute correctly over literal-union inputs
  (isolating exactly the invalid members), and avoid constructing positive
  allowed-shape unions that inflate the instantiation graph. The existing
  `ValidateEncoded` (`[Exclude<EncodedOf<I>, null>] extends [Allowed]`) is the
  in-house precedent.
- Seed sketch (operator draft, Fable-reviewed): keep the operator's
  wide-string guard (`string extends T ? unknown`) and first-char rule
  (`T extends \`${infer F}${string}\`` with `F extends "_" | "a".."z"` — also
  rejects `""`); add `Lowercase<T> extends T` (intrinsic — catches uppercase
  at ANY position without recursion); add the subtractive violation union
  (`[T] extends [Exclude<T, NameViolation>]` over whitespace/quote/dash/dot
  templates); failures return `BslTypeError<Msg>` carriers, never `never`
  (opaque diagnostics). Byte-length (PG NAMEDATALEN 63 BYTES — not chars;
  multibyte makes char-counting wrong) is runtime-only, completing the
  both-sides contract. The fixer wires per-surface message literals.
- REFINED seed (operator cost-pass + Fable, supersedes the sketch above where
  they differ): split Msg OUT of the expensive core — `IsValidSqlName<T>`
  (message-free, cached per unique name literal) with per-surface
  `ValidateSqlName<T, Msg>` as an O(1) shell. Drop the Exclude wrapper: naked
  `T extends NameViolation` distribution collapses mixed unions to `boolean`,
  which fails `extends true` — conservative union rejection for free (only
  loss: the error cannot name the offending member; acceptable for
  single-literal parameters). Intrinsic `Lowercase<T> extends T` runs FIRST
  (near-free short-circuit); starter check fuses the char union into the
  template slot (`` `${LowerStart}${string}` ``, no infer). NameViolation
  members are per-check costs — the set earns entries from V2/V3-confirmed
  bites only. FOLLOW-ON CANDIDATE (perf-fixture-gated): apply the same
  Msg-out-of-cache-key split to `ValidateEncoded<I, Allowed, Msg>` so its
  Exclude core is shared across all combinator surfaces.
