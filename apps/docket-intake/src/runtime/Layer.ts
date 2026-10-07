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
  DocketJournalingPortsLive,
  DocketKgBundleOptions,
  DocketMatterLookupUnavailableLive,
  DocketTrackedDatesCsvOptions,
  makeDocketAgentsLayer,
  makeDocketFileJournalLayer,
  makeDocketFileStoreLayer,
  makeDocketGraphLayer,
  makeDocketGraphReadOnlyLayer,
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
import { DocketDryRunPortsLive } from "../DryRun.ts";
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

type IntakeOptions = {
  readonly config: DocketIntakeAppConfig;
  readonly initialSince: string;
};

const graphConfig = (options: IntakeOptions) =>
  DocketGraphConfig.make({
    initialSince: options.initialSince,
    mailbox: options.config.mailbox,
    timeZone: options.config.timeZone,
  });

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

// The pipeline over the given mailbox and calendar ports, the two Anthropic-backed agents at
// temperature 0 (so a dry run and a live run read a message the same way, D-46), the store, the
// matter lookup and the docket sheet, with the review loop's round limit and threshold taken from
// the configuration.
const pipelineOver = <ROut, E, R>(config: DocketIntakeAppConfig, ports: Layer.Layer<ROut, E, R>) =>
  makeDocketIntakeLayer(
    DocketIntakeConfig.make({
      mailbox: config.mailbox,
      review: DocketReviewConfig.make({
        acceptThreshold: config.reviewAcceptThreshold,
        maxRounds: config.reviewMaxRounds,
      }),
      reviewNegatives: config.reviewNegatives,
    })
  ).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        ports,
        makeDocketAgentsLayer().pipe(Layer.provide(makeAnthropicLanguageModelLiveLayer({ temperature: 0 }))),
        matterLookupLayer(config),
        trackedDatesLayer(config)
      )
    ),
    Layer.provide(BunCrypto.layer)
  );

// The docket intake pipeline over the live Graph ports, with every calendar create and message
// mark recorded in the write journal. The store and the journal are exposed beside the pipeline
// so the service can seed its cursor and start a run each cycle.
const makeDocketIntakeAppLayer = (options: IntakeOptions) => {
  const storeOptions = DocketFileStoreOptions.make({ directory: options.config.stateDirectory });
  const journal = makeDocketFileJournalLayer(storeOptions).pipe(
    Layer.provideMerge(makeDocketFileStoreLayer(storeOptions))
  );
  const graph = makeDocketGraphLayer(graphConfig(options)).pipe(Layer.provide(makeM365Layer(options.config)));
  return pipelineOver(
    options.config,
    DocketJournalingPortsLive.pipe(Layer.provide(graph), Layer.provideMerge(journal))
  );
};

// The same pipeline for a dry run: read-only Graph ports under recording ones, and a throwaway
// store in the dry-run directory. Nothing reaches the calendar, the mailbox or the real state.
const makeDocketDryRunAppLayer = (options: IntakeOptions & { readonly directory: string }) => {
  const graph = makeDocketGraphReadOnlyLayer(graphConfig(options)).pipe(Layer.provide(makeM365Layer(options.config)));
  return pipelineOver(
    options.config,
    Layer.merge(
      DocketDryRunPortsLive.pipe(Layer.provide(graph)),
      makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: options.directory }))
    )
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
  dryRun: makeDocketDryRunAppLayer,
  intake: makeDocketIntakeAppLayer,
  mailbox: (config: DocketIntakeAppConfig) => Layer.merge(makeM365Layer(config), BunCrypto.layer),
};
