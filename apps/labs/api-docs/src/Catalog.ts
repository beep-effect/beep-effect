import { EcfrApi } from "@beep/ecfr/contract";
import { GovinfoApi } from "@beep/govinfo/domain/contracts/Api";
import { PclHttpApi } from "@beep/pacer/Pcl.api";
import { QaCollectorApi } from "@beep/qa-capture/Collector.api";
import { Effect, Path } from "effect";
import { CatalogEntry, CatalogEntryMeta, CatalogSlug, CatalogSource, makeContractSource } from "./Catalog.models.ts";

/** Complete v1 API docs catalog. */
export const Catalog: ReadonlyArray<CatalogEntry> = [
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("pacer-pcl"),
      title: "PACER Case Locator",
      description: "PACER contract for case and party searches and asynchronous case-download reports.",
      audience: "consumed",
    }),
    source: makeContractSource(PclHttpApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("govinfo-search"),
      title: "GovInfo search contract",
      description: "Hand-written GovInfo contract covering document search.",
      audience: "consumed",
    }),
    source: makeContractSource(GovinfoApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("qa-collector"),
      title: "QA capture collector",
      description: "Local event, marker, health, and stop endpoints used while recording browser QA evidence.",
      audience: "served",
    }),
    source: makeContractSource(QaCollectorApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("ecfr"),
      title: "eCFR contract",
      description: "Generated HttpApi contract for the public eCFR API.",
      audience: "consumed",
    }),
    source: makeContractSource(EcfrApi),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("govinfo-full"),
      title: "GovInfo full API",
      description: "Committed OpenAPI source covering the full GovInfo API.",
      audience: "consumed",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/govinfo/openapi.json",
      dialect: "openapi-3.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("runpod"),
      title: "Runpod API",
      description: "Committed pre-patch OpenAPI source used by the Runpod generator.",
      audience: "consumed",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/runpod/openapi.json",
      dialect: "openapi-3.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("ecfr-source"),
      title: "eCFR source specification",
      description: "Hand-maintained Swagger 2.0 source for the eCFR contract. Compare it with /apis/ecfr/docs.",
      audience: "consumed",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/ecfr/openapi.json",
      dialect: "swagger-2.0",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("acp"),
      title: "Agent Client Protocol schema",
      description: "Committed unstable ACP JSON Schema. This raw-only entry has no Scalar page.",
      audience: "consumed",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/acp/spec/schema.unstable.json",
      dialect: "json-schema-2020-12",
      format: "json",
    }),
  }),
  new CatalogEntry({
    meta: CatalogEntryMeta.make({
      slug: CatalogSlug.make("venice-ai"),
      title: "Venice.ai API",
      description: "Committed OpenAPI 3.0 source for the Venice.ai inference API.",
      audience: "consumed",
    }),
    source: CatalogSource.SpecSource({
      specPath: "packages/drivers/venice-ai/swagger.yaml",
      dialect: "openapi-3.0",
      format: "yaml",
    }),
  }),
];

/** Resolve a repo-root-relative committed specification without consulting cwd. */
export const resolveCatalogSpecPath = Effect.fn("ApiDocs.resolveCatalogSpecPath")(function* (specPath: string) {
  const path = yield* Path.Path;
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  return path.resolve(repositoryRoot, specPath);
});
