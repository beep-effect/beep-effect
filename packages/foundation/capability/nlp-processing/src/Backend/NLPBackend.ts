/**
 * Pluggable NLP backend interface.
 *
 * Defines the abstract contract every NLP backend (wink-nlp, CoreNLP, spaCy, an
 * LLM adapter, ...) implements so the capability can swap engines while keeping a
 * stable API. Backends form a category: objects are backends, morphisms are
 * adapters/wrappers, and composition enables fallback strategies.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * `Data.TaggedError` becomes `S.TaggedError` from `effect/Schema`, scoped by a
 * `$NlpProcessingId` composer, `Context.GenericTag` becomes the
 * `Context.Service` class form used across this package, and `Object.keys`
 * becomes `Struct.keys`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Context, Inspectable, pipe, Struct } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as GraphSchema from "@beep/nlp/Graph/Schema";
import type * as Effect from "effect/Effect";

const $I = $NlpProcessingId.create("Backend/NLPBackend");

const renderCause = (cause: unknown): string => Inspectable.toStringUnknown(cause);

type BackendNotSupportedOptions = {
  readonly message?: string | undefined;
};

type BackendOperationErrorOptions = {
  readonly cause: unknown;
};

const isBackendNotSupportedDataFirst = (args: IArguments): boolean => args.length >= 3 || P.isString(args[1]);

const isBackendOperationErrorDataFirst = (args: IArguments): boolean => args.length >= 3;

/**
 * Failure raised when a backend does not support a requested operation.
 *
 * **Example** (Create unsupported backend error)
 *
 * ```ts
 * import { BackendNotSupported } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = BackendNotSupported.make({
 *   backend: "minimal",
 *   operation: "parseDependencies",
 *   message: "Dependency parsing is unavailable"
 * })
 * console.log(error._tag) // "BackendNotSupported"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BackendNotSupported extends S.TaggedError<BackendNotSupported>($I`BackendNotSupported`)(
  "BackendNotSupported",
  {
    backend: S.String,
    message: S.String,
    operation: S.String,
  },
  $I.annote("BackendNotSupported", {
    description: "Failure raised when an NLP backend does not support a requested operation.",
  })
) {
  static readonly forOperation: {
    (backend: string, operation: string, options?: BackendNotSupportedOptions): BackendNotSupported;
    (operation: string, options?: BackendNotSupportedOptions): (backend: string) => BackendNotSupported;
  } = dual(
    isBackendNotSupportedDataFirst,
    (backend: string, operation: string, options?: BackendNotSupportedOptions): BackendNotSupported =>
      BackendNotSupported.make({
        backend,
        operation,
        message: options?.message ?? `Backend ${backend} does not support ${operation}`,
      })
  );
}

/**
 * Failure raised when a backend fails to initialize.
 *
 * **Example** (Create backend init error)
 *
 * ```ts
 * import { BackendInitError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = BackendInitError.make({
 *   backend: "wink-nlp",
 *   cause: new Error("model load failed"),
 *   message: "Backend wink-nlp failed to initialize"
 * })
 * console.log(error.backend) // "wink-nlp"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BackendInitError extends S.TaggedError<BackendInitError>($I`BackendInitError`)(
  "BackendInitError",
  {
    backend: S.String,
    cause: S.Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annote("BackendInitError", {
    description: "Failure raised when an NLP backend fails to initialize.",
  })
) {
  static readonly fromCause: {
    (backend: string, cause: unknown): BackendInitError;
    (cause: unknown): (backend: string) => BackendInitError;
  } = dual(
    2,
    (backend: string, cause: unknown): BackendInitError =>
      BackendInitError.make({
        backend,
        cause,
        message: `Backend ${backend} failed to initialize: ${renderCause(cause)}`,
      })
  );
}

/**
 * Failure raised when a backend operation fails at runtime.
 *
 * **Example** (Create operation failure error)
 *
 * ```ts
 * import { BackendOperationError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = BackendOperationError.make({
 *   backend: "wink-nlp",
 *   operation: "posTag",
 *   cause: new Error("tokenizer failed"),
 *   message: "Backend wink-nlp operation posTag failed"
 * })
 * console.log(error.operation) // "posTag"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BackendOperationError extends S.TaggedError<BackendOperationError>($I`BackendOperationError`)(
  "BackendOperationError",
  {
    backend: S.String,
    cause: S.Defect({ includeStack: true }),
    message: S.String,
    operation: S.String,
  },
  $I.annote("BackendOperationError", {
    description: "Failure raised when an NLP backend operation fails at runtime.",
  })
) {
  static readonly fromCause: {
    (backend: string, operation: string, options: BackendOperationErrorOptions): BackendOperationError;
    (operation: string, options: BackendOperationErrorOptions): (backend: string) => BackendOperationError;
  } = dual(
    isBackendOperationErrorDataFirst,
    (backend: string, operation: string, options: BackendOperationErrorOptions): BackendOperationError => {
      const cause = options.cause;

      return BackendOperationError.make({
        backend,
        cause,
        message: `Backend ${backend} operation ${operation} failed: ${renderCause(cause)}`,
        operation,
      });
    }
  );
}

/**
 * Tagged schema union for every recoverable backend failure.
 *
 * **Example** (Check union membership)
 *
 * ```ts
 * import { notSupported, NLPBackendError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = notSupported("minimal", "ner")
 * console.log(NLPBackendError.is(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const NLPBackendError = S.Union([BackendNotSupported, BackendInitError, BackendOperationError]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("NLPBackendError", {
    description: "A backend failure.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type represented by the {@link NLPBackendError} schema.
 *
 * **Example** (Access error tag type)
 *
 * ```ts
 * import type { NLPBackendError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const tag = (error: NLPBackendError) => error._tag
 * console.log(tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NLPBackendError = typeof NLPBackendError.Type;

/**
 * Capability bitmap that describes which operations a backend can perform.
 *
 * **Example** (Declare capability bitmap)
 *
 * ```ts
 * import type { BackendCapabilities } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const capabilities: BackendCapabilities = {
 *   constituencyParsing: false,
 *   coreferenceResolution: false,
 *   dependencyParsing: false,
 *   lemmatization: true,
 *   ner: true,
 *   posTagging: true,
 *   relationExtraction: false,
 *   sentencization: true,
 *   tokenization: true
 * }
 * console.log(capabilities.tokenization) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BackendCapabilities extends S.Class<BackendCapabilities>($I`BackendCapabilities`)(
  {
    /** Constituency parsing (phrase structure). */
    constituencyParsing: S.Boolean.annotateKey({
      description: "Constituency parsing (phrase structure).",
    }),
    /** Coreference resolution (entity mention linking). */
    coreferenceResolution: S.Boolean.annotateKey({
      description: "Coreference resolution (entity mention linking).",
    }),
    /** Dependency parsing (syntactic structure). */
    dependencyParsing: S.Boolean.annotateKey({
      description: "Dependency parsing (syntactic structure).",
    }),
    /** Lemmatization (morphological normalization). */
    lemmatization: S.Boolean.annotateKey({
      description: "Lemmatization (morphological normalization).",
    }),
    /** Named entity recognition (PERSON, ORG, LOC, ...). */
    ner: S.Boolean.annotateKey({
      description: "Named entity recognition (PERSON, ORG, LOC, ...).",
    }),
    /** Part-of-speech tagging. */
    posTagging: S.Boolean.annotateKey({
      description: "Part-of-speech tagging.",
    }),
    /** Semantic relation extraction. */
    relationExtraction: S.Boolean.annotateKey({
      description: "Semantic relation extraction.",
    }),
    /** Sentence boundary detection. */
    sentencization: S.Boolean.annotateKey({
      description: "Sentence boundary detection.",
    }),
    /** Basic tokenization (word segmentation). */
    tokenization: S.Boolean.annotateKey({
      description: "Basic tokenization (word segmentation).",
    }),
  },
  $I.annote("BackendCapabilities", {
    description: "Capabilities of an NLP backend service.",
  })
) {}

