/**
 * Service: Ontology Registry
 *
 * **Details**
 *
 * Loads and queries the ontology registry (registry.json) from storage.
 * Enables multi-ontology deployments where requests can specify their own ontology.
 *
 * The registry provides:
 * - Ontology metadata (IRI, version, paths)
 * - Resolution of ontology URIs to storage paths
 * - Validation that required files exist
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OntologyRegistry } from "../Domain/Schema/OntologyRegistry.ts";
import { OntologyRegistryJson } from "../Domain/Schema/OntologyRegistry.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyRegistry");
const OntologyIdentifierType = LiteralKit(["id", "iri"]).pipe(
  $I.annoteSchema("OntologyIdentifierType", {
    description: "Registry fields that can identify an ontology lookup target.",
  })
);

/**
 * Error types for registry operations
 *
 * **Example** (Inspect registry not found error)
 *
 * ```ts
 * import { RegistryNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * const error = RegistryNotFoundError.make({ path: "ontologies/registry.json" })
 * console.log(error._tag) // "RegistryNotFoundError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryNotFoundError extends S.TaggedError<RegistryNotFoundError>($I`RegistryNotFoundError`)(
  "RegistryNotFoundError",
  {
    path: S.String.annotateKey({
      description: "Storage path that could not be resolved.",
    }),
  },
  $I.annote("RegistryNotFoundError", {
    description: "Failure raised when the configured ontology registry cannot be loaded from storage.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Provides the registry parse error service capability.
 *
 * **Example** (Construct a parse error)
 *
 * ```ts
 * import { RegistryParseError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * const error = RegistryParseError.make({
 *   path: "ontologies/registry.json",
 *   cause: new Error("Unexpected token")
 * })
 * console.log(error._tag) // "RegistryParseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryParseError extends S.TaggedError<RegistryParseError>($I`RegistryParseError`)(
  "RegistryParseError",
  {
    path: S.String.annotateKey({
      description: "Storage path containing the invalid registry document.",
    }),
    cause: S.Defect({ includeStack: true }).annotateKey({
      description: "Underlying schema failure retained for diagnostics.",
    }),
  },
  $I.annote("RegistryParseError", {
    description: "Failure raised when the stored ontology registry cannot be decoded.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Provides the ontology not found error service capability.
 *
 * **Example** (Construct a not-found error)
 *
 * ```ts
 * import { OntologyNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * const error = OntologyNotFoundError.make({
 *   identifier: "core",
 *   type: "id"
 * })
 * console.log(error._tag) // "OntologyNotFoundError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyNotFoundError extends S.TaggedError<OntologyNotFoundError>($I`OntologyNotFoundError`)(
  "OntologyNotFoundError",
  {
    identifier: S.String.annotateKey({
      description: "Ontology identifier or IRI that could not be resolved.",
    }),
    type: OntologyIdentifierType.annotateKey({
      description: "Registry field used for the failed lookup.",
    }),
  },
  $I.annote("OntologyNotFoundError", {
    description: "Failure raised when an ontology is absent from the configured registry.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Describes the registry error data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RegistryError = RegistryNotFoundError | RegistryParseError | OntologyNotFoundError;

/**
 * Default path to registry.json in storage
 */
const DEFAULT_REGISTRY_PATH = "registry.json";

