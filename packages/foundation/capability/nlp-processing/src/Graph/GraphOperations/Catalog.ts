/**
 * GraphOperations/Catalog - a library of standard NLP graph operations.
 *
 * Ready-to-use {@link GraphOperation}s that the
 * {@link GraphExecutor} can apply to a text graph. The linguistic
 * operations are backed by the pluggable {@link Backend.NLPBackend} (so they
 * require it in their context `R` and fail with {@link Backend.NLPBackendError});
 * the pure string operations are context-free transformations.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - operations are backed by {@link Backend.NLPBackend} (the granular linguistic
 *   contract); the thin facade `NLPService` delegates to the same backend.
 * - node creation is EFFECTFUL (`EffectGraph.makeNode` reads `Clock`/`Random`), so
 *   `apply` uses `Effect.forEach`.
 * - text-utility operations (paragraphize/normalizeWhitespace/
 *   removePunctuation/removeStopWords/stem/ngrams) are NOT backend operations; they
 *   live on the existing Core, driver, and tool layers.
 * - `Object.keys` becomes `Struct.keys`; the cast-based `getOperation(name)` lookup
 *   is dropped (it required `as any`).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A } from "@beep/utils";
import { Effect, Struct } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as Backend from "../../Backend/NLPBackend.ts";
import { makeNode } from "../EffectGraph.ts";
import * as Op from "./Operation.ts";
import type { DependencyNode, EntityNode, LemmaNode, POSNode, RelationNode } from "@beep/nlp/Graph/Schema";

/**
 * Backend-backed operation that splits document text into sentence children.
 *
 * **Details**
 *
 * Each detected sentence becomes a child node of the source leaf. Execution
 * requires {@link Backend.NLPBackend}; backend failures are captured through the
 * operation's typed error channel.
 *
 * **Example** (Log sentencize category)
 *
 * ```ts
 * import { sentencize } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(sentencize.category) // "expansion"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const sentencize: Op.GraphOperation<string, string, Backend.NLPBackend, Backend.NLPBackendError> = Op.make({
  apply: Effect.fn("Catalog.sentencize")(function* (node) {
    const backend = yield* Backend.NLPBackend;
    const sentences = yield* backend.sentencize(node.data);
    return yield* Effect.forEach(sentences, (sentence) => makeNode(sentence, O.some(node.id), O.some("sentencize")));
  }),
  category: "expansion",
  description: "Split text into sentences using sentence boundary detection.",
  name: "sentencize",
});

/**
 * Backend-backed operation that splits text into token children.
 *
 * **Details**
 *
 * Tokenization expands one input leaf into zero or more token payloads while the
 * graph executor handles parent linkage and result caching.
 *
 * **Example** (Log tokenize category)
 *
 * ```ts
 * import { tokenize } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(tokenize.category) // "expansion"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const tokenize: Op.GraphOperation<string, string, Backend.NLPBackend, Backend.NLPBackendError> = Op.make({
  apply: Effect.fn("Catalog.tokenize")(function* (node) {
    const backend = yield* Backend.NLPBackend;
    const tokens = yield* backend.tokenize(node.data);
    return yield* Effect.forEach(tokens, (token) => makeNode(token, O.some(node.id), O.some("tokenize")));
  }),
  category: "expansion",
  description: "Split text into tokens using the backend tokenizer.",
  name: "tokenize",
});

/**
 * Backend-backed operation that emits part-of-speech annotation nodes.
 *
 * **Details**
 *
 * Apply this to token or sentence leaves depending on the backend's contract.
 * The emitted {@link POSNode}s retain token text, tag, position, timestamp, and
 * optional metadata supplied by the backend.
 *
 * **Example** (Log posTag name)
 *
 * ```ts
 * import { posTag } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(posTag.name) // "posTag"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const posTag: Op.GraphOperation<string, POSNode, Backend.NLPBackend, Backend.NLPBackendError> = Op.make({
  apply: Effect.fn("Catalog.posTag")(function* (node) {
    const backend = yield* Backend.NLPBackend;
    const tags = yield* backend.posTag(node.data);
    return yield* Effect.forEach(tags, (tag) => makeNode(tag, O.some(node.id), O.some("posTag")));
  }),
  category: "expansion",
  description: "Tag each token with its part-of-speech label.",
  name: "posTag",
});

/**
 * Backend-backed operation that emits canonical lemma nodes.
 *
 * **Details**
 *
 * Lemma nodes are child annotations of the source text leaf; repeated execution
 * can be cached by operation name and source node id.
 *
 * **Example** (Log lemmatize name)
 *
 * ```ts
 * import { lemmatize } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(lemmatize.name) // "lemmatize"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const lemmatize: Op.GraphOperation<string, LemmaNode, Backend.NLPBackend, Backend.NLPBackendError> = Op.make({
  apply: Effect.fn("Catalog.lemmatize")(function* (node) {
    const backend = yield* Backend.NLPBackend;
    const lemmas = yield* backend.lemmatize(node.data);
    return yield* Effect.forEach(lemmas, (lemma) => makeNode(lemma, O.some(node.id), O.some("lemmatize")));
  }),
  category: "expansion",
  description: "Reduce each token to its canonical lemma.",
  name: "lemmatize",
});

/**
 * Backend-backed operation that emits named-entity annotation nodes.
 *
 * **Details**
 *
 * Entity spans are relative to the source text payload supplied to the backend.
 *
 * **Example** (Log extractEntities name)
 *
 * ```ts
 * import { extractEntities } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(extractEntities.name) // "extractEntities"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const extractEntities: Op.GraphOperation<string, EntityNode, Backend.NLPBackend, Backend.NLPBackendError> =
  Op.make({
    apply: Effect.fn("Catalog.extractEntities")(function* (node) {
      const backend = yield* Backend.NLPBackend;
      const entities = yield* backend.extractEntities(node.data);
      return yield* Effect.forEach(entities, (entity) => makeNode(entity, O.some(node.id), O.some("extractEntities")));
    }),
    category: "expansion",
    description: "Extract named entities from text.",
    name: "extractEntities",
  });

/**
 * Backend-backed operation that emits syntactic dependency arcs for a sentence.
 *
 * **Details**
 *
 * The operation is intended for sentence-like leaves. Feed it token fragments
 * only when the active backend accepts token-local dependency parsing.
 *
 * **Example** (Log parseDependencies name)
 *
 * ```ts
 * import { parseDependencies } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(parseDependencies.name) // "parseDependencies"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const parseDependencies: Op.GraphOperation<string, DependencyNode, Backend.NLPBackend, Backend.NLPBackendError> =
  Op.make({
    apply: Effect.fn("Catalog.parseDependencies")(function* (node) {
      const backend = yield* Backend.NLPBackend;
      const deps = yield* backend.parseDependencies(node.data);
      return yield* Effect.forEach(deps, (dep) => makeNode(dep, O.some(node.id), O.some("parseDependencies")));
    }),
    category: "expansion",
    description: "Parse syntactic dependency arcs within a sentence.",
    name: "parseDependencies",
  });

/**
 * Backend-backed operation that emits semantic relation annotations.
 *
 * **Details**
 *
 * Relation extraction typically assumes entity context is recoverable from the
 * source text or backend model. The graph operation itself only receives one leaf
 * payload and does not inspect sibling entity nodes.
 *
 * **Example** (Log extractRelations name)
 *
 * ```ts
 * import { extractRelations } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(extractRelations.name) // "extractRelations"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const extractRelations: Op.GraphOperation<string, RelationNode, Backend.NLPBackend, Backend.NLPBackendError> =
  Op.make({
    apply: Effect.fn("Catalog.extractRelations")(function* (node) {
      const backend = yield* Backend.NLPBackend;
      const relations = yield* backend.extractRelations(node.data);
      return yield* Effect.forEach(relations, (relation) =>
        makeNode(relation, O.some(node.id), O.some("extractRelations"))
      );
    }),
    category: "expansion",
    description: "Extract semantic relations between entities.",
    name: "extractRelations",
  });

/**
 * Pure transformation that lowercases each source leaf.
 *
 * **Example** (Log toLowerCase category)
 *
 * ```ts
 * import { toLowerCase } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(toLowerCase.category) // "transformation"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const toLowerCase: Op.GraphOperation<string, string> = Op.transform({
  description: "Convert text to lowercase.",
  f: Str.toLowerCase,
  name: "toLowerCase",
});

/**
 * Pure transformation that uppercases each source leaf.
 *
 * **Example** (Log toUpperCase category)
 *
 * ```ts
 * import { toUpperCase } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(toUpperCase.category) // "transformation"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const toUpperCase: Op.GraphOperation<string, string> = Op.transform({
  description: "Convert text to uppercase.",
  f: Str.toUpperCase,
  name: "toUpperCase",
});

/**
 * Pure transformation that trims leading and trailing whitespace.
 *
 * **Example** (Log trim category)
 *
 * ```ts
 * import { trim } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(trim.category) // "transformation"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const trim: Op.GraphOperation<string, string> = Op.transform({
  description: "Remove leading and trailing whitespace.",
  f: Str.trim,
  name: "trim",
});

/**
 * Standard operations keyed by their public catalog names.
 *
 * **Details**
 *
 * Backend-backed entries require `NLPBackend` when executed. Pure string
 * transformations can run with only the graph executor and result store.
 *
 * **Example** (Log tokenize operation name)
 *
 * ```ts
 * import { StandardOperations } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(StandardOperations.tokenize.name) // "tokenize"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const StandardOperations = {
  extractEntities,
  extractRelations,
  lemmatize,
  parseDependencies,
  posTag,
  sentencize,
  toLowerCase,
  toUpperCase,
  tokenize,
  trim,
} as const;

/**
 * List the stable operation names exposed by {@link StandardOperations}.
 *
 * **Example** (Check tokenize name listed)
 *
 * ```ts
 * import { getOperationNames } from "@beep/nlp-processing/Graph/GraphOperations/Catalog"
 *
 * console.log(getOperationNames().includes("tokenize")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const getOperationNames = (): ReadonlyArray<string> => A.fromIterable(Struct.keys(StandardOperations));
