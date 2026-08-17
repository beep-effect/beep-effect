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
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { OntologyRegistry } from "../Domain/Schema/OntologyRegistry.ts";
import { OntologyRegistryJson } from "../Domain/Schema/OntologyRegistry.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyRegistry");

/**
 * Error types for registry operations
 *
 * **Example** (Inspect registry not found error)
 *
 * ```ts
 * import { RegistryNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * console.log(RegistryNotFoundError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryNotFoundError {
  /**
   * Stable discriminator for registry lookup failures.
   *
   * **Example** (Use the _tag field)
   *
   * ```ts
   * import type { RegistryNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type RegistryNotFoundError_tag = RegistryNotFoundError["_tag"]
   * const acceptsRegistryNotFoundError_tag = (_value: RegistryNotFoundError_tag): void => undefined
   *
   * console.log(acceptsRegistryNotFoundError_tag)
   * ```
   */
  readonly _tag = "RegistryNotFoundError";
  /**
   * Storage path that could not be resolved.
   *
   * **Example** (Use the path field)
   *
   * ```ts
   * import type { RegistryNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type RegistryNotFoundErrorPath = RegistryNotFoundError["path"]
   * const acceptsRegistryNotFoundErrorPath = (_value: RegistryNotFoundErrorPath): void => undefined
   *
   * console.log(acceptsRegistryNotFoundErrorPath)
   * ```
   */
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }
}

/**
 * Provides the registry parse error service capability.
 *
 * **Example** (Inspect registry parse error)
 *
 * ```ts
 * import { RegistryParseError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * console.log(RegistryParseError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryParseError {
  /**
   * Stable discriminator for registry parsing failures.
   *
   * **Example** (Use the _tag field)
   *
   * ```ts
   * import type { RegistryParseError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type RegistryParseError_tag = RegistryParseError["_tag"]
   * const acceptsRegistryParseError_tag = (_value: RegistryParseError_tag): void => undefined
   *
   * console.log(acceptsRegistryParseError_tag)
   * ```
   */
  readonly _tag = "RegistryParseError";
  /**
   * Storage path containing the invalid registry document.
   *
   * **Example** (Use the path field)
   *
   * ```ts
   * import type { RegistryParseError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type RegistryParseErrorPath = RegistryParseError["path"]
   * const acceptsRegistryParseErrorPath = (_value: RegistryParseErrorPath): void => undefined
   *
   * console.log(acceptsRegistryParseErrorPath)
   * ```
   */
  readonly path: string;
  /**
   * Underlying parse failure retained for diagnostics.
   *
   * **Example** (Use the cause field)
   *
   * ```ts
   * import type { RegistryParseError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type RegistryParseErrorCause = RegistryParseError["cause"]
   * const acceptsRegistryParseErrorCause = (_value: RegistryParseErrorCause): void => undefined
   *
   * console.log(acceptsRegistryParseErrorCause)
   * ```
   */
  readonly cause: unknown;
  constructor(path: string, cause: unknown) {
    this.path = path;
    this.cause = cause;
  }
}

/**
 * Provides the ontology not found error service capability.
 *
 * **Example** (Inspect ontology not found error)
 *
 * ```ts
 * import { OntologyNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * console.log(OntologyNotFoundError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyNotFoundError {
  /**
   * Stable discriminator for missing ontology entries.
   *
   * **Example** (Use the _tag field)
   *
   * ```ts
   * import type { OntologyNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type OntologyNotFoundError_tag = OntologyNotFoundError["_tag"]
   * const acceptsOntologyNotFoundError_tag = (_value: OntologyNotFoundError_tag): void => undefined
   *
   * console.log(acceptsOntologyNotFoundError_tag)
   * ```
   */
  readonly _tag = "OntologyNotFoundError";
  /**
   * Ontology identifier or IRI that could not be resolved.
   *
   * **Example** (Use the identifier field)
   *
   * ```ts
   * import type { OntologyNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type OntologyNotFoundErrorIdentifier = OntologyNotFoundError["identifier"]
   * const acceptsOntologyNotFoundErrorIdentifier = (_value: OntologyNotFoundErrorIdentifier): void => undefined
   *
   * console.log(acceptsOntologyNotFoundErrorIdentifier)
   * ```
   */
  readonly identifier: string;
  /**
   * Registry field used for the failed lookup.
   *
   * **Example** (Use the type field)
   *
   * ```ts
   * import type { OntologyNotFoundError } from "@effect-ontology/Service/OntologyRegistry"
   *
   * type OntologyNotFoundErrorType = OntologyNotFoundError["type"]
   * const acceptsOntologyNotFoundErrorType = (_value: OntologyNotFoundErrorType): void => undefined
   *
   * console.log(acceptsOntologyNotFoundErrorType)
   * ```
   */
  readonly type: "id" | "iri";
  constructor(identifier: string, type: "id" | "iri") {
    this.identifier = identifier;
    this.type = type;
  }
}