/**
 * Structural shape of the {@link NLPBackend} service.
 *
 * **Details**
 *
 * Operations a backend does not support should fail with
 * {@link BackendNotSupported}. The annotation operations are functors over text:
 * `posTag`/`lemmatize` preserve token structure, `extractEntities`/
 * `extractRelations` surface semantic spans.
 *
 * **Example** (Implement minimal backend shape)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * console.log(backend.name) // "minimal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface NLPBackendShape {
  /** Capabilities this backend supports. */
  readonly capabilities: BackendCapabilities;
  /** Extract named entities (functor `Text -> [Entity]`). */
  readonly extractEntities: (text: string) => Effect.Effect<ReadonlyArray<GraphSchema.EntityNode>, NLPBackendError>;
  /** Extract semantic relations between entities. */
  readonly extractRelations: (text: string) => Effect.Effect<ReadonlyArray<GraphSchema.RelationNode>, NLPBackendError>;
  /** Lemmatize tokens to canonical forms (forgetful functor `[Token] -> [Lemma]`). */
  readonly lemmatize: (text: string) => Effect.Effect<ReadonlyArray<GraphSchema.LemmaNode>, NLPBackendError>;
  /** Backend name (e.g. `"wink-nlp"`, `"stanford-corenlp"`, `"spacy"`). */
  readonly name: string;
  /** Parse syntactic dependencies (functor `Sentence -> Graph<Token, Dependency>`). */
  readonly parseDependencies: (
    sentence: string
  ) => Effect.Effect<ReadonlyArray<GraphSchema.DependencyNode>, NLPBackendError>;
  /** Tag tokens with part-of-speech labels (functor `[Token] -> [POSNode]`). */
  readonly posTag: (text: string) => Effect.Effect<ReadonlyArray<GraphSchema.POSNode>, NLPBackendError>;
  /** Split text into sentences (free functor `Text -> [Sentence]`). */
  readonly sentencize: (text: string) => Effect.Effect<ReadonlyArray<string>, NLPBackendError>;
  /** Split text into tokens (free functor `Text -> [Token]`). */
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>, NLPBackendError>;
}

