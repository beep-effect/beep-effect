## 1. Instance

- id: `scan-state-json-lexer-flags`
- file:line: `packages/agents/server/src/AssistantTurn/ScanState.ts:48`
- symbol: `ScanState`
- members: `escaped`, `inBlocksArray`, `inString`
- evidence classes:
  - E4 at `packages/agents/server/src/AssistantTurn/ScanState.ts:145` — escaped is only set true inside if (inString) (line 147); leaving the string (inString=false) happens only in the else of if (escaped), so escaped=>inString. inBlocksArray is a one-way latch on the first [.

## 2. Current shape

Live schema declaration at `packages/agents/server/src/AssistantTurn/ScanState.ts:40`:

```ts
export class ScanState extends S.Class<ScanState>($I`ScanState`)(
  {
    current: S.String.pipe(SchemaUtils.withKeyDefaults("")).annotateKey({
      description: "Current JSON object slice being accumulated while scanner depth is positive.",
    }),
    depth: NonNegativeScanDepth.pipe(SchemaUtils.withKeyDefaults(0)).annotateKey({
      description: "Current non-negative JSON nesting depth inside the blocks array.",
    }),
    escaped: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether the previous character was an escape marker inside a JSON string.",
    }),
    inBlocksArray: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether the scanner has entered the top-level blocks array.",
    }),
    inString: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)).annotateKey({
      description: "Whether the scanner is currently inside a JSON string literal.",
    }),
  },
  $I.annote("ScanState", {
    description: "The carry state of the incremental block extractor between chunks.",
  })
) {}
```

The coherence-sensitive branch at `packages/agents/server/src/AssistantTurn/ScanState.ts:145` is:

```ts
if (inString) {
  if (escaped) escaped = false;
  else if (char === "\\") escaped = true;
  else if (char === '"') inString = false;
  continue;
}
```

## 3. Cardinality gap

The three booleans represent eight combinations. Six are legal because the independent `inBlocksArray` latch combines with three JSON string phases:

- `outside` × before/inside blocks array.
- `in-string` × before/inside blocks array.
- `escaped` × before/inside blocks array.

The two illegal combinations are `escaped && !inString`, one for each latch value. `inBlocksArray` is not part of the exclusivity defect and remains a boolean latch.

## 4. Target schema

Add `LiteralKit` to the existing `@beep/schema` import. Name the new kit and type `ScanStringPhase`; replace only `escaped` and `inString`, retaining `inBlocksArray`:

```ts
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";

export const ScanStringPhase = LiteralKit(["outside", "in-string", "escaped"]).pipe(
  $I.annoteSchema("ScanStringPhase", {
    description: "Exclusive JSON string and escape phase of the incremental block scanner.",
  })
);

export type ScanStringPhase = typeof ScanStringPhase.Type;

export class ScanState extends S.Class<ScanState>($I`ScanState`)(
  {
    current: S.String.pipe(SchemaUtils.withKeyDefaults("")),
    depth: NonNegativeScanDepth.pipe(SchemaUtils.withKeyDefaults(0)),
    inBlocksArray: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    stringPhase: ScanStringPhase.pipe(
      SchemaUtils.withKeyDefaults(ScanStringPhase.Enum.outside)
    ),
  },
  $I.annote("ScanState", {
    description: "The carry state of the incremental block extractor between chunks.",
  })
) {}
```

Retain the existing field annotations in the applied code. Fold characters exhaustively by the literal phase, keeping the blocks-array latch logic in the `outside` arm:

```ts
let { current, depth, inBlocksArray, stringPhase } = state;

for (const char of text) {
  if (depth > 0) current += char;
  ScanStringPhase.$match(stringPhase, {
    escaped: () => {
      stringPhase = ScanStringPhase.Enum["in-string"];
    },
    "in-string": () => {
      if (char === "\\") stringPhase = ScanStringPhase.Enum.escaped;
      else if (char === '"') stringPhase = ScanStringPhase.Enum.outside;
    },
    outside: () => {
      Match.value(char).pipe(
        Match.when(`"`, () => (stringPhase = ScanStringPhase.Enum["in-string"])),
        Match.when("[", () => {
          if (!inBlocksArray) {
            inBlocksArray = true;
          } else if (depth > 0) {
            depth++;
          }
        }),
        Match.when("{", () => {
          if (inBlocksArray) {
            if (depth === 0) {
              current = "{";
            }
            depth++;
          }
        }),
        Match.whenOr("}", "]", () => {
          if (depth > 0) {
            depth--;
            if (depth === 0) {
              completed.push(current);
              current = "";
            }
          }
        }),
        Match.orElse(() => {})
      );
    },
  });
}
```

Construct `ScanState` with `stringPhase` and return `result.state` directly from `scanChunk` rather than rebuilding a plain object field by field.

## 5. Migration inventory

- `packages/agents/server/src/AssistantTurn/ScanState.ts:48` — replace `escaped` with `stringPhase: ScanStringPhase`; retain `inBlocksArray` and remove `inString` at line 54.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:118` — update the “state flags” example prose to the phase/latch model; the line-123 `inBlocksArray` example remains valid.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:141` — destructure `stringPhase` instead of `escaped` and `inString`.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:145` — replace the nested boolean chain with exhaustive `ScanStringPhase.$match` arms.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:152` — entering a quote writes `ScanStringPhase.Enum["in-string"]`.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:154` and `:161` — keep both `inBlocksArray` latch reads unchanged; this flag is independent.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:181` — construct the next state with `stringPhase` instead of the two booleans.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:220` — return `result.state` directly; delete the plain-object reads of `inString` and `escaped` at lines 223-224 while preserving all state fields through the class value.
- `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:202` — no field migration; it passes `initialScanState` and `scanChunk` opaquely through `Stream.mapAccum`.
- `packages/agents/server/src/test.ts:27` — no field migration; the exported test seed aliases `initialScanState` opaquely.
- `packages/agents/server/test/AssistantTurn.schema-parity.test.ts:28` — replace encoded `escaped`/`inString` fixtures with `stringPhase: "outside"` in both expected states.
- `packages/agents/server/test/scanChunk.test.ts:15` — no field migration; the property test carries `ScanState` opaquely.