/**
 * Describes the registry error data exposed by this module.
 *
 *
 * **Example** (Use the RegistryError contract)
 *
 * ```ts
 * import type { RegistryError } from "@effect-ontology/Service/OntologyRegistry"
 *
 * const acceptsRegistryError = (_value: RegistryError): void => undefined
 *
 * console.log(acceptsRegistryError)
 * ```
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
 * **Example** (Inspect ontology registry service)
 *
 * ```ts
 * import { OntologyRegistryService } from "@effect-ontology/Service/OntologyRegistry"
 *
 * console.log(OntologyRegistryService)
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
    let cachedRegistry: OntologyRegistry | null = null;

    /**
     * Load the registry from storage
     */
    const loadRegistry = Effect.gen(function* () {
      if (P.isNotNull(cachedRegistry)) {
        return cachedRegistry;
      }

      yield* Effect.logInfo("Loading ontology registry", { path: registryPath });

      const contentOpt = yield* storage
        .get(registryPath)
        .pipe(Effect.mapError(() => new RegistryNotFoundError(registryPath)));

      if (contentOpt === undefined) {
        return yield* Effect.fail(new RegistryNotFoundError(registryPath));
      }

      const registry = yield* S.decodeEffect(OntologyRegistryJson)(contentOpt).pipe(
        Effect.mapError((cause) => new RegistryParseError(registryPath, cause))
      );

      yield* Effect.logInfo("Ontology registry loaded", {
        version: registry.version,
        ontologyCount: registry.ontologies.length,
        ontologies: A.map(registry.ontologies, (ontology) => ontology.id),
      });

      cachedRegistry = registry;
      return registry;
    });

    /**
     * Get ontology entry by short ID (e.g., "seattle")
     */
    const getById = Effect.fn("getById")(function* (id: string) {
      const registry = yield* loadRegistry;
      return A.findFirst(registry.ontologies, (ontology) => ontology.id === id);
    });

    /**
     * Get ontology entry by IRI (e.g., "http://effect-ontology.dev/seattle")
     */
    const getByIri = Effect.fn("getByIri")(function* (iri: string) {
      const registry = yield* loadRegistry;
      return A.findFirst(registry.ontologies, (ontology) => ontology.iri === iri);
    });

    /**
     * Resolve an ontology URI to its storage path
     *
     * Accepts:
     * - Full IRI: "http://effect-ontology.dev/seattle" -> looks up in registry
     * - Short ID: "seattle" -> looks up in registry
     * - Direct path: "canonical/seattle/ontology.ttl" -> returns as-is
     * - GCS URI: "gs://bucket/path" -> strips prefix, returns path
     */
    const resolveToPath = Effect.fn("resolveToPath")(function* (uri: string) {
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
        return yield* Effect.fail(new OntologyNotFoundError(uri, "iri"));
      }
      const entry = yield* getById(uri);
      if (O.isSome(entry)) {
        return entry.value.storagePath;
      }
      return yield* Effect.fail(new OntologyNotFoundError(uri, "id"));
    });

    /**
     * Resolve an ontology URI to its full entry (if in registry)
     */
    const resolveToEntry = Effect.fn("resolveToEntry")(function* (uri: string) {
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
      cachedRegistry = null;
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