/**
 * Service tag for the pluggable {@link NLPBackendShape} backend.
 *
 * **Example** (Read service tag key)
 *
 * ```ts
 * import { NLPBackend } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * console.log(NLPBackend.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class NLPBackend extends Context.Service<NLPBackend, NLPBackendShape>()($I`NLPBackend`) {}

/**
 * Check whether a backend advertises support for a single capability.
 *
 * **Example** (Check single capability support)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { supportsCapability } from "@beep/nlp-processing/Backend/NLPBackend"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * console.log(supportsCapability(backend, "tokenization")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const supportsCapability: {
  (backend: NLPBackendShape, capability: keyof BackendCapabilities): boolean;
  (capability: keyof BackendCapabilities): (backend: NLPBackendShape) => boolean;
} = dual(
  2,
  (backend: NLPBackendShape, capability: keyof BackendCapabilities): boolean => backend.capabilities[capability]
);

/**
 * List supported capability keys in schema order.
 *
 * **Example** (List supported capability keys)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getSupportedCapabilities } from "@beep/nlp-processing/Backend/NLPBackend"
 * import type { NLPBackendShape } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const backend: NLPBackendShape = {
 *   name: "minimal",
 *   capabilities: {
 *     constituencyParsing: false,
 *     coreferenceResolution: false,
 *     dependencyParsing: false,
 *     lemmatization: false,
 *     ner: false,
 *     posTagging: false,
 *     relationExtraction: false,
 *     sentencization: true,
 *     tokenization: true
 *   },
 *   tokenize: (text) => Effect.succeed(text.split(" ")),
 *   sentencize: (text) => Effect.succeed([text]),
 *   posTag: () => Effect.succeed([]),
 *   lemmatize: () => Effect.succeed([]),
 *   extractEntities: () => Effect.succeed([]),
 *   parseDependencies: () => Effect.succeed([]),
 *   extractRelations: () => Effect.succeed([])
 * }
 * console.log(getSupportedCapabilities(backend)) // ["tokenization"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const getSupportedCapabilities = (backend: NLPBackendShape): ReadonlyArray<keyof BackendCapabilities> =>
  pipe(
    Struct.keys(backend.capabilities),
    A.filter((cap) => backend.capabilities[cap])
  );

/**
 * Construct a {@link BackendNotSupported} failure with a default message.
 *
 * **Details**
 *
 * The overriding message travels in an options object — as it does on
 * {@link BackendNotSupported.forOperation} — so the backend name can be applied
 * last from a `pipe` without the two strings becoming ambiguous.
 *
 * **Example** (Build not-supported failure)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { notSupported } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = notSupported("minimal", "dependencyParsing")
 * const custom = pipe("minimal", notSupported("dependencyParsing", { message: "No parser bundled" }))
 *
 * console.log(error.message.includes("dependencyParsing")) // true
 * console.log(custom.message) // "No parser bundled"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const notSupported: {
  (backend: string, operation: string, options?: BackendNotSupportedOptions): BackendNotSupported;
  (operation: string, options?: BackendNotSupportedOptions): (backend: string) => BackendNotSupported;
} = dual(
  isBackendNotSupportedDataFirst,
  (backend: string, operation: string, options?: BackendNotSupportedOptions): BackendNotSupported =>
    BackendNotSupported.forOperation(backend, operation, options)
);

/**
 * Construct a {@link BackendInitError} from an unknown initialization cause.
 *
 * **Example** (Build init error from cause)
 *
 * ```ts
 * import { initError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = initError("wink-nlp", new Error("missing model"))
 * console.log(error.backend) // "wink-nlp"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const initError: typeof BackendInitError.fromCause = BackendInitError.fromCause;

/**
 * Construct a {@link BackendOperationError} for a failed backend operation.
 *
 * **Example** (Build operation error from cause)
 *
 * ```ts
 * import { operationError } from "@beep/nlp-processing/Backend/NLPBackend"
 *
 * const error = operationError("wink-nlp", "tokenize", new Error("bad input"))
 * console.log(error.operation) // "tokenize"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const operationError: {
  (backend: string, operation: string, cause: unknown): BackendOperationError;
  (operation: string, cause: unknown): (backend: string) => BackendOperationError;
} = dual(
  3,
  (backend: string, operation: string, cause: unknown): BackendOperationError =>
    BackendOperationError.fromCause(backend, operation, { cause })
);
