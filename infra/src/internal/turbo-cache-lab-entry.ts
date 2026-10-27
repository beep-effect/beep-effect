/**
 * Pulumi entrypoint for the disposable turbo-cache conformance lab.
 *
 * Reuses the production {@link CiTurboCache} component unchanged under a
 * lab-only component name, so every physical name (functions, log groups,
 * authorizer, API) carries the `beep-tcl-<epoch>` prefix and the stack owns
 * no production resource. `infra/turbo-cache-lab/lab-aws.sh bootstrap`
 * creates the lab KMS key and SecureStrings and names them in this stack's
 * config, as production names its existing parameters; the stack itself
 * creates both lab buckets (incumbent and `-evo-`) from that config.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as pulumi from "@pulumi/pulumi";
import {
  CiTurboCache,
  CiTurboCachePulumiConfigValues,
  CiTurboCacheRemediation,
  loadCiTurboCacheConfig,
  resolveTurboCacheLabBuckets,
  TurboCacheLabBucketsInput,
} from "../CiTurboCache.ts";

const config = loadCiTurboCacheConfig();
const names = resolveTurboCacheLabBuckets(
  TurboCacheLabBucketsInput.make({
    epoch: new pulumi.Config("turboCacheLab").require("epoch"),
    bucketName: config.bucketName,
  })
);

const incumbent = new CiTurboCache(names.componentPrefix, { config });

// Evolved incumbent: the minimum remediation measured against the same corpus.
// Its own bucket keeps tagged and untagged objects apart; reserved concurrency
// is raised above the observed (capped) 20/10 peak.
const evolved = new CiTurboCache(`${names.componentPrefix}-evo`, {
  config: CiTurboCachePulumiConfigValues.make({ ...config, bucketName: names.evolvedBucket }),
  remediation: CiTurboCacheRemediation.make({
    tagPassthrough: true,
    readReservedConcurrency: 60,
    writeReservedConcurrency: 30,
    authorizerReservedConcurrency: 60,
  }),
});

/**
 * Lab incumbent API endpoint; conformance targets append `/v8`.
 *
 * @category resources
 * @since 0.0.0
 */
export const incumbentEndpoint = incumbent.apiEndpoint;

/**
 * Lab artifact bucket name.
 *
 * @category resources
 * @since 0.0.0
 */
export const incumbentBucket = incumbent.bucketName;

/**
 * Lab evolved-incumbent API endpoint.
 *
 * @category resources
 * @since 0.0.0
 */
export const evolvedEndpoint = evolved.apiEndpoint;