/**
 * OntologyRegistryService - Load and query the ontology registry
 *
 * **Details**
 *
 * Provides methods to:
 * - Load registry from storage
 * - Look up ontologies by ID or IRI
 * - Resolve ontology URIs to storage paths
 *
 * **Example** (Look up an ontology by id)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { OntologyRegistryService } from "@effect-ontology/Service/OntologyRegistry"
 *
 * const program = Effect.gen(function* () {
 *   const registry = yield* OntologyRegistryService
 *   return yield* registry.getById("core")
 * }).pipe(Effect.provide(OntologyRegistryService.Default))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class OntologyRegistryService extends Context.Service<OntologyRegistryService>()($I`OntologyRegistryService`, {
  make: Effect.gen(function* () {
    const storage = yield* StorageService;
    const config = yield* ConfigService;

    // Registry path from config or default
    const registryPath = O.getOrElse(config.ontology.registryPath, () => DEFAULT_REGISTRY_PATH);

    // Cache the loaded registry
    let cachedRegistry = O.none<OntologyRegistry>();

    /**
     * Load the registry from storage
     */
    const loadRegistry = Effect.gen(function* () {
      if (O.isSome(cachedRegistry)) {
        return cachedRegistry.value;
      }

      yield* Effect.logInfo("Loading ontology registry", { path: registryPath });

      const contentOpt = yield* storage
        .getOption(registryPath)
        .pipe(Effect.mapError(() => RegistryNotFoundError.make({ path: registryPath })));

      if (O.isNone(contentOpt)) {
        return yield* RegistryNotFoundError.make({ path: registryPath });
      }

      const registry = yield* OntologyRegistryJson.decodeEffect(contentOpt.value).pipe(
        Effect.mapError((cause) => RegistryParseError.make({ path: registryPath, cause }))
      );

      yield* Effect.logInfo("Ontology registry loaded", {
        version: registry.version,
        ontologyCount: registry.ontologies.length,
        ontologies: A.map(registry.ontologies, (ontology) => ontology.id),
      });

      cachedRegistry = O.some(registry);
      return registry;
    });

    /**
     * Get ontology entry by short ID (e.g., "seattle")
     */
    const getById = Effect.fn("OntologyRegistry.getById")(function* (id: string) {
      const registry = yield* loadRegistry;
      return A.findFirst(registry.ontologies, (ontology) => ontology.id === id);
    });

    /**
     * Get ontology entry by IRI (e.g., "https://effect-ontology.dev/seattle")
     */
    const getByIri = Effect.fn("OntologyRegistry.getByIri")(function* (iri: string) {
      const registry = yield* loadRegistry;
      return A.findFirst(registry.ontologies, (ontology) => ontology.iri === iri);
    });

    /**
     * Resolve an ontology URI to its storage path
     *
     * Accepts:
     * - Full IRI: "https://effect-ontology.dev/seattle" -> looks up in registry
     * - Short ID: "seattle" -> looks up in registry
     * - Direct path: "canonical/seattle/ontology.ttl" -> returns as-is
     * - GCS URI: "gs://bucket/path" -> strips prefix, returns path
     */
    const resolveToPath = Effect.fn("OntologyRegistry.resolveToPath")(function* (uri: string) {
      if (Str.startsWith("gs://")(uri)) {
        return Str.replace(/^gs:\/\/[^/]+\//, "")(uri);
      }
      if (Str.includes("/")(uri) || Str.endsWith(".ttl")(uri) || Str.endsWith(".owl")(uri)) {
        return uri;
      }
      if (Str.startsWith("http")(uri)) {
        const entry = yield* getByIri(uri);
        if (O.isSome(entry)) {
          return entry.value.storagePath;
        }
        return yield* OntologyNotFoundError.make({ identifier: uri, type: "iri" });
      }
      const entry = yield* getById(uri);
      if (O.isSome(entry)) {
        return entry.value.storagePath;
      }
      return yield* OntologyNotFoundError.make({ identifier: uri, type: "id" });
    });

    /**
     * Resolve an ontology URI to its full entry (if in registry)
     */
    const resolveToEntry = Effect.fn("OntologyRegistry.resolveToEntry")(function* (uri: string) {
      if (Str.startsWith("http")(uri)) {
        return yield* getByIri(uri);
      }
      if (!Str.includes("/")(uri)) {
        return yield* getById(uri);
      }
      const registry = yield* loadRegistry;
      return A.findFirst(registry.ontologies, (ontology) => ontology.storagePath === uri);
    });

    /**
     * List all available ontologies
     */
    const list = Effect.gen(function* () {
      const registry = yield* loadRegistry;
      return registry.ontologies;
    });

    /**
     * Clear the cached registry (for testing or forced refresh)
     */
    const clearCache = Effect.sync(() => {
      cachedRegistry = O.none();
    });

    return {
      loadRegistry,
      getById,
      getByIri,
      resolveToPath,
      resolveToEntry,
      list,
      clearCache,
    };
  }).pipe(Effect.withSpan("OntologyRegistryService.make")),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      // StorageService provided by parent scope (runtime-selected storage type)
    ])
  );
}