No other live source or test reads or writes these members.

## 6. Guard-deletion accounting

- `packages/agents/server/src/AssistantTurn/ScanState.ts:145` — delete `if (inString) { if (escaped) ... else if ... }`, the nested coherence chain that assumes `escaped => inString`; exhaustive phase matching makes the illegal combination unrepresentable.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:148` — delete the coupled write that clears `inString` while relying on `escaped` already being false.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:220` — delete the manual five-field normalizing copy, including separate `inString`/`escaped` reads, by returning the already-schema-constructed state.
- `packages/agents/server/src/AssistantTurn/ScanState.ts:209` — update the comment-only description from brace/string/escape booleans to the explicit phase machine.

The `if (!inBlocksArray)` check at line 154 and `if (inBlocksArray)` check at line 161 are intentionally not deleted: they govern the independent one-way latch and were not the cardinality defect. There is no legacy input normalizer or mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

The campaign inventory classifies `ScanState` as internal. Its schema encoding does change from `{ escaped, inString }` to `{ stringPhase }`, and `packages/agents/server/test/AssistantTurn.schema-parity.test.ts:28` deliberately snapshots that internal encoded form; update that fixture in the same landing. No persisted or wire consumer was found.

## 8. Test impact

- `packages/agents/server/test/AssistantTurn.schema-parity.test.ts:28` — update both exact encoded/state shapes and keep `ScanState` in the schema-derived arbitrary round-trip list at line 68.
- `packages/agents/server/test/scanChunk.test.ts:37` — retain the envelope/chunking property test unchanged; its nasty strings and single-character chunking are the behavioral proof that the phase rewrite preserves escape handling.
- Add direct transition cases spanning chunk boundaries after a backslash and after a closing quote, asserting `ScanStringPhase` values rather than boolean pairs.

## 9. Risk & sequencing

This is the only batch item in `packages/agents/server` and has the highest behavioral risk because it touches the incremental lexer loop. Land the schema, scanner transition, exact-shape fixture, and phase-boundary tests atomically. The public `ScanState` export means compile-time consumers see a field rename even though runtime use outside the module is opaque; repository-wide search found no such field consumer.
