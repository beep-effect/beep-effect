/**
 * Layer wiring of the docket intake service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AnthropicLanguageModelLive } from "@beep/anthropic";
import {
  DocketFileStoreOptions,
  DocketGraphConfig,
  DocketMatterLookupUnavailableLive,
  makeDocketAgentsLayer,
  makeDocketFileStoreLayer,
  makeDocketGraphLayer,
} from "@beep/law-practice-server/DocketIntake";
import { DocketIntakeConfig, makeDocketIntakeLayer } from "@beep/law-practice-use-cases/DocketIntake";
import { M365, M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { Layer } from "effect";
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

// The docket intake pipeline over its live ports: Graph mailbox and calendar, the two
// Anthropic-backed agents, the file store and the matter lookup. The store is exposed beside the
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
  const agents = makeDocketAgentsLayer().pipe(Layer.provide(AnthropicLanguageModelLive));
  const store = makeDocketFileStoreLayer(DocketFileStoreOptions.make({ directory: config.stateDirectory }));

  return makeDocketIntakeLayer(
    DocketIntakeConfig.make({ mailbox: config.mailbox, reviewNegatives: config.reviewNegatives })
  ).pipe(
    Layer.provideMerge(Layer.mergeAll(graph, agents, store, DocketMatterLookupUnavailableLive)),
    Layer.provide(BunCrypto.layer)
  );
};

/**
 * The live wiring of the service's commands.
 *
 * @category layers
 * @since 0.0.0
 */
export const liveWiring = {
  intake: makeDocketIntakeAppLayer,
  mailbox: (config: DocketIntakeAppConfig) => Layer.merge(makeM365Layer(config), BunCrypto.layer),
};
