/**
 * Incremental assistant-turn scan state helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsServerId } from "@beep/identity";
import { Fn } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

const $I = $AgentsServerId.create("AssistantTurn/ScanState");

const NonNegativeScanDepth = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeScanDepth", {
    description: "Non-negative integer nesting depth in the incremental assistant-block scanner.",
  })
);

/**
 * **Example** (Assigning initial scan state)
 *
 * ```ts
 * import { initialScanState } from "@beep/agents-server/AssistantTurn"
 * import type { ScanState } from "@beep/agents-server/AssistantTurn"
 *
 * const state: ScanState = initialScanState
 * console.log(state.depth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScanState extends S.Opaque<ScanState, { readonly brand: unique symbol }>()(
  S.Struct({
    current: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.annotateKey({
        description: "Current JSON object slice being accumulated while scanner depth is positive.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(""))
    ),
    depth: NonNegativeScanDepth.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.annotateKey({
        description: "Current non-negative JSON nesting depth inside the blocks array.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(0))
    ),
    escaped: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({
        description: "Whether the previous character was an escape marker inside a JSON string.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    inBlocksArray: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({
        description: "Whether the scanner has entered the top-level blocks array.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    inString: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.annotateKey({
        description: "Whether the scanner is currently inside a JSON string literal.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("ScanState", {
      description: "The carry state of the incremental block extractor between chunks.",
    })
  )
) {
  static readonly encodeResult = S.encodeResult(ScanState);
}

/**
 * **Example** (Building chunk input value)
 *
 * ```ts
 * import { initialScanState, ScanChunkInput } from "@beep/agents-server/AssistantTurn"
 *
 * const input = ScanChunkInput.make({ state: initialScanState, text: '{"blocks":[]}' })
 * console.log(input.text.length)
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export class ScanChunkInput extends S.Opaque<ScanChunkInput, { readonly brand: unique symbol }>()(
  S.Struct({
    state: ScanState.annotateKey({ description: "Scanner carry state before this chunk is folded." }),
    text: S.String.annotateKey({ description: "Next raw structured-output JSON text chunk." }),
  }).pipe(
    $I.annoteSchema("ScanChunkInput", {
      description: "Schema-backed input for one incremental scanner transition.",
    })
  )
) {}

/**
 * **Example** (Building chunk result value)
 *
 * ```ts
 * import { initialScanState, ScanChunkResult } from "@beep/agents-server/AssistantTurn"
 *
 * const result = ScanChunkResult.make({ state: initialScanState, completed: [] })
 * console.log(result.completed.length)
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export class ScanChunkResult extends S.Opaque<ScanChunkResult, { readonly brand: unique symbol }>()(
  S.Struct({
    state: ScanState.annotateKey({ description: "Scanner carry state after this chunk is folded." }),
    completed: S.String.pipe(S.Array, S.mutable).annotateKey({
      description: "Completed assistant-block JSON object slices emitted while folding this chunk.",
    }),
  }).pipe(
    $I.annoteSchema("ScanChunkResult", {
      description: "Schema-backed result for one incremental scanner transition.",
    })
  )
) {}

/**
 * The empty scan state used to begin scanning a fresh structured-output stream.
 *
 * **Example** (Reading empty state flags)
 *
 * ```ts
 * import { initialScanState } from "@beep/agents-server/AssistantTurn"
 *
 * console.log(initialScanState.inBlocksArray) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const initialScanState = ScanState.make({});

const ScanChunkTransition = Fn({
  input: ScanChunkInput,
  output: ScanChunkResult,
}).pipe(
  $I.annoteSchema("ScanChunkTransition", {
    description: "Schema-backed contract for one incremental scanner transition.",
  })
);

const scanChunkResult = ScanChunkTransition.implementSync(({ state, text }) => {
  let { current, depth, escaped, inBlocksArray, inString } = state;
  const completed = A.empty<string>();
  for (const char of text) {
    if (depth > 0) current += char;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    Match.value(char).pipe(
      Match.when(`"`, () => (inString = true)),
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
  }
  return ScanChunkResult.make({
    state: ScanState.make({
      inBlocksArray,
      depth,
      inString,
      escaped,
      current,
    }),
    completed,
  });
});

/**
 * Fold one chunk of structured-output JSON text into the scan state, returning
 * the next state plus any block element slices that completed within the chunk.
 *
 * **Example** (Extracting completed block slices)
 *
 * ```ts
 * import { initialScanState, scanChunk } from "@beep/agents-server/AssistantTurn"
 *
 * const envelope = '{"blocks":[{"type":"paragraph"}]}'
 * const [, completed] = scanChunk(initialScanState, envelope)
 * console.log(completed) // ['{"type":"paragraph"}']
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanChunk: {
  (text: string): (state: ScanState) => [ScanState, Array<string>];
  (state: ScanState, text: string): [ScanState, Array<string>];
} = dual(2, (state: ScanState, text: string): [ScanState, Array<string>] => {
  const result = scanChunkResult({ state, text });
  return [
    ScanState.make({
      inBlocksArray: result.state.inBlocksArray,
      depth: result.state.depth,
      inString: result.state.inString,
      escaped: result.state.escaped,
      current: result.state.current,
    }),
    result.completed,
  ];
});
