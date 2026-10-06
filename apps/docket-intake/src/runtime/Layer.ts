/**
 * Layer wiring of the docket intake service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeAnthropicLanguageModelLiveLayer } from "@beep/anthropic";
import {
  DocketFileStoreOptions,
  DocketGraphConfig,
  DocketKgBundleOptions,
  DocketMatterLookupUnavailableLive,
  DocketTrackedDatesCsvOptions,
  makeDocketAgentsLayer,
  makeDocketFileStoreLayer,
  makeDocketGraphLayer,
  makeDocketMatterLookupLayer,
  makeDocketTrackedDatesCsvLayer,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketIntakeConfig,
  DocketReviewConfig,
  makeDocketIntakeLayer,
} from "@beep/law-practice-use-cases/DocketIntake";
import { M365, M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Layer } from "effect";
import * as O from "effect/Option";
import type { DocketIntakeAppConfig } from "../Config.ts";

// The app-only Microsoft Graph layer for the configured tenant and certificate.
const makeM365Layer = (config: DocketIntakeAppConfig) =>
  M365.makeAppOnlyLiveLayer(
    M365AppOnlyConfigInput.make({
      clientId: config.clientId,
      credential: M365CertificateCredential.make({
        privateKey: config.certPrivateKey,
        thumbprintSha256: config.certThumbprintSha256,
      }),
      tenantId: config.tenantId,
    })
  );

// The matter lookup over the configured practice-KG bundle, opened read-only; without a bundle,
// every entry is flagged `matter-lookup-failed`.
const matterLookupLayer = (config: DocketIntakeAppConfig) =>
  O.match(config.kgBundleDirectory, {
    onNone: () => DocketMatterLookupUnavailableLive,
    onSome: (bundleDir) => makeDocketMatterLookupLayer(DocketKgBundleOptions.make({ bundleDir })),
  });

// The docket sheet cross-check over the configured CSV export; without one there is no cross-check.
const trackedDatesLayer = (config: DocketIntakeAppConfig) =>
  O.match(config.docketSheetCsv, {
    onNone: () => Layer.empty,
    onSome: (path) => makeDocketTrackedDatesCsvLayer(DocketTrackedDatesCsvOptions.make({ path })),
  });

// The docket intake pipeline over its live ports: Graph mailbox and calendar, the two
// Anthropic-backed agents, the file store, the matter lookup and the docket sheet, with the review
// loop's round limit and threshold taken from the configuration. The store is exposed beside the
// pipeline so the service can seed its cursor.
const makeDocketIntakeAppLayer = (options: {
  readonly config: DocketIntakeAppConfig;
  readonly initialSince: string;
}) => {
  const { config, initialSince } = options;
  const graph = makeDocketGraphLayer(
    DocketGraphConfig.make({
      initialSince,
      mailbox: config.mailbox,
      timeZone: config.timeZone,
    })
  ).pipe(Layer.provide(makeM365Layer(config)));
  // Temperature 0 for both agents, so a dry run and a live run read a message the same way (D-46).
  const agents = makeDocketAgentsLayer().pipe(Layer.provide(makeAnthropicLanguageModelLiveLayer({ temperature: 0 })));
  const store = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: config.stateDirectory }));

  return makeDocketIntakeLayer(
    DocketIntakeConfig.make({
      mailbox: config.mailbox,
      review: DocketReviewConfig.make({
        acceptThreshold: config.reviewAcceptThreshold,
        maxRounds: config.reviewMaxRounds,
      }),
      reviewNegatives: config.reviewNegatives,
    })
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(graph, agents, store, matterLookupLayer(config), trackedDatesLayer(config))),
    Layer.provide(BunCrypto.layer)
  );
};

/**
 * The live wiring of the service's commands.
 *
 * **Example** (List the live wiring members)
 *
 * ```ts
 * import { liveWiring } from "../../src/runtime/Layer.ts"
 *
 * console.log(Object.keys(liveWiring))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const liveWiring = {
  intake: makeDocketIntakeAppLayer,
  mailbox: (config: DocketIntakeAppConfig) => Layer.merge(makeM365Layer(config), BunCrypto.layer),
};
