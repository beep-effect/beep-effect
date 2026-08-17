/**
 * Service: Ontology Registry
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
import { Context, Effect, Layer, Option, Schema } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { OntologyRegistry } from "../Domain/Schema/OntologyRegistry.ts";
import { OntologyRegistryJson } from "../Domain/Schema/OntologyRegistry.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/OntologyRegistry");

/**
 * Error types for registry operations
 *
 * @since 0.0.0
 * @category errors
 */
export class RegistryNotFoundError {
  readonly _tag = "RegistryNotFoundError";
  readonly path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class RegistryParseError {
  readonly _tag = "RegistryParseError";
  readonly path: string;
  readonly cause: unknown;
  constructor(path: string, cause: unknown) {
    this.path = path;
    this.cause = cause;
  }
}

export class OntologyNotFoundError {
  readonly _tag = "OntologyNotFoundError";
  readonly identifier: string;
  readonly type: "id" | "iri";
  constructor(identifier: string, type: "id" | "iri") {
    this.identifier = identifier;
    this.type = type;
  }
}

export type RegistryError = RegistryNotFoundError | RegistryParseError | OntologyNotFoundError;

/**
 * Default path to registry.json in storage
 */
const DEFAULT_REGISTRY_PATH = "registry.json";

/**
 * OntologyRegistryService - Load and query the ontology registry
 *
 * Provides methods to:
 * - Load registry from storage
 * - Look up ontologies by ID or IRI
 * - Resolve ontology URIs to storage paths
 *
 * @since 0.0.0
 * @category services
 */
export class OntologyRegistryService extends Context.Service<OntologyRegistryService>()($I`OntologyRegistryService`, {
  make: Effect.gen(function* () {
    const storage = yield* StorageService;
    const config = yield* ConfigService;

    // Registry path from config or default
    const registryPath = Option.getOrElse(config.ontology.registryPath, () => DEFAULT_REGISTRY_PATH);

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

      const registry = yield* Schema.decodeEffect(OntologyRegistryJson)(contentOpt).pipe(
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
        if (Option.isSome(entry)) {
          return entry.value.storagePath;
        }
        return yield* Effect.fail(new OntologyNotFoundError(uri, "iri"));
      }
      const entry = yield* getById(uri);
      if (Option.isSome(entry)) {
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
