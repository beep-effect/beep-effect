/**
 * Catalog of contracts and committed specifications exposed by the API docs lab.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EcfrApi } from "@beep/ecfr/contract";
import { GovinfoApi } from "@beep/govinfo/domain/contracts/Api";
import { PclHttpApi } from "@beep/pacer/Pcl.api";
import { QaCollectorApi } from "@beep/qa-capture/Collector.api";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { CatalogEntry, CatalogEntryMeta, CatalogSlug, CatalogSource, makeContractSource } from "./Catalog.models.ts";

/**
 * Complete ordered catalog of handwritten contracts and committed specifications exposed by the lab.
 *
 * **Example** (Count catalog entries)
 *
 * ```ts
 * import { Catalog } from "@beep/api-docs/src/Catalog"
 * import * as A from "effect/Array"
 *
 * console.log(A.length(Catalog)) // 9
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const Catalog: ReadonlyArray<CatalogEntry> = [
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("pacer-pcl"),
      title: "PACER Case Locator",
      description: "PACER contract for case and party searches and asynchronous case-download reports.",
    }),
    source: makeContractSource(PclHttpApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("govinfo-search"),
      title: "GovInfo search contract",
      description: "Hand-written GovInfo contract covering document search.",
    }),
    source: makeContractSource(GovinfoApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.served.make({
      slug: CatalogSlug.make("qa-collector"),
      title: "QA capture collector",
      description: "Local event, marker, health, and stop endpoints used while recording browser QA evidence.",
    }),
    source: makeContractSource(QaCollectorApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("ecfr"),
      title: "eCFR contract",
      description: "Generated HttpApi contract for the public eCFR API.",
    }),
    source: makeContractSource(EcfrApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("govinfo-full"),
      title: "GovInfo full API",
      description: "Committed OpenAPI source covering the full GovInfo API.",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/govinfo/openapi.json",
      dialect: "openapi-3.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("runpod"),
      title: "Runpod API",
      description: "Committed pre-patch OpenAPI source used by the Runpod generator.",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/runpod/openapi.json",
      dialect: "openapi-3.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("ecfr-source"),
      title: "eCFR source specification",
      description: "Hand-maintained Swagger 2.0 source for the eCFR contract. Compare it with /apis/ecfr/docs.",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/ecfr/openapi.json",
      dialect: "swagger-2.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("acp"),
      title: "Agent Client Protocol schema",
      description: "Committed unstable ACP JSON Schema. This raw-only entry has no Scalar page.",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/acp/spec/schema.unstable.json",
      dialect: "json-schema-2020-12",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.cases.consumed.make({
      slug: CatalogSlug.make("venice-ai"),
      title: "Venice.ai API",
      description: "Committed OpenAPI 3.0 source for the Venice.ai inference API.",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/venice-ai/swagger.yaml",
      dialect: "openapi-3.0",
      format: "yaml",
    }),
  }),
];

/**
 * Resolves a repository-relative specification path from the lab module location instead of the process working directory.
 *
 * **Gotchas**
 *
 * The input must remain relative to the repository root; this function does not verify that the target file exists.
 *
 * **Example** (Resolve a committed specification)
 *
 * ```ts
 * import { resolveCatalogSpecPath } from "@beep/api-docs/src/Catalog"
 * import * as BunServices from "@effect/platform-bun/BunServices"
 * import { Effect } from "effect"
 *
 * const program = resolveCatalogSpecPath("packages/drivers/govinfo/openapi.json").pipe(
 *   Effect.provide(BunServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveCatalogSpecPath = Effect.fn("ApiDocs.resolveCatalogSpecPath")(function* (specPath: string) {
  const path = yield* Path.Path;
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  return path.resolve(repositoryRoot, specPath);
});
