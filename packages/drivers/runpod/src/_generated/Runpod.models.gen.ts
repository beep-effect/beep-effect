/**
 * Generated schemas source for \@beep/runpod.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// This file is generated. Do not edit manually.

import { $RunpodId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $RunpodId.create("Runpod.generated");

/**
 * Generated RUNPOD class schema for `ContainerRegistryAuth`.
 *
 * **Example** (Inspect ContainerRegistryAuth)
 *
 * ```ts
 * import { ContainerRegistryAuth } from "@beep/runpod"
 *
 * console.log(ContainerRegistryAuth.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContainerRegistryAuth extends S.Class<ContainerRegistryAuth>(
  $I`ContainerRegistryAuth`,
)(
  {
    id: S.optionalKey(
      S.String.annotateKey({
        description:
          "A unique string identifying a container registry authentication.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a container registry authentication. The name must be unique.",
      }),
    ),
  },
  $I.annote("ContainerRegistryAuth", {
    description: "Generated RUNPOD schema for ContainerRegistryAuth.",
    identifier: "ContainerRegistryAuth",
  }),
) {
  static readonly is = S.is(ContainerRegistryAuth);
}

/**
 * Generated RUNPOD class schema for `Template`.
 *
 * **Example** (Inspect Template)
 *
 * ```ts
 * import { Template } from "@beep/runpod"
 *
 * console.log(Template.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Template extends S.Class<Template>($I`Template`)(
  {
    category: S.optionalKey(
      S.String.annotateKey({
        description:
          "The category of the template. The category can be used to filter templates in the Runpod UI. Current categories are NVIDIA, AMD, and CPU.",
      }),
    ),
    containerDiskInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the container disk for a Pod or worker. The data on the container disk is wiped when the Pod or worker restarts. To persist data across restarts, set volumeInGb to configure the local network volume.",
      }),
    ),
    containerRegistryAuthId: S.optionalKey(S.String),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on a Pod or worker. If [], uses the ENTRYPOINT defined in the image.",
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on a Pod or worker. If [], uses the start CMD defined in the image.",
      }),
    ),
    earned: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount of Runpod credits earned by the creator of a template by all Pods or workers created from the template.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    id: S.optionalKey(
      S.String.annotateKey({
        description: "A unique string identifying a template.",
      }),
    ),
    imageName: S.optionalKey(
      S.String.annotateKey({
        description:
          "The image tag for the container run on Pods or workers created from a template.",
      }),
    ),
    isPublic: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true if a template is public and can be used by any Runpod user. Set to false if a template is private and can only be used by the creator.",
      }),
    ),
    isRunpod: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If true, a template is an official template managed by Runpod.",
      }),
    ),
    isServerless: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If true, instances created from a template are Serverless workers. If false, instances created from a template are Pods.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a template. The name needs to be unique.",
      }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on a Pod or worker. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    readme: S.optionalKey(
      S.String.annotateKey({
        description:
          "A string of markdown-formatted text that describes a template. The readme is displayed in the Runpod UI when a user selects the template.",
      }),
    ),
    runtimeInMin: S.optionalKey(S.Int),
    volumeInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the local network volume for a Pod or worker. The data on the local network volume is persisted across restarts. To persist data so that future Pods and workers can access it, create a network volume and set networkVolumeId to attach it to the Pod or worker.",
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a local network volume or network volume is attached to a Pod or worker, the absolute path where the network volume is mounted in the filesystem.",
      }),
    ),
  },
  $I.annote("Template", {
    description: "Generated RUNPOD schema for Template.",
    identifier: "Template",
  }),
) {
  static readonly is = S.is(Template);
}

/**
 * Generated RUNPOD class schema for `SavingsPlan`.
 *
 * **Example** (Inspect SavingsPlan)
 *
 * ```ts
 * import { SavingsPlan } from "@beep/runpod"
 *
 * console.log(SavingsPlan.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SavingsPlan extends S.Class<SavingsPlan>($I`SavingsPlan`)(
  {
    costPerHr: S.optionalKey(
      S.Finite.check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    endTime: S.optionalKey(S.String),
    gpuTypeId: S.optionalKey(S.String),
    id: S.optionalKey(S.String),
    podId: S.optionalKey(S.String),
    startTime: S.optionalKey(S.String),
  },
  $I.annote("SavingsPlan", {
    description: "Generated RUNPOD schema for SavingsPlan.",
    identifier: "SavingsPlan",
  }),
) {
  static readonly is = S.is(SavingsPlan);
}

/**
 * Generated RUNPOD class schema for `Pod`.
 *
 * **Example** (Inspect Pod)
 *
 * ```ts
 * import { Pod } from "@beep/runpod"
 *
 * console.log(Pod.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Pod extends S.Class<Pod>($I`Pod`)(
  {
    adjustedCostPerHr: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The effective cost in Runpod credits per hour of running a Pod, adjusted by active Savings Plans.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    aiApiId: S.optionalKey(
      S.String.annotateKey({
        description: "Synonym for endpointId (legacy name).",
      }),
    ),
    consumerUserId: S.optionalKey(
      S.String.annotateKey({
        description:
          "A unique string identifying the Runpod user who rents a Pod.",
      }),
    ),
    containerDiskInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the container disk for a Pod. The data on the container disk is wiped when the Pod restarts. To persist data across Pod restarts, set volumeInGb to configure the Pod network volume.",
      }),
    ),
    containerRegistryAuthId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a Pod is created with a container registry auth, the unique string identifying that container registry auth.",
      }),
    ),
    costPerHr: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The cost in Runpod credits per hour of running a Pod. Note that the actual cost may be lower if Savings Plans are applied.",
        format: "currency",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    cpuFlavorId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the Pod is a CPU Pod, the unique string identifying the CPU flavor the Pod is running on.",
      }),
    ),
    desiredStatus: S.optionalKey(
      S.Literals(["RUNNING", "EXITED", "TERMINATED"]).annotateKey({
        description: "The current expected status of a Pod.",
      }),
    ),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on the created Pod. If [], uses the ENTRYPOINT defined in the image.",
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on the created Pod. If [], uses the start CMD defined in the image.",
      }),
    ),
    endpointId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the Pod is a Serverless worker, a unique string identifying the associated endpoint.",
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    gpu: S.optionalKey(
      S.Struct({
        id: S.optionalKey(S.String),
        count: S.optionalKey(
          S.Int.annotateKey({
            description: "The number of GPUs attached to a Pod.",
          }),
        ),
        displayName: S.optionalKey(S.String),
        securePrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        communityPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        oneMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        threeMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        sixMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        oneWeekPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        communitySpotPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        secureSpotPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
      }),
    ),
    id: S.optionalKey(
      S.String.annotateKey({
        description:
          "A unique string identifying a [Pod](#/components/schema/Pod).",
      }),
    ),
    image: S.optionalKey(
      S.String.annotateKey({
        description: "The image tag for the container run on a Pod.",
      }),
    ),
    interruptible: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Describes how a Pod is rented. An interruptible Pod can be rented at a lower cost but can be stopped at any time to free up resources for another Pod. A reserved Pod is rented at a higher cost but runs until it exits or is manually stopped.",
      }),
    ),
    lastStartedAt: S.optionalKey(
      S.String.annotateKey({
        description: "The UTC timestamp when a Pod was last started.",
      }),
    ),
    lastStatusChange: S.optionalKey(
      S.String.annotateKey({
        description: "A string describing the last lifecycle event on a Pod.",
      }),
    ),
    locked: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to lock a Pod. Locking a Pod disables stopping or resetting the Pod.",
      }),
    ),
    machine: S.optionalKey(
      S.Struct({
        minPodGpuCount: S.optionalKey(S.Int),
        gpuTypeId: S.optionalKey(S.String),
        gpuType: S.optionalKey(
          S.Struct({
            id: S.optionalKey(S.String),
            count: S.optionalKey(
              S.Int.annotateKey({
                description: "The number of GPUs attached to a Pod.",
              }),
            ),
            displayName: S.optionalKey(S.String),
            securePrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            communityPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            oneMonthPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            threeMonthPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            sixMonthPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            oneWeekPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            communitySpotPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            secureSpotPrice: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
          }),
        ),
        cpuCount: S.optionalKey(S.Int),
        cpuTypeId: S.optionalKey(S.String),
        cpuType: S.optionalKey(
          S.Struct({
            id: S.optionalKey(S.String),
            displayName: S.optionalKey(S.String),
            cores: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            threadsPerCore: S.optionalKey(
              S.Finite.check(
                S.isFinite().annotate({ expected: "a finite number" }),
              ),
            ),
            groupId: S.optionalKey(S.String),
          }),
        ),
        location: S.optionalKey(S.String),
        dataCenterId: S.optionalKey(S.String),
        diskThroughputMBps: S.optionalKey(S.Int),
        maxDownloadSpeedMbps: S.optionalKey(S.Int),
        maxUploadSpeedMbps: S.optionalKey(S.Int),
        supportPublicIp: S.optionalKey(S.Boolean),
        secureCloud: S.optionalKey(S.Boolean),
        maintenanceStart: S.optionalKey(S.String),
        maintenanceEnd: S.optionalKey(S.String),
        maintenanceNote: S.optionalKey(S.String),
        note: S.optionalKey(S.String),
        costPerHr: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        currentPricePerGpu: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        gpuAvailable: S.optionalKey(S.Int),
        gpuDisplayName: S.optionalKey(S.String),
      }).annotateKey({
        description:
          "Information about the machine a Pod is running on (see [Machine](#/components/schemas/Machine)).",
      }),
    ),
    machineId: S.optionalKey(
      S.String.annotateKey({
        description:
          "A unique string identifying the host machine a Pod is running on.",
      }),
    ),
    memoryInGb: S.optionalKey(
      S.Finite.annotateKey({
        description: "The amount of RAM, in gigabytes (GB), attached to a Pod.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Pod. The name does not need to be unique.",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
    networkVolume: S.optionalKey(
      S.Struct({
        id: S.optionalKey(
          S.String.annotateKey({
            description: "A unique string identifying a network volume.",
          }),
        ),
        name: S.optionalKey(
          S.String.annotateKey({
            description:
              "A user-defined name for a network volume. The name does not need to be unique.",
          }),
        ),
        size: S.optionalKey(
          S.Int.annotateKey({
            description:
              "The amount of disk space, in gigabytes (GB), allocated to a network volume.",
          }),
        ),
        dataCenterId: S.optionalKey(
          S.String.annotateKey({
            description:
              "The Runpod data center ID where a network volume is located.",
          }),
        ),
      }).annotateKey({
        description:
          "If a network volume is attached to a Pod, information about the network volume (see [network volume schema](#/components/schemas/NetworkVolume)).",
      }),
    ),
    portMappings: S.optionalKey(
      S.Union([
        S.Record(S.String, S.Json.annotate({ expected: "JSON value" })),
        S.Null,
      ]).annotateKey({
        description:
          'A mapping of internal ports to public ports on a Pod. For example, { "22": 10341 } means that port 22 on the Pod is mapped to port 10341 and is publicly accessible at [public ip]:10341. If the Pod is still initializing, this mapping is not yet determined and will be empty.',
      }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on a Pod. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    publicIp: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "The public IP address of a Pod. If the Pod is still initializing, this IP is not yet determined and will be empty.",
        format: "ipv4",
      }),
    ),
    savingsPlans: S.optionalKey(
      S.Array(SavingsPlan).annotateKey({
        description:
          "The list of active Savings Plans applied to a Pod (see [Savings Plans](#/components/schemas/SavingsPlan)). If none are applied, the list is empty.",
      }),
    ),
    slsVersion: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the Pod is a Serverless worker, the version of the associated endpoint (see [Endpoint Version](#/components/schemas/Endpoint/version)).",
      }),
    ),
    templateId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a Pod is created with a template, the unique string identifying that template.",
      }),
    ),
    vcpuCount: S.optionalKey(
      S.Finite.annotateKey({
        description: "The number of virtual CPUs attached to a Pod.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    volumeEncrypted: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true if the local network volume of a Pod is encrypted. Can only be set when creating a Pod.",
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pod volume for a Pod. The data on the Pod volume is persisted across Pod restarts. To persist data so that future Pods can access it, create a network volume and set networkVolumeId to attach it to the Pod.",
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If either a Pod volume or a network volume is attached to a Pod, the absolute path where the network volume is mounted in the filesystem.",
      }),
    ),
  },
  $I.annote("Pod", {
    description: "Generated RUNPOD schema for Pod.",
    identifier: "Pod",
  }),
) {
  static readonly is = S.is(Pod);
}

/**
 * Generated RUNPOD class schema for `Endpoint`.
 *
 * **Example** (Inspect Endpoint)
 *
 * ```ts
 * import { Endpoint } from "@beep/runpod"
 *
 * console.log(Endpoint.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Endpoint extends S.Class<Endpoint>($I`Endpoint`)(
  {
    allowedCudaVersions: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of acceptable CUDA versions for the workers on a Serverless endpoint. If not set, any CUDA version is acceptable.",
      }),
    ),
    computeType: S.optionalKey(
      S.Literals(["CPU", "GPU"]).annotateKey({
        description:
          "The type of compute used by workers on a Serverless endpoint.",
      }),
    ),
    createdAt: S.optionalKey(
      S.String.annotateKey({
        description:
          "The UTC timestamp when a Serverless endpoint was created.",
      }),
    ),
    dataCenterIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of Runpod data center IDs where workers on a Serverless endpoint can be located.",
        default: [
          "EU-RO-1",
          "CA-MTL-1",
          "EU-SE-1",
          "US-IL-1",
          "EUR-IS-1",
          "EU-CZ-1",
          "US-TX-3",
          "EUR-IS-2",
          "US-KS-2",
          "US-GA-2",
          "US-WA-1",
          "US-TX-1",
          "CA-MTL-3",
          "EU-NL-1",
          "US-TX-4",
          "US-CA-2",
          "US-NC-1",
          "OC-AU-1",
          "US-DE-1",
          "EUR-IS-3",
          "CA-MTL-2",
          "AP-JP-1",
          "EUR-NO-1",
          "EU-FR-1",
          "US-KS-3",
          "US-GA-1",
        ],
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    executionTimeoutMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of milliseconds an individual request can run on a Serverless endpoint before the worker is stopped and the request is marked as failed.",
      }),
    ),
    gpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The number of GPUs attached to each worker on a Serverless endpoint.",
      }),
    ),
    gpuTypeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of Runpod GPU types which can be attached to a Serverless endpoint.",
      }),
    ),
    id: S.optionalKey(
      S.String.annotateKey({
        description: "A unique string identifying a Serverless endpoint.",
      }),
    ),
    idleTimeout: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The number of seconds a worker on a Serverless endpoint can be running without taking a job before the worker is scaled down.",
      }),
    ),
    instanceIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "For CPU Serverless endpoints, a list of instance IDs that can be attached to a Serverless endpoint.",
      }),
    ),
    minCudaVersion: S.optionalKey(
      S.String.annotateKey({
        description:
          "The minimum acceptable CUDA version for the workers on a Serverless endpoint.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a Serverless endpoint. The name does not need to be unique.",
      }),
    ),
    networkVolumeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the network volume to attach to the Serverless endpoint.",
      }),
    ),
    networkVolumeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of network volume IDs attached to the Serverless endpoint. Allows multiple network volumes to be used with multi-region endpoints.",
      }),
    ),
    scalerType: S.optionalKey(
      S.Literals(["QUEUE_DELAY", "REQUEST_COUNT"]).annotateKey({
        description:
          "The method used to scale up workers on a Serverless endpoint. If QUEUE_DELAY, workers are scaled based on a periodic check to see if any requests have been in queue for too long. If REQUEST_COUNT, the desired number of workers is periodically calculated based on the number of requests in the endpoint's queue. Use QUEUE_DELAY if you need to ensure requests take no longer than a maximum latency, and use REQUEST_COUNT if you need to scale based on the number of requests.",
      }),
    ),
    scalerValue: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the endpoint scalerType is QUEUE_DELAY, the number of seconds a request can remain in queue before a new worker is scaled up. If the endpoint scalerType is REQUEST_COUNT, the number of workers is increased as needed to meet the number of requests in the endpoint's queue divided by scalerValue.",
      }),
    ),
    template: S.optionalKey(Template),
    templateId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the template used to create a Serverless endpoint.",
      }),
    ),
    userId: S.optionalKey(
      S.String.annotateKey({
        description:
          "A unique string identifying the Runpod user who created a Serverless endpoint.",
      }),
    ),
    version: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The latest version of a Serverless endpoint, which is updated whenever the template or environment variables of the endpoint are changed.",
      }),
    ),
    workers: S.optionalKey(
      S.Array(Pod).annotateKey({
        description:
          "Information about current workers on a Serverless endpoint.",
      }),
    ),
    workersMax: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of workers that can be running at the same time on a Serverless endpoint.",
      }),
    ),
    workersMin: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The minimum number of workers that will run at the same time on a Serverless endpoint. This number of workers will always stay running for the endpoint, and will be charged even if no requests are being processed, but they are charged at a lower rate than running autoscaling workers.",
      }),
    ),
  },
  $I.annote("Endpoint", {
    description: "Generated RUNPOD schema for Endpoint.",
    identifier: "Endpoint",
  }),
) {
  static readonly is = S.is(Endpoint);
}

/**
 * Generated RUNPOD class schema for `BillingRecord`.
 *
 * **Example** (Inspect BillingRecord)
 *
 * ```ts
 * import { BillingRecord } from "@beep/runpod"
 *
 * console.log(BillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BillingRecord extends S.Class<BillingRecord>($I`BillingRecord`)(
  {
    amount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for the group for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    diskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space billed for the billing period, in gigabytes (GB). Does not apply to all resource types.",
      }),
    ),
    endpointId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If grouping by endpoint ID, the endpoint ID of the group.",
      }),
    ),
    gpuTypeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If grouping by GPU type ID, the GPU type ID of the group.",
      }),
    ),
    podId: S.optionalKey(
      S.String.annotateKey({
        description: "If grouping by Pod ID, the Pod ID of the group.",
      }),
    ),
    time: S.optionalKey(
      S.String.annotateKey({
        description:
          "The start of the period for which the billing record applies.",
        format: "date-time",
      }),
    ),
    timeBilledMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The total time billed for the billing period, in milliseconds. Does not apply to all resource types.",
      }),
    ),
  },
  $I.annote("BillingRecord", {
    description: "Generated RUNPOD schema for BillingRecord.",
  }),
) {
  static readonly is = S.is(BillingRecord);
}

/**
 * Generated RUNPOD schema for `BillingRecords`.
 *
 * **Example** (Inspect the BillingRecords schema)
 *
 * ```ts
 * import { BillingRecords } from "@beep/runpod"
 *
 * console.log(BillingRecords.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingRecords = S.Array(
  S.Struct({
    amount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for the group for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    diskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space billed for the billing period, in gigabytes (GB). Does not apply to all resource types.",
      }),
    ),
    endpointId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If grouping by endpoint ID, the endpoint ID of the group.",
      }),
    ),
    gpuTypeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If grouping by GPU type ID, the GPU type ID of the group.",
      }),
    ),
    podId: S.optionalKey(
      S.String.annotateKey({
        description: "If grouping by Pod ID, the Pod ID of the group.",
      }),
    ),
    time: S.optionalKey(
      S.String.annotateKey({
        description:
          "The start of the period for which the billing record applies.",
        format: "date-time",
      }),
    ),
    timeBilledMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The total time billed for the billing period, in milliseconds. Does not apply to all resource types.",
      }),
    ),
  }),
).pipe(
  $I.annoteSchema("BillingRecords", {
    description: "Generated RUNPOD schema for BillingRecords.",
  }),
);

/**
 * Type for {@link BillingRecords}.
 *
 * **Example** (Reference the BillingRecords type)
 *
 * ```ts
 * import type { BillingRecords } from "@beep/runpod"
 *
 * type BillingRecordsValue = BillingRecords
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingRecords = typeof BillingRecords.Type;

/**
 * Generated RUNPOD class schema for `ContainerRegistryAuthCreateInput`.
 *
 * **Example** (Inspect ContainerRegistryAuthCreateInput)
 *
 * ```ts
 * import { ContainerRegistryAuthCreateInput } from "@beep/runpod"
 *
 * console.log(ContainerRegistryAuthCreateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ContainerRegistryAuthCreateInput extends S.Class<ContainerRegistryAuthCreateInput>(
  $I`ContainerRegistryAuthCreateInput`,
)(
  {
    name: S.String.annotateKey({
      description:
        "A user-defined name for a container registry authentication. The name must be unique.",
    }),
    password: S.String.annotateKey({
      description: "The password for the container registry.",
    }),
    username: S.String.annotateKey({
      description: "The username for the container registry.",
    }),
  },
  $I.annote("ContainerRegistryAuthCreateInput", {
    description:
      "Generated RUNPOD schema for ContainerRegistryAuthCreateInput.",
  }),
) {
  static readonly is = S.is(ContainerRegistryAuthCreateInput);
}

/**
 * Generated RUNPOD schema for `ContainerRegistryAuths`.
 *
 * **Example** (Inspect the ContainerRegistryAuths schema)
 *
 * ```ts
 * import { ContainerRegistryAuths } from "@beep/runpod"
 *
 * console.log(ContainerRegistryAuths.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContainerRegistryAuths = S.Array(ContainerRegistryAuth).pipe(
  $I.annoteSchema("ContainerRegistryAuths", {
    description: "Generated RUNPOD schema for ContainerRegistryAuths.",
  }),
);

/**
 * Type for {@link ContainerRegistryAuths}.
 *
 * **Example** (Reference the ContainerRegistryAuths type)
 *
 * ```ts
 * import type { ContainerRegistryAuths } from "@beep/runpod"
 *
 * type ContainerRegistryAuthsValue = ContainerRegistryAuths
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContainerRegistryAuths = typeof ContainerRegistryAuths.Type;

/**
 * Generated RUNPOD schema for `CudaVersions`.
 *
 * **Example** (Inspect the CudaVersions schema)
 *
 * ```ts
 * import { CudaVersions } from "@beep/runpod"
 *
 * console.log(CudaVersions.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CudaVersions = S.String.pipe(
  $I.annoteSchema("CudaVersions", {
    description: "Generated RUNPOD schema for CudaVersions.",
  }),
);

/**
 * Type for {@link CudaVersions}.
 *
 * **Example** (Reference the CudaVersions type)
 *
 * ```ts
 * import type { CudaVersions } from "@beep/runpod"
 *
 * type CudaVersionsValue = CudaVersions
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CudaVersions = typeof CudaVersions.Type;

/**
 * Generated RUNPOD class schema for `DataCenter`.
 *
 * **Example** (Inspect DataCenter)
 *
 * ```ts
 * import { DataCenter } from "@beep/runpod"
 *
 * console.log(DataCenter.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DataCenter extends S.Class<DataCenter>($I`DataCenter`)(
  { id: S.optionalKey(S.String) },
  $I.annote("DataCenter", {
    description: "Generated RUNPOD schema for DataCenter.",
  }),
) {
  static readonly is = S.is(DataCenter);
}

/**
 * Generated RUNPOD class schema for `EndpointCreateInput`.
 *
 * **Example** (Inspect EndpointCreateInput)
 *
 * ```ts
 * import { EndpointCreateInput } from "@beep/runpod"
 *
 * console.log(EndpointCreateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EndpointCreateInput extends S.Class<EndpointCreateInput>(
  $I`EndpointCreateInput`,
)(
  {
    allowedCudaVersions: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, a list of acceptable CUDA versions on the created workers. If not set, any CUDA version is acceptable.",
      }),
    ),
    computeType: S.optionalKey(
      S.Literals(["GPU", "CPU"]).annotateKey({
        description:
          "Set to GPU to create a Serverless endpoint with GPU workers. Set to CPU to create a Serverless endpoint with CPU workers. If set to CPU, properties related to GPUs such as gpuTypeIds will be ignored. If set to GPU, properties related to CPUs such as cpuFlavorIds will be ignored.",
        default: "GPU",
      }),
    ),
    cpuFlavorIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a CPU endpoint, a list of Runpod CPU flavors which can be attached to the created workers. The order of the list determines the order to rent CPU flavors.",
      }),
    ),
    dataCenterIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of Runpod data center IDs where workers on the created Serverless endpoint can be located.",
        default: [
          "EU-RO-1",
          "CA-MTL-1",
          "EU-SE-1",
          "US-IL-1",
          "EUR-IS-1",
          "EU-CZ-1",
          "US-TX-3",
          "EUR-IS-2",
          "US-KS-2",
          "US-GA-2",
          "US-WA-1",
          "US-TX-1",
          "CA-MTL-3",
          "EU-NL-1",
          "US-TX-4",
          "US-CA-2",
          "US-NC-1",
          "OC-AU-1",
          "US-DE-1",
          "EUR-IS-3",
          "CA-MTL-2",
          "AP-JP-1",
          "EUR-NO-1",
          "EU-FR-1",
          "US-KS-3",
          "US-GA-1",
        ],
      }),
    ),
    executionTimeoutMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of milliseconds an individual request can run on a Serverless endpoint before the worker is stopped and the request is marked as failed.",
      }),
    ),
    flashboot: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Whether to use flash boot for the created Serverless endpoint.",
      }),
    ),
    gpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, the number of GPUs attached to each worker on the endpoint.",
        default: 1,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    gpuTypeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, a list of Runpod GPU types which can be attached to the created workers. The order of the list determines the order to rent GPU types.",
      }),
    ),
    idleTimeout: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The number of seconds a worker on the created Serverless endpoint can run without taking a job before the worker is scaled down.",
        default: 5,
      })
        .check(
          S.isGreaterThanOrEqualTo(1).annotate({
            expected: "a value greater than or equal to 1",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(3600).annotate({
            expected: "a value less than or equal to 3600",
          }),
        ),
    ),
    minCudaVersion: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, the minimum acceptable CUDA version on the created workers.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Serverless endpoint. The name does not need to be unique.",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
    networkVolumeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the network volume to attach to the created Serverless endpoint.",
      }),
    ),
    networkVolumeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of network volume IDs to attach to the created Serverless endpoint. Allows multiple network volumes to be used with multi-region endpoints.",
      }),
    ),
    scalerType: S.optionalKey(
      S.Literals(["QUEUE_DELAY", "REQUEST_COUNT"]).annotateKey({
        description:
          "The method used to scale up workers on the created Serverless endpoint. If QUEUE_DELAY, workers are scaled based on a periodic check to see if any requests have been in queue for too long. If REQUEST_COUNT, the desired number of workers is periodically calculated based on the number of requests in the endpoint's queue. Use QUEUE_DELAY if you need to ensure requests take no longer than a maximum latency, and use REQUEST_COUNT if you need to scale based on the number of requests.",
        default: "QUEUE_DELAY",
      }),
    ),
    scalerValue: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the endpoint scalerType is QUEUE_DELAY, the number of seconds a request can remain in queue before a new worker is scaled up. If the endpoint scalerType is REQUEST_COUNT, the number of workers is increased as needed to meet the number of requests in the endpoint's queue divided by scalerValue.",
        default: 4,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    templateId: S.String.annotateKey({
      description:
        "The unique string identifying the template used to create the Serverless endpoint.",
    }),
    vcpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Serverless endpoint is a CPU endpoint, the number of vCPUs allocated to each created worker.",
        default: 2,
      }),
    ),
    workersMax: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of workers that can be running at the same time on a Serverless endpoint.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
    workersMin: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The minimum number of workers that will run at the same time on a Serverless endpoint. This number of workers will always stay running for the endpoint, and will be charged even if no requests are being processed, but they are charged at a lower rate than running autoscaling workers.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
  },
  $I.annote("EndpointCreateInput", {
    description: "Generated RUNPOD schema for EndpointCreateInput.",
  }),
) {
  static readonly is = S.is(EndpointCreateInput);
}

/**
 * Generated RUNPOD class schema for `EndpointUpdateInPlaceInput`.
 *
 * **Example** (Inspect EndpointUpdateInPlaceInput)
 *
 * ```ts
 * import { EndpointUpdateInPlaceInput } from "@beep/runpod"
 *
 * console.log(EndpointUpdateInPlaceInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EndpointUpdateInPlaceInput extends S.Class<EndpointUpdateInPlaceInput>(
  $I`EndpointUpdateInPlaceInput`,
)(
  {
    executionTimeoutMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of milliseconds an individual request can run on a Serverless endpoint before the worker is stopped and the request is marked as failed.",
      }),
    ),
    flashboot: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Whether to use flash boot for the created Serverless endpoint.",
      }),
    ),
    idleTimeout: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The number of seconds a worker on the created Serverless endpoint can run without taking a job before the worker is scaled down.",
        default: 5,
      })
        .check(
          S.isGreaterThanOrEqualTo(1).annotate({
            expected: "a value greater than or equal to 1",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(3600).annotate({
            expected: "a value less than or equal to 3600",
          }),
        ),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a Serverless endpoint. The name does not need to be unique.",
      }),
    ),
    scalerType: S.optionalKey(
      S.Literals(["QUEUE_DELAY", "REQUEST_COUNT"]).annotateKey({
        description:
          "The method used to scale up workers on the created Serverless endpoint. If QUEUE_DELAY, workers are scaled based on a periodic check to see if any requests have been in queue for too long. If REQUEST_COUNT, the desired number of workers is periodically calculated based on the number of requests in the endpoint's queue. Use QUEUE_DELAY if you need to ensure requests take no longer than a maximum latency, and use REQUEST_COUNT if you need to scale based on the number of requests.",
        default: "QUEUE_DELAY",
      }),
    ),
    scalerValue: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the endpoint scalerType is QUEUE_DELAY, the number of seconds a request can remain in queue before a new worker is scaled up. If the endpoint scalerType is REQUEST_COUNT, the number of workers is increased as needed to meet the number of requests in the endpoint's queue divided by scalerValue.",
        default: 4,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    workersMax: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of workers that can be running at the same time on a Serverless endpoint.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
    workersMin: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The minimum number of workers that will run at the same time on a Serverless endpoint. This number of workers will always stay running for the endpoint, and will be charged even if no requests are being processed, but they are charged at a lower rate than running autoscaling workers.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
  },
  $I.annote("EndpointUpdateInPlaceInput", {
    description: "Generated RUNPOD schema for EndpointUpdateInPlaceInput.",
  }),
) {
  static readonly is = S.is(EndpointUpdateInPlaceInput);
}

/**
 * Generated RUNPOD class schema for `EndpointUpdateInput`.
 *
 * **Example** (Inspect EndpointUpdateInput)
 *
 * ```ts
 * import { EndpointUpdateInput } from "@beep/runpod"
 *
 * console.log(EndpointUpdateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EndpointUpdateInput extends S.Class<EndpointUpdateInput>(
  $I`EndpointUpdateInput`,
)(
  {
    allowedCudaVersions: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, a list of acceptable CUDA versions on the created workers. If not set, any CUDA version is acceptable.",
      }),
    ),
    cpuFlavorIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a CPU endpoint, a list of Runpod CPU flavors which can be attached to the created workers. The order of the list determines the order to rent CPU flavors.",
      }),
    ),
    dataCenterIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of Runpod data center IDs where workers on the created Serverless endpoint can be located.",
        default: [
          "EU-RO-1",
          "CA-MTL-1",
          "EU-SE-1",
          "US-IL-1",
          "EUR-IS-1",
          "EU-CZ-1",
          "US-TX-3",
          "EUR-IS-2",
          "US-KS-2",
          "US-GA-2",
          "US-WA-1",
          "US-TX-1",
          "CA-MTL-3",
          "EU-NL-1",
          "US-TX-4",
          "US-CA-2",
          "US-NC-1",
          "OC-AU-1",
          "US-DE-1",
          "EUR-IS-3",
          "CA-MTL-2",
          "AP-JP-1",
          "EUR-NO-1",
          "EU-FR-1",
          "US-KS-3",
          "US-GA-1",
        ],
      }),
    ),
    executionTimeoutMs: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of milliseconds an individual request can run on a Serverless endpoint before the worker is stopped and the request is marked as failed.",
      }),
    ),
    flashboot: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Whether to use flash boot for the created Serverless endpoint.",
      }),
    ),
    gpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, the number of GPUs attached to each worker on the endpoint.",
        default: 1,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    gpuTypeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, a list of Runpod GPU types which can be attached to the created workers. The order of the list determines the order to rent GPU types.",
      }),
    ),
    idleTimeout: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The number of seconds a worker on the created Serverless endpoint can run without taking a job before the worker is scaled down.",
        default: 5,
      })
        .check(
          S.isGreaterThanOrEqualTo(1).annotate({
            expected: "a value greater than or equal to 1",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(3600).annotate({
            expected: "a value less than or equal to 3600",
          }),
        ),
    ),
    minCudaVersion: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the created Serverless endpoint is a GPU endpoint, the minimum acceptable CUDA version on the created workers.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Serverless endpoint. The name does not need to be unique.",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
    networkVolumeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the network volume to attach to the created Serverless endpoint.",
      }),
    ),
    networkVolumeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of network volume IDs to attach to the created Serverless endpoint. Allows multiple network volumes to be used with multi-region endpoints.",
      }),
    ),
    scalerType: S.optionalKey(
      S.Literals(["QUEUE_DELAY", "REQUEST_COUNT"]).annotateKey({
        description:
          "The method used to scale up workers on the created Serverless endpoint. If QUEUE_DELAY, workers are scaled based on a periodic check to see if any requests have been in queue for too long. If REQUEST_COUNT, the desired number of workers is periodically calculated based on the number of requests in the endpoint's queue. Use QUEUE_DELAY if you need to ensure requests take no longer than a maximum latency, and use REQUEST_COUNT if you need to scale based on the number of requests.",
        default: "QUEUE_DELAY",
      }),
    ),
    scalerValue: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the endpoint scalerType is QUEUE_DELAY, the number of seconds a request can remain in queue before a new worker is scaled up. If the endpoint scalerType is REQUEST_COUNT, the number of workers is increased as needed to meet the number of requests in the endpoint's queue divided by scalerValue.",
        default: 4,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    templateId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the template used to create the Serverless endpoint.",
      }),
    ),
    vcpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Serverless endpoint is a CPU endpoint, the number of vCPUs allocated to each created worker.",
        default: 2,
      }),
    ),
    workersMax: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The maximum number of workers that can be running at the same time on a Serverless endpoint.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
    workersMin: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The minimum number of workers that will run at the same time on a Serverless endpoint. This number of workers will always stay running for the endpoint, and will be charged even if no requests are being processed, but they are charged at a lower rate than running autoscaling workers.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
    ),
  },
  $I.annote("EndpointUpdateInput", {
    description: "Generated RUNPOD schema for EndpointUpdateInput.",
    documentation:
      "Input for updating an endpoint which will trigger a rolling release on the endpoint.",
  }),
) {
  static readonly is = S.is(EndpointUpdateInput);
}

/**
 * Generated RUNPOD schema for `Endpoints`.
 *
 * **Example** (Inspect the Endpoints schema)
 *
 * ```ts
 * import { Endpoints } from "@beep/runpod"
 *
 * console.log(Endpoints.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Endpoints = S.Array(Endpoint).pipe(
  $I.annoteSchema("Endpoints", {
    description: "Generated RUNPOD schema for Endpoints.",
  }),
);

/**
 * Type for {@link Endpoints}.
 *
 * **Example** (Reference the Endpoints type)
 *
 * ```ts
 * import type { Endpoints } from "@beep/runpod"
 *
 * type EndpointsValue = Endpoints
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Endpoints = typeof Endpoints.Type;

/**
 * Generated RUNPOD schema for `GPUTypeId`.
 *
 * **Example** (Inspect the GPUTypeId schema)
 *
 * ```ts
 * import { GPUTypeId } from "@beep/runpod"
 *
 * console.log(GPUTypeId.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GPUTypeId = S.String.pipe(
  $I.annoteSchema("GPUTypeId", {
    description: "Generated RUNPOD schema for GPUTypeId.",
  }),
);

/**
 * Type for {@link GPUTypeId}.
 *
 * **Example** (Reference the GPUTypeId type)
 *
 * ```ts
 * import type { GPUTypeId } from "@beep/runpod"
 *
 * type GPUTypeIdValue = GPUTypeId
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GPUTypeId = typeof GPUTypeId.Type;

/**
 * Generated RUNPOD class schema for `Machine`.
 *
 * **Example** (Inspect Machine)
 *
 * ```ts
 * import { Machine } from "@beep/runpod"
 *
 * console.log(Machine.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Machine extends S.Class<Machine>($I`Machine`)(
  {
    costPerHr: S.optionalKey(
      S.Finite.check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    cpuCount: S.optionalKey(S.Int),
    cpuType: S.optionalKey(
      S.Struct({
        id: S.optionalKey(S.String),
        displayName: S.optionalKey(S.String),
        cores: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        threadsPerCore: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        groupId: S.optionalKey(S.String),
      }),
    ),
    cpuTypeId: S.optionalKey(S.String),
    currentPricePerGpu: S.optionalKey(
      S.Finite.check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    dataCenterId: S.optionalKey(S.String),
    diskThroughputMBps: S.optionalKey(S.Int),
    gpuAvailable: S.optionalKey(S.Int),
    gpuDisplayName: S.optionalKey(S.String),
    gpuType: S.optionalKey(
      S.Struct({
        id: S.optionalKey(S.String),
        count: S.optionalKey(
          S.Int.annotateKey({
            description: "The number of GPUs attached to a Pod.",
          }),
        ),
        displayName: S.optionalKey(S.String),
        securePrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        communityPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        oneMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        threeMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        sixMonthPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        oneWeekPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        communitySpotPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
        secureSpotPrice: S.optionalKey(
          S.Finite.check(
            S.isFinite().annotate({ expected: "a finite number" }),
          ),
        ),
      }),
    ),
    gpuTypeId: S.optionalKey(S.String),
    location: S.optionalKey(S.String),
    maintenanceEnd: S.optionalKey(S.String),
    maintenanceNote: S.optionalKey(S.String),
    maintenanceStart: S.optionalKey(S.String),
    maxDownloadSpeedMbps: S.optionalKey(S.Int),
    maxUploadSpeedMbps: S.optionalKey(S.Int),
    minPodGpuCount: S.optionalKey(S.Int),
    note: S.optionalKey(S.String),
    secureCloud: S.optionalKey(S.Boolean),
    supportPublicIp: S.optionalKey(S.Boolean),
  },
  $I.annote("Machine", {
    description: "Generated RUNPOD schema for Machine.",
  }),
) {
  static readonly is = S.is(Machine);
}

/**
 * Generated RUNPOD class schema for `NetworkVolume`.
 *
 * **Example** (Inspect NetworkVolume)
 *
 * ```ts
 * import { NetworkVolume } from "@beep/runpod"
 *
 * console.log(NetworkVolume.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NetworkVolume extends S.Class<NetworkVolume>($I`NetworkVolume`)(
  {
    dataCenterId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The Runpod data center ID where a network volume is located.",
      }),
    ),
    id: S.optionalKey(
      S.String.annotateKey({
        description: "A unique string identifying a network volume.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a network volume. The name does not need to be unique.",
      }),
    ),
    size: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), allocated to a network volume.",
      }),
    ),
  },
  $I.annote("NetworkVolume", {
    description: "Generated RUNPOD schema for NetworkVolume.",
  }),
) {
  static readonly is = S.is(NetworkVolume);
}

/**
 * Generated RUNPOD class schema for `NetworkVolumeBillingRecord`.
 *
 * **Example** (Inspect NetworkVolumeBillingRecord)
 *
 * ```ts
 * import { NetworkVolumeBillingRecord } from "@beep/runpod"
 *
 * console.log(NetworkVolumeBillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NetworkVolumeBillingRecord extends S.Class<NetworkVolumeBillingRecord>(
  $I`NetworkVolumeBillingRecord`,
)(
  {
    amount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for the group for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    diskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space billed for the billing period, in gigabytes (GB). Does not apply to all resource types.",
      }),
    ),
    highPerformanceStorageAmount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for high performance storage for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    highPerformanceStorageDiskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of high performance storage disk space billed for the billing period, in gigabytes (GB).",
      }),
    ),
    time: S.optionalKey(
      S.String.annotateKey({
        description:
          "The start of the period for which the billing record applies.",
        format: "date-time",
      }),
    ),
  },
  $I.annote("NetworkVolumeBillingRecord", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingRecord.",
  }),
) {
  static readonly is = S.is(NetworkVolumeBillingRecord);
}

/**
 * Generated RUNPOD schema for `NetworkVolumeBillingRecords`.
 *
 * **Example** (Inspect the NetworkVolumeBillingRecords schema)
 *
 * ```ts
 * import { NetworkVolumeBillingRecords } from "@beep/runpod"
 *
 * console.log(NetworkVolumeBillingRecords.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkVolumeBillingRecords = S.Array(
  S.Struct({
    amount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for the group for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    diskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space billed for the billing period, in gigabytes (GB). Does not apply to all resource types.",
      }),
    ),
    highPerformanceStorageAmount: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The amount charged for high performance storage for the billing period, in USD.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    highPerformanceStorageDiskSpaceBilledGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of high performance storage disk space billed for the billing period, in gigabytes (GB).",
      }),
    ),
    time: S.optionalKey(
      S.String.annotateKey({
        description:
          "The start of the period for which the billing record applies.",
        format: "date-time",
      }),
    ),
  }),
).pipe(
  $I.annoteSchema("NetworkVolumeBillingRecords", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingRecords.",
  }),
);

/**
 * Type for {@link NetworkVolumeBillingRecords}.
 *
 * **Example** (Reference the NetworkVolumeBillingRecords type)
 *
 * ```ts
 * import type { NetworkVolumeBillingRecords } from "@beep/runpod"
 *
 * type NetworkVolumeBillingRecordsValue = NetworkVolumeBillingRecords
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumeBillingRecords =
  typeof NetworkVolumeBillingRecords.Type;

/**
 * Generated RUNPOD class schema for `NetworkVolumeCreateInput`.
 *
 * **Example** (Inspect NetworkVolumeCreateInput)
 *
 * ```ts
 * import { NetworkVolumeCreateInput } from "@beep/runpod"
 *
 * console.log(NetworkVolumeCreateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NetworkVolumeCreateInput extends S.Class<NetworkVolumeCreateInput>(
  $I`NetworkVolumeCreateInput`,
)(
  {
    dataCenterId: S.String.annotateKey({
      description:
        "The Runpod data center ID where the created network volume is located.",
    }),
    name: S.String.annotateKey({
      description:
        "A user-defined name for the created network volume. The name does not need to be unique.",
    }),
    size: S.Int.annotateKey({
      description:
        "The amount of disk space, in gigabytes (GB), allocated to the created network volume.",
    })
      .check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(4000).annotate({
          expected: "a value less than or equal to 4000",
        }),
      ),
  },
  $I.annote("NetworkVolumeCreateInput", {
    description: "Generated RUNPOD schema for NetworkVolumeCreateInput.",
  }),
) {
  static readonly is = S.is(NetworkVolumeCreateInput);
}

/**
 * Generated RUNPOD class schema for `NetworkVolumeUpdateInput`.
 *
 * **Example** (Inspect NetworkVolumeUpdateInput)
 *
 * ```ts
 * import { NetworkVolumeUpdateInput } from "@beep/runpod"
 *
 * console.log(NetworkVolumeUpdateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NetworkVolumeUpdateInput extends S.Class<NetworkVolumeUpdateInput>(
  $I`NetworkVolumeUpdateInput`,
)(
  {
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the network volume. The name does not need to be unique.",
      }),
    ),
    size: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), which will be allocated to the network volume after the update. Must be greater than the current size of the network volume.",
      })
        .check(
          S.isGreaterThanOrEqualTo(0).annotate({
            expected: "a value greater than or equal to 0",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(4000).annotate({
            expected: "a value less than or equal to 4000",
          }),
        ),
    ),
  },
  $I.annote("NetworkVolumeUpdateInput", {
    description: "Generated RUNPOD schema for NetworkVolumeUpdateInput.",
  }),
) {
  static readonly is = S.is(NetworkVolumeUpdateInput);
}

/**
 * Generated RUNPOD schema for `NetworkVolumes`.
 *
 * **Example** (Inspect the NetworkVolumes schema)
 *
 * ```ts
 * import { NetworkVolumes } from "@beep/runpod"
 *
 * console.log(NetworkVolumes.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkVolumes = S.Array(
  S.Struct({
    id: S.optionalKey(
      S.String.annotateKey({
        description: "A unique string identifying a network volume.",
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for a network volume. The name does not need to be unique.",
      }),
    ),
    size: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), allocated to a network volume.",
      }),
    ),
    dataCenterId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The Runpod data center ID where a network volume is located.",
      }),
    ),
  }),
).pipe(
  $I.annoteSchema("NetworkVolumes", {
    description: "Generated RUNPOD schema for NetworkVolumes.",
  }),
);

/**
 * Type for {@link NetworkVolumes}.
 *
 * **Example** (Reference the NetworkVolumes type)
 *
 * ```ts
 * import type { NetworkVolumes } from "@beep/runpod"
 *
 * type NetworkVolumesValue = NetworkVolumes
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumes = typeof NetworkVolumes.Type;

/**
 * Generated RUNPOD class schema for `PodCreateInput`.
 *
 * **Example** (Inspect PodCreateInput)
 *
 * ```ts
 * import { PodCreateInput } from "@beep/runpod"
 *
 * console.log(PodCreateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PodCreateInput extends S.Class<PodCreateInput>($I`PodCreateInput`)(
  {
    allowedCudaVersions: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Pod is a GPU Pod, a list of acceptable CUDA versions on the [Pod](#/components/schemas/Pod). If not set, any CUDA version is acceptable.",
      }),
    ),
    cloudType: S.optionalKey(
      S.Literals(["SECURE", "COMMUNITY"]).annotateKey({
        description:
          "Set to SECURE to create the Pod in Secure Cloud. Set to COMMUNITY to create the Pod in Community Cloud. To determine which one suits your needs, see https://docs.runpod.io/pods/overview#pod-types.",
        default: "SECURE",
      }),
    ),
    computeType: S.optionalKey(
      S.Literals(["GPU", "CPU"]).annotateKey({
        description:
          "Set to GPU to create a GPU Pod. Set to CPU to create a CPU Pod. If set to CPU, the Pod will not have a GPU attached and properties related to GPUs such as gpuTypeIds will be ignored. If set to GPU, the Pod will have a GPU attached and properties related to CPUs such as cpuFlavorIds will be ignored.",
        default: "GPU",
      }),
    ),
    containerDiskInGb: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the container disk for the created Pod. The data on the container disk is wiped when the Pod restarts. To persist data across Pod restarts, set volumeInGb to configure the Pod network volume.",
        default: 50,
      }),
    ),
    containerRegistryAuthId: S.optionalKey(
      S.String.annotateKey({ description: "Registry credentials ID." }),
    ),
    countryCodes: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of country codes where the created Pod can be located. If not set, the Pod can be located in any country.",
      }),
    ),
    cpuFlavorIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Pod is a CPU Pod, a list of Runpod CPU flavors which can be attached to the Pod. The order of the list determines the order to rent CPU flavors. See cpuFlavorPriority for how the order of the list affects Pod creation.",
      }),
    ),
    cpuFlavorPriority: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the created Pod is a CPU Pod, set to availability to respond to current CPU flavor availability. Set to custom to always try to rent CPU flavors in the order specified in cpuFlavorIds.",
        default: "availability",
      }),
    ),
    dataCenterIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of Runpod data center IDs where the created Pod can be located. See `dataCenterPriority` for information on how the order of the list affects Pod creation.",
        default: [
          "EU-RO-1",
          "CA-MTL-1",
          "EU-SE-1",
          "US-IL-1",
          "EUR-IS-1",
          "EU-CZ-1",
          "US-TX-3",
          "EUR-IS-2",
          "US-KS-2",
          "US-GA-2",
          "US-WA-1",
          "US-TX-1",
          "CA-MTL-3",
          "EU-NL-1",
          "US-TX-4",
          "US-CA-2",
          "US-NC-1",
          "OC-AU-1",
          "US-DE-1",
          "EUR-IS-3",
          "CA-MTL-2",
          "AP-JP-1",
          "EUR-NO-1",
          "EU-FR-1",
          "US-KS-3",
          "US-GA-1",
        ],
      }),
    ),
    dataCenterPriority: S.optionalKey(
      S.String.annotateKey({
        description:
          "Set to availability to respond to current machine availability. Set to custom to always try to rent machines from data centers in the order specified in dataCenterIds.",
        default: "availability",
      }),
    ),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on the created Pod. If [], uses the ENTRYPOINT defined in the image.",
        default: [],
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on the created Pod. If [], uses the start CMD defined in the image.",
        default: [],
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    globalNetworking: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to enable global networking for the created Pod. Currently only available for On-Demand GPU Pods on some Secure Cloud data centers.",
        default: false,
      }),
    ),
    gpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Pod is a GPU Pod, the number of GPUs attached to the created Pod.",
        default: 1,
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    gpuTypeIds: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If the created Pod is a GPU Pod, a list of Runpod GPU types which can be attached to the created Pod. The order of the list determines the order to rent GPU types. See `gpuTypePriority` for information on how the order of the list affects Pod creation.",
      }),
    ),
    gpuTypePriority: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the created Pod is a GPU Pod, set to availability to respond to current GPU type availability. Set to custom to always try to rent GPU types in the order specified in gpuTypeIds.",
        default: "availability",
      }),
    ),
    imageName: S.optionalKey(
      S.String.annotateKey({
        description: "The image tag for the container run on the created Pod.",
      }),
    ),
    interruptible: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to create an interruptible or spot Pod. An interruptible Pod can be rented at a lower cost but can be stopped at any time to free up resources for another Pod. A reserved Pod is rented at a higher cost but runs until it exits or is manually stopped.",
        default: false,
      }),
    ),
    locked: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to lock a Pod. Locking a Pod disables stopping or resetting the Pod.",
        default: false,
      }),
    ),
    minDiskBandwidthMBps: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The minimum disk bandwidth, in megabytes per second (MBps), for the created Pod.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    minDownloadMbps: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The minimum download speed, in megabits per second (Mbps), for the created Pod.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    minRAMPerGPU: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Pod is a GPU Pod, the minimum amount of RAM, in gigabytes (GB), allocated to the created Pod for each GPU attached to the Pod.",
        default: 8,
      }),
    ),
    minUploadMbps: S.optionalKey(
      S.Finite.annotateKey({
        description:
          "The minimum upload speed, in megabits per second (Mbps), for the created Pod.",
      }).check(S.isFinite().annotate({ expected: "a finite number" })),
    ),
    minVCPUPerGPU: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Pod is a GPU Pod, the minimum number of virtual CPUs allocated to the created Pod for each GPU attached to the Pod.",
        default: 2,
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Pod. The name does not need to be unique.",
        default: "my pod",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
    networkVolumeId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string identifying the network volume to attach to the created Pod. If attached, a network volume replaces the Pod network volume.",
      }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on the created Pod. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    supportPublicIp: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If the created Pod is on Community Cloud, set to true if you need the Pod to expose a public IP address. If null, the Pod might not have a public IP address. On Secure Cloud, the Pod will always have a public IP address.",
      }),
    ),
    templateId: S.optionalKey(
      S.String.annotateKey({
        description:
          "If the Pod is created with a template, the unique string identifying that template.",
      }),
    ),
    vcpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "If the created Pod is a CPU Pod, the number of vCPUs allocated to the Pod.",
        default: 2,
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pod volume for the created Pod. The data on the Pod volume is persisted across Pod restarts. To persist data so that future Pods can access it, create a network volume and set networkVolumeId to attach it to the Pod.",
        default: 20,
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If either a Pod volume or a network volume is attached to a Pod, the absolute path where the network volume will be mounted in the filesystem.",
        default: "/workspace",
      }),
    ),
  },
  $I.annote("PodCreateInput", {
    description: "Generated RUNPOD schema for PodCreateInput.",
  }),
) {
  static readonly is = S.is(PodCreateInput);
}

/**
 * Generated RUNPOD class schema for `PodUpdateInPlaceInput`.
 *
 * **Example** (Inspect PodUpdateInPlaceInput)
 *
 * ```ts
 * import { PodUpdateInPlaceInput } from "@beep/runpod"
 *
 * console.log(PodUpdateInPlaceInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PodUpdateInPlaceInput extends S.Class<PodUpdateInPlaceInput>(
  $I`PodUpdateInPlaceInput`,
)(
  {
    locked: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to lock a Pod. Locking a Pod disables stopping or resetting the Pod.",
        default: false,
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Pod. The name does not need to be unique.",
        default: "my pod",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
  },
  $I.annote("PodUpdateInPlaceInput", {
    description: "Generated RUNPOD schema for PodUpdateInPlaceInput.",
  }),
) {
  static readonly is = S.is(PodUpdateInPlaceInput);
}

/**
 * Generated RUNPOD class schema for `PodUpdateInput`.
 *
 * **Example** (Inspect PodUpdateInput)
 *
 * ```ts
 * import { PodUpdateInput } from "@beep/runpod"
 *
 * console.log(PodUpdateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PodUpdateInput extends S.Class<PodUpdateInput>($I`PodUpdateInput`)(
  {
    containerDiskInGb: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the container disk for the created Pod. The data on the container disk is wiped when the Pod restarts. To persist data across Pod restarts, set volumeInGb to configure the Pod network volume.",
        default: 50,
      }),
    ),
    containerRegistryAuthId: S.optionalKey(
      S.String.annotateKey({ description: "Registry credentials ID." }),
    ),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on the created Pod. If [], uses the ENTRYPOINT defined in the image.",
        default: [],
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on the created Pod. If [], uses the start CMD defined in the image.",
        default: [],
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    globalNetworking: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to enable global networking for the created Pod. Currently only available for On-Demand GPU Pods on some Secure Cloud data centers.",
        default: false,
      }),
    ),
    imageName: S.optionalKey(
      S.String.annotateKey({
        description: "The image tag for the container run on the created Pod.",
      }),
    ),
    locked: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Set to true to lock a Pod. Locking a Pod disables stopping or resetting the Pod.",
        default: false,
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({
        description:
          "A user-defined name for the created Pod. The name does not need to be unique.",
        default: "my pod",
      }).check(
        S.isMaxLength(191).annotate({
          expected: "a value with a length of at most 191",
        }),
      ),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on the created Pod. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pod volume for the created Pod. The data on the Pod volume is persisted across Pod restarts. To persist data so that future Pods can access it, create a network volume and set networkVolumeId to attach it to the Pod.",
        default: 20,
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If either a Pod volume or a network volume is attached to a Pod, the absolute path where the network volume will be mounted in the filesystem.",
        default: "/workspace",
      }),
    ),
  },
  $I.annote("PodUpdateInput", {
    description: "Generated RUNPOD schema for PodUpdateInput.",
    documentation: "Input for updating a Pod which will trigger a reset.",
  }),
) {
  static readonly is = S.is(PodUpdateInput);
}

/**
 * Generated RUNPOD schema for `Pods`.
 *
 * **Example** (Inspect the Pods schema)
 *
 * ```ts
 * import { Pods } from "@beep/runpod"
 *
 * console.log(Pods.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Pods = S.Array(Pod).pipe(
  $I.annoteSchema("Pods", {
    description: "Generated RUNPOD schema for Pods.",
  }),
);

/**
 * Type for {@link Pods}.
 *
 * **Example** (Reference the Pods type)
 *
 * ```ts
 * import type { Pods } from "@beep/runpod"
 *
 * type PodsValue = Pods
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Pods = typeof Pods.Type;

/**
 * Generated RUNPOD class schema for `TemplateCreateInput`.
 *
 * **Example** (Inspect TemplateCreateInput)
 *
 * ```ts
 * import { TemplateCreateInput } from "@beep/runpod"
 *
 * console.log(TemplateCreateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TemplateCreateInput extends S.Class<TemplateCreateInput>(
  $I`TemplateCreateInput`,
)(
  {
    category: S.optionalKey(
      S.Literals(["NVIDIA", "AMD", "CPU"]).annotateKey({
        description:
          "The compute category of the resource defined by this template.",
        default: "NVIDIA",
      }),
    ),
    containerDiskInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space in GB to allocate for the container.",
        default: 50,
      }),
    ),
    containerRegistryAuthId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string representing the container auth object needed for a private image.",
      }),
    ),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on the Pods using this template. If [], uses the ENTRYPOINT defined in the DockerFile.",
        default: [],
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on the Pods using this template. If [], uses the start CMD defined in the DockerFile.",
        default: [],
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    imageName: S.String.annotateKey({ description: "Docker image name." }),
    isPublic: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If this is a Pod template, specifies whether the template is visible to other Runpod users.",
        default: false,
      }),
    ),
    isServerless: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "Whether the template specifies a Serverless worker or a Pod.",
        default: false,
      }),
    ),
    name: S.String.annotateKey({ description: "Template name." }),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on the created Pod. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    readme: S.optionalKey(
      S.String.annotateKey({
        description: "README content in markdown format.",
        default: "",
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pods deployed with this template.",
        default: 20,
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a volume is attached to a Pod deployed with this template, the absolute path where the volume will be mounted in the filesystem.",
        default: "/workspace",
      }),
    ),
  },
  $I.annote("TemplateCreateInput", {
    description: "Generated RUNPOD schema for TemplateCreateInput.",
  }),
) {
  static readonly is = S.is(TemplateCreateInput);
}

/**
 * Generated RUNPOD class schema for `TemplateUpdateInPlaceInput`.
 *
 * **Example** (Inspect TemplateUpdateInPlaceInput)
 *
 * ```ts
 * import { TemplateUpdateInPlaceInput } from "@beep/runpod"
 *
 * console.log(TemplateUpdateInPlaceInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TemplateUpdateInPlaceInput extends S.Class<TemplateUpdateInPlaceInput>(
  $I`TemplateUpdateInPlaceInput`,
)(
  {
    isPublic: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If this is a Pod template, specifies whether the template is visible to other Runpod users.",
        default: false,
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({ description: "Template name." }),
    ),
    readme: S.optionalKey(
      S.String.annotateKey({
        description: "README content in markdown format.",
        default: "",
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pods deployed with this template.",
        default: 20,
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a volume is attached to a Pod deployed with this template, the absolute path where the volume will be mounted in the filesystem.",
        default: "/workspace",
      }),
    ),
  },
  $I.annote("TemplateUpdateInPlaceInput", {
    description: "Generated RUNPOD schema for TemplateUpdateInPlaceInput.",
  }),
) {
  static readonly is = S.is(TemplateUpdateInPlaceInput);
}

/**
 * Generated RUNPOD class schema for `TemplateUpdateInput`.
 *
 * **Example** (Inspect TemplateUpdateInput)
 *
 * ```ts
 * import { TemplateUpdateInput } from "@beep/runpod"
 *
 * console.log(TemplateUpdateInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TemplateUpdateInput extends S.Class<TemplateUpdateInput>(
  $I`TemplateUpdateInput`,
)(
  {
    containerDiskInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space in GB to allocate for the container.",
        default: 50,
      }),
    ),
    containerRegistryAuthId: S.optionalKey(
      S.String.annotateKey({
        description:
          "The unique string representing the container auth object needed for a private image.",
      }),
    ),
    dockerEntrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the ENTRYPOINT for the Docker image run on the Pods using this template. If [], uses the ENTRYPOINT defined in the DockerFile.",
        default: [],
      }),
    ),
    dockerStartCmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "If specified, overrides the start CMD for the Docker image run on the Pods using this template. If [], uses the start CMD defined in the DockerFile.",
        default: [],
      }),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({ default: {} }),
    ),
    imageName: S.optionalKey(
      S.String.annotateKey({ description: "Docker image name." }),
    ),
    isPublic: S.optionalKey(
      S.Boolean.annotateKey({
        description:
          "If this is a Pod template, specifies whether the template is visible to other Runpod users.",
        default: false,
      }),
    ),
    name: S.optionalKey(
      S.String.annotateKey({ description: "Template name." }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "A list of ports exposed on the created Pod. Each port is formatted as [port number]/[protocol]. Protocol can be either http or tcp.",
      }),
    ),
    readme: S.optionalKey(
      S.String.annotateKey({
        description: "README content in markdown format.",
        default: "",
      }),
    ),
    volumeInGb: S.optionalKey(
      S.Int.annotateKey({
        description:
          "The amount of disk space, in gigabytes (GB), to allocate on the Pods deployed with this template.",
        default: 20,
      }),
    ),
    volumeMountPath: S.optionalKey(
      S.String.annotateKey({
        description:
          "If a volume is attached to a Pod deployed with this template, the absolute path where the volume will be mounted in the filesystem.",
        default: "/workspace",
      }),
    ),
  },
  $I.annote("TemplateUpdateInput", {
    description: "Generated RUNPOD schema for TemplateUpdateInput.",
    documentation:
      "Input for updating a Template which will trigger a rolling release for any associated endpoints.",
  }),
) {
  static readonly is = S.is(TemplateUpdateInput);
}

/**
 * Generated RUNPOD schema for `Templates`.
 *
 * **Example** (Inspect the Templates schema)
 *
 * ```ts
 * import { Templates } from "@beep/runpod"
 *
 * console.log(Templates.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Templates = S.Array(Template).pipe(
  $I.annoteSchema("Templates", {
    description: "Generated RUNPOD schema for Templates.",
  }),
);

/**
 * Type for {@link Templates}.
 *
 * **Example** (Reference the Templates type)
 *
 * ```ts
 * import type { Templates } from "@beep/runpod"
 *
 * type TemplatesValue = Templates
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Templates = typeof Templates.Type;

/**
 * Generated RUNPOD class schema for `UnauthorizedError`.
 *
 * **Example** (Inspect UnauthorizedError)
 *
 * ```ts
 * import { UnauthorizedError } from "@beep/runpod"
 *
 * console.log(UnauthorizedError.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UnauthorizedError extends S.Class<UnauthorizedError>(
  $I`UnauthorizedError`,
)(
  { message: S.optionalKey(S.String) },
  $I.annote("UnauthorizedError", {
    description: "Generated RUNPOD schema for UnauthorizedError.",
  }),
) {
  static readonly is = S.is(UnauthorizedError);
}

/**
 * Generated RUNPOD schema for `User`.
 *
 * **Example** (Inspect the User schema)
 *
 * ```ts
 * import { User } from "@beep/runpod"
 *
 * console.log(User.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const User = S.String.pipe(
  $I.annoteSchema("User", {
    description: "Generated RUNPOD schema for User.",
  }),
);

/**
 * Type for {@link User}.
 *
 * **Example** (Reference the User type)
 *
 * ```ts
 * import type { User } from "@beep/runpod"
 *
 * type UserValue = User
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type User = typeof User.Type;
