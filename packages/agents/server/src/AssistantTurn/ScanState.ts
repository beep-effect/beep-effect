/**
 * Incremental assistant-turn scan state helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsServerId } from "@beep/identity";
import { Fn, SchemaUtils } from "@beep/schema";
import { isNonNegative } from "@beep/schema/Number";
import { Match } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $AgentsServerId.create("AssistantTurn/ScanState");

const NonNegativeScanDepth = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("NonNegativeScanDepth", {
    description: "Non-negative integer nesting depth in the incremental assistant-block scanner.",
  })
);

/**
 * The carry state of the incremental block extractor between chunks.
 *
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
) {
  static readonly encodeResult = S.encodeResult(ScanState);
}

/**
 * Schema-backed input for one incremental scanner transition.
 *
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
export class ScanChunkInput extends S.Class<ScanChunkInput>($I`ScanChunkInput`)(
  {
    state: ScanState.annotateKey({ description: "Scanner carry state before this chunk is folded." }),
    text: S.String.annotateKey({ description: "Next raw structured-output JSON text chunk." }),
  },
  $I.annote("ScanChunkInput", {
    description: "Schema-backed input for one incremental scanner transition.",
  })
) {}

/**
 * Schema-backed result for one incremental scanner transition.
 *
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
export class ScanChunkResult extends S.Class<ScanChunkResult>($I`ScanChunkResult`)(
  {
    state: ScanState.annotateKey({ description: "Scanner carry state after this chunk is folded." }),
    completed: S.String.pipe(S.Array, S.mutable).annotateKey({
      description: "Completed assistant-block JSON object slices emitted while folding this chunk.",
    }),
  },
  $I.annote("ScanChunkResult", {
    description: "Schema-backed result for one incremental scanner transition.",
  })
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
export const initialScanState = ScanState.make();

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
// scanChunk is a byte-for-byte port of the POC's incremental JSON block scanner.
// Its branching is the brace/string/escape state machine itself and is locked
// down by a fast-check property test (test/scanChunk.test.ts); extracting helpers
// would scatter the single-pass state without reducing real complexity.
// fallow-ignore-next-line complexity -- single-pass brace and string scanner is a POC port guarded by property tests
export const scanChunk: {
  (text: string): (state: ScanState) => [ScanState, Array<string>];
  (state: ScanState, text: string): [ScanState, Array<string>];
} = dual(2, (state: ScanState, text: string): [ScanState, Array<string>] => {
  const result = scanChunkResult({ state, text });
  return [
    {
      inBlocksArray: result.state.inBlocksArray,
      depth: result.state.depth,
      inString: result.state.inString,
      escaped: result.state.escaped,
      current: result.state.current,
    },
    result.completed,
  ];
});
