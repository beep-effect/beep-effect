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
 * Generated RUNPOD schema for `Account`.
 *
 * **Example** (Inspect the Account schema)
 *
 * ```ts
 * import { Account } from "@beep/runpod"
 *
 * console.log(Account.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Account = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "Account ID. For a request that acts for a team (a key created inside the team, or `X-Team-Id`) this is the team owner's account. For an organization member it is the member's own account; see `GET /v2/organization` for the organization.",
    }),
    email: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Email of the same account. Null when the account has no email on file.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Account", {
    description: "Generated RUNPOD schema for Account.",
    documentation: "The account the API key belongs to.",
    identifier: "Account",
  }),
);

/**
 * Type for {@link Account}.
 *
 * **Example** (Reference the Account type)
 *
 * ```ts
 * import type { Account } from "@beep/runpod"
 *
 * type AccountValue = Account
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Account = typeof Account.Type;

/**
 * Generated RUNPOD schema for `AuditLog`.
 *
 * **Example** (Inspect the AuditLog schema)
 *
 * ```ts
 * import { AuditLog } from "@beep/runpod"
 *
 * console.log(AuditLog.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuditLog = S.StructWithRest(
  S.Struct({
    actorId: S.Union([S.String, S.Null]).annotateKey({
      description:
        "ID of the user who performed the action. Null when the action was not attributable to a user.",
    }),
    email: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Email of the actor when the action was recorded. Null when unknown.",
    }),
    resourceType: S.String.annotateKey({
      description:
        "Kind of resource the action applied to, as recorded at write time. Not an enum: values are free-form, mostly lower camel case, and new kinds appear without an API version change. Current writers record values such as `pod`, `apiKey`, `sharedApiKey`, `secret`, `costCenter`, `paymentMethod`, `billingAccount`, `registryCredential`, `organization` and `group`, and `unknown` when the writer recorded no kind.",
    }),
    resourceId: S.String.annotateKey({
      description:
        "ID of the affected resource. Empty when the action was not about one resource; a bulk action lists every affected ID, comma-separated.",
    }),
    action: S.String.annotateKey({
      description:
        "Name of the action, as recorded at write time. Not an enum: values are free-form, mostly lower case verbs, and new actions appear without an API version change. Current writers record values such as `create`, `update`, `delete`, `rename`, `lock`, `unlock`, `start`, `reset`, `add` and `setBillingMode`.",
    }),
    value: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Details of the change as a JSON-encoded string. The structure varies by action; parse it as JSON for a structured view. A bulk action split across several entries adds an `auditChunk` object with `index` and `of`. Null when the action recorded no details.",
    }),
    timestamp: S.String.annotateKey({
      description: "When the action happened (UTC, whole seconds).",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("AuditLog", {
    description: "Generated RUNPOD schema for AuditLog.",
    documentation: "One recorded action on the account.",
    identifier: "AuditLog",
  }),
);

/**
 * Type for {@link AuditLog}.
 *
 * **Example** (Reference the AuditLog type)
 *
 * ```ts
 * import type { AuditLog } from "@beep/runpod"
 *
 * type AuditLogValue = AuditLog
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AuditLog = typeof AuditLog.Type;

/**
 * Generated RUNPOD schema for `AuthenticationAttempt`.
 *
 * **Example** (Inspect the AuthenticationAttempt schema)
 *
 * ```ts
 * import { AuthenticationAttempt } from "@beep/runpod"
 *
 * console.log(AuthenticationAttempt.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuthenticationAttempt = S.StructWithRest(
  S.Struct({
    attemptId: S.String.annotateKey({
      description: "Identifies the attempt in verify and resend.",
    }),
    expiresAt: S.String.annotateKey({
      description:
        "When the attempt stops accepting codes. Resending does not extend it.",
      format: "date-time",
    }),
    resendAfter: S.String.annotateKey({
      description: "Earliest time a resend is accepted.",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("AuthenticationAttempt", {
    description: "Generated RUNPOD schema for AuthenticationAttempt.",
    identifier: "AuthenticationAttempt",
  }),
);

/**
 * Type for {@link AuthenticationAttempt}.
 *
 * **Example** (Reference the AuthenticationAttempt type)
 *
 * ```ts
 * import type { AuthenticationAttempt } from "@beep/runpod"
 *
 * type AuthenticationAttemptValue = AuthenticationAttempt
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AuthenticationAttempt = typeof AuthenticationAttempt.Type;

/**
 * Generated RUNPOD schema for `AuthenticationAttemptResult`.
 *
 * **Example** (Inspect the AuthenticationAttemptResult schema)
 *
 * ```ts
 * import { AuthenticationAttemptResult } from "@beep/runpod"
 *
 * console.log(AuthenticationAttemptResult.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AuthenticationAttemptResult = S.StructWithRest(
  S.Struct({
    userId: S.String,
    credential: S.StructWithRest(
      S.Struct({
        id: S.String.annotateKey({
          description:
            "Identifies the key in the console, where it can be revoked.",
        }),
        apiKey: S.String.annotateKey({
          description:
            "The raw API key. It is returned once, so store it before doing anything else.",
        }),
      }),
      [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("AuthenticationAttemptResult", {
    description: "Generated RUNPOD schema for AuthenticationAttemptResult.",
    identifier: "AuthenticationAttemptResult",
  }),
);

/**
 * Type for {@link AuthenticationAttemptResult}.
 *
 * **Example** (Reference the AuthenticationAttemptResult type)
 *
 * ```ts
 * import type { AuthenticationAttemptResult } from "@beep/runpod"
 *
 * type AuthenticationAttemptResultValue = AuthenticationAttemptResult
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AuthenticationAttemptResult =
  typeof AuthenticationAttemptResult.Type;

/**
 * Generated RUNPOD schema for `AvailabilityLevel`.
 *
 * **Example** (Inspect the AvailabilityLevel schema)
 *
 * ```ts
 * import { AvailabilityLevel } from "@beep/runpod"
 *
 * console.log(AvailabilityLevel.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AvailabilityLevel = S.Literals([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
]).pipe(
  $I.annoteSchema("AvailabilityLevel", {
    description: "Generated RUNPOD schema for AvailabilityLevel.",
    documentation: "Catalog stock availability level.",
    identifier: "AvailabilityLevel",
  }),
);

/**
 * Type for {@link AvailabilityLevel}.
 *
 * **Example** (Reference the AvailabilityLevel type)
 *
 * ```ts
 * import type { AvailabilityLevel } from "@beep/runpod"
 *
 * type AvailabilityLevelValue = AvailabilityLevel
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AvailabilityLevel = typeof AvailabilityLevel.Type;

/**
 * Generated RUNPOD schema for `BaseContainerConfig`.
 *
 * **Example** (Inspect the BaseContainerConfig schema)
 *
 * ```ts
 * import { BaseContainerConfig } from "@beep/runpod"
 *
 * console.log(BaseContainerConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseContainerConfig = S.StructWithRest(
  S.Struct({
    args: S.optionalKey(
      S.String.annotateKey({
        description:
          'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
      }),
    ),
    cmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    entrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    disk: S.optionalKey(
      S.Int.annotateKey({
        description: "Container disk in GB (ephemeral, wiped on restart)",
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({
        description: "Environment variables as key-value pairs",
      }),
    ),
    image: S.optionalKey(
      S.String.annotateKey({ description: "Docker image reference" }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description: "Exposed ports, formatted as port/protocol",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BaseContainerConfig", {
    description: "Generated RUNPOD schema for BaseContainerConfig.",
    documentation:
      "Container configuration universal to every containerized resource. ContainerConfig composes it and adds `registry`; resources compose ContainerConfig.\n",
    identifier: "BaseContainerConfig",
  }),
);

/**
 * Type for {@link BaseContainerConfig}.
 *
 * **Example** (Reference the BaseContainerConfig type)
 *
 * ```ts
 * import type { BaseContainerConfig } from "@beep/runpod"
 *
 * type BaseContainerConfigValue = BaseContainerConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseContainerConfig = typeof BaseContainerConfig.Type;

/**
 * Generated RUNPOD schema for `BaseCpuConfig`.
 *
 * **Example** (Inspect the BaseCpuConfig schema)
 *
 * ```ts
 * import { BaseCpuConfig } from "@beep/runpod"
 *
 * console.log(BaseCpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseCpuConfig = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "CPU flavor identifier, as returned by GET /v2/catalog/cpus.",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
    vcpuCount: S.Int.annotateKey({
      description:
        "Number of vCPUs. Must be valid for the selected CPU flavor and must be a power of two.",
    }).check(
      S.isGreaterThanOrEqualTo(2).annotate({
        expected: "a value greater than or equal to 2",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BaseCpuConfig", {
    description: "Generated RUNPOD schema for BaseCpuConfig.",
    identifier: "BaseCpuConfig",
  }),
);

/**
 * Type for {@link BaseCpuConfig}.
 *
 * **Example** (Reference the BaseCpuConfig type)
 *
 * ```ts
 * import type { BaseCpuConfig } from "@beep/runpod"
 *
 * type BaseCpuConfigValue = BaseCpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseCpuConfig = typeof BaseCpuConfig.Type;

/**
 * Generated RUNPOD schema for `BaseEndpointGpuConfig`.
 *
 * **Example** (Inspect the BaseEndpointGpuConfig schema)
 *
 * ```ts
 * import { BaseEndpointGpuConfig } from "@beep/runpod"
 *
 * console.log(BaseEndpointGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseEndpointGpuConfig = S.StructWithRest(
  S.Struct({
    pools: S.optionalKey(
      S.Array(S.String)
        .annotateKey({
          description:
            'Serverless GPU pool IDs (as returned by `GET /v2/catalog/gpus` in\n`pool`). Workers are placed on whichever listed pool has capacity.\nNarrow a pool down to specific cards with `excludedTypes`.\n\nOn `PATCH`, `pools` and `excludedTypes` are one selection and are\nreplaced together, so sending `pools` by itself **clears the\nexclusions**. Two cases:\n\n- **Changing pools, keeping exclusions** — send both fields in one\n  request: `{"gpu": {"pools": ["ADA_24"], "excludedTypes":\n  ["NVIDIA L40"]}}`. `GET` the endpoint first to read the current\n  `excludedTypes` and resend the ones that still apply to the new\n  pools; an exclusion naming a type outside `pools` is a 400.\n- **Changing only `count` or a CUDA constraint** — omit `pools`:\n  `{"gpu": {"minCudaVersion": "12.4"}}`. The pool list and the\n  exclusions are both left exactly as they are.\n\n`excludedTypes` documents the full rule.\n',
        })
        .check(
          S.isMinLength(1).annotate({
            expected: "a value with a length of at least 1",
          }),
        ),
    ),
    excludedTypes: S.optionalKey(
      S.Array(
        S.String.check(
          S.isPattern(new globalThis.RegExp("^\\s*[^-\\s]", "u")).annotate({
            expected: "a string matching the RegExp ^\\s*[^-\\s]",
          }),
        ),
      )
        .annotateKey({
          description:
            'GPU **type** IDs to subtract from the selected pools — the `id`\nfield of `GET /v2/catalog/gpus`, the same identifiers pods take in\n`gpu.id`. Workers run on every type in `pools` except these. Omit to\nuse the whole pool.\n\nPools stay the unit of selection; types are the unit of\nsubtraction. There is no inclusive allowlist: a card later added to\none of your pools becomes eligible, which is the honest reading of\n"this pool, minus these".\n\nTied to `pools`, because the two together are one selection:\nsupplying `pools` replaces that selection wholesale, so a `PATCH`\nsending `pools` **without `excludedTypes`** **clears** them —\nrestate them to keep them. A `PATCH` that omits `pools` leaves both\nthe pools and the exclusions untouched, so changing only a CUDA\nconstraint cannot widen a pinned endpoint.\n\nRejected with 400 if a value is not a GPU type in one of `pools`,\nso a typo cannot produce a filter that does nothing. Surrounding whitespace\nis trimmed, so `" NVIDIA L40"` and `"NVIDIA L40"` mean the same card.\n',
        })
        .check(
          S.isUnique().annotate({ expected: "an array with unique items" }),
        ),
    ),
    count: S.optionalKey(
      S.Int.annotateKey({ description: "GPUs per worker", default: 1 }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BaseEndpointGpuConfig", {
    description: "Generated RUNPOD schema for BaseEndpointGpuConfig.",
    identifier: "BaseEndpointGpuConfig",
  }),
);

/**
 * Type for {@link BaseEndpointGpuConfig}.
 *
 * **Example** (Reference the BaseEndpointGpuConfig type)
 *
 * ```ts
 * import type { BaseEndpointGpuConfig } from "@beep/runpod"
 *
 * type BaseEndpointGpuConfigValue = BaseEndpointGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseEndpointGpuConfig = typeof BaseEndpointGpuConfig.Type;

/**
 * Generated RUNPOD schema for `BaseGpuConfig`.
 *
 * **Example** (Inspect the BaseGpuConfig schema)
 *
 * ```ts
 * import { BaseGpuConfig } from "@beep/runpod"
 *
 * console.log(BaseGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseGpuConfig = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "GPU type identifier" }),
    count: S.optionalKey(
      S.Int.annotateKey({ description: "Number of GPUs", default: 1 })
        .check(
          S.isGreaterThanOrEqualTo(1).annotate({
            expected: "a value greater than or equal to 1",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(1024).annotate({
            expected: "a value less than or equal to 1024",
          }),
        ),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BaseGpuConfig", {
    description: "Generated RUNPOD schema for BaseGpuConfig.",
    identifier: "BaseGpuConfig",
  }),
);

/**
 * Type for {@link BaseGpuConfig}.
 *
 * **Example** (Reference the BaseGpuConfig type)
 *
 * ```ts
 * import type { BaseGpuConfig } from "@beep/runpod"
 *
 * type BaseGpuConfigValue = BaseGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseGpuConfig = typeof BaseGpuConfig.Type;

/**
 * Generated RUNPOD schema for `PersistentMount`.
 *
 * **Example** (Inspect the PersistentMount schema)
 *
 * ```ts
 * import { PersistentMount } from "@beep/runpod"
 *
 * console.log(PersistentMount.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersistentMount = S.Struct({
  size: S.Int.annotateKey({
    description: "Host-local persistent storage in GB. Minimum 10 GB.",
  }).check(
    S.isGreaterThanOrEqualTo(10).annotate({
      expected: "a value greater than or equal to 10",
    }),
  ),
  path: S.String.annotateKey({
    description: "Mount path inside the container. May be changed via PATCH.",
  }),
}).pipe(
  $I.annoteSchema("PersistentMount", {
    description: "Generated RUNPOD schema for PersistentMount.",
    documentation:
      "Host-local persistent storage. Pinned to the pod's host machine — data\ndoes not survive a host failure. Disallowed on CPU pods. Mutually\nexclusive with NetworkMount. Deprecated: prefer NetworkMount for any\ndata you cannot recreate.\n",
    identifier: "PersistentMount",
  }),
);

/**
 * Type for {@link PersistentMount}.
 *
 * **Example** (Reference the PersistentMount type)
 *
 * ```ts
 * import type { PersistentMount } from "@beep/runpod"
 *
 * type PersistentMountValue = PersistentMount
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PersistentMount = typeof PersistentMount.Type;

/**
 * Generated RUNPOD schema for `NetworkMount`.
 *
 * **Example** (Inspect the NetworkMount schema)
 *
 * ```ts
 * import { NetworkMount } from "@beep/runpod"
 *
 * console.log(NetworkMount.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkMount = S.Struct({
  volumeId: S.String.annotateKey({
    description:
      "ID of an existing NetworkVolume in the same data center as the pod.",
  }),
  path: S.String.annotateKey({
    description:
      "Mount path inside the container. No default — must be specified explicitly.",
  }),
}).pipe(
  $I.annoteSchema("NetworkMount", {
    description: "Generated RUNPOD schema for NetworkMount.",
    documentation:
      "Reference to a NetworkVolume. Custom paths are honored at runtime on\nboth GPU and CPU pods. On a pod, the volume can be mounted, moved,\nor unmounted after creation (see `UpdatePodMounts`).\n",
    identifier: "NetworkMount",
  }),
);

/**
 * Type for {@link NetworkMount}.
 *
 * **Example** (Reference the NetworkMount type)
 *
 * ```ts
 * import type { NetworkMount } from "@beep/runpod"
 *
 * type NetworkMountValue = NetworkMount
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkMount = typeof NetworkMount.Type;

/**
 * Generated RUNPOD schema for `BaseMounts`.
 *
 * **Example** (Inspect the BaseMounts schema)
 *
 * ```ts
 * import { BaseMounts } from "@beep/runpod"
 *
 * console.log(BaseMounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaseMounts = S.StructWithRest(
  S.Struct({
    persistent: S.optionalKey(PersistentMount),
    network: S.Array(NetworkMount).pipe(S.optionalKey),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BaseMounts", {
    description: "Generated RUNPOD schema for BaseMounts.",
    documentation:
      "Shared base type for all resources that mount storage volumes.\n`persistent` and `network` cannot both be set (rejected with 400).\nEach resource that uses this type sets its own limit on network\nvolumes.\n",
    identifier: "BaseMounts",
  }),
);

/**
 * Type for {@link BaseMounts}.
 *
 * **Example** (Reference the BaseMounts type)
 *
 * ```ts
 * import type { BaseMounts } from "@beep/runpod"
 *
 * type BaseMountsValue = BaseMounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseMounts = typeof BaseMounts.Type;

/**
 * Generated RUNPOD schema for `BillingAmounts`.
 *
 * **Example** (Inspect the BillingAmounts schema)
 *
 * ```ts
 * import { BillingAmounts } from "@beep/runpod"
 *
 * console.log(BillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description: "Total cost in USD for the bucket across all resources.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podGpuAmount: S.Finite.annotateKey({
      description: "GPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podCpuAmount: S.Finite.annotateKey({
      description: "CPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podDiskAmount: S.Finite.annotateKey({
      description: "Pod disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessGpuAmount: S.Finite.annotateKey({
      description: "Serverless GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessCpuAmount: S.Finite.annotateKey({
      description: "Serverless CPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessDiskAmount: S.Finite.annotateKey({
      description: "Serverless disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessFeeAmount: S.Finite.annotateKey({
      description:
        "Unused and always 0. Platform charges are included in the serverless compute amounts.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    storageStandardAmount: S.Finite.annotateKey({
      description:
        "Standard network volume storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    storageHighPerformanceAmount: S.Finite.annotateKey({
      description:
        "High-performance network volume storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    endpointAmount: S.Finite.annotateKey({
      description: "Runpod public endpoint cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterGpuAmount: S.Finite.annotateKey({
      description: "Cluster GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterDiskAmount: S.Finite.annotateKey({
      description: "Cluster disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterNetworkingAmount: S.Finite.annotateKey({
      description: "Cluster inter-node networking cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BillingAmounts", {
    description: "Generated RUNPOD schema for BillingAmounts.",
    documentation:
      "Total spend across all billable Runpod resources with each cost component broken out, fully prefixed by resource. Backs the aggregate record's amounts and the metadata totals. Serverless amounts are inclusive of platform charges.\n",
    identifier: "BillingAmounts",
  }),
);

/**
 * Type for {@link BillingAmounts}.
 *
 * **Example** (Reference the BillingAmounts type)
 *
 * ```ts
 * import type { BillingAmounts } from "@beep/runpod"
 *
 * type BillingAmountsValue = BillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingAmounts = typeof BillingAmounts.Type;

/**
 * Generated RUNPOD schema for `BillingBucketSize`.
 *
 * **Example** (Inspect the BillingBucketSize schema)
 *
 * ```ts
 * import { BillingBucketSize } from "@beep/runpod"
 *
 * console.log(BillingBucketSize.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingBucketSize = S.Literals([
  "hour",
  "day",
  "week",
  "month",
  "year",
]).pipe(
  $I.annoteSchema("BillingBucketSize", {
    description: "Generated RUNPOD schema for BillingBucketSize.",
    documentation: "Length of each billing time bucket.",
    default: "day",
    identifier: "BillingBucketSize",
  }),
);

/**
 * Type for {@link BillingBucketSize}.
 *
 * **Example** (Reference the BillingBucketSize type)
 *
 * ```ts
 * import type { BillingBucketSize } from "@beep/runpod"
 *
 * type BillingBucketSizeValue = BillingBucketSize
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingBucketSize = typeof BillingBucketSize.Type;

/**
 * Generated RUNPOD schema for `BillingQuery`.
 *
 * **Example** (Inspect the BillingQuery schema)
 *
 * ```ts
 * import { BillingQuery } from "@beep/runpod"
 *
 * console.log(BillingQuery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingQuery = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    bucketSize: BillingBucketSize,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BillingQuery", {
    description: "Generated RUNPOD schema for BillingQuery.",
    documentation:
      "Resolved query window and granularity (routes without a filter).",
    identifier: "BillingQuery",
  }),
);

/**
 * Type for {@link BillingQuery}.
 *
 * **Example** (Reference the BillingQuery type)
 *
 * ```ts
 * import type { BillingQuery } from "@beep/runpod"
 *
 * type BillingQueryValue = BillingQuery
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingQuery = typeof BillingQuery.Type;

/**
 * Generated RUNPOD schema for `BillingMetadata`.
 *
 * **Example** (Inspect the BillingMetadata schema)
 *
 * ```ts
 * import { BillingMetadata } from "@beep/runpod"
 *
 * console.log(BillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingMetadata = S.StructWithRest(
  S.Struct({
    query: BillingQuery,
    recordCount: S.Int.annotateKey({
      description: "Number of records returned.",
    }),
    totals: BillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BillingMetadata", {
    description: "Generated RUNPOD schema for BillingMetadata.",
    identifier: "BillingMetadata",
  }),
);

/**
 * Type for {@link BillingMetadata}.
 *
 * **Example** (Reference the BillingMetadata type)
 *
 * ```ts
 * import type { BillingMetadata } from "@beep/runpod"
 *
 * type BillingMetadataValue = BillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingMetadata = typeof BillingMetadata.Type;

/**
 * Generated RUNPOD schema for `BillingRecord`.
 *
 * **Example** (Inspect the BillingRecord schema)
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
export const BillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description: "Total cost in USD for the bucket across all resources.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podGpuAmount: S.Finite.annotateKey({
      description: "GPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podCpuAmount: S.Finite.annotateKey({
      description: "CPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podDiskAmount: S.Finite.annotateKey({
      description: "Pod disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessGpuAmount: S.Finite.annotateKey({
      description: "Serverless GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessCpuAmount: S.Finite.annotateKey({
      description: "Serverless CPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessDiskAmount: S.Finite.annotateKey({
      description: "Serverless disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessFeeAmount: S.Finite.annotateKey({
      description:
        "Unused and always 0. Platform charges are included in the serverless compute amounts.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    storageStandardAmount: S.Finite.annotateKey({
      description:
        "Standard network volume storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    storageHighPerformanceAmount: S.Finite.annotateKey({
      description:
        "High-performance network volume storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    endpointAmount: S.Finite.annotateKey({
      description: "Runpod public endpoint cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterGpuAmount: S.Finite.annotateKey({
      description: "Cluster GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterDiskAmount: S.Finite.annotateKey({
      description: "Cluster disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterNetworkingAmount: S.Finite.annotateKey({
      description: "Cluster inter-node networking cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BillingRecord", {
    description: "Generated RUNPOD schema for BillingRecord.",
    documentation:
      "A single time-bucketed record of total spend across all billable Runpod resources, with each cost component broken out. Returned by GET /v2/billing.\n",
    identifier: "BillingRecord",
  }),
);

/**
 * Type for {@link BillingRecord}.
 *
 * **Example** (Reference the BillingRecord type)
 *
 * ```ts
 * import type { BillingRecord } from "@beep/runpod"
 *
 * type BillingRecordValue = BillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingRecord = typeof BillingRecord.Type;

/**
 * Generated RUNPOD schema for `BillingTimeRange`.
 *
 * **Example** (Inspect the BillingTimeRange schema)
 *
 * ```ts
 * import { BillingTimeRange } from "@beep/runpod"
 *
 * console.log(BillingTimeRange.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BillingTimeRange = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BillingTimeRange", {
    description: "Generated RUNPOD schema for BillingTimeRange.",
    documentation:
      "Half-open time range [startTime, endTime) in RFC 3339. On a record it is the time bucket; on a query echo it is the resolved window.\n",
    identifier: "BillingTimeRange",
  }),
);

/**
 * Type for {@link BillingTimeRange}.
 *
 * **Example** (Reference the BillingTimeRange type)
 *
 * ```ts
 * import type { BillingTimeRange } from "@beep/runpod"
 *
 * type BillingTimeRangeValue = BillingTimeRange
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BillingTimeRange = typeof BillingTimeRange.Type;

/**
 * Generated RUNPOD schema for `BuildState`.
 *
 * **Example** (Inspect the BuildState schema)
 *
 * ```ts
 * import { BuildState } from "@beep/runpod"
 *
 * console.log(BuildState.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BuildState = S.Literals([
  "PENDING",
  "BUILDING",
  "UPLOADING",
  "TESTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TEST_FAILED",
]).pipe(
  $I.annoteSchema("BuildState", {
    description: "Generated RUNPOD schema for BuildState.",
    documentation:
      "GitHub build lifecycle state. `COMPLETED`, `FAILED`, `CANCELLED`, and\n`TEST_FAILED` are terminal; `PENDING`, `BUILDING`, `UPLOADING`, and\n`TESTING` are live.\n",
    identifier: "BuildState",
  }),
);

/**
 * Type for {@link BuildState}.
 *
 * **Example** (Reference the BuildState type)
 *
 * ```ts
 * import type { BuildState } from "@beep/runpod"
 *
 * type BuildStateValue = BuildState
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BuildState = typeof BuildState.Type;

/**
 * Generated RUNPOD schema for `Build`.
 *
 * **Example** (Inspect the Build schema)
 *
 * ```ts
 * import { Build } from "@beep/runpod"
 *
 * console.log(Build.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Build = S.StructWithRest(
  S.Struct({
    id: S.String,
    status: BuildState,
    commitHash: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "Short hash of the commit that triggered the build.",
      }),
    ),
    commitMessage: S.optionalKey(S.Union([S.String, S.Null])),
    branch: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "Git branch the commit was pushed to.",
      }),
    ),
    commitDate: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "When the triggering commit was authored.",
        format: "date-time",
      }),
    ),
    imageName: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "Fully qualified image the build produced (or will produce).",
      }),
    ),
    startedAt: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "When the build started. Null while the build is still pending.",
        format: "date-time",
      }),
    ),
    completedAt: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "When the build reached a terminal state. Null while the build is live.",
        format: "date-time",
      }),
    ),
    error: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "Failure detail for `FAILED` / `TEST_FAILED` builds; null otherwise.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Build", {
    description: "Generated RUNPOD schema for Build.",
    identifier: "Build",
  }),
);

/**
 * Type for {@link Build}.
 *
 * **Example** (Reference the Build type)
 *
 * ```ts
 * import type { Build } from "@beep/runpod"
 *
 * type BuildValue = Build
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Build = typeof Build.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleCapabilities`.
 *
 * **Example** (Inspect the OrganizationRoleCapabilities schema)
 *
 * ```ts
 * import { OrganizationRoleCapabilities } from "@beep/runpod"
 *
 * console.log(OrganizationRoleCapabilities.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleCapabilities = S.Array(S.String).pipe(
  $I.annoteSchema("OrganizationRoleCapabilities", {
    description: "Generated RUNPOD schema for OrganizationRoleCapabilities.",
    documentation:
      "What the role grants, as `FAMILY:VERB` capabilities, sorted. A member's effective access can also include account-level access that no role grants.",
    identifier: "OrganizationRoleCapabilities",
  }),
);

/**
 * Type for {@link OrganizationRoleCapabilities}.
 *
 * **Example** (Reference the OrganizationRoleCapabilities type)
 *
 * ```ts
 * import type { OrganizationRoleCapabilities } from "@beep/runpod"
 *
 * type OrganizationRoleCapabilitiesValue = OrganizationRoleCapabilities
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleCapabilities =
  typeof OrganizationRoleCapabilities.Type;

/**
 * Generated RUNPOD schema for `BuiltinOrganizationRole`.
 *
 * **Example** (Inspect the BuiltinOrganizationRole schema)
 *
 * ```ts
 * import { BuiltinOrganizationRole } from "@beep/runpod"
 *
 * console.log(BuiltinOrganizationRole.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BuiltinOrganizationRole = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description: "Role ID, `builtin:` followed by the role's key.",
    }),
    name: S.String.annotateKey({ description: "Display name." }),
    type: S.tag("builtin").annotateKey({
      description: "Always `builtin` for this variant.",
    }),
    capabilities: OrganizationRoleCapabilities,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("BuiltinOrganizationRole", {
    description: "Generated RUNPOD schema for BuiltinOrganizationRole.",
    documentation: "A role Runpod defines. Built-in roles cannot be changed.",
    identifier: "BuiltinOrganizationRole",
  }),
);

/**
 * Type for {@link BuiltinOrganizationRole}.
 *
 * **Example** (Reference the BuiltinOrganizationRole type)
 *
 * ```ts
 * import type { BuiltinOrganizationRole } from "@beep/runpod"
 *
 * type BuiltinOrganizationRoleValue = BuiltinOrganizationRole
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BuiltinOrganizationRole = typeof BuiltinOrganizationRole.Type;

/**
 * Generated RUNPOD schema for `CatalogInclude`.
 *
 * **Example** (Inspect the CatalogInclude schema)
 *
 * ```ts
 * import { CatalogInclude } from "@beep/runpod"
 *
 * console.log(CatalogInclude.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CatalogInclude = S.Literal("AVAILABILITY").pipe(
  $I.annoteSchema("CatalogInclude", {
    description: "Generated RUNPOD schema for CatalogInclude.",
    documentation:
      "Catalog include expansion. Only AVAILABILITY is supported today; additional include values may be added in the future.",
    identifier: "CatalogInclude",
  }),
);

/**
 * Type for {@link CatalogInclude}.
 *
 * **Example** (Reference the CatalogInclude type)
 *
 * ```ts
 * import type { CatalogInclude } from "@beep/runpod"
 *
 * type CatalogIncludeValue = CatalogInclude
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CatalogInclude = typeof CatalogInclude.Type;

/**
 * Generated RUNPOD schema for `CatalogResourceAvailability`.
 *
 * **Example** (Inspect the CatalogResourceAvailability schema)
 *
 * ```ts
 * import { CatalogResourceAvailability } from "@beep/runpod"
 *
 * console.log(CatalogResourceAvailability.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CatalogResourceAvailability = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Catalog resource identifier." }),
    name: S.String.annotateKey({
      description: "Human-readable catalog resource name.",
    }),
    availability: AvailabilityLevel,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CatalogResourceAvailability", {
    description: "Generated RUNPOD schema for CatalogResourceAvailability.",
    identifier: "CatalogResourceAvailability",
  }),
);

/**
 * Type for {@link CatalogResourceAvailability}.
 *
 * **Example** (Reference the CatalogResourceAvailability type)
 *
 * ```ts
 * import type { CatalogResourceAvailability } from "@beep/runpod"
 *
 * type CatalogResourceAvailabilityValue = CatalogResourceAvailability
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CatalogResourceAvailability =
  typeof CatalogResourceAvailability.Type;

/**
 * Generated RUNPOD schema for `Cloud`.
 *
 * **Example** (Inspect the Cloud schema)
 *
 * ```ts
 * import { Cloud } from "@beep/runpod"
 *
 * console.log(Cloud.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cloud = S.Literals(["SECURE", "COMMUNITY"]).pipe(
  $I.annoteSchema("Cloud", {
    description: "Generated RUNPOD schema for Cloud.",
    documentation:
      "Cloud tier.\n- `SECURE`    — Runpod-owned datacenter hardware\n- `COMMUNITY` — community-hosted hardware\n",
    identifier: "Cloud",
  }),
);

/**
 * Type for {@link Cloud}.
 *
 * **Example** (Reference the Cloud type)
 *
 * ```ts
 * import type { Cloud } from "@beep/runpod"
 *
 * type CloudValue = Cloud
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Cloud = typeof Cloud.Type;

/**
 * Generated RUNPOD schema for `CostCenter`.
 *
 * **Example** (Inspect the CostCenter schema)
 *
 * ```ts
 * import { CostCenter } from "@beep/runpod"
 *
 * console.log(CostCenter.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CostCenter = S.StructWithRest(
  S.Struct({
    id: S.String,
    value: S.String.annotateKey({
      description:
        "Cost center name exactly as stored, so it matches billing breakdowns.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CostCenter", {
    description: "Generated RUNPOD schema for CostCenter.",
    identifier: "CostCenter",
  }),
);

/**
 * Type for {@link CostCenter}.
 *
 * **Example** (Reference the CostCenter type)
 *
 * ```ts
 * import type { CostCenter } from "@beep/runpod"
 *
 * type CostCenterValue = CostCenter
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CostCenter = typeof CostCenter.Type;

/**
 * Generated RUNPOD schema for `ResourceCostCenter`.
 *
 * **Example** (Inspect the ResourceCostCenter schema)
 *
 * ```ts
 * import { ResourceCostCenter } from "@beep/runpod"
 *
 * console.log(ResourceCostCenter.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResourceCostCenter = S.suspend(
  (): S.Codec<CostCenter> => CostCenter,
).pipe(
  $I.annoteSchema("ResourceCostCenter", {
    description: "Generated RUNPOD schema for ResourceCostCenter.",
    documentation:
      "Cost center this resource's spend is attributed to. Absent when the resource is not attributed to a cost center, or when the caller lacks permission to view cost centers. Managed through `/v2/cost-centers`.",
    identifier: "ResourceCostCenter",
  }),
);

/**
 * Type for {@link ResourceCostCenter}.
 *
 * **Example** (Reference the ResourceCostCenter type)
 *
 * ```ts
 * import type { ResourceCostCenter } from "@beep/runpod"
 *
 * type ResourceCostCenterValue = ResourceCostCenter
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResourceCostCenter = typeof ResourceCostCenter.Type;

/**
 * Generated RUNPOD schema for `TagReference`.
 *
 * **Example** (Inspect the TagReference schema)
 *
 * ```ts
 * import { TagReference } from "@beep/runpod"
 *
 * console.log(TagReference.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TagReference = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "ID of the tag itself, shared by every resource it is attached to.",
    }),
    key: S.String,
    value: S.String.annotateKey({ description: "May be empty." }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("TagReference", {
    description: "Generated RUNPOD schema for TagReference.",
    identifier: "TagReference",
  }),
);

/**
 * Type for {@link TagReference}.
 *
 * **Example** (Reference the TagReference type)
 *
 * ```ts
 * import type { TagReference } from "@beep/runpod"
 *
 * type TagReferenceValue = TagReference
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TagReference = typeof TagReference.Type;

/**
 * Generated RUNPOD schema for `ResourceTags`.
 *
 * **Example** (Inspect the ResourceTags schema)
 *
 * ```ts
 * import { ResourceTags } from "@beep/runpod"
 *
 * console.log(ResourceTags.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResourceTags = S.Array(TagReference).pipe(
  $I.annoteSchema("ResourceTags", {
    description: "Generated RUNPOD schema for ResourceTags.",
    documentation:
      "The tags on this resource that are visible to the caller. Keys and values are returned exactly as stored. Tags under the reserved `runpod:` prefix, such as the cost center, are never listed here. Absent when the resource's tags are unavailable to the caller; an empty array means none are visible.",
    identifier: "ResourceTags",
  }),
);

/**
 * Type for {@link ResourceTags}.
 *
 * **Example** (Reference the ResourceTags type)
 *
 * ```ts
 * import type { ResourceTags } from "@beep/runpod"
 *
 * type ResourceTagsValue = ResourceTags
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResourceTags = typeof ResourceTags.Type;

/**
 * Generated RUNPOD schema for `ClusterType`.
 *
 * **Example** (Inspect the ClusterType schema)
 *
 * ```ts
 * import { ClusterType } from "@beep/runpod"
 *
 * console.log(ClusterType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterType = S.Literals([
  "APPLICATION",
  "TRAINING",
  "SLURM",
  "RAY",
]).pipe(
  $I.annoteSchema("ClusterType", {
    description: "Generated RUNPOD schema for ClusterType.",
    documentation:
      "Cluster type. TRAINING is the generic distributed-training cluster; SLURM provisions a managed Slurm controller/compute topology; RAY provisions a managed Ray head/worker topology; APPLICATION is a general multi-node application cluster.",
    identifier: "ClusterType",
  }),
);

/**
 * Type for {@link ClusterType}.
 *
 * **Example** (Reference the ClusterType type)
 *
 * ```ts
 * import type { ClusterType } from "@beep/runpod"
 *
 * type ClusterTypeValue = ClusterType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterType = typeof ClusterType.Type;

/**
 * Generated RUNPOD schema for `ClusterCompute`.
 *
 * **Example** (Inspect the ClusterCompute schema)
 *
 * ```ts
 * import { ClusterCompute } from "@beep/runpod"
 *
 * console.log(ClusterCompute.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterCompute = S.Struct({
  gpuTypeId: S.String.annotateKey({
    description:
      "GPU type for every pod in the cluster, as returned by GET /v2/catalog/gpus.",
  }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  gpuCountPerPod: S.Int.annotateKey({
    description:
      "Number of GPUs on each pod. Bounded above by the GPU type's per-cloud maximum (GpuType.maxCount); values beyond it are rejected.",
  }).check(
    S.isGreaterThanOrEqualTo(1).annotate({
      expected: "a value greater than or equal to 1",
    }),
  ),
  podCount: S.Int.annotateKey({
    description: "Number of pods (nodes) in the cluster.",
  })
    .check(
      S.isGreaterThanOrEqualTo(2).annotate({
        expected: "a value greater than or equal to 2",
      }),
    )
    .check(
      S.isLessThanOrEqualTo(250).annotate({
        expected: "a value less than or equal to 250",
      }),
    ),
}).pipe(
  $I.annoteSchema("ClusterCompute", {
    description: "Generated RUNPOD schema for ClusterCompute.",
    documentation:
      "The homogeneous compute shape of a cluster. Every pod in the cluster is identical: `podCount` pods, each with `gpuCountPerPod` GPUs of type `gpuTypeId`. Total GPUs = `podCount` * `gpuCountPerPod`.",
    identifier: "ClusterCompute",
  }),
);

/**
 * Type for {@link ClusterCompute}.
 *
 * **Example** (Reference the ClusterCompute type)
 *
 * ```ts
 * import type { ClusterCompute } from "@beep/runpod"
 *
 * type ClusterComputeValue = ClusterCompute
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterCompute = typeof ClusterCompute.Type;

/**
 * Generated RUNPOD schema for `ClusterPodsSummary`.
 *
 * **Example** (Inspect the ClusterPodsSummary schema)
 *
 * ```ts
 * import { ClusterPodsSummary } from "@beep/runpod"
 *
 * console.log(ClusterPodsSummary.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterPodsSummary = S.Struct({
  total: S.Int.annotateKey({
    description: "Number of member pods currently provisioned for the cluster.",
  }),
  byStatus: S.Record(S.String, S.Int).annotateKey({
    description:
      "Member pod counts keyed by pod status (the same values as `Pod.status`, e.g. RUNNING, PROVISIONING). Statuses with no pods are omitted.",
  }),
}).pipe(
  $I.annoteSchema("ClusterPodsSummary", {
    description: "Generated RUNPOD schema for ClusterPodsSummary.",
    documentation:
      "A lightweight summary of a cluster's member pods. Use `GET /v2/clusters/{id}/pods` to retrieve the full pod objects.",
    identifier: "ClusterPodsSummary",
  }),
);

/**
 * Type for {@link ClusterPodsSummary}.
 *
 * **Example** (Reference the ClusterPodsSummary type)
 *
 * ```ts
 * import type { ClusterPodsSummary } from "@beep/runpod"
 *
 * type ClusterPodsSummaryValue = ClusterPodsSummary
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterPodsSummary = typeof ClusterPodsSummary.Type;

/**
 * Generated RUNPOD schema for `ClusterNetwork`.
 *
 * **Example** (Inspect the ClusterNetwork schema)
 *
 * ```ts
 * import { ClusterNetwork } from "@beep/runpod"
 *
 * console.log(ClusterNetwork.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterNetwork = S.Struct({
  cidr: S.String.annotateKey({
    description: "The overlay network's CIDR block.",
  }),
  vxlanId: S.optionalKey(
    S.Int.annotateKey({
      description: "VXLAN network identifier; omitted until assigned.",
    }),
  ),
  vxlanPort: S.optionalKey(
    S.Int.annotateKey({
      description:
        "UDP port carrying the VXLAN traffic; omitted until assigned.",
    }),
  ),
}).pipe(
  $I.annoteSchema("ClusterNetwork", {
    description: "Generated RUNPOD schema for ClusterNetwork.",
    documentation:
      "The cluster's private VXLAN overlay network (shared by all member pods).",
    identifier: "ClusterNetwork",
  }),
);

/**
 * Type for {@link ClusterNetwork}.
 *
 * **Example** (Reference the ClusterNetwork type)
 *
 * ```ts
 * import type { ClusterNetwork } from "@beep/runpod"
 *
 * type ClusterNetworkValue = ClusterNetwork
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterNetwork = typeof ClusterNetwork.Type;

/**
 * Generated RUNPOD schema for `PodStatus`.
 *
 * **Example** (Inspect the PodStatus schema)
 *
 * ```ts
 * import { PodStatus } from "@beep/runpod"
 *
 * console.log(PodStatus.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodStatus = S.Literals([
  "PROVISIONING",
  "STARTING",
  "RUNNING",
  "EXITED",
  "ERROR",
  "TERMINATED",
]).pipe(
  $I.annoteSchema("PodStatus", {
    description: "Generated RUNPOD schema for PodStatus.",
    documentation:
      "Lifecycle status of a pod.\n- `PROVISIONING` — pod is being allocated\n- `STARTING`     — container is starting\n- `RUNNING`      — container is healthy\n- `EXITED`       — container exited (stopped)\n- `ERROR`        — container is in an unrecoverable error state\n- `TERMINATED`   — pod has been permanently deleted\n",
    identifier: "PodStatus",
  }),
);

/**
 * Type for {@link PodStatus}.
 *
 * **Example** (Reference the PodStatus type)
 *
 * ```ts
 * import type { PodStatus } from "@beep/runpod"
 *
 * type PodStatusValue = PodStatus
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodStatus = typeof PodStatus.Type;

/**
 * Generated RUNPOD schema for `ClusterPrimary`.
 *
 * **Example** (Inspect the ClusterPrimary schema)
 *
 * ```ts
 * import { ClusterPrimary } from "@beep/runpod"
 *
 * console.log(ClusterPrimary.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterPrimary = S.Struct({
  podId: S.String.annotateKey({ description: "ID of the primary member pod." }),
  status: PodStatus,
  sshEndpoint: S.optionalKey(
    S.String.annotateKey({
      description:
        "Public SSH endpoint (`host:port`) for the primary node; omitted when the primary is not yet RUNNING or does not expose SSH (22/tcp).",
    }),
  ),
}).pipe(
  $I.annoteSchema("ClusterPrimary", {
    description: "Generated RUNPOD schema for ClusterPrimary.",
    documentation:
      "The cluster's primary (master) node, through which the cluster is typically driven. Omitted until a primary pod has been placed.",
    identifier: "ClusterPrimary",
  }),
);

/**
 * Type for {@link ClusterPrimary}.
 *
 * **Example** (Reference the ClusterPrimary type)
 *
 * ```ts
 * import type { ClusterPrimary } from "@beep/runpod"
 *
 * type ClusterPrimaryValue = ClusterPrimary
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterPrimary = typeof ClusterPrimary.Type;

/**
 * Generated RUNPOD schema for `Cluster`.
 *
 * **Example** (Inspect the Cluster schema)
 *
 * ```ts
 * import { Cluster } from "@beep/runpod"
 *
 * console.log(Cluster.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cluster = S.StructWithRest(
  S.Struct({
    costCenter: S.optionalKey(ResourceCostCenter),
    tags: S.optionalKey(ResourceTags),
    id: S.String,
    name: S.String,
    type: ClusterType,
    compute: ClusterCompute,
    template: S.optionalKey(
      S.String.annotateKey({
        description:
          "ID of the template this cluster's pods were created from; omitted when they were not created from one.",
      }),
    ),
    dataCenterId: S.optionalKey(
      S.String.annotateKey({
        description:
          "Data center the cluster is placed in (a cluster is always within a single data center). Derived from the member pods; omitted until at least one pod is placed.",
      }),
    ),
    pods: ClusterPodsSummary,
    network: S.optionalKey(
      S.suspend((): S.Codec<ClusterNetwork> => ClusterNetwork).annotateKey({
        description:
          "The cluster's overlay network; omitted until the network is provisioned.",
      }),
    ),
    primary: S.optionalKey(
      S.suspend((): S.Codec<ClusterPrimary> => ClusterPrimary).annotateKey({
        description:
          "The primary (master) node; omitted until a primary pod is placed. Its `sshEndpoint` is omitted until that pod is RUNNING with SSH exposed.",
      }),
    ),
    createdAt: S.String.annotateKey({ format: "date-time" }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Cluster", {
    description: "Generated RUNPOD schema for Cluster.",
    documentation:
      "A cluster. Cluster-level fields describe the identity and homogeneous shape; `pods` is a lightweight summary of the members. Fetch the full member pods — with their container config, mounts, and runtime state — from `GET /v2/clusters/{id}/pods`.",
    identifier: "Cluster",
  }),
);

/**
 * Type for {@link Cluster}.
 *
 * **Example** (Reference the Cluster type)
 *
 * ```ts
 * import type { Cluster } from "@beep/runpod"
 *
 * type ClusterValue = Cluster
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Cluster = typeof Cluster.Type;

/**
 * Generated RUNPOD schema for `ClusterBillingAmounts`.
 *
 * **Example** (Inspect the ClusterBillingAmounts schema)
 *
 * ```ts
 * import { ClusterBillingAmounts } from "@beep/runpod"
 *
 * console.log(ClusterBillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterBillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description: "Total Instant Cluster cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "Cluster GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Cluster disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    networkingAmount: S.Finite.annotateKey({
      description: "Cluster inter-node networking cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ClusterBillingAmounts", {
    description: "Generated RUNPOD schema for ClusterBillingAmounts.",
    documentation:
      "Cluster cost components (GPU-only, no CPU). Backs a record's amounts and the metadata totals.\n",
    identifier: "ClusterBillingAmounts",
  }),
);

/**
 * Type for {@link ClusterBillingAmounts}.
 *
 * **Example** (Reference the ClusterBillingAmounts type)
 *
 * ```ts
 * import type { ClusterBillingAmounts } from "@beep/runpod"
 *
 * type ClusterBillingAmountsValue = ClusterBillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterBillingAmounts = typeof ClusterBillingAmounts.Type;

/**
 * Generated RUNPOD schema for `ClusterBillingQuery`.
 *
 * **Example** (Inspect the ClusterBillingQuery schema)
 *
 * ```ts
 * import { ClusterBillingQuery } from "@beep/runpod"
 *
 * console.log(ClusterBillingQuery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterBillingQuery = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    bucketSize: BillingBucketSize,
    clusterId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "The clusterId filter applied, if any.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ClusterBillingQuery", {
    description: "Generated RUNPOD schema for ClusterBillingQuery.",
    documentation:
      "Resolved query window and granularity (routes without a filter).",
    identifier: "ClusterBillingQuery",
  }),
);

/**
 * Type for {@link ClusterBillingQuery}.
 *
 * **Example** (Reference the ClusterBillingQuery type)
 *
 * ```ts
 * import type { ClusterBillingQuery } from "@beep/runpod"
 *
 * type ClusterBillingQueryValue = ClusterBillingQuery
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterBillingQuery = typeof ClusterBillingQuery.Type;

/**
 * Generated RUNPOD schema for `ClusterBillingMetadata`.
 *
 * **Example** (Inspect the ClusterBillingMetadata schema)
 *
 * ```ts
 * import { ClusterBillingMetadata } from "@beep/runpod"
 *
 * console.log(ClusterBillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterBillingMetadata = S.StructWithRest(
  S.Struct({
    query: ClusterBillingQuery,
    recordCount: S.Int.annotateKey({
      description:
        "Number of records returned (buckets times distinct clusters).",
    }),
    uniqueClusterCount: S.Int.annotateKey({
      description: "Number of distinct clusters the records span.",
    }),
    totals: ClusterBillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ClusterBillingMetadata", {
    description: "Generated RUNPOD schema for ClusterBillingMetadata.",
    identifier: "ClusterBillingMetadata",
  }),
);

/**
 * Type for {@link ClusterBillingMetadata}.
 *
 * **Example** (Reference the ClusterBillingMetadata type)
 *
 * ```ts
 * import type { ClusterBillingMetadata } from "@beep/runpod"
 *
 * type ClusterBillingMetadataValue = ClusterBillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterBillingMetadata = typeof ClusterBillingMetadata.Type;

/**
 * Generated RUNPOD schema for `ClusterBillingRecord`.
 *
 * **Example** (Inspect the ClusterBillingRecord schema)
 *
 * ```ts
 * import { ClusterBillingRecord } from "@beep/runpod"
 *
 * console.log(ClusterBillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterBillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description: "Total Instant Cluster cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "Cluster GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Cluster disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    networkingAmount: S.Finite.annotateKey({
      description: "Cluster inter-node networking cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    clusterId: S.String.annotateKey({
      description:
        "The cluster this record bills. When the clusterId filter is set every record carries that id; otherwise one record is emitted per cluster per bucket.\n",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ClusterBillingRecord", {
    description: "Generated RUNPOD schema for ClusterBillingRecord.",
    documentation:
      "A single time-bucketed cluster billing record; clusters are GPU-only (no CPU component). Returned by GET /v2/billing/clusters.\n",
    identifier: "ClusterBillingRecord",
  }),
);

/**
 * Type for {@link ClusterBillingRecord}.
 *
 * **Example** (Reference the ClusterBillingRecord type)
 *
 * ```ts
 * import type { ClusterBillingRecord } from "@beep/runpod"
 *
 * type ClusterBillingRecordValue = ClusterBillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterBillingRecord = typeof ClusterBillingRecord.Type;

/**
 * Generated RUNPOD schema for `ClusterMounts`.
 *
 * **Example** (Inspect the ClusterMounts schema)
 *
 * ```ts
 * import { ClusterMounts } from "@beep/runpod"
 *
 * console.log(ClusterMounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClusterMounts = S.Struct({
  persistent: S.optionalKey(
    S.Struct({
      size: S.Int.annotateKey({
        description: "Host-local persistent storage in GB. Minimum 10 GB.",
      }).check(
        S.isGreaterThanOrEqualTo(10).annotate({
          expected: "a value greater than or equal to 10",
        }),
      ),
      path: S.String.annotateKey({
        description:
          "Mount path inside the container. May be changed via PATCH.",
      }).check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      ),
    }).annotateKey({
      description:
        "Host-local persistent storage. Pinned to the pod's host machine — data\ndoes not survive a host failure. Disallowed on CPU pods. Mutually\nexclusive with NetworkMount. Deprecated: prefer NetworkMount for any\ndata you cannot recreate.\n",
    }),
  ),
  network: S.optionalKey(
    S.Array(
      S.Struct({
        volumeId: S.String.annotateKey({
          description:
            "ID of an existing NetworkVolume in the same data center as the pod.",
        }),
        path: S.String.annotateKey({
          description:
            "Mount path inside the container. No default — must be specified explicitly.",
        }).check(
          S.isMinLength(1).annotate({
            expected: "a value with a length of at least 1",
          }),
        ),
      }).annotate({
        description:
          "Reference to a NetworkVolume. Custom paths are honored at runtime on\nboth GPU and CPU pods. On a pod, the volume can be mounted, moved,\nor unmounted after creation (see `UpdatePodMounts`).\n",
      }),
    ).check(
      S.isMaxLength(1).annotate({
        expected: "a value with a length of at most 1",
      }),
    ),
  ),
}).pipe(
  $I.annoteSchema("ClusterMounts", {
    description: "Generated RUNPOD schema for ClusterMounts.",
    documentation:
      "Storage mounts for a cluster create: `persistent` or one `network`\nvolume, not both. Clusters cannot mount global volumes, so `global`\nis rejected with 422. A mount `path` must not be empty (rejected with 422): an\nempty path reads as unset and would mount the volume at the\ntemplate's path, or `/workspace` without a template.\n",
    identifier: "ClusterMounts",
  }),
);

/**
 * Type for {@link ClusterMounts}.
 *
 * **Example** (Reference the ClusterMounts type)
 *
 * ```ts
 * import type { ClusterMounts } from "@beep/runpod"
 *
 * type ClusterMountsValue = ClusterMounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClusterMounts = typeof ClusterMounts.Type;

/**
 * Generated RUNPOD schema for `CodeVerifier`.
 *
 * **Example** (Inspect the CodeVerifier schema)
 *
 * ```ts
 * import { CodeVerifier } from "@beep/runpod"
 *
 * console.log(CodeVerifier.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeVerifier = S.String.check(
  S.isPattern(new globalThis.RegExp("^[A-Za-z0-9._~-]{43,128}$", "u")).annotate(
    {
      expected: "a string matching the RegExp ^[A-Za-z0-9._~-]{43,128}$",
      identifier: "CodeVerifier",
    },
  ),
).pipe(
  $I.annoteSchema("CodeVerifier", {
    description: "Generated RUNPOD schema for CodeVerifier.",
    documentation:
      "The random secret whose SHA-256 hash was sent as `codeChallenge`.",
  }),
);

/**
 * Type for {@link CodeVerifier}.
 *
 * **Example** (Reference the CodeVerifier type)
 *
 * ```ts
 * import type { CodeVerifier } from "@beep/runpod"
 *
 * type CodeVerifierValue = CodeVerifier
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CodeVerifier = typeof CodeVerifier.Type;

/**
 * Generated RUNPOD schema for `Compliance`.
 *
 * **Example** (Inspect the Compliance schema)
 *
 * ```ts
 * import { Compliance } from "@beep/runpod"
 *
 * console.log(Compliance.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Compliance = S.Literals([
  "GDPR",
  "ISO_IEC_27001",
  "ISO_14001",
  "PCI_DSS",
  "HITRUST",
  "SOC_1_TYPE_2",
  "SOC_2_TYPE_2",
  "SOC_3_TYPE_2",
  "ITAR",
  "FISMA_HIGH",
  "HIPAA",
  "RENEWABLE",
]).pipe(
  $I.annoteSchema("Compliance", {
    description: "Generated RUNPOD schema for Compliance.",
    documentation: "Compliance certifications.",
    identifier: "Compliance",
  }),
);

/**
 * Type for {@link Compliance}.
 *
 * **Example** (Reference the Compliance type)
 *
 * ```ts
 * import type { Compliance } from "@beep/runpod"
 *
 * type ComplianceValue = Compliance
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Compliance = typeof Compliance.Type;

/**
 * Generated RUNPOD schema for `ContainerConfig`.
 *
 * **Example** (Inspect the ContainerConfig schema)
 *
 * ```ts
 * import { ContainerConfig } from "@beep/runpod"
 *
 * console.log(ContainerConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContainerConfig = S.StructWithRest(
  S.Struct({
    args: S.optionalKey(
      S.String.annotateKey({
        description:
          'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
      }),
    ),
    cmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    entrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    disk: S.optionalKey(
      S.Int.annotateKey({
        description: "Container disk in GB (ephemeral, wiped on restart)",
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({
        description: "Environment variables as key-value pairs",
      }),
    ),
    image: S.optionalKey(
      S.String.annotateKey({ description: "Docker image reference" }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description: "Exposed ports, formatted as port/protocol",
      }),
    ),
    registry: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ContainerConfig", {
    description: "Generated RUNPOD schema for ContainerConfig.",
    documentation:
      "Reusable container configuration shared across templates, pods, serverless endpoints, and clusters. Adding a field here automatically propagates to all of them.\n",
    identifier: "ContainerConfig",
  }),
);

/**
 * Type for {@link ContainerConfig}.
 *
 * **Example** (Reference the ContainerConfig type)
 *
 * ```ts
 * import type { ContainerConfig } from "@beep/runpod"
 *
 * type ContainerConfigValue = ContainerConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContainerConfig = typeof ContainerConfig.Type;

/**
 * Generated RUNPOD schema for `ResourceType`.
 *
 * **Example** (Inspect the ResourceType schema)
 *
 * ```ts
 * import { ResourceType } from "@beep/runpod"
 *
 * console.log(ResourceType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResourceType = S.Literals([
  "POD",
  "CLUSTER",
  "SERVERLESS_ENDPOINT",
  "NETWORK_VOLUME",
]).pipe(
  $I.annoteSchema("ResourceType", {
    description: "Generated RUNPOD schema for ResourceType.",
    documentation: "Kind of resource a cost center or tag can be attached to.",
    identifier: "ResourceType",
  }),
);

/**
 * Type for {@link ResourceType}.
 *
 * **Example** (Reference the ResourceType type)
 *
 * ```ts
 * import type { ResourceType } from "@beep/runpod"
 *
 * type ResourceTypeValue = ResourceType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResourceType = typeof ResourceType.Type;

/**
 * Generated RUNPOD schema for `CostCenterResource`.
 *
 * **Example** (Inspect the CostCenterResource schema)
 *
 * ```ts
 * import { CostCenterResource } from "@beep/runpod"
 *
 * console.log(CostCenterResource.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CostCenterResource = S.Struct({
  id: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  type: ResourceType,
}).pipe(
  $I.annoteSchema("CostCenterResource", {
    description: "Generated RUNPOD schema for CostCenterResource.",
    identifier: "CostCenterResource",
  }),
);

/**
 * Type for {@link CostCenterResource}.
 *
 * **Example** (Reference the CostCenterResource type)
 *
 * ```ts
 * import type { CostCenterResource } from "@beep/runpod"
 *
 * type CostCenterResourceValue = CostCenterResource
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CostCenterResource = typeof CostCenterResource.Type;

/**
 * Generated RUNPOD schema for `CpuConfig`.
 *
 * **Example** (Inspect the CpuConfig schema)
 *
 * ```ts
 * import { CpuConfig } from "@beep/runpod"
 *
 * console.log(CpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CpuConfig = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "CPU flavor identifier, as returned by GET /v2/catalog/cpus.",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
    vcpuCount: S.Int.annotateKey({
      description:
        "Number of vCPUs. Must be valid for the selected CPU flavor and must be a power of two.",
    }).check(
      S.isGreaterThanOrEqualTo(2).annotate({
        expected: "a value greater than or equal to 2",
      }),
    ),
    memory: S.Int.annotateKey({
      description: "Memory allocated to the pod in GB.",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CpuConfig", {
    description: "Generated RUNPOD schema for CpuConfig.",
    identifier: "CpuConfig",
  }),
);

/**
 * Type for {@link CpuConfig}.
 *
 * **Example** (Reference the CpuConfig type)
 *
 * ```ts
 * import type { CpuConfig } from "@beep/runpod"
 *
 * type CpuConfigValue = CpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CpuConfig = typeof CpuConfig.Type;

/**
 * Generated RUNPOD schema for `CpuProduct`.
 *
 * **Example** (Inspect the CpuProduct schema)
 *
 * ```ts
 * import { CpuProduct } from "@beep/runpod"
 *
 * console.log(CpuProduct.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CpuProduct = S.Literals(["POD", "SERVERLESS"]).pipe(
  $I.annoteSchema("CpuProduct", {
    description: "Generated RUNPOD schema for CpuProduct.",
    documentation:
      "CPU catalog product availability context. Availability is product-specific, so this is required whenever availability is requested.",
    identifier: "CpuProduct",
  }),
);

/**
 * Type for {@link CpuProduct}.
 *
 * **Example** (Reference the CpuProduct type)
 *
 * ```ts
 * import type { CpuProduct } from "@beep/runpod"
 *
 * type CpuProductValue = CpuProduct
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CpuProduct = typeof CpuProduct.Type;

/**
 * Generated RUNPOD schema for `DataCenterAvailability`.
 *
 * **Example** (Inspect the DataCenterAvailability schema)
 *
 * ```ts
 * import { DataCenterAvailability } from "@beep/runpod"
 *
 * console.log(DataCenterAvailability.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DataCenterAvailability = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Data center identifier." }),
    name: S.String.annotateKey({
      description: "Human-readable data center name.",
    }),
    availability: AvailabilityLevel,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("DataCenterAvailability", {
    description: "Generated RUNPOD schema for DataCenterAvailability.",
    identifier: "DataCenterAvailability",
  }),
);

/**
 * Type for {@link DataCenterAvailability}.
 *
 * **Example** (Reference the DataCenterAvailability type)
 *
 * ```ts
 * import type { DataCenterAvailability } from "@beep/runpod"
 *
 * type DataCenterAvailabilityValue = DataCenterAvailability
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DataCenterAvailability = typeof DataCenterAvailability.Type;

/**
 * Generated RUNPOD schema for `CpuType`.
 *
 * **Example** (Inspect the CpuType schema)
 *
 * ```ts
 * import { CpuType } from "@beep/runpod"
 *
 * console.log(CpuType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CpuType = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description: "CPU flavor identifier (use in cpu.id for pod creation)",
    }),
    name: S.String.annotateKey({ description: "Human-readable flavor name" }),
    group: S.String.annotateKey({ description: "CPU generation group" }),
    vcpu: S.StructWithRest(S.Struct({ min: S.Int, max: S.Int }), [
      S.Record(S.String, S.Json.annotate({ expected: "JSON value" })),
    ]),
    ramGbPerVcpu: S.Finite.annotateKey({
      description:
        "GB of RAM allocated per vCPU. Multiply by the chosen vCPU\ncount (within `vcpu.min`..`vcpu.max`) to get the total RAM\nfor an instance of this flavor. May be fractional.\n",
      format: "float",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    price: S.StructWithRest(
      S.Struct({
        securePerVcpu: S.Finite.annotateKey({
          description:
            "Price for secure pods per vCPU. Multiply by the chosen vCPU\ncount (within `vcpu.min`..`vcpu.max`) to get the total price.\n",
          format: "float",
        }).check(S.isFinite().annotate({ expected: "a finite number" })),
        serverlessPerVcpu: S.Finite.annotateKey({
          description:
            "Price for serverless per vCPU. Multiply by the chosen vCPU\ncount (within `vcpu.min`..`vcpu.max`) to get the total price.\n",
          format: "float",
        }).check(S.isFinite().annotate({ expected: "a finite number" })),
      }),
      [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
    ),
    availability: S.optionalKey(
      S.suspend(
        (): S.Codec<AvailabilityLevel> => AvailabilityLevel,
      ).annotateKey({
        description:
          "Overall CPU availability for the requested `product` contexts. Present only when requested with include=AVAILABILITY, which also requires `product`.",
      }),
    ),
    dataCenters: S.optionalKey(
      S.Array(DataCenterAvailability).annotateKey({
        description:
          "Per-datacenter CPU availability for the requested `product`\ncontexts, listing only the datacenters that offer this CPU flavor.\nPresent only when requested with include=AVAILABILITY, which also\nrequires `product`, and omitted entirely when the flavor is\nunavailable everywhere.\n",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CpuType", {
    description: "Generated RUNPOD schema for CpuType.",
    identifier: "CpuType",
  }),
);

/**
 * Type for {@link CpuType}.
 *
 * **Example** (Reference the CpuType type)
 *
 * ```ts
 * import type { CpuType } from "@beep/runpod"
 *
 * type CpuTypeValue = CpuType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CpuType = typeof CpuType.Type;

/**
 * Generated RUNPOD schema for `CreateAuthenticationAttemptRequest`.
 *
 * **Example** (Inspect the CreateAuthenticationAttemptRequest schema)
 *
 * ```ts
 * import { CreateAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * console.log(CreateAuthenticationAttemptRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateAuthenticationAttemptRequest = S.Struct({
  email: S.String.annotateKey({
    description:
      "Address to send the verification code to. It may belong to an existing account or a new one.",
    format: "email",
  }).check(
    S.isMaxCodePoints(254).annotate({
      expected: "a string with at most 254 code points",
    }),
  ),
  keyName: S.String.annotateKey({
    description: "Name of the API key issued when verification succeeds.",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(64).annotate({
        expected: "a string with at most 64 code points",
      }),
    ),
  codeChallenge: S.String.annotateKey({
    description:
      "Unpadded base64url SHA-256 hash of a random `codeVerifier` the caller keeps private. Verify and resend require the matching verifier.",
  }).check(
    S.isPattern(new globalThis.RegExp("^[A-Za-z0-9_-]{43}$", "u")).annotate({
      expected: "a string matching the RegExp ^[A-Za-z0-9_-]{43}$",
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateAuthenticationAttemptRequest", {
    description:
      "Generated RUNPOD schema for CreateAuthenticationAttemptRequest.",
    identifier: "CreateAuthenticationAttemptRequest",
  }),
);

/**
 * Type for {@link CreateAuthenticationAttemptRequest}.
 *
 * **Example** (Reference the CreateAuthenticationAttemptRequest type)
 *
 * ```ts
 * import type { CreateAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * type CreateAuthenticationAttemptRequestValue = CreateAuthenticationAttemptRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateAuthenticationAttemptRequest =
  typeof CreateAuthenticationAttemptRequest.Type;

/**
 * Generated RUNPOD schema for `CreateClusterRequest`.
 *
 * **Example** (Inspect the CreateClusterRequest schema)
 *
 * ```ts
 * import { CreateClusterRequest } from "@beep/runpod"
 *
 * console.log(CreateClusterRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateClusterRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  compute: ClusterCompute,
  name: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  type: ClusterType,
  templateId: S.optionalKey(
    S.String.annotateKey({
      description:
        "ID of a pod template to provision every member pod from. The\ntemplate supplies the container settings (image, args, disk,\nenv, ports) and the container registry credential for private\nimages. Mutually exclusive with `image`, `args`, `entrypoint`,\n`cmd`, `disk`, `env`, and `ports` (rejected with 400). `registry`\ncombines with it: an explicit `registry` overrides the\ntemplate's credential; omit it (or send `null` or an empty\nstring) to use the template's. `mounts`\ncombines with it too: the volume in `mounts` is attached to\nevery member pod, overriding the template's volume settings. The cluster\nretains the link: the `template` response field is set. Must be\na non-serverless pod template accessible to the caller.\n",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  dataCenterIds: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Preferred data centers for placement. Omit or pass an empty\narray to let the scheduler choose. A cluster is always placed\nwithin a single data center.\n",
    }),
  ),
  mounts: S.optionalKey(ClusterMounts),
  startJupyter: S.optionalKey(
    S.Boolean.annotateKey({
      description: "Start Jupyter on every member pod, as on pod create.",
      default: false,
    }),
  ),
  startSsh: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Provision SSH access on every member pod: injects a PUBLIC_KEY environment variable carrying your account's registered SSH public key. Same semantics as the pod create flag.",
      default: false,
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateClusterRequest", {
    description: "Generated RUNPOD schema for CreateClusterRequest.",
    identifier: "CreateClusterRequest",
  }),
);

/**
 * Type for {@link CreateClusterRequest}.
 *
 * **Example** (Reference the CreateClusterRequest type)
 *
 * ```ts
 * import type { CreateClusterRequest } from "@beep/runpod"
 *
 * type CreateClusterRequestValue = CreateClusterRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateClusterRequest = typeof CreateClusterRequest.Type;

/**
 * Generated RUNPOD schema for `CreateCostCenterRequest`.
 *
 * **Example** (Inspect the CreateCostCenterRequest schema)
 *
 * ```ts
 * import { CreateCostCenterRequest } from "@beep/runpod"
 *
 * console.log(CreateCostCenterRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateCostCenterRequest = S.Struct({
  value: S.String.annotateKey({
    description: "Leading and trailing whitespace is trimmed.",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(50).annotate({
        expected: "a string with at most 50 code points",
      }),
    )
    .check(
      S.isPattern(new globalThis.RegExp("^\\s*\\S", "u")).annotate({
        expected: "a string matching the RegExp ^\\s*\\S",
      }),
    ),
  resources: S.optionalKey(
    S.Array(CostCenterResource)
      .annotateKey({
        description: "Resources to attribute to the new cost center.",
      })
      .check(
        S.isMaxLength(100).annotate({
          expected: "a value with a length of at most 100",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("CreateCostCenterRequest", {
    description: "Generated RUNPOD schema for CreateCostCenterRequest.",
    identifier: "CreateCostCenterRequest",
  }),
);

/**
 * Type for {@link CreateCostCenterRequest}.
 *
 * **Example** (Reference the CreateCostCenterRequest type)
 *
 * ```ts
 * import type { CreateCostCenterRequest } from "@beep/runpod"
 *
 * type CreateCostCenterRequestValue = CreateCostCenterRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateCostCenterRequest = typeof CreateCostCenterRequest.Type;

/**
 * Generated RUNPOD schema for `CreateCpuConfig`.
 *
 * **Example** (Inspect the CreateCpuConfig schema)
 *
 * ```ts
 * import { CreateCpuConfig } from "@beep/runpod"
 *
 * console.log(CreateCpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateCpuConfig = S.Struct({
  id: S.String.annotateKey({
    description: "CPU flavor identifier, as returned by GET /v2/catalog/cpus.",
  }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  vcpuCount: S.Int.annotateKey({
    description:
      "Number of vCPUs. Must be valid for the selected CPU flavor and must be a power of two.",
  }).check(
    S.isGreaterThanOrEqualTo(2).annotate({
      expected: "a value greater than or equal to 2",
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateCpuConfig", {
    description: "Generated RUNPOD schema for CreateCpuConfig.",
    identifier: "CreateCpuConfig",
  }),
);

/**
 * Type for {@link CreateCpuConfig}.
 *
 * **Example** (Reference the CreateCpuConfig type)
 *
 * ```ts
 * import type { CreateCpuConfig } from "@beep/runpod"
 *
 * type CreateCpuConfigValue = CreateCpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateCpuConfig = typeof CreateCpuConfig.Type;

/**
 * Generated RUNPOD schema for `CreateDelegationRequest`.
 *
 * **Example** (Inspect the CreateDelegationRequest schema)
 *
 * ```ts
 * import { CreateDelegationRequest } from "@beep/runpod"
 *
 * console.log(CreateDelegationRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateDelegationRequest = S.Struct({
  resource: S.String.annotateKey({ description: "ECR resource ARN" }),
  name: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description: "Optional name for the delegation",
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateDelegationRequest", {
    description: "Generated RUNPOD schema for CreateDelegationRequest.",
    identifier: "CreateDelegationRequest",
  }),
);

/**
 * Type for {@link CreateDelegationRequest}.
 *
 * **Example** (Reference the CreateDelegationRequest type)
 *
 * ```ts
 * import type { CreateDelegationRequest } from "@beep/runpod"
 *
 * type CreateDelegationRequestValue = CreateDelegationRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateDelegationRequest = typeof CreateDelegationRequest.Type;

/**
 * Generated RUNPOD schema for `CreateEndpointGpuConfig`.
 *
 * **Example** (Inspect the CreateEndpointGpuConfig schema)
 *
 * ```ts
 * import { CreateEndpointGpuConfig } from "@beep/runpod"
 *
 * console.log(CreateEndpointGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateEndpointGpuConfig = S.Struct({
  pools: S.Array(S.String)
    .annotateKey({
      description:
        'Serverless GPU pool IDs (as returned by `GET /v2/catalog/gpus` in\n`pool`). Workers are placed on whichever listed pool has capacity.\nNarrow a pool down to specific cards with `excludedTypes`.\n\nOn `PATCH`, `pools` and `excludedTypes` are one selection and are\nreplaced together, so sending `pools` by itself **clears the\nexclusions**. Two cases:\n\n- **Changing pools, keeping exclusions** — send both fields in one\n  request: `{"gpu": {"pools": ["ADA_24"], "excludedTypes":\n  ["NVIDIA L40"]}}`. `GET` the endpoint first to read the current\n  `excludedTypes` and resend the ones that still apply to the new\n  pools; an exclusion naming a type outside `pools` is a 400.\n- **Changing only `count` or a CUDA constraint** — omit `pools`:\n  `{"gpu": {"minCudaVersion": "12.4"}}`. The pool list and the\n  exclusions are both left exactly as they are.\n\n`excludedTypes` documents the full rule.\n',
    })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  excludedTypes: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\s*[^-\\s]", "u")).annotate({
          expected: "a string matching the RegExp ^\\s*[^-\\s]",
        }),
      ),
    )
      .annotateKey({
        description:
          'GPU **type** IDs to subtract from the selected pools — the `id`\nfield of `GET /v2/catalog/gpus`, the same identifiers pods take in\n`gpu.id`. Workers run on every type in `pools` except these. Omit to\nuse the whole pool.\n\nPools stay the unit of selection; types are the unit of\nsubtraction. There is no inclusive allowlist: a card later added to\none of your pools becomes eligible, which is the honest reading of\n"this pool, minus these".\n\nTied to `pools`, because the two together are one selection:\nsupplying `pools` replaces that selection wholesale, so a `PATCH`\nsending `pools` **without `excludedTypes`** **clears** them —\nrestate them to keep them. A `PATCH` that omits `pools` leaves both\nthe pools and the exclusions untouched, so changing only a CUDA\nconstraint cannot widen a pinned endpoint.\n\nRejected with 400 if a value is not a GPU type in one of `pools`,\nso a typo cannot produce a filter that does nothing. Surrounding whitespace\nis trimmed, so `" NVIDIA L40"` and `"NVIDIA L40"` mean the same card.\n',
      })
      .check(S.isUnique().annotate({ expected: "an array with unique items" })),
  ),
  count: S.optionalKey(
    S.Int.annotateKey({ description: "GPUs per worker", default: 1 }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  allowedCudaVersions: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
          expected: "a string matching the RegExp ^\\d+\\.\\d+$",
        }),
      ),
    ).annotateKey({
      description:
        "Acceptable CUDA versions for worker placement, as\n`major.minor`. Omit to accept any version (or inherit the\ntemplate's constraint when creating from `templateId`).\nMatching is exact — discover valid values per GPU type via\n`GET /v2/catalog/gpus?include=AVAILABILITY&product=SERVERLESS`\n(`cudaVersions`).\n\nA non-empty set is mutually exclusive with minCudaVersion (400\nif both are sent). An explicit `[]` states no constraint, so it\nmay accompany a floor.\n",
    }),
  ),
  minCudaVersion: S.optionalKey(
    S.String.annotateKey({
      description:
        "Lowest acceptable CUDA version for worker placement, as\n`major.minor`, compared numerically rather than as a decimal —\nso 12.11 is above 12.2. Use this for an open-ended floor and\nallowedCudaVersions for an exact set.\n\nMutually exclusive with a non-empty allowedCudaVersions (400 if\nboth are sent); an explicit `[]` there states no constraint and\nmay accompany this floor.\n",
    }).check(
      S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
        expected: "a string matching the RegExp ^\\d+\\.\\d+$",
      }),
    ),
  ),
}).pipe(
  $I.annoteSchema("CreateEndpointGpuConfig", {
    description: "Generated RUNPOD schema for CreateEndpointGpuConfig.",
    documentation:
      "GPU request for an endpoint create. Carries the CUDA constraints, which\nlive here rather than at the body's top level so they are\nunrepresentable on a CPU endpoint.\n",
    identifier: "CreateEndpointGpuConfig",
  }),
);

/**
 * Type for {@link CreateEndpointGpuConfig}.
 *
 * **Example** (Reference the CreateEndpointGpuConfig type)
 *
 * ```ts
 * import type { CreateEndpointGpuConfig } from "@beep/runpod"
 *
 * type CreateEndpointGpuConfigValue = CreateEndpointGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateEndpointGpuConfig = typeof CreateEndpointGpuConfig.Type;

/**
 * Generated RUNPOD schema for `QueueDelayScaling`.
 *
 * **Example** (Inspect the QueueDelayScaling schema)
 *
 * ```ts
 * import { QueueDelayScaling } from "@beep/runpod"
 *
 * console.log(QueueDelayScaling.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueueDelayScaling = S.Struct({
  type: S.tag("QUEUE_DELAY").annotateKey({
    description: "Scaler discriminator. Always `QUEUE_DELAY` for this variant.",
  }),
  queueDelay: S.Finite.annotateKey({
    description:
      "Adjusts the number of workers based on how long requests wait in the queue.",
    format: "float",
  })
    .check(S.isFinite().annotate({ expected: "a finite number" }))
    .check(
      S.isGreaterThanOrEqualTo(0.5).annotate({
        expected: "a value greater than or equal to 0.5",
      }),
    ),
}).pipe(
  $I.annoteSchema("QueueDelayScaling", {
    description: "Generated RUNPOD schema for QueueDelayScaling.",
    documentation: "Scale on queue wait time. Queue-based endpoints only.",
    identifier: "QueueDelayScaling",
  }),
);

/**
 * Type for {@link QueueDelayScaling}.
 *
 * **Example** (Reference the QueueDelayScaling type)
 *
 * ```ts
 * import type { QueueDelayScaling } from "@beep/runpod"
 *
 * type QueueDelayScalingValue = QueueDelayScaling
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueueDelayScaling = typeof QueueDelayScaling.Type;

/**
 * Generated RUNPOD schema for `RequestCountScaling`.
 *
 * **Example** (Inspect the RequestCountScaling schema)
 *
 * ```ts
 * import { RequestCountScaling } from "@beep/runpod"
 *
 * console.log(RequestCountScaling.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RequestCountScaling = S.Struct({
  type: S.tag("REQUEST_COUNT").annotateKey({
    description:
      "Scaler discriminator. Always `REQUEST_COUNT` for this variant.",
  }),
  requestCount: S.Int.annotateKey({
    description:
      "Adjusts the number of workers based on active in-flight requests.",
  }).check(
    S.isGreaterThanOrEqualTo(1).annotate({
      expected: "a value greater than or equal to 1",
    }),
  ),
}).pipe(
  $I.annoteSchema("RequestCountScaling", {
    description: "Generated RUNPOD schema for RequestCountScaling.",
    documentation:
      "Scale on concurrent in-flight requests per worker. Required for\nload-balancing endpoints; also selectable for queue-based.\n",
    identifier: "RequestCountScaling",
  }),
);

/**
 * Type for {@link RequestCountScaling}.
 *
 * **Example** (Reference the RequestCountScaling type)
 *
 * ```ts
 * import type { RequestCountScaling } from "@beep/runpod"
 *
 * type RequestCountScalingValue = RequestCountScaling
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RequestCountScaling = typeof RequestCountScaling.Type;

/**
 * Generated RUNPOD schema for `EndpointScaling`.
 *
 * **Example** (Inspect the EndpointScaling schema)
 *
 * ```ts
 * import { EndpointScaling } from "@beep/runpod"
 *
 * console.log(EndpointScaling.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointScaling = S.Union(
  [QueueDelayScaling, RequestCountScaling],
  { mode: "oneOf" },
).pipe(
  $I.annoteSchema("EndpointScaling", {
    description: "Generated RUNPOD schema for EndpointScaling.",
    documentation:
      "Autoscaling signal — a discriminated union on `type`: `QUEUE_DELAY`\n(queue-based endpoints only) or `REQUEST_COUNT`. The scaler is chosen\nindependently of the endpoint's routing `type` and can be switched on\nupdate.\n",
    identifier: "EndpointScaling",
  }),
);

/**
 * Type for {@link EndpointScaling}.
 *
 * **Example** (Reference the EndpointScaling type)
 *
 * ```ts
 * import type { EndpointScaling } from "@beep/runpod"
 *
 * type EndpointScalingValue = EndpointScaling
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointScaling = typeof EndpointScaling.Type;

/**
 * Generated RUNPOD schema for `EndpointType`.
 *
 * **Example** (Inspect the EndpointType schema)
 *
 * ```ts
 * import { EndpointType } from "@beep/runpod"
 *
 * console.log(EndpointType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointType = S.Literals(["QUEUE", "LOAD_BALANCER"]).pipe(
  $I.annoteSchema("EndpointType", {
    description: "Generated RUNPOD schema for EndpointType.",
    documentation:
      "Request-routing semantics for a modern serverless endpoint.\n- `QUEUE` — submit asynchronous or synchronous jobs through the managed queue.\n- `LOAD_BALANCER` — send requests directly to worker-defined HTTP paths.\n  Configure via `env`: `PORT` (server port, default 80), `PORT_HEALTH`\n  (health-check port, default 80), and `HEALTH_CHECK_PATH` (path the\n  load balancer polls for worker health, default `/ping`).\n",
    identifier: "EndpointType",
  }),
);

/**
 * Type for {@link EndpointType}.
 *
 * **Example** (Reference the EndpointType type)
 *
 * ```ts
 * import type { EndpointType } from "@beep/runpod"
 *
 * type EndpointTypeValue = EndpointType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointType = typeof EndpointType.Type;

/**
 * Generated RUNPOD schema for `FlashBoot`.
 *
 * **Example** (Inspect the FlashBoot schema)
 *
 * ```ts
 * import { FlashBoot } from "@beep/runpod"
 *
 * console.log(FlashBoot.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FlashBoot = S.Literals([
  "OFF",
  "FLASHBOOT",
  "PRIORITY_FLASHBOOT",
]).pipe(
  $I.annoteSchema("FlashBoot", {
    description: "Generated RUNPOD schema for FlashBoot.",
    documentation:
      "FlashBoot cold-start acceleration mode.\n- `OFF`                — disabled\n- `FLASHBOOT`          — enabled\n- `PRIORITY_FLASHBOOT` — enabled with priority capacity\n",
    identifier: "FlashBoot",
  }),
);

/**
 * Type for {@link FlashBoot}.
 *
 * **Example** (Reference the FlashBoot type)
 *
 * ```ts
 * import type { FlashBoot } from "@beep/runpod"
 *
 * type FlashBootValue = FlashBoot
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FlashBoot = typeof FlashBoot.Type;

/**
 * Generated RUNPOD schema for `EndpointMount`.
 *
 * **Example** (Inspect the EndpointMount schema)
 *
 * ```ts
 * import { EndpointMount } from "@beep/runpod"
 *
 * console.log(EndpointMount.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointMount = S.Struct({
  volumeId: S.String.annotateKey({
    description:
      "ID of a NetworkVolume (under `network`) or GlobalVolume (under `global`).",
  }),
}).pipe(
  $I.annoteSchema("EndpointMount", {
    description: "Generated RUNPOD schema for EndpointMount.",
    documentation:
      "A volume mounted on every worker, always at `/runpod-volume`. Custom\npaths are not supported yet.\n",
    identifier: "EndpointMount",
  }),
);

/**
 * Type for {@link EndpointMount}.
 *
 * **Example** (Reference the EndpointMount type)
 *
 * ```ts
 * import type { EndpointMount } from "@beep/runpod"
 *
 * type EndpointMountValue = EndpointMount
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointMount = typeof EndpointMount.Type;

/**
 * Generated RUNPOD schema for `EndpointMountsInput`.
 *
 * **Example** (Inspect the EndpointMountsInput schema)
 *
 * ```ts
 * import { EndpointMountsInput } from "@beep/runpod"
 *
 * console.log(EndpointMountsInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointMountsInput = S.Struct({
  network: S.optionalKey(
    S.Array(EndpointMount).annotateKey({
      description: "Network volumes, at most one per data center.",
    }),
  ),
  global: S.optionalKey(
    S.Array(EndpointMount).check(
      S.isMaxLength(1).annotate({
        expected: "a value with a length of at most 1",
      }),
    ),
  ),
}).pipe(
  $I.annoteSchema("EndpointMountsInput", {
    description: "Generated RUNPOD schema for EndpointMountsInput.",
    documentation:
      "Volumes to mount on the endpoint's workers. A `network` or `global`\nlist that is present replaces the endpoint's current list of that kind;\nan empty list detaches it, and an omitted list is left unchanged. Both\nkinds cannot be present on the endpoint at once, so to switch kinds send\n`[]` for one and the new list for the other in the same request. Changes\napply to workers created afterwards. At most one global volume, GPU\nendpoints only. `network` may accompany the deprecated `networkVolumes` field\nonly if the two agree exactly.\n",
    identifier: "EndpointMountsInput",
  }),
);

/**
 * Type for {@link EndpointMountsInput}.
 *
 * **Example** (Reference the EndpointMountsInput type)
 *
 * ```ts
 * import type { EndpointMountsInput } from "@beep/runpod"
 *
 * type EndpointMountsInputValue = EndpointMountsInput
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointMountsInput = typeof EndpointMountsInput.Type;

/**
 * Generated RUNPOD schema for `CreateEndpointRequest`.
 *
 * **Example** (Inspect the CreateEndpointRequest schema)
 *
 * ```ts
 * import { CreateEndpointRequest } from "@beep/runpod"
 *
 * console.log(CreateEndpointRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateEndpointRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  gpu: S.optionalKey(CreateEndpointGpuConfig),
  name: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  scaling: EndpointScaling,
  type: S.suspend((): S.Codec<EndpointType> => EndpointType).annotateKey({
    description:
      "Request-routing model. Required — it determines the valid scaler\nand request URLs, so it must be chosen explicitly on every create.\n",
  }),
  cpu: S.optionalKey(
    S.Array(CreateCpuConfig)
      .annotateKey({
        description:
          "Eligible CPU configurations for each worker. Memory is derived from the\nselected flavor's catalog RAM multiplier. Exact duplicate configurations\nare rejected; the same flavor may be listed at different vCPU counts.\n",
      })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      )
      .check(S.isUnique().annotate({ expected: "an array with unique items" })),
  ),
  dataCenterIds: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Preferred data centers for placement. Omit or pass an empty array to let the scheduler choose.",
    }),
  ),
  flashboot: S.optionalKey(
    S.suspend((): S.Codec<FlashBoot> => FlashBoot).annotateKey({
      default: "OFF",
    }),
  ),
  networkVolumes: S.optionalKey(
    S.Array(S.String).annotateKey({ description: "Network volume IDs." }),
  ),
  mounts: S.optionalKey(EndpointMountsInput),
  templateId: S.optionalKey(
    S.String.annotateKey({
      description:
        "ID of a serverless template to base this endpoint on. The\ntemplate is resolved at create time into the same container\nsettings you could otherwise spread into this body (image,\nargs, disk, ports, env, registry); explicit body fields\noverride the template's, except `env`, which is merged per\nkey with body values winning. The template's\nallowedCudaVersions seeds `gpu.allowedCudaVersions` when the\nbody omits it — but only for a GPU create, since a CPU endpoint\nhas no gpu block to seed into, and not when the body sets\n`gpu.minCudaVersion`, since seeding a set beside a floor would\nmanufacture the mutual-exclusion 400 from a valid request. Its\npod-specific startSsh/startJupyter flags are\nignored. Later template edits do not affect the endpoint.\nThe template may be one of your own or a public catalog\ntemplate — see `GET /v2/catalog/templates` (unknown or\ninaccessible ID → 404) — and must be a serverless template\n(→ 422).\n",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  timeout: S.optionalKey(S.Int.annotateKey({ default: 300000 })),
  workers: S.optionalKey(
    S.Struct({
      min: S.optionalKey(
        S.Int.annotateKey({ default: 0 }).check(
          S.isGreaterThanOrEqualTo(0).annotate({
            expected: "a value greater than or equal to 0",
            description: "Minimum number of workers.",
          }),
        ),
      ),
      max: S.optionalKey(
        S.Int.annotateKey({ default: 3 }).check(
          S.isGreaterThanOrEqualTo(0).annotate({
            expected: "a value greater than or equal to 0",
            description: "Maximum number of workers.",
          }),
        ),
      ),
      idleTimeout: S.optionalKey(
        S.Int.annotateKey({ default: 10 }).check(
          S.makeFilterGroup([
            S.isGreaterThanOrEqualTo(1).annotate({
              expected: "a value greater than or equal to 1",
            }),
            S.isLessThanOrEqualTo(3600).annotate({
              expected: "a value less than or equal to 3600",
            }),
          ]).annotate({
            description:
              "Seconds before idle workers scale down. Not applicable to queue-based\nendpoints scaling on `requestCount` — rejected on create/update and\nomitted from responses for that combination.\n",
          }),
        ),
      ),
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateEndpointRequest", {
    description: "Generated RUNPOD schema for CreateEndpointRequest.",
    identifier: "CreateEndpointRequest",
  }),
);

/**
 * Type for {@link CreateEndpointRequest}.
 *
 * **Example** (Reference the CreateEndpointRequest type)
 *
 * ```ts
 * import type { CreateEndpointRequest } from "@beep/runpod"
 *
 * type CreateEndpointRequestValue = CreateEndpointRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateEndpointRequest = typeof CreateEndpointRequest.Type;

/**
 * Generated RUNPOD schema for `CreateGlobalVolumeRequest`.
 *
 * **Example** (Inspect the CreateGlobalVolumeRequest schema)
 *
 * ```ts
 * import { CreateGlobalVolumeRequest } from "@beep/runpod"
 *
 * console.log(CreateGlobalVolumeRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateGlobalVolumeRequest = S.Struct({
  name: S.String.annotateKey({
    description:
      "Human-readable name, 1–191 characters with at least one non-whitespace character. Leading and trailing whitespace is trimmed.\n",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(191).annotate({
        expected: "a string with at most 191 code points",
      }),
    )
    .check(
      S.isPattern(
        new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　]", "u"),
      ).annotate({
        expected:
          "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　]",
      }),
    ),
}).pipe(
  $I.annoteSchema("CreateGlobalVolumeRequest", {
    description: "Generated RUNPOD schema for CreateGlobalVolumeRequest.",
    identifier: "CreateGlobalVolumeRequest",
  }),
);

/**
 * Type for {@link CreateGlobalVolumeRequest}.
 *
 * **Example** (Reference the CreateGlobalVolumeRequest type)
 *
 * ```ts
 * import type { CreateGlobalVolumeRequest } from "@beep/runpod"
 *
 * type CreateGlobalVolumeRequestValue = CreateGlobalVolumeRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateGlobalVolumeRequest = typeof CreateGlobalVolumeRequest.Type;

/**
 * Generated RUNPOD schema for `CreateGpuConfig`.
 *
 * **Example** (Inspect the CreateGpuConfig schema)
 *
 * ```ts
 * import { CreateGpuConfig } from "@beep/runpod"
 *
 * console.log(CreateGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateGpuConfig = S.Struct({
  id: S.String.annotateKey({ description: "GPU type identifier" }),
  count: S.optionalKey(
    S.Int.annotateKey({ description: "Number of GPUs", default: 1 })
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(1024).annotate({
          expected: "a value less than or equal to 1024",
        }),
      ),
  ),
  allowedCudaVersions: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
          expected: "a string matching the RegExp ^\\d+\\.\\d+$",
        }),
      ),
    ).annotateKey({
      description:
        "Acceptable CUDA versions for the host machine, as `major.minor`.\nOmit to accept any version. Matching is exact, so a version no\nmachine reports yields a capacity error rather than a fallback —\ndiscover valid values per GPU type via\n`GET /v2/catalog/gpus?include=AVAILABILITY&product=POD`\n(`cudaVersions`).\n\nA non-empty set is mutually exclusive with minCudaVersion (400\nif both are sent). An explicit `[]` states no constraint, so it\nmay accompany a floor.\n",
    }),
  ),
  minCudaVersion: S.optionalKey(
    S.String.annotateKey({
      description:
        "Lowest acceptable CUDA version for the host machine, as\n`major.minor`, compared numerically rather than as a decimal —\nso 12.11 is above 12.2. Use this for an open-ended floor and\nallowedCudaVersions for an exact set.\n\nMutually exclusive with a non-empty allowedCudaVersions (400 if\nboth are sent); an explicit `[]` there states no constraint and\nmay accompany this floor.\n",
    }).check(
      S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
        expected: "a string matching the RegExp ^\\d+\\.\\d+$",
      }),
    ),
  ),
  minRamPerGpu: S.optionalKey(
    S.Int.annotateKey({
      description:
        "Minimum host system RAM in GB per requested GPU. This is a placement filter, not a resource request. The actual total allocated system RAM may be higher and is returned in gpu.memory.",
    })
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(65536).annotate({
          expected: "a value less than or equal to 65536",
        }),
      ),
  ),
  minVcpuCountPerGpu: S.optionalKey(
    S.Int.annotateKey({
      description:
        "Minimum host vCPU count per requested GPU. This is a placement filter, not a resource request. The actual total allocated vCPU count may be higher and is returned in gpu.vcpuCount.",
    })
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(4096).annotate({
          expected: "a value less than or equal to 4096",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("CreateGpuConfig", {
    description: "Generated RUNPOD schema for CreateGpuConfig.",
    documentation:
      "GPU request for a pod create. Carries the CUDA host constraints, which\nlive here rather than at the body's top level so they are\nunrepresentable on a CPU pod.\n",
    identifier: "CreateGpuConfig",
  }),
);

/**
 * Type for {@link CreateGpuConfig}.
 *
 * **Example** (Reference the CreateGpuConfig type)
 *
 * ```ts
 * import type { CreateGpuConfig } from "@beep/runpod"
 *
 * type CreateGpuConfigValue = CreateGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateGpuConfig = typeof CreateGpuConfig.Type;

/**
 * Generated RUNPOD schema for `VolumeType`.
 *
 * **Example** (Inspect the VolumeType schema)
 *
 * ```ts
 * import { VolumeType } from "@beep/runpod"
 *
 * console.log(VolumeType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VolumeType = S.Literals(["STANDARD", "HIGH_PERFORMANCE"]).pipe(
  $I.annoteSchema("VolumeType", {
    description: "Generated RUNPOD schema for VolumeType.",
    documentation: "Data center network volume storage type.",
    identifier: "VolumeType",
  }),
);

/**
 * Type for {@link VolumeType}.
 *
 * **Example** (Reference the VolumeType type)
 *
 * ```ts
 * import type { VolumeType } from "@beep/runpod"
 *
 * type VolumeTypeValue = VolumeType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VolumeType = typeof VolumeType.Type;

/**
 * Generated RUNPOD schema for `CreateNetworkVolumeRequest`.
 *
 * **Example** (Inspect the CreateNetworkVolumeRequest schema)
 *
 * ```ts
 * import { CreateNetworkVolumeRequest } from "@beep/runpod"
 *
 * console.log(CreateNetworkVolumeRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateNetworkVolumeRequest = S.Struct({
  dataCenter: S.String.annotateKey({
    description: "Data center in which to create the volume",
  }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  name: S.String.annotateKey({ description: "Human-readable name" }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  size: S.Int.annotateKey({ description: "Storage to allocate in GB" })
    .check(
      S.isGreaterThanOrEqualTo(10).annotate({
        expected: "a value greater than or equal to 10",
      }),
    )
    .check(
      S.isLessThanOrEqualTo(4096).annotate({
        expected: "a value less than or equal to 4096",
      }),
    ),
  type: S.optionalKey(
    S.suspend((): S.Codec<VolumeType> => VolumeType).annotateKey({
      description:
        "Storage tier for the volume. Optional. When omitted, the volume is\nprovisioned using the requested data center's default (primary)\nstorage tier. HIGH_PERFORMANCE provisions a high-performance (HPS)\nvolume; STANDARD provisions a standard volume. A volume's tier is\nimmutable after creation.\n",
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateNetworkVolumeRequest", {
    description: "Generated RUNPOD schema for CreateNetworkVolumeRequest.",
    identifier: "CreateNetworkVolumeRequest",
  }),
);

/**
 * Type for {@link CreateNetworkVolumeRequest}.
 *
 * **Example** (Reference the CreateNetworkVolumeRequest type)
 *
 * ```ts
 * import type { CreateNetworkVolumeRequest } from "@beep/runpod"
 *
 * type CreateNetworkVolumeRequestValue = CreateNetworkVolumeRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateNetworkVolumeRequest = typeof CreateNetworkVolumeRequest.Type;

/**
 * Generated RUNPOD schema for `CreateOrganizationGroupRequest`.
 *
 * **Example** (Inspect the CreateOrganizationGroupRequest schema)
 *
 * ```ts
 * import { CreateOrganizationGroupRequest } from "@beep/runpod"
 *
 * console.log(CreateOrganizationGroupRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateOrganizationGroupRequest = S.Struct({
  name: S.String.annotateKey({
    description:
      "Group name with at least one non-whitespace character; surrounding whitespace is trimmed.",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(191).annotate({
        expected: "a string with at most 191 code points",
      }),
    )
    .check(
      S.isPattern(
        new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　]", "u"),
      ).annotate({
        expected:
          "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　]",
      }),
    ),
}).pipe(
  $I.annoteSchema("CreateOrganizationGroupRequest", {
    description: "Generated RUNPOD schema for CreateOrganizationGroupRequest.",
    identifier: "CreateOrganizationGroupRequest",
  }),
);

/**
 * Type for {@link CreateOrganizationGroupRequest}.
 *
 * **Example** (Reference the CreateOrganizationGroupRequest type)
 *
 * ```ts
 * import type { CreateOrganizationGroupRequest } from "@beep/runpod"
 *
 * type CreateOrganizationGroupRequestValue = CreateOrganizationGroupRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateOrganizationGroupRequest =
  typeof CreateOrganizationGroupRequest.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleInput`.
 *
 * **Example** (Inspect the OrganizationRoleInput schema)
 *
 * ```ts
 * import { OrganizationRoleInput } from "@beep/runpod"
 *
 * console.log(OrganizationRoleInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleInput = S.Struct({
  id: S.String.annotateKey({
    description:
      "Role ID, as reported on a member or an invite: `builtin:admin`, `builtin:dev`, `builtin:billing`, `builtin:basic`, or a custom role's own ID.",
  }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
}).pipe(
  $I.annoteSchema("OrganizationRoleInput", {
    description: "Generated RUNPOD schema for OrganizationRoleInput.",
    documentation: "An organization role to assign, by ID.",
    identifier: "OrganizationRoleInput",
  }),
);

/**
 * Type for {@link OrganizationRoleInput}.
 *
 * **Example** (Reference the OrganizationRoleInput type)
 *
 * ```ts
 * import type { OrganizationRoleInput } from "@beep/runpod"
 *
 * type OrganizationRoleInputValue = OrganizationRoleInput
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleInput = typeof OrganizationRoleInput.Type;

/**
 * Generated RUNPOD schema for `CreateOrganizationInviteRequest`.
 *
 * **Example** (Inspect the CreateOrganizationInviteRequest schema)
 *
 * ```ts
 * import { CreateOrganizationInviteRequest } from "@beep/runpod"
 *
 * console.log(CreateOrganizationInviteRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateOrganizationInviteRequest = S.Struct({
  email: S.String.annotateKey({
    description:
      "Address to invite, stored lowercased. The invitee accepts by signing in with a verified account on this address.",
    format: "email",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(254).annotate({
        expected: "a string with at most 254 code points",
      }),
    ),
  role: OrganizationRoleInput,
}).pipe(
  $I.annoteSchema("CreateOrganizationInviteRequest", {
    description: "Generated RUNPOD schema for CreateOrganizationInviteRequest.",
    identifier: "CreateOrganizationInviteRequest",
  }),
);

/**
 * Type for {@link CreateOrganizationInviteRequest}.
 *
 * **Example** (Reference the CreateOrganizationInviteRequest type)
 *
 * ```ts
 * import type { CreateOrganizationInviteRequest } from "@beep/runpod"
 *
 * type CreateOrganizationInviteRequestValue = CreateOrganizationInviteRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateOrganizationInviteRequest =
  typeof CreateOrganizationInviteRequest.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleName`.
 *
 * **Example** (Inspect the OrganizationRoleName schema)
 *
 * ```ts
 * import { OrganizationRoleName } from "@beep/runpod"
 *
 * console.log(OrganizationRoleName.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleName = S.String.check(
  S.isMinLength(1).annotate({
    expected: "a value with a length of at least 1",
  }),
)
  .check(
    S.isMaxCodePoints(191).annotate({
      expected: "a string with at most 191 code points",
    }),
  )
  .check(
    S.isPattern(
      new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　]", "u"),
    ).annotate({
      expected:
        "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　]",
      identifier: "OrganizationRoleName",
    }),
  )
  .pipe(
    $I.annoteSchema("OrganizationRoleName", {
      description: "Generated RUNPOD schema for OrganizationRoleName.",
      documentation:
        "Display name, 1–191 characters with at least one non-whitespace character. Leading and trailing whitespace is trimmed. It must be unique within the organization and cannot be a built-in role's name.",
    }),
  );

/**
 * Type for {@link OrganizationRoleName}.
 *
 * **Example** (Reference the OrganizationRoleName type)
 *
 * ```ts
 * import type { OrganizationRoleName } from "@beep/runpod"
 *
 * type OrganizationRoleNameValue = OrganizationRoleName
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleName = typeof OrganizationRoleName.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleCapabilitiesInput`.
 *
 * **Example** (Inspect the OrganizationRoleCapabilitiesInput schema)
 *
 * ```ts
 * import { OrganizationRoleCapabilitiesInput } from "@beep/runpod"
 *
 * console.log(OrganizationRoleCapabilitiesInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleCapabilitiesInput = S.Array(
  S.String.check(
    S.isPattern(new globalThis.RegExp("^[A-Z0-9_]+:[A-Z0-9_]+$", "u")).annotate(
      { expected: "a string matching the RegExp ^[A-Z0-9_]+:[A-Z0-9_]+$" },
    ),
  ),
)
  .check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  )
  .check(
    S.isUnique().annotate({
      expected: "an array with unique items",
      identifier: "OrganizationRoleCapabilitiesInput",
    }),
  )
  .pipe(
    $I.annoteSchema("OrganizationRoleCapabilitiesInput", {
      description:
        "Generated RUNPOD schema for OrganizationRoleCapabilitiesInput.",
      documentation:
        "What the role grants, as `FAMILY:VERB` capabilities from `GET /v2/organization/roles/capabilities`. The caller must hold every capability it lists.",
    }),
  );

/**
 * Type for {@link OrganizationRoleCapabilitiesInput}.
 *
 * **Example** (Reference the OrganizationRoleCapabilitiesInput type)
 *
 * ```ts
 * import type { OrganizationRoleCapabilitiesInput } from "@beep/runpod"
 *
 * type OrganizationRoleCapabilitiesInputValue = OrganizationRoleCapabilitiesInput
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleCapabilitiesInput =
  typeof OrganizationRoleCapabilitiesInput.Type;

/**
 * Generated RUNPOD schema for `CreateOrganizationRoleRequest`.
 *
 * **Example** (Inspect the CreateOrganizationRoleRequest schema)
 *
 * ```ts
 * import { CreateOrganizationRoleRequest } from "@beep/runpod"
 *
 * console.log(CreateOrganizationRoleRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateOrganizationRoleRequest = S.Struct({
  name: OrganizationRoleName,
  capabilities: OrganizationRoleCapabilitiesInput,
}).pipe(
  $I.annoteSchema("CreateOrganizationRoleRequest", {
    description: "Generated RUNPOD schema for CreateOrganizationRoleRequest.",
    identifier: "CreateOrganizationRoleRequest",
  }),
);

/**
 * Type for {@link CreateOrganizationRoleRequest}.
 *
 * **Example** (Reference the CreateOrganizationRoleRequest type)
 *
 * ```ts
 * import type { CreateOrganizationRoleRequest } from "@beep/runpod"
 *
 * type CreateOrganizationRoleRequestValue = CreateOrganizationRoleRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateOrganizationRoleRequest =
  typeof CreateOrganizationRoleRequest.Type;

/**
 * Generated RUNPOD schema for `GlobalMount`.
 *
 * **Example** (Inspect the GlobalMount schema)
 *
 * ```ts
 * import { GlobalMount } from "@beep/runpod"
 *
 * console.log(GlobalMount.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobalMount = S.Struct({
  volumeId: S.String.annotateKey({
    description: "ID of an existing GlobalVolume.",
  }),
  path: S.optionalKey(
    S.String.annotateKey({
      description:
        "Mount path inside the container. Optional; a default is chosen for you when omitted.",
    }),
  ),
}).pipe(
  $I.annoteSchema("GlobalMount", {
    description: "Generated RUNPOD schema for GlobalMount.",
    documentation:
      "Reference to a GlobalVolume. Usage-billed, so it has no size. On a\npod, the volume can be mounted, moved, or unmounted after creation\n(see `UpdatePodMounts`).\n",
    identifier: "GlobalMount",
  }),
);

/**
 * Type for {@link GlobalMount}.
 *
 * **Example** (Reference the GlobalMount type)
 *
 * ```ts
 * import type { GlobalMount } from "@beep/runpod"
 *
 * type GlobalMountValue = GlobalMount
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GlobalMount = typeof GlobalMount.Type;

/**
 * Generated RUNPOD schema for `Mounts`.
 *
 * **Example** (Inspect the Mounts schema)
 *
 * ```ts
 * import { Mounts } from "@beep/runpod"
 *
 * console.log(Mounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Mounts = S.Struct({
  persistent: S.optionalKey(PersistentMount),
  network: S.optionalKey(
    S.Array(NetworkMount).check(
      S.isMaxLength(4).annotate({
        expected: "a value with a length of at most 4",
        description: "Up to 4 network volumes, all in the pod's data center.\n",
      }),
    ),
  ),
  global: S.optionalKey(
    S.Array(GlobalMount)
      .annotateKey({
        description:
          "At most one global volume, on GPU and CPU pods, with no data\ncenter constraint. Combinable with `network` but not with\n`persistent` (rejected with 400): a persistent disk is dropped\nwhenever a volume is attached. Same PATCH rules as `network`.\n",
      })
      .check(
        S.isMaxLength(1).annotate({
          expected: "a value with a length of at most 1",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("Mounts", {
    description: "Generated RUNPOD schema for Mounts.",
    documentation:
      "Storage mounts attached to a pod. `persistent` (the volume disk) is\nmutually exclusive with both `network` and `global` (enforced at the\nhandler with 400 if combined). A pod takes up to 4 network volumes\nand 1 global volume. Every network volume must be in the pod's data\ncenter, each volume may be listed once, and mount paths must not\noverlap; a request that breaks one of these is rejected. To change a\npod's mounts after creation, see `UpdatePodMounts`.\n",
    identifier: "Mounts",
  }),
);

/**
 * Type for {@link Mounts}.
 *
 * **Example** (Reference the Mounts type)
 *
 * ```ts
 * import type { Mounts } from "@beep/runpod"
 *
 * type MountsValue = Mounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Mounts = typeof Mounts.Type;

/**
 * Generated RUNPOD schema for `PodQueueHours`.
 *
 * **Example** (Inspect the PodQueueHours schema)
 *
 * ```ts
 * import { PodQueueHours } from "@beep/runpod"
 *
 * console.log(PodQueueHours.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodQueueHours = S.Array(
  S.Int.check(
    S.isGreaterThanOrEqualTo(0).annotate({
      expected: "a value greater than or equal to 0",
    }),
  ).check(
    S.isLessThanOrEqualTo(23).annotate({
      expected: "a value less than or equal to 23",
    }),
  ),
).pipe(
  $I.annoteSchema("PodQueueHours", {
    description: "Generated RUNPOD schema for PodQueueHours.",
    identifier: "PodQueueHours",
  }),
);

/**
 * Type for {@link PodQueueHours}.
 *
 * **Example** (Reference the PodQueueHours type)
 *
 * ```ts
 * import type { PodQueueHours } from "@beep/runpod"
 *
 * type PodQueueHoursValue = PodQueueHours
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodQueueHours = typeof PodQueueHours.Type;

/**
 * Generated RUNPOD schema for `PodQueueAllowedHours`.
 *
 * **Example** (Inspect the PodQueueAllowedHours schema)
 *
 * ```ts
 * import { PodQueueAllowedHours } from "@beep/runpod"
 *
 * console.log(PodQueueAllowedHours.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodQueueAllowedHours = S.Struct({
  monday: S.optionalKey(PodQueueHours),
  tuesday: S.optionalKey(PodQueueHours),
  wednesday: S.optionalKey(PodQueueHours),
  thursday: S.optionalKey(PodQueueHours),
  friday: S.optionalKey(PodQueueHours),
  saturday: S.optionalKey(PodQueueHours),
  sunday: S.optionalKey(PodQueueHours),
}).pipe(
  $I.annoteSchema("PodQueueAllowedHours", {
    description: "Generated RUNPOD schema for PodQueueAllowedHours.",
    documentation:
      "Hours of the day, in UTC, during which the queued pod may deploy, per\nweekday. Omit the object to allow any time. A weekday that is omitted\nis unrestricted; an empty array blocks that whole day. Each entry is\nan hour from 0 to 23 and allows deploys from that hour to the next.\n",
    identifier: "PodQueueAllowedHours",
  }),
);

/**
 * Type for {@link PodQueueAllowedHours}.
 *
 * **Example** (Reference the PodQueueAllowedHours type)
 *
 * ```ts
 * import type { PodQueueAllowedHours } from "@beep/runpod"
 *
 * type PodQueueAllowedHoursValue = PodQueueAllowedHours
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodQueueAllowedHours = typeof PodQueueAllowedHours.Type;

/**
 * Generated RUNPOD schema for `PodQueueOptions`.
 *
 * **Example** (Inspect the PodQueueOptions schema)
 *
 * ```ts
 * import { PodQueueOptions } from "@beep/runpod"
 *
 * console.log(PodQueueOptions.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodQueueOptions = S.Struct({
  startsAt: S.optionalKey(
    S.String.annotateKey({
      description:
        "Begin waiting at this future time instead of now. The create call\nthen does not try to deploy first; the pod is queued at once. A\ntime already past is a `400`.\n",
      format: "date-time",
    }),
  ),
  expiresAt: S.optionalKey(
    S.String.annotateKey({
      description:
        "Stop waiting at this time; the queued pod then reports `EXPIRED`.\nDefaults to, and is capped at, 30 days after `startsAt` (or after\nthe request when `startsAt` is omitted). A time already past, or\none not after `startsAt`, is a `400`.\n",
      format: "date-time",
    }),
  ),
  allowedHours: S.optionalKey(PodQueueAllowedHours),
  notifyEmail: S.optionalKey(
    S.String.annotateKey({
      description:
        "Also email this address when the pod deploys, or when the queued\npod fails or expires. Must be an address on your account (`422`\notherwise).\n",
      format: "email",
    }),
  ),
}).pipe(
  $I.annoteSchema("PodQueueOptions", {
    description: "Generated RUNPOD schema for PodQueueOptions.",
    documentation:
      "Queue the pod for deploy-when-available instead of failing when the\nrequested GPU has no capacity. The create call still tries to deploy\nfirst; only a capacity failure queues the request, and any other\nfailure is returned as it would be without `queue`. A queued pod is\nplaced by a scheduler that retries about every five minutes, in plan\npriority order, during `allowedHours`, until `expiresAt`. An empty\nobject queues with the defaults.\n\nGPU pods on the secure cloud only: `queue` with `cpu` or\n`globalNetworking` is rejected with `400`. A plan without\ndeploy-when-available is refused with `403`, and one whose queue is\nfull with `409`. A request that matches a pod still queued (same GPU\ntype and count, same settings) returns that queued pod rather than a\nsecond one.\n",
    identifier: "PodQueueOptions",
  }),
);

/**
 * Type for {@link PodQueueOptions}.
 *
 * **Example** (Reference the PodQueueOptions type)
 *
 * ```ts
 * import type { PodQueueOptions } from "@beep/runpod"
 *
 * type PodQueueOptionsValue = PodQueueOptions
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodQueueOptions = typeof PodQueueOptions.Type;

/**
 * Generated RUNPOD schema for `CreatePodRequest`.
 *
 * **Example** (Inspect the CreatePodRequest schema)
 *
 * ```ts
 * import { CreatePodRequest } from "@beep/runpod"
 *
 * console.log(CreatePodRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreatePodRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  name: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  cloud: S.optionalKey(
    S.suspend((): S.Codec<Cloud> => Cloud).annotateKey({
      description: "Cloud tier. Defaults to `SECURE` when omitted.",
      default: "SECURE",
    }),
  ),
  cpu: S.optionalKey(CreateCpuConfig),
  dataCenterIds: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Preferred data centers for placement. Omit or pass an empty\narray to let the scheduler choose.\n",
    }),
  ),
  globalNetworking: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Enable global networking, giving the pod a private IP reachable across data centers. Requires an NVIDIA GPU and a global-networking-enabled data center. See `GET /v2/catalog/datacenters` (`globalNetwork`) for eligible data centers.",
      default: false,
    }),
  ),
  gpu: S.optionalKey(CreateGpuConfig),
  mounts: S.optionalKey(Mounts),
  startJupyter: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Create-time flag telling the provisioner to start JupyterLab:\ninjects a generated `JUPYTER_PASSWORD` environment variable,\nunless the request already sets one. Only images that honor\nthe convention start Jupyter from it (Runpod official images\ndo); expose `8888/http` in `ports` to reach it.\n\nNot part of the pod's readable config — never returned by\nGET and not changeable by PATCH.\n",
      default: false,
    }),
  ),
  startSsh: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Create-time flag telling the provisioner to set up SSH\naccess: injects a `PUBLIC_KEY` environment variable carrying\nyour account's registered SSH public keys, unless the request\nalready sets one. **Requires registered keys** (`PUT\n/v2/account/ssh-keys`); with none registered the flag does\nnothing and the pod has no SSH access. Only images that honor\nthe convention start sshd from it (all Runpod official images\ndo). Connect using the pod's `ssh` block; the `ssh.direct`\nvariant additionally needs a `22/tcp` entry in `ports`.\n\nNot part of the pod's readable config — never returned by\nGET and not changeable by PATCH.\n",
      default: false,
    }),
  ),
  templateId: S.optionalKey(
    S.String.annotateKey({
      description:
        "ID of a pod template to base this pod on. The template is\nresolved at create time into the same container settings you\ncould otherwise spread into this body (image, args, disk,\nports, env, registry, persistent mount, startSsh,\nstartJupyter, allowedCudaVersions); explicit body fields\noverride the template's, except `env`, which is merged per\nkey with body values winning. Sending either CUDA field\n(`gpu.allowedCudaVersions` or `gpu.minCudaVersion`) replaces\nthe template's CUDA constraint entirely, and CPU pods ignore\nit (like the persistent mount). The template is a one-time\nsource of settings: later template edits do not affect the\npod, and the created pod does not retain a link to the\ntemplate (`template` stays null). The template may be one\nof your own or a public catalog template — see\n`GET /v2/catalog/templates` (unknown or inaccessible ID →\n404) — and must not be a serverless template (→ 422). CPU\npods do not inherit a template's persistent mount.\n",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  queue: S.optionalKey(PodQueueOptions),
}).pipe(
  $I.annoteSchema("CreatePodRequest", {
    description: "Generated RUNPOD schema for CreatePodRequest.",
    identifier: "CreatePodRequest",
  }),
);

/**
 * Type for {@link CreatePodRequest}.
 *
 * **Example** (Reference the CreatePodRequest type)
 *
 * ```ts
 * import type { CreatePodRequest } from "@beep/runpod"
 *
 * type CreatePodRequestValue = CreatePodRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreatePodRequest = typeof CreatePodRequest.Type;

/**
 * Generated RUNPOD schema for `CreateRegistryRequest`.
 *
 * **Example** (Inspect the CreateRegistryRequest schema)
 *
 * ```ts
 * import { CreateRegistryRequest } from "@beep/runpod"
 *
 * console.log(CreateRegistryRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateRegistryRequest = S.Struct({
  name: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ).check(
    S.isMaxCodePoints(191).annotate({
      expected: "a string with at most 191 code points",
    }),
  ),
  password: S.String.annotateKey({
    description: "Registry password (write-only, not returned in responses)",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(16384).annotate({
        expected: "a string with at most 16384 code points",
      }),
    ),
  username: S.String.annotateKey({
    description: "Registry username (write-only, not returned in responses)",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(191).annotate({
        expected: "a string with at most 191 code points",
      }),
    ),
}).pipe(
  $I.annoteSchema("CreateRegistryRequest", {
    description: "Generated RUNPOD schema for CreateRegistryRequest.",
    identifier: "CreateRegistryRequest",
  }),
);

/**
 * Type for {@link CreateRegistryRequest}.
 *
 * **Example** (Reference the CreateRegistryRequest type)
 *
 * ```ts
 * import type { CreateRegistryRequest } from "@beep/runpod"
 *
 * type CreateRegistryRequestValue = CreateRegistryRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateRegistryRequest = typeof CreateRegistryRequest.Type;

/**
 * Generated RUNPOD schema for `CreateSecretRequest`.
 *
 * **Example** (Inspect the CreateSecretRequest schema)
 *
 * ```ts
 * import { CreateSecretRequest } from "@beep/runpod"
 *
 * console.log(CreateSecretRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateSecretRequest = S.Struct({
  name: S.String.annotateKey({
    description:
      "Unique name for the secret — referenced from environment variables as `{{ RUNPOD_SECRET_<name> }}`; immutable after creation. Maximum 191 characters, must start with a letter or underscore, and may contain letters, digits, and `_.-/`. Names beginning with the reserved prefix `RUNPOD` are rejected (case-insensitive).",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(191).annotate({
        expected: "a string with at most 191 code points",
      }),
    )
    .check(
      S.isPattern(
        new globalThis.RegExp("^[a-zA-Z_][a-zA-Z0-9_.\\-/]*$", "u"),
      ).annotate({
        expected: "a string matching the RegExp ^[a-zA-Z_][a-zA-Z0-9_.\\-/]*$",
      }),
    ),
  value: S.String.annotateKey({
    description:
      "The secret value. Write-only — never returned by the API. Must be smaller than 16 MiB of UTF-8 text (strictly under 16,777,216 bytes).",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(16777216).annotate({
        expected: "a string with at most 16777216 code points",
      }),
    ),
  description: S.optionalKey(
    S.String.annotateKey({
      description:
        "Optional human-readable description, at most 65,535 bytes of UTF-8 text.",
    }).check(
      S.isMaxCodePoints(65535).annotate({
        expected: "a string with at most 65535 code points",
      }),
    ),
  ),
}).pipe(
  $I.annoteSchema("CreateSecretRequest", {
    description: "Generated RUNPOD schema for CreateSecretRequest.",
    identifier: "CreateSecretRequest",
  }),
);

/**
 * Type for {@link CreateSecretRequest}.
 *
 * **Example** (Reference the CreateSecretRequest type)
 *
 * ```ts
 * import type { CreateSecretRequest } from "@beep/runpod"
 *
 * type CreateSecretRequestValue = CreateSecretRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateSecretRequest = typeof CreateSecretRequest.Type;

/**
 * Generated RUNPOD schema for `TemplateCategory`.
 *
 * **Example** (Inspect the TemplateCategory schema)
 *
 * ```ts
 * import { TemplateCategory } from "@beep/runpod"
 *
 * console.log(TemplateCategory.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TemplateCategory = S.Literals(["CPU", "NVIDIA", "AMD"]).pipe(
  $I.annoteSchema("TemplateCategory", {
    description: "Generated RUNPOD schema for TemplateCategory.",
    documentation:
      "Controls how the template is grouped and filtered in the Runpod console.\nIt does not affect hardware selection, scheduling, or billing.\n- `CPU`    — CPU-only workloads\n- `NVIDIA` — NVIDIA GPU workloads\n- `AMD`    — AMD GPU workloads\n",
    identifier: "TemplateCategory",
  }),
);

/**
 * Type for {@link TemplateCategory}.
 *
 * **Example** (Reference the TemplateCategory type)
 *
 * ```ts
 * import type { TemplateCategory } from "@beep/runpod"
 *
 * type TemplateCategoryValue = TemplateCategory
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TemplateCategory = typeof TemplateCategory.Type;

/**
 * Generated RUNPOD schema for `TemplateMounts`.
 *
 * **Example** (Inspect the TemplateMounts schema)
 *
 * ```ts
 * import { TemplateMounts } from "@beep/runpod"
 *
 * console.log(TemplateMounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TemplateMounts = S.Struct({
  persistent: S.optionalKey(PersistentMount),
}).pipe(
  $I.annoteSchema("TemplateMounts", {
    description: "Generated RUNPOD schema for TemplateMounts.",
    documentation:
      "Storage mounts attached to a template. Templates support only a\nsingle persistent mount today; any `network` property is rejected\nwith 422 by the schema validator.\n\nPATCH semantics: omitting `mounts` or sending `{}` leaves the\nexisting mount unchanged.\n",
    identifier: "TemplateMounts",
  }),
);

/**
 * Type for {@link TemplateMounts}.
 *
 * **Example** (Reference the TemplateMounts type)
 *
 * ```ts
 * import type { TemplateMounts } from "@beep/runpod"
 *
 * type TemplateMountsValue = TemplateMounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TemplateMounts = typeof TemplateMounts.Type;

/**
 * Generated RUNPOD schema for `CreateTemplateRequest`.
 *
 * **Example** (Inspect the CreateTemplateRequest schema)
 *
 * ```ts
 * import { CreateTemplateRequest } from "@beep/runpod"
 *
 * console.log(CreateTemplateRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CreateTemplateRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.String.annotateKey({ description: "Docker image reference" }),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  name: S.String.check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
  allowedCudaVersions: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
          expected: "a string matching the RegExp ^\\d+\\.\\d+$",
        }),
      ),
    ).annotateKey({
      description:
        "Acceptable CUDA versions for containers created from this\ntemplate, as `major.minor`. Omit to accept any version — see\nthe same field on `createPod` for matching semantics.\nExpanded into GPU pod and serverless endpoint creates; CPU\npods ignore it.\n",
    }),
  ),
  category: S.optionalKey(
    S.suspend((): S.Codec<TemplateCategory> => TemplateCategory).annotateKey({
      description: "Optional. Defaults to `NVIDIA` when omitted.",
      default: "NVIDIA",
    }),
  ),
  mounts: S.optionalKey(TemplateMounts),
  public: S.optionalKey(S.Boolean.annotateKey({ default: false })),
  serverless: S.optionalKey(S.Boolean.annotateKey({ default: false })),
  startJupyter: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Start JupyterLab in containers created from this template:\ninjects a generated `JUPYTER_PASSWORD` environment variable,\nunless `env` already sets one. Only images that honor the\nconvention start Jupyter from it (Runpod official images do);\nexpose `8888/http` in `ports` to reach it. Defaults to `true`\nwhen omitted, matching console-created templates.\n",
      default: true,
    }),
  ),
  startSsh: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Provision SSH access in containers created from this template:\ninjects a `PUBLIC_KEY` environment variable carrying the\ndeployer's registered SSH public keys (`PUT\n/v2/account/ssh-keys` — with none registered the flag does\nnothing), unless `env` already sets one. Only images that\nhonor the convention start sshd from it (all Runpod official\nimages do); direct SSH also needs a `22/tcp` entry in\n`ports`. Defaults to `true` when omitted, matching\nconsole-created templates.\n",
      default: true,
    }),
  ),
}).pipe(
  $I.annoteSchema("CreateTemplateRequest", {
    description: "Generated RUNPOD schema for CreateTemplateRequest.",
    identifier: "CreateTemplateRequest",
  }),
);

/**
 * Type for {@link CreateTemplateRequest}.
 *
 * **Example** (Reference the CreateTemplateRequest type)
 *
 * ```ts
 * import type { CreateTemplateRequest } from "@beep/runpod"
 *
 * type CreateTemplateRequestValue = CreateTemplateRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CreateTemplateRequest = typeof CreateTemplateRequest.Type;

/**
 * Generated RUNPOD schema for `CudaVersionAvailability`.
 *
 * **Example** (Inspect the CudaVersionAvailability schema)
 *
 * ```ts
 * import { CudaVersionAvailability } from "@beep/runpod"
 *
 * console.log(CudaVersionAvailability.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CudaVersionAvailability = S.StructWithRest(
  S.Struct({
    version: S.String.annotateKey({
      description:
        "CUDA version as `major.minor`, suitable for `gpu.allowedCudaVersions` on pod create.",
    }).check(
      S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
        expected: "a string matching the RegExp ^\\d+\\.\\d+$",
      }),
    ),
    available: S.Boolean.annotateKey({
      description:
        "True when at least one machine on this CUDA version has free capacity now. False means the version is offered for this GPU type but is currently full, so a pod constrained to it will fail on capacity.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CudaVersionAvailability", {
    description: "Generated RUNPOD schema for CudaVersionAvailability.",
    identifier: "CudaVersionAvailability",
  }),
);

/**
 * Type for {@link CudaVersionAvailability}.
 *
 * **Example** (Reference the CudaVersionAvailability type)
 *
 * ```ts
 * import type { CudaVersionAvailability } from "@beep/runpod"
 *
 * type CudaVersionAvailabilityValue = CudaVersionAvailability
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CudaVersionAvailability = typeof CudaVersionAvailability.Type;

/**
 * Generated RUNPOD schema for `CustomOrganizationRole`.
 *
 * **Example** (Inspect the CustomOrganizationRole schema)
 *
 * ```ts
 * import { CustomOrganizationRole } from "@beep/runpod"
 *
 * console.log(CustomOrganizationRole.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CustomOrganizationRole = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Role ID." }),
    name: S.String.annotateKey({
      description: "Display name, unique within the organization.",
    }),
    type: S.tag("custom").annotateKey({
      description: "Always `custom` for this variant.",
    }),
    capabilities: OrganizationRoleCapabilities,
    createdAt: S.String.annotateKey({
      description: "When the role was created.",
      format: "date-time",
    }),
    updatedAt: S.String.annotateKey({
      description:
        "When the role last changed. Assigning the role to a member or invite can also move it.",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("CustomOrganizationRole", {
    description: "Generated RUNPOD schema for CustomOrganizationRole.",
    documentation: "A role the caller's organization defined.",
    identifier: "CustomOrganizationRole",
  }),
);

/**
 * Type for {@link CustomOrganizationRole}.
 *
 * **Example** (Reference the CustomOrganizationRole type)
 *
 * ```ts
 * import type { CustomOrganizationRole } from "@beep/runpod"
 *
 * type CustomOrganizationRoleValue = CustomOrganizationRole
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CustomOrganizationRole = typeof CustomOrganizationRole.Type;

/**
 * Generated RUNPOD schema for `DataCenterRegion`.
 *
 * **Example** (Inspect the DataCenterRegion schema)
 *
 * ```ts
 * import { DataCenterRegion } from "@beep/runpod"
 *
 * console.log(DataCenterRegion.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DataCenterRegion = S.Literals([
  "NORTH_AMERICA",
  "SOUTH_AMERICA",
  "EUROPE",
  "ASIA",
  "MIDDLE_EAST",
  "AFRICA",
  "OCEANIA",
  "ANTARCTICA",
  "UNKNOWN",
]).pipe(
  $I.annoteSchema("DataCenterRegion", {
    description: "Generated RUNPOD schema for DataCenterRegion.",
    documentation: "Continental region containing the data center.",
    identifier: "DataCenterRegion",
  }),
);

/**
 * Type for {@link DataCenterRegion}.
 *
 * **Example** (Reference the DataCenterRegion type)
 *
 * ```ts
 * import type { DataCenterRegion } from "@beep/runpod"
 *
 * type DataCenterRegionValue = DataCenterRegion
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DataCenterRegion = typeof DataCenterRegion.Type;

/**
 * Generated RUNPOD schema for `DataCenter`.
 *
 * **Example** (Inspect the DataCenter schema)
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
export const DataCenter = S.StructWithRest(
  S.Struct({
    id: S.String,
    name: S.String,
    region: DataCenterRegion,
    globalNetwork: S.Boolean.annotateKey({
      description:
        "Whether this data center supports global networking (private cross-datacenter pod-to-pod network).",
    }),
    networkVolumeTypes: S.Array(VolumeType).annotateKey({
      description: "Network volume tiers this DC supports. Empty = none.",
    }),
    compliance: S.Array(Compliance).annotateKey({
      description: "Compliance certifications held by this data center",
    }),
    gpuAvailability: S.optionalKey(
      S.Array(CatalogResourceAvailability).annotateKey({
        description:
          "Availability of each GPU this data center offers. Present only when\nrequested with include=GPU_AVAILABILITY, and omitted entirely when\nthe data center offers no GPUs.\n",
      }),
    ),
    cpuAvailability: S.optionalKey(
      S.Array(CatalogResourceAvailability).annotateKey({
        description:
          "Availability of each CPU flavor this data center offers. Present\nonly when requested with include=CPU_AVAILABILITY, and omitted\nentirely when the data center offers no CPU flavors.\n",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("DataCenter", {
    description: "Generated RUNPOD schema for DataCenter.",
    identifier: "DataCenter",
  }),
);

/**
 * Type for {@link DataCenter}.
 *
 * **Example** (Reference the DataCenter type)
 *
 * ```ts
 * import type { DataCenter } from "@beep/runpod"
 *
 * type DataCenterValue = DataCenter
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DataCenter = typeof DataCenter.Type;

/**
 * Generated RUNPOD schema for `DataCenterInclude`.
 *
 * **Example** (Inspect the DataCenterInclude schema)
 *
 * ```ts
 * import { DataCenterInclude } from "@beep/runpod"
 *
 * console.log(DataCenterInclude.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DataCenterInclude = S.Literals([
  "GPU_AVAILABILITY",
  "CPU_AVAILABILITY",
]).pipe(
  $I.annoteSchema("DataCenterInclude", {
    description: "Generated RUNPOD schema for DataCenterInclude.",
    documentation: "Data center catalog availability expansion.",
    identifier: "DataCenterInclude",
  }),
);

/**
 * Type for {@link DataCenterInclude}.
 *
 * **Example** (Reference the DataCenterInclude type)
 *
 * ```ts
 * import type { DataCenterInclude } from "@beep/runpod"
 *
 * type DataCenterIncludeValue = DataCenterInclude
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DataCenterInclude = typeof DataCenterInclude.Type;

/**
 * Generated RUNPOD schema for `EcrDelegation`.
 *
 * **Example** (Inspect the EcrDelegation schema)
 *
 * ```ts
 * import { EcrDelegation } from "@beep/runpod"
 *
 * console.log(EcrDelegation.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EcrDelegation = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Delegation identifier" }),
    name: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "Optional name for the delegation",
      }),
    ),
    delegatorUserId: S.String.annotateKey({
      description: "User ID that created the delegation",
    }),
    awsUser: S.String.annotateKey({
      description: "AWS user/role being delegated",
    }),
    repository: S.String.annotateKey({ description: "ECR repository name" }),
    tag: S.String.annotateKey({ description: "ECR image tag" }),
    awsRegion: S.String.annotateKey({ description: "AWS region" }),
    dockerRegistryUri: S.optionalKey(
      S.String.annotateKey({
        description: "Formatted ECR registry URI for Docker login",
      }),
    ),
    createdAt: S.String.annotateKey({
      description: "When the delegation was created",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EcrDelegation", {
    description: "Generated RUNPOD schema for EcrDelegation.",
    identifier: "EcrDelegation",
  }),
);

/**
 * Type for {@link EcrDelegation}.
 *
 * **Example** (Reference the EcrDelegation type)
 *
 * ```ts
 * import type { EcrDelegation } from "@beep/runpod"
 *
 * type EcrDelegationValue = EcrDelegation
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EcrDelegation = typeof EcrDelegation.Type;

/**
 * Generated RUNPOD schema for `QueueBasedRequestUrls`.
 *
 * **Example** (Inspect the QueueBasedRequestUrls schema)
 *
 * ```ts
 * import { QueueBasedRequestUrls } from "@beep/runpod"
 *
 * console.log(QueueBasedRequestUrls.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueueBasedRequestUrls = S.Struct({
  run: S.String.annotateKey({
    description:
      "URL for asynchronously submitting a queued job.\nSee the [/run operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/run) for request and response bodies.",
    format: "uri",
  }),
  runSync: S.String.annotateKey({
    description:
      "URL for synchronously submitting a queued job. Accepts an optional `?wait=x` query parameter to control how long the request waits for job completion, defaulting to 90 seconds.\nSee the [/runsync operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/runsync) for request and response bodies.",
    format: "uri",
  }),
  status: S.String.annotateKey({
    description:
      "Check the current state, execution statistics, and results of a previously submitted job.\nSee the [/status operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/status) for request and response bodies.",
    format: "uri",
  }),
  stream: S.String.annotateKey({
    description:
      "Receive incremental results as they become available from a job that generates output progressively.\nSee the [/stream operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/stream) for request and response bodies.",
    format: "uri",
  }),
  cancel: S.String.annotateKey({
    description:
      "Stop an in-progress job or remove a queued job before it starts.\nSee the [/cancel operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/cancel) for request and response bodies.",
    format: "uri",
  }),
  retry: S.String.annotateKey({
    description:
      "Requeue a failed or timed-out job without submitting a new request.\nSee the [/retry operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/retry) for request and response bodies.",
    format: "uri",
  }),
  purgeQueue: S.String.annotateKey({
    description:
      "Remove all pending jobs from the queue. Does not affect in-progress jobs.\nSee the [/purge-queue operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/purge-queue) for request and response bodies.",
    format: "uri",
  }),
  health: S.String.annotateKey({
    description:
      "Overview of an endpoint's operational status.\nSee the [/health operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference#/health) for request and response bodies.",
    format: "uri",
  }),
}).pipe(
  $I.annoteSchema("QueueBasedRequestUrls", {
    description: "Generated RUNPOD schema for QueueBasedRequestUrls.",
    identifier: "QueueBasedRequestUrls",
  }),
);

/**
 * Type for {@link QueueBasedRequestUrls}.
 *
 * **Example** (Reference the QueueBasedRequestUrls type)
 *
 * ```ts
 * import type { QueueBasedRequestUrls } from "@beep/runpod"
 *
 * type QueueBasedRequestUrlsValue = QueueBasedRequestUrls
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueueBasedRequestUrls = typeof QueueBasedRequestUrls.Type;

/**
 * Generated RUNPOD schema for `LoadBalancingRequestUrls`.
 *
 * **Example** (Inspect the LoadBalancingRequestUrls schema)
 *
 * ```ts
 * import { LoadBalancingRequestUrls } from "@beep/runpod"
 *
 * console.log(LoadBalancingRequestUrls.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LoadBalancingRequestUrls = S.Struct({
  base: S.String.annotateKey({
    description:
      "Base URL for worker-defined HTTP and WebSocket paths.\nSee [Load balancing endpoints](https://docs.runpod.io/serverless/load-balancing/overview).",
    format: "uri",
  }),
  health: S.String.annotateKey({
    description:
      "Health check endpoint the load balancer will periodically ping to decide if the worker is healthy enough to receive traffic. Configurable by setting the `HEALTH_CHECK_PATH` environment variable. Defaults to `/ping` if the variable is not set.\nSee [Health checks](https://docs.runpod.io/serverless/load-balancing/overview#health-checks) for the response codes it interprets.",
    format: "uri",
  }),
}).pipe(
  $I.annoteSchema("LoadBalancingRequestUrls", {
    description: "Generated RUNPOD schema for LoadBalancingRequestUrls.",
    identifier: "LoadBalancingRequestUrls",
  }),
);

/**
 * Type for {@link LoadBalancingRequestUrls}.
 *
 * **Example** (Reference the LoadBalancingRequestUrls type)
 *
 * ```ts
 * import type { LoadBalancingRequestUrls } from "@beep/runpod"
 *
 * type LoadBalancingRequestUrlsValue = LoadBalancingRequestUrls
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LoadBalancingRequestUrls = typeof LoadBalancingRequestUrls.Type;

/**
 * Generated RUNPOD schema for `EndpointRequestUrls`.
 *
 * **Example** (Inspect the EndpointRequestUrls schema)
 *
 * ```ts
 * import { EndpointRequestUrls } from "@beep/runpod"
 *
 * console.log(EndpointRequestUrls.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointRequestUrls = S.Union(
  [QueueBasedRequestUrls, LoadBalancingRequestUrls],
  { mode: "oneOf" },
).pipe(
  $I.annoteSchema("EndpointRequestUrls", {
    description: "Generated RUNPOD schema for EndpointRequestUrls.",
    documentation:
      "Request URLs appropriate to the endpoint's top-level `type`.\nQueue-based endpoints provide job submission and management URLs;\nload-balancing endpoints provide `base` and `health` because their\nremaining paths are worker-defined.\n\nRequest and response bodies for the queue-based URLs are documented in\nthe [serverless operation reference](https://docs.runpod.io/serverless/endpoints/operation-reference).\nLoad-balancing endpoints are documented in\n[Load balancing endpoints](https://docs.runpod.io/serverless/load-balancing/overview).",
    identifier: "EndpointRequestUrls",
  }),
);

/**
 * Type for {@link EndpointRequestUrls}.
 *
 * **Example** (Reference the EndpointRequestUrls type)
 *
 * ```ts
 * import type { EndpointRequestUrls } from "@beep/runpod"
 *
 * type EndpointRequestUrlsValue = EndpointRequestUrls
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointRequestUrls = typeof EndpointRequestUrls.Type;

/**
 * Generated RUNPOD schema for `EndpointGpuConfig`.
 *
 * **Example** (Inspect the EndpointGpuConfig schema)
 *
 * ```ts
 * import { EndpointGpuConfig } from "@beep/runpod"
 *
 * console.log(EndpointGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointGpuConfig = S.StructWithRest(
  S.Struct({
    pools: S.Array(S.String)
      .annotateKey({
        description:
          'Serverless GPU pool IDs (as returned by `GET /v2/catalog/gpus` in\n`pool`). Workers are placed on whichever listed pool has capacity.\nNarrow a pool down to specific cards with `excludedTypes`.\n\nOn `PATCH`, `pools` and `excludedTypes` are one selection and are\nreplaced together, so sending `pools` by itself **clears the\nexclusions**. Two cases:\n\n- **Changing pools, keeping exclusions** — send both fields in one\n  request: `{"gpu": {"pools": ["ADA_24"], "excludedTypes":\n  ["NVIDIA L40"]}}`. `GET` the endpoint first to read the current\n  `excludedTypes` and resend the ones that still apply to the new\n  pools; an exclusion naming a type outside `pools` is a 400.\n- **Changing only `count` or a CUDA constraint** — omit `pools`:\n  `{"gpu": {"minCudaVersion": "12.4"}}`. The pool list and the\n  exclusions are both left exactly as they are.\n\n`excludedTypes` documents the full rule.\n',
      })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      ),
    excludedTypes: S.optionalKey(
      S.Array(
        S.String.check(
          S.isPattern(new globalThis.RegExp("^\\s*[^-\\s]", "u")).annotate({
            expected: "a string matching the RegExp ^\\s*[^-\\s]",
          }),
        ),
      )
        .annotateKey({
          description:
            'GPU **type** IDs to subtract from the selected pools — the `id`\nfield of `GET /v2/catalog/gpus`, the same identifiers pods take in\n`gpu.id`. Workers run on every type in `pools` except these. Omit to\nuse the whole pool.\n\nPools stay the unit of selection; types are the unit of\nsubtraction. There is no inclusive allowlist: a card later added to\none of your pools becomes eligible, which is the honest reading of\n"this pool, minus these".\n\nTied to `pools`, because the two together are one selection:\nsupplying `pools` replaces that selection wholesale, so a `PATCH`\nsending `pools` **without `excludedTypes`** **clears** them —\nrestate them to keep them. A `PATCH` that omits `pools` leaves both\nthe pools and the exclusions untouched, so changing only a CUDA\nconstraint cannot widen a pinned endpoint.\n\nRejected with 400 if a value is not a GPU type in one of `pools`,\nso a typo cannot produce a filter that does nothing. Surrounding whitespace\nis trimmed, so `" NVIDIA L40"` and `"NVIDIA L40"` mean the same card.\n',
        })
        .check(
          S.isUnique().annotate({ expected: "an array with unique items" }),
        ),
    ),
    count: S.optionalKey(
      S.Int.annotateKey({ description: "GPUs per worker", default: 1 }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    allowedCudaVersions: S.Array(S.String).annotateKey({
      description:
        "Acceptable CUDA versions for worker placement, as `major.minor`. Empty means any version.",
    }),
    minCudaVersion: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Lowest acceptable CUDA version for worker placement, as `major.minor`. Null means no floor.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointGpuConfig", {
    description: "Generated RUNPOD schema for EndpointGpuConfig.",
    identifier: "EndpointGpuConfig",
  }),
);

/**
 * Type for {@link EndpointGpuConfig}.
 *
 * **Example** (Reference the EndpointGpuConfig type)
 *
 * ```ts
 * import type { EndpointGpuConfig } from "@beep/runpod"
 *
 * type EndpointGpuConfigValue = EndpointGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointGpuConfig = typeof EndpointGpuConfig.Type;

/**
 * Generated RUNPOD schema for `EndpointMounts`.
 *
 * **Example** (Inspect the EndpointMounts schema)
 *
 * ```ts
 * import { EndpointMounts } from "@beep/runpod"
 *
 * console.log(EndpointMounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointMounts = S.StructWithRest(
  S.Struct({ network: S.Array(EndpointMount), global: S.Array(EndpointMount) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointMounts", {
    description: "Generated RUNPOD schema for EndpointMounts.",
    documentation: "Volumes mounted on every worker of the endpoint.",
    identifier: "EndpointMounts",
  }),
);

/**
 * Type for {@link EndpointMounts}.
 *
 * **Example** (Reference the EndpointMounts type)
 *
 * ```ts
 * import type { EndpointMounts } from "@beep/runpod"
 *
 * type EndpointMountsValue = EndpointMounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointMounts = typeof EndpointMounts.Type;

/**
 * Generated RUNPOD schema for `Endpoint`.
 *
 * **Example** (Inspect the Endpoint schema)
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
export const Endpoint = S.StructWithRest(
  S.Struct({
    args: S.optionalKey(
      S.String.annotateKey({
        description:
          'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
      }),
    ),
    cmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    entrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    disk: S.optionalKey(
      S.Int.annotateKey({
        description: "Container disk in GB (ephemeral, wiped on restart)",
      }).check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    ),
    env: S.optionalKey(
      S.Record(S.String, S.String).annotateKey({
        description: "Environment variables as key-value pairs",
      }),
    ),
    image: S.optionalKey(
      S.String.annotateKey({ description: "Docker image reference" }),
    ),
    ports: S.optionalKey(
      S.Array(S.String).annotateKey({
        description: "Exposed ports, formatted as port/protocol",
      }),
    ),
    registry: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
      }),
    ),
    costCenter: S.optionalKey(ResourceCostCenter),
    tags: S.optionalKey(ResourceTags),
    id: S.String,
    name: S.String,
    type: S.optionalKey(EndpointType),
    requestUrls: S.optionalKey(EndpointRequestUrls),
    gpu: S.optionalKey(S.Union([EndpointGpuConfig, S.Null])),
    cpu: S.optionalKey(
      S.Array(CpuConfig)
        .annotateKey({
          description:
            "Eligible CPU configurations for each worker, in the order they\nwere submitted. Present for CPU endpoints and omitted for GPU\nendpoints. Memory is derived from the selected flavor's catalog\nRAM multiplier.\n",
        })
        .check(
          S.isMinLength(1).annotate({
            expected: "a value with a length of at least 1",
          }),
        ),
    ),
    workers: S.Struct({
      min: S.Int.annotateKey({
        description: "Minimum number of workers.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
      max: S.Int.annotateKey({
        description: "Maximum number of workers.",
      }).check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      ),
      idleTimeout: S.optionalKey(
        S.Int.annotateKey({
          description:
            "Seconds before idle workers scale down. Not applicable to queue-based\nendpoints scaling on `requestCount` — rejected on create/update and\nomitted from responses for that combination.\n",
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
    }),
    scaling: EndpointScaling,
    dataCenterIds: S.Array(S.String),
    networkVolumes: S.Array(S.String),
    mounts: EndpointMounts,
    timeout: S.Int.annotateKey({
      description: "Per-request execution timeout in milliseconds",
    }),
    flashboot: FlashBoot,
    createdAt: S.String.annotateKey({ format: "date-time" }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Endpoint", {
    description: "Generated RUNPOD schema for Endpoint.",
    documentation:
      "Reusable container configuration shared across templates, pods, serverless endpoints, and clusters. Adding a field here automatically propagates to all of them.\n",
    identifier: "Endpoint",
  }),
);

/**
 * Type for {@link Endpoint}.
 *
 * **Example** (Reference the Endpoint type)
 *
 * ```ts
 * import type { Endpoint } from "@beep/runpod"
 *
 * type EndpointValue = Endpoint
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Endpoint = typeof Endpoint.Type;

/**
 * Generated RUNPOD schema for `EndpointBillingAmounts`.
 *
 * **Example** (Inspect the EndpointBillingAmounts schema)
 *
 * ```ts
 * import { EndpointBillingAmounts } from "@beep/runpod"
 *
 * console.log(EndpointBillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointBillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description: "Total public endpoint cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointBillingAmounts", {
    description: "Generated RUNPOD schema for EndpointBillingAmounts.",
    documentation:
      "Runpod public endpoint cost. Backs a record's amounts and the metadata totals.\n",
    identifier: "EndpointBillingAmounts",
  }),
);

/**
 * Type for {@link EndpointBillingAmounts}.
 *
 * **Example** (Reference the EndpointBillingAmounts type)
 *
 * ```ts
 * import type { EndpointBillingAmounts } from "@beep/runpod"
 *
 * type EndpointBillingAmountsValue = EndpointBillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointBillingAmounts = typeof EndpointBillingAmounts.Type;

/**
 * Generated RUNPOD schema for `EndpointBillingMetadata`.
 *
 * **Example** (Inspect the EndpointBillingMetadata schema)
 *
 * ```ts
 * import { EndpointBillingMetadata } from "@beep/runpod"
 *
 * console.log(EndpointBillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointBillingMetadata = S.StructWithRest(
  S.Struct({
    query: BillingQuery,
    recordCount: S.Int,
    totals: EndpointBillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointBillingMetadata", {
    description: "Generated RUNPOD schema for EndpointBillingMetadata.",
    identifier: "EndpointBillingMetadata",
  }),
);

/**
 * Type for {@link EndpointBillingMetadata}.
 *
 * **Example** (Reference the EndpointBillingMetadata type)
 *
 * ```ts
 * import type { EndpointBillingMetadata } from "@beep/runpod"
 *
 * type EndpointBillingMetadataValue = EndpointBillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointBillingMetadata = typeof EndpointBillingMetadata.Type;

/**
 * Generated RUNPOD schema for `EndpointBillingRecord`.
 *
 * **Example** (Inspect the EndpointBillingRecord schema)
 *
 * ```ts
 * import { EndpointBillingRecord } from "@beep/runpod"
 *
 * console.log(EndpointBillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointBillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description: "Total public endpoint cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointBillingRecord", {
    description: "Generated RUNPOD schema for EndpointBillingRecord.",
    documentation:
      "A single time-bucketed Runpod public endpoint billing record. Returned by GET /v2/billing/endpoints.\n",
    identifier: "EndpointBillingRecord",
  }),
);

/**
 * Type for {@link EndpointBillingRecord}.
 *
 * **Example** (Reference the EndpointBillingRecord type)
 *
 * ```ts
 * import type { EndpointBillingRecord } from "@beep/runpod"
 *
 * type EndpointBillingRecordValue = EndpointBillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointBillingRecord = typeof EndpointBillingRecord.Type;

/**
 * Generated RUNPOD schema for `EndpointDurationStats`.
 *
 * **Example** (Inspect the EndpointDurationStats schema)
 *
 * ```ts
 * import { EndpointDurationStats } from "@beep/runpod"
 *
 * console.log(EndpointDurationStats.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointDurationStats = S.StructWithRest(
  S.Struct({
    min: S.Int,
    max: S.Int,
    total: S.Finite.annotateKey({
      description: "Sum over every request (or cold start) in the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    p70: S.Int,
    p90: S.Int,
    p95: S.Int,
    p98: S.Int,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointDurationStats", {
    description: "Generated RUNPOD schema for EndpointDurationStats.",
    documentation: "Millisecond statistics over one bucket.",
    identifier: "EndpointDurationStats",
  }),
);

/**
 * Type for {@link EndpointDurationStats}.
 *
 * **Example** (Reference the EndpointDurationStats type)
 *
 * ```ts
 * import type { EndpointDurationStats } from "@beep/runpod"
 *
 * type EndpointDurationStatsValue = EndpointDurationStats
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointDurationStats = typeof EndpointDurationStats.Type;

/**
 * Generated RUNPOD schema for `EndpointColdStartMetric`.
 *
 * **Example** (Inspect the EndpointColdStartMetric schema)
 *
 * ```ts
 * import { EndpointColdStartMetric } from "@beep/runpod"
 *
 * console.log(EndpointColdStartMetric.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointColdStartMetric = S.StructWithRest(
  S.Struct({
    time: S.String.annotateKey({
      description: "Bucket start (UTC).",
      format: "date-time",
    }),
    count: S.Int,
    durationMs: EndpointDurationStats,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointColdStartMetric", {
    description: "Generated RUNPOD schema for EndpointColdStartMetric.",
    identifier: "EndpointColdStartMetric",
  }),
);

/**
 * Type for {@link EndpointColdStartMetric}.
 *
 * **Example** (Reference the EndpointColdStartMetric type)
 *
 * ```ts
 * import type { EndpointColdStartMetric } from "@beep/runpod"
 *
 * type EndpointColdStartMetricValue = EndpointColdStartMetric
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointColdStartMetric = typeof EndpointColdStartMetric.Type;

/**
 * Generated RUNPOD schema for `EndpointMetricsInterval`.
 *
 * **Example** (Inspect the EndpointMetricsInterval schema)
 *
 * ```ts
 * import { EndpointMetricsInterval } from "@beep/runpod"
 *
 * console.log(EndpointMetricsInterval.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointMetricsInterval = S.Literals([
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "6h",
  "12h",
  "1d",
]).pipe(
  $I.annoteSchema("EndpointMetricsInterval", {
    description: "Generated RUNPOD schema for EndpointMetricsInterval.",
    documentation: "Bucket size for endpoint metrics.",
    default: "1h",
    identifier: "EndpointMetricsInterval",
  }),
);

/**
 * Type for {@link EndpointMetricsInterval}.
 *
 * **Example** (Reference the EndpointMetricsInterval type)
 *
 * ```ts
 * import type { EndpointMetricsInterval } from "@beep/runpod"
 *
 * type EndpointMetricsIntervalValue = EndpointMetricsInterval
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointMetricsInterval = typeof EndpointMetricsInterval.Type;

/**
 * Generated RUNPOD schema for `Pagination`.
 *
 * **Example** (Inspect the Pagination schema)
 *
 * ```ts
 * import { Pagination } from "@beep/runpod"
 *
 * console.log(Pagination.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Pagination = S.StructWithRest(
  S.Struct({
    nextCursor: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Pass as the `cursor` query parameter to fetch the next page. Null on the last page.\n",
    }),
    hasNextPage: S.Boolean.annotateKey({
      description: "Whether more items exist after this page.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Pagination", {
    description: "Generated RUNPOD schema for Pagination.",
    documentation:
      "Cursor-pagination metadata, uniform across list endpoints. Every response carries it: follow `nextCursor` while `hasNextPage` is true to walk the full result set.\n",
    identifier: "Pagination",
  }),
);

/**
 * Type for {@link Pagination}.
 *
 * **Example** (Reference the Pagination type)
 *
 * ```ts
 * import type { Pagination } from "@beep/runpod"
 *
 * type PaginationValue = Pagination
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Pagination = typeof Pagination.Type;

/**
 * Generated RUNPOD schema for `EndpointColdStartMetricsResponse`.
 *
 * **Example** (Inspect the EndpointColdStartMetricsResponse schema)
 *
 * ```ts
 * import { EndpointColdStartMetricsResponse } from "@beep/runpod"
 *
 * console.log(EndpointColdStartMetricsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointColdStartMetricsResponse = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Resolved window start (after defaults).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "Resolved window end (after defaults and the clamp to now).",
      format: "date-time",
    }),
    interval: EndpointMetricsInterval,
    records: S.Array(EndpointColdStartMetric).annotateKey({
      description: "This page's buckets, oldest first.",
    }),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointColdStartMetricsResponse", {
    description:
      "Generated RUNPOD schema for EndpointColdStartMetricsResponse.",
    documentation:
      "Cold start counts and durations per bucket for the resolved window. `records` contains only buckets with activity. Buckets with no activity are omitted, not zero-filled, so `records` can be shorter than the number of buckets in the window, or empty. Results are paged: see `pagination`.\n",
    identifier: "EndpointColdStartMetricsResponse",
  }),
);

/**
 * Type for {@link EndpointColdStartMetricsResponse}.
 *
 * **Example** (Reference the EndpointColdStartMetricsResponse type)
 *
 * ```ts
 * import type { EndpointColdStartMetricsResponse } from "@beep/runpod"
 *
 * type EndpointColdStartMetricsResponseValue = EndpointColdStartMetricsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointColdStartMetricsResponse =
  typeof EndpointColdStartMetricsResponse.Type;

/**
 * Generated RUNPOD schema for `EndpointRequestMetric`.
 *
 * **Example** (Inspect the EndpointRequestMetric schema)
 *
 * ```ts
 * import { EndpointRequestMetric } from "@beep/runpod"
 *
 * console.log(EndpointRequestMetric.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointRequestMetric = S.StructWithRest(
  S.Struct({
    time: S.String.annotateKey({
      description: "Bucket start (UTC).",
      format: "date-time",
    }),
    requests: S.Int.annotateKey({
      description: "Requests that finished in this bucket.",
    }),
    completed: S.Int,
    failed: S.Int,
    retries: S.Int,
    executionTimeMs: EndpointDurationStats,
    delayTimeMs: EndpointDurationStats,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointRequestMetric", {
    description: "Generated RUNPOD schema for EndpointRequestMetric.",
    identifier: "EndpointRequestMetric",
  }),
);

/**
 * Type for {@link EndpointRequestMetric}.
 *
 * **Example** (Reference the EndpointRequestMetric type)
 *
 * ```ts
 * import type { EndpointRequestMetric } from "@beep/runpod"
 *
 * type EndpointRequestMetricValue = EndpointRequestMetric
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointRequestMetric = typeof EndpointRequestMetric.Type;

/**
 * Generated RUNPOD schema for `EndpointRequestMetricsResponse`.
 *
 * **Example** (Inspect the EndpointRequestMetricsResponse schema)
 *
 * ```ts
 * import { EndpointRequestMetricsResponse } from "@beep/runpod"
 *
 * console.log(EndpointRequestMetricsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointRequestMetricsResponse = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Resolved window start (after defaults).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "Resolved window end (after defaults and the clamp to now).",
      format: "date-time",
    }),
    interval: EndpointMetricsInterval,
    records: S.Array(EndpointRequestMetric).annotateKey({
      description: "This page's buckets, oldest first.",
    }),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointRequestMetricsResponse", {
    description: "Generated RUNPOD schema for EndpointRequestMetricsResponse.",
    documentation:
      "Request counts and durations per bucket for the resolved window. `records` contains only buckets with activity. Buckets with no activity are omitted, not zero-filled, so `records` can be shorter than the number of buckets in the window, or empty. Results are paged: see `pagination`.\n",
    identifier: "EndpointRequestMetricsResponse",
  }),
);

/**
 * Type for {@link EndpointRequestMetricsResponse}.
 *
 * **Example** (Reference the EndpointRequestMetricsResponse type)
 *
 * ```ts
 * import type { EndpointRequestMetricsResponse } from "@beep/runpod"
 *
 * type EndpointRequestMetricsResponseValue = EndpointRequestMetricsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointRequestMetricsResponse =
  typeof EndpointRequestMetricsResponse.Type;

/**
 * Generated RUNPOD schema for `EndpointWorkerMetric`.
 *
 * **Example** (Inspect the EndpointWorkerMetric schema)
 *
 * ```ts
 * import { EndpointWorkerMetric } from "@beep/runpod"
 *
 * console.log(EndpointWorkerMetric.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointWorkerMetric = S.StructWithRest(
  S.Struct({
    time: S.String.annotateKey({
      description: "Bucket start (UTC).",
      format: "date-time",
    }),
    running: S.Int,
    idle: S.Int,
    initializing: S.Int,
    throttled: S.Int,
    unhealthy: S.Int,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointWorkerMetric", {
    description: "Generated RUNPOD schema for EndpointWorkerMetric.",
    identifier: "EndpointWorkerMetric",
  }),
);

/**
 * Type for {@link EndpointWorkerMetric}.
 *
 * **Example** (Reference the EndpointWorkerMetric type)
 *
 * ```ts
 * import type { EndpointWorkerMetric } from "@beep/runpod"
 *
 * type EndpointWorkerMetricValue = EndpointWorkerMetric
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointWorkerMetric = typeof EndpointWorkerMetric.Type;

/**
 * Generated RUNPOD schema for `EndpointWorkerMetricsResponse`.
 *
 * **Example** (Inspect the EndpointWorkerMetricsResponse schema)
 *
 * ```ts
 * import { EndpointWorkerMetricsResponse } from "@beep/runpod"
 *
 * console.log(EndpointWorkerMetricsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointWorkerMetricsResponse = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Resolved window start (after defaults).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "Resolved window end (after defaults and the clamp to now).",
      format: "date-time",
    }),
    interval: EndpointMetricsInterval,
    records: S.Array(EndpointWorkerMetric).annotateKey({
      description: "This page's buckets, oldest first.",
    }),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("EndpointWorkerMetricsResponse", {
    description: "Generated RUNPOD schema for EndpointWorkerMetricsResponse.",
    documentation:
      "Worker counts by state per bucket for the resolved window. `records` contains only buckets with activity. Buckets with no activity are omitted, not zero-filled, so `records` can be shorter than the number of buckets in the window, or empty. Results are paged: see `pagination`.\n",
    identifier: "EndpointWorkerMetricsResponse",
  }),
);

/**
 * Type for {@link EndpointWorkerMetricsResponse}.
 *
 * **Example** (Reference the EndpointWorkerMetricsResponse type)
 *
 * ```ts
 * import type { EndpointWorkerMetricsResponse } from "@beep/runpod"
 *
 * type EndpointWorkerMetricsResponseValue = EndpointWorkerMetricsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointWorkerMetricsResponse =
  typeof EndpointWorkerMetricsResponse.Type;

/**
 * Generated RUNPOD schema for `EndpointWorkers`.
 *
 * **Example** (Inspect the EndpointWorkers schema)
 *
 * ```ts
 * import { EndpointWorkers } from "@beep/runpod"
 *
 * console.log(EndpointWorkers.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EndpointWorkers = S.Struct({
  min: S.optionalKey(
    S.Int.annotateKey({ description: "Minimum number of workers." }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
  ),
  max: S.optionalKey(
    S.Int.annotateKey({ description: "Maximum number of workers." }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
  ),
  idleTimeout: S.optionalKey(
    S.Int.annotateKey({
      description:
        "Seconds before idle workers scale down. Not applicable to queue-based\nendpoints scaling on `requestCount` — rejected on create/update and\nomitted from responses for that combination.\n",
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
}).pipe(
  $I.annoteSchema("EndpointWorkers", {
    description: "Generated RUNPOD schema for EndpointWorkers.",
    identifier: "EndpointWorkers",
  }),
);

/**
 * Type for {@link EndpointWorkers}.
 *
 * **Example** (Reference the EndpointWorkers type)
 *
 * ```ts
 * import type { EndpointWorkers } from "@beep/runpod"
 *
 * type EndpointWorkersValue = EndpointWorkers
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EndpointWorkers = typeof EndpointWorkers.Type;

/**
 * Generated RUNPOD schema for `ErrorResponse`.
 *
 * **Example** (Inspect the ErrorResponse schema)
 *
 * ```ts
 * import { ErrorResponse } from "@beep/runpod"
 *
 * console.log(ErrorResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ErrorResponse = S.StructWithRest(
  S.Struct({
    title: S.String.annotateKey({
      description: "Short human-readable summary",
    }),
    status: S.Int.annotateKey({ description: "HTTP status code" }),
    detail: S.String.annotateKey({ description: "Human-readable explanation" }),
    errors: S.optionalKey(
      S.Array(S.String).annotateKey({
        description: "Individual request-validation failures.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ErrorResponse", {
    description: "Generated RUNPOD schema for ErrorResponse.",
    identifier: "ErrorResponse",
  }),
);

/**
 * Type for {@link ErrorResponse}.
 *
 * **Example** (Reference the ErrorResponse type)
 *
 * ```ts
 * import type { ErrorResponse } from "@beep/runpod"
 *
 * type ErrorResponseValue = ErrorResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ErrorResponse = typeof ErrorResponse.Type;

/**
 * Generated RUNPOD schema for `GlobalMountPatch`.
 *
 * **Example** (Inspect the GlobalMountPatch schema)
 *
 * ```ts
 * import { GlobalMountPatch } from "@beep/runpod"
 *
 * console.log(GlobalMountPatch.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobalMountPatch = S.Struct({
  volumeId: S.String.annotateKey({
    description: "ID of an existing GlobalVolume.",
  }),
  path: S.optionalKey(
    S.String.annotateKey({
      description:
        "Mount path inside the container. Optional; when mounting, a default is chosen for you if omitted.",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  remove: S.optionalKey(
    S.Boolean.annotateKey({
      description: "Unmount the volume. Cannot be combined with `path`.",
    }),
  ),
}).pipe(
  $I.annoteSchema("GlobalMountPatch", {
    description: "Generated RUNPOD schema for GlobalMountPatch.",
    documentation: "Mounts, moves, or unmounts the pod's global volume.",
    identifier: "GlobalMountPatch",
  }),
);

/**
 * Type for {@link GlobalMountPatch}.
 *
 * **Example** (Reference the GlobalMountPatch type)
 *
 * ```ts
 * import type { GlobalMountPatch } from "@beep/runpod"
 *
 * type GlobalMountPatchValue = GlobalMountPatch
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GlobalMountPatch = typeof GlobalMountPatch.Type;

/**
 * Generated RUNPOD schema for `GlobalVolume`.
 *
 * **Example** (Inspect the GlobalVolume schema)
 *
 * ```ts
 * import { GlobalVolume } from "@beep/runpod"
 *
 * console.log(GlobalVolume.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobalVolume = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description: "Unique global volume identifier",
    }),
    name: S.String.annotateKey({
      description: "Human-readable name (not required to be unique)",
    }),
    createdAt: S.String.annotateKey({
      description: "When the volume was created",
      format: "date-time",
    }),
    createdByUserId: S.Union([S.String, S.Null]).annotateKey({
      description: "ID of the user who created the volume, if known",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("GlobalVolume", {
    description: "Generated RUNPOD schema for GlobalVolume.",
    identifier: "GlobalVolume",
  }),
);

/**
 * Type for {@link GlobalVolume}.
 *
 * **Example** (Reference the GlobalVolume type)
 *
 * ```ts
 * import type { GlobalVolume } from "@beep/runpod"
 *
 * type GlobalVolumeValue = GlobalVolume
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GlobalVolume = typeof GlobalVolume.Type;

/**
 * Generated RUNPOD schema for `GpuCloudFilter`.
 *
 * **Example** (Inspect the GpuCloudFilter schema)
 *
 * ```ts
 * import { GpuCloudFilter } from "@beep/runpod"
 *
 * console.log(GpuCloudFilter.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GpuCloudFilter = S.Literals(["SECURE", "COMMUNITY"]).pipe(
  $I.annoteSchema("GpuCloudFilter", {
    description: "Generated RUNPOD schema for GpuCloudFilter.",
    documentation: "GPU availability cloud filter.",
    identifier: "GpuCloudFilter",
  }),
);

/**
 * Type for {@link GpuCloudFilter}.
 *
 * **Example** (Reference the GpuCloudFilter type)
 *
 * ```ts
 * import type { GpuCloudFilter } from "@beep/runpod"
 *
 * type GpuCloudFilterValue = GpuCloudFilter
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GpuCloudFilter = typeof GpuCloudFilter.Type;

/**
 * Generated RUNPOD schema for `GpuConfig`.
 *
 * **Example** (Inspect the GpuConfig schema)
 *
 * ```ts
 * import { GpuConfig } from "@beep/runpod"
 *
 * console.log(GpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GpuConfig = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "GPU type identifier" }),
    count: S.optionalKey(
      S.Int.annotateKey({ description: "Number of GPUs", default: 1 })
        .check(
          S.isGreaterThanOrEqualTo(1).annotate({
            expected: "a value greater than or equal to 1",
          }),
        )
        .check(
          S.isLessThanOrEqualTo(1024).annotate({
            expected: "a value less than or equal to 1024",
          }),
        ),
    ),
    vcpuCount: S.Finite.annotateKey({
      description:
        "Total vCPU count allocated to the pod across all requested GPUs.",
      format: "double",
    })
      .check(S.isFinite().annotate({ expected: "a finite number" }))
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
    memory: S.Finite.annotateKey({
      description:
        "Total system RAM in GB allocated to the pod across all requested GPUs.",
      format: "double",
    })
      .check(S.isFinite().annotate({ expected: "a finite number" }))
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("GpuConfig", {
    description: "Generated RUNPOD schema for GpuConfig.",
    identifier: "GpuConfig",
  }),
);

/**
 * Type for {@link GpuConfig}.
 *
 * **Example** (Reference the GpuConfig type)
 *
 * ```ts
 * import type { GpuConfig } from "@beep/runpod"
 *
 * type GpuConfigValue = GpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GpuConfig = typeof GpuConfig.Type;

/**
 * Generated RUNPOD schema for `GpuManufacturer`.
 *
 * **Example** (Inspect the GpuManufacturer schema)
 *
 * ```ts
 * import { GpuManufacturer } from "@beep/runpod"
 *
 * console.log(GpuManufacturer.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GpuManufacturer = S.Literals(["NVIDIA", "AMD", "UNKNOWN"]).pipe(
  $I.annoteSchema("GpuManufacturer", {
    description: "Generated RUNPOD schema for GpuManufacturer.",
    documentation: "Canonical GPU hardware manufacturer.",
    identifier: "GpuManufacturer",
  }),
);

/**
 * Type for {@link GpuManufacturer}.
 *
 * **Example** (Reference the GpuManufacturer type)
 *
 * ```ts
 * import type { GpuManufacturer } from "@beep/runpod"
 *
 * type GpuManufacturerValue = GpuManufacturer
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GpuManufacturer = typeof GpuManufacturer.Type;

/**
 * Generated RUNPOD schema for `GpuType`.
 *
 * **Example** (Inspect the GpuType schema)
 *
 * ```ts
 * import { GpuType } from "@beep/runpod"
 *
 * console.log(GpuType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GpuType = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description: "Individual GPU type identifier (use for pod creation)",
    }),
    name: S.String,
    pool: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Serverless GPU pool ID (use for serverless endpoint creation). Null if GPU is not in a serverless pool.",
    }),
    manufacturer: GpuManufacturer,
    memory: S.Int.annotateKey({ description: "VRAM in GB" }),
    secure: S.Boolean.annotateKey({ description: "Available on secure cloud" }),
    community: S.Boolean.annotateKey({
      description: "Available on community cloud",
    }),
    price: S.StructWithRest(
      S.Struct({
        secure: S.Finite.annotateKey({ format: "float" }).check(
          S.isFinite().annotate({ expected: "a finite number" }),
        ),
        community: S.Finite.annotateKey({ format: "float" }).check(
          S.isFinite().annotate({ expected: "a finite number" }),
        ),
        serverless: S.optionalKey(
          S.Finite.annotateKey({
            description:
              "Serverless list price per GPU per hour, from the `pool` this GPU\nbelongs to. Multiply by `gpu.count` for the per-worker rate.\nAbsent when the GPU is not in a serverless pool available to the\ncaller. Negotiated account discounts are not reflected.\n",
            format: "float",
          }).check(S.isFinite().annotate({ expected: "a finite number" })),
        ),
      }),
      [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
    ).annotateKey({
      description:
        "List price in USD per hour for a **single** GPU of this type. Pod\nrates are quoted separately per cloud (`secure`, `community`);\n`serverless` is the rate for this GPU's pool. In every case the\nrate for a unit is the figure times `gpu.count`; the rate actually\nbilled for a pod is reported as `cost` on the pod itself.\n",
    }),
    maxCount: S.StructWithRest(S.Struct({ secure: S.Int, community: S.Int }), [
      S.Record(S.String, S.Json.annotate({ expected: "JSON value" })),
    ]).annotateKey({
      description:
        "The largest number of GPUs you can request on a single pod of this\ntype, quoted separately per cloud. A pod runs on one machine, so\nthis is the GPU count of the largest machine of this type Runpod\noperates in that cloud.\n\nThis is a ceiling, not a stock level — it does not mean that many\nGPUs are free right now. For current availability, request\n`include=AVAILABILITY&product=POD` and read `availability`\n(overall) or `dataCenters` (per data center).\n",
    }),
    minVcpuCount: S.optionalKey(
      S.Int.annotateKey({
        description:
          "Minimum total vCPU count reported across matching machines for the\nrequested `count` and availability filters. Present only with\ninclude=AVAILABILITY and omitted when `availability` is `NONE`.\n",
      }),
    ),
    minRam: S.optionalKey(
      S.Int.annotateKey({
        description:
          "Minimum total system RAM in GB reported across matching machines\nfor the requested `count` and availability filters. This is host\nRAM, not the GPU VRAM reported in `memory`. Present only with\ninclude=AVAILABILITY and omitted when `availability` is `NONE`.\n",
      }),
    ),
    availability: S.optionalKey(
      S.suspend(
        (): S.Codec<AvailabilityLevel> => AvailabilityLevel,
      ).annotateKey({
        description:
          "Overall GPU availability for the requested `product` contexts. Present only when requested with include=AVAILABILITY, which also requires `product`.",
      }),
    ),
    dataCenters: S.optionalKey(
      S.Array(DataCenterAvailability).annotateKey({
        description:
          "Per-datacenter GPU availability for the requested `product`\ncontexts, listing only the datacenters that offer this GPU in the\nrequested configuration. Present only when requested with\ninclude=AVAILABILITY, which also requires `product`, and omitted\nentirely when the configuration is unavailable everywhere.\n",
      }),
    ),
    cudaVersions: S.optionalKey(
      S.Array(CudaVersionAvailability).annotateKey({
        description:
          "CUDA versions offered by machines with this GPU type, each tagged\nwith current capacity. Present only when requested with\ninclude=AVAILABILITY, and scoped by the same filters as\n`availability` (`count`, `cloud`, `product`, and whichever of\n`cudaVersions` / `minCudaVersion` was supplied).\n\nMachines that report no CUDA version are skipped, so this property\nis absent entirely for a GPU type with none — AMD, for instance.\nTreat a missing `cudaVersions` the same as an empty one. A version\nabsent from a populated list is not offered for this GPU type.\n",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("GpuType", {
    description: "Generated RUNPOD schema for GpuType.",
    identifier: "GpuType",
  }),
);

/**
 * Type for {@link GpuType}.
 *
 * **Example** (Reference the GpuType type)
 *
 * ```ts
 * import type { GpuType } from "@beep/runpod"
 *
 * type GpuTypeValue = GpuType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GpuType = typeof GpuType.Type;

/**
 * Generated RUNPOD schema for `ListAuditLogsResponse`.
 *
 * **Example** (Inspect the ListAuditLogsResponse schema)
 *
 * ```ts
 * import { ListAuditLogsResponse } from "@beep/runpod"
 *
 * console.log(ListAuditLogsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListAuditLogsResponse = S.StructWithRest(
  S.Struct({ auditLogs: S.Array(AuditLog), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListAuditLogsResponse", {
    description: "Generated RUNPOD schema for ListAuditLogsResponse.",
    identifier: "ListAuditLogsResponse",
  }),
);

/**
 * Type for {@link ListAuditLogsResponse}.
 *
 * **Example** (Reference the ListAuditLogsResponse type)
 *
 * ```ts
 * import type { ListAuditLogsResponse } from "@beep/runpod"
 *
 * type ListAuditLogsResponseValue = ListAuditLogsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListAuditLogsResponse = typeof ListAuditLogsResponse.Type;

/**
 * Generated RUNPOD schema for `ListBillingResponse`.
 *
 * **Example** (Inspect the ListBillingResponse schema)
 *
 * ```ts
 * import { ListBillingResponse } from "@beep/runpod"
 *
 * console.log(ListBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListBillingResponse = S.StructWithRest(
  S.Struct({ records: S.Array(BillingRecord), metadata: BillingMetadata }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListBillingResponse", {
    description: "Generated RUNPOD schema for ListBillingResponse.",
    documentation: "Aggregated billing records across all Runpod resources.",
    identifier: "ListBillingResponse",
  }),
);

/**
 * Type for {@link ListBillingResponse}.
 *
 * **Example** (Reference the ListBillingResponse type)
 *
 * ```ts
 * import type { ListBillingResponse } from "@beep/runpod"
 *
 * type ListBillingResponseValue = ListBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListBillingResponse = typeof ListBillingResponse.Type;

/**
 * Generated RUNPOD schema for `ListClusterBillingResponse`.
 *
 * **Example** (Inspect the ListClusterBillingResponse schema)
 *
 * ```ts
 * import { ListClusterBillingResponse } from "@beep/runpod"
 *
 * console.log(ListClusterBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListClusterBillingResponse = S.StructWithRest(
  S.Struct({
    records: S.Array(ClusterBillingRecord),
    metadata: ClusterBillingMetadata,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListClusterBillingResponse", {
    description: "Generated RUNPOD schema for ListClusterBillingResponse.",
    documentation:
      "Time-bucketed Cluster billing records plus metadata for the resolved query, record count, distinct cluster count, and compute totals.\n",
    identifier: "ListClusterBillingResponse",
  }),
);

/**
 * Type for {@link ListClusterBillingResponse}.
 *
 * **Example** (Reference the ListClusterBillingResponse type)
 *
 * ```ts
 * import type { ListClusterBillingResponse } from "@beep/runpod"
 *
 * type ListClusterBillingResponseValue = ListClusterBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListClusterBillingResponse = typeof ListClusterBillingResponse.Type;

/**
 * Generated RUNPOD schema for `ListClustersResponse`.
 *
 * **Example** (Inspect the ListClustersResponse schema)
 *
 * ```ts
 * import { ListClustersResponse } from "@beep/runpod"
 *
 * console.log(ListClustersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListClustersResponse = S.StructWithRest(
  S.Struct({ clusters: S.Array(Cluster), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListClustersResponse", {
    description: "Generated RUNPOD schema for ListClustersResponse.",
    identifier: "ListClustersResponse",
  }),
);

/**
 * Type for {@link ListClustersResponse}.
 *
 * **Example** (Reference the ListClustersResponse type)
 *
 * ```ts
 * import type { ListClustersResponse } from "@beep/runpod"
 *
 * type ListClustersResponseValue = ListClustersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListClustersResponse = typeof ListClustersResponse.Type;

/**
 * Generated RUNPOD schema for `ListCostCenterResourcesResponse`.
 *
 * **Example** (Inspect the ListCostCenterResourcesResponse schema)
 *
 * ```ts
 * import { ListCostCenterResourcesResponse } from "@beep/runpod"
 *
 * console.log(ListCostCenterResourcesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListCostCenterResourcesResponse = S.StructWithRest(
  S.Struct({ resources: S.Array(CostCenterResource), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListCostCenterResourcesResponse", {
    description: "Generated RUNPOD schema for ListCostCenterResourcesResponse.",
    identifier: "ListCostCenterResourcesResponse",
  }),
);

/**
 * Type for {@link ListCostCenterResourcesResponse}.
 *
 * **Example** (Reference the ListCostCenterResourcesResponse type)
 *
 * ```ts
 * import type { ListCostCenterResourcesResponse } from "@beep/runpod"
 *
 * type ListCostCenterResourcesResponseValue = ListCostCenterResourcesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListCostCenterResourcesResponse =
  typeof ListCostCenterResourcesResponse.Type;

/**
 * Generated RUNPOD schema for `ListCostCentersResponse`.
 *
 * **Example** (Inspect the ListCostCentersResponse schema)
 *
 * ```ts
 * import { ListCostCentersResponse } from "@beep/runpod"
 *
 * console.log(ListCostCentersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListCostCentersResponse = S.StructWithRest(
  S.Struct({ costCenters: S.Array(CostCenter), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListCostCentersResponse", {
    description: "Generated RUNPOD schema for ListCostCentersResponse.",
    identifier: "ListCostCentersResponse",
  }),
);

/**
 * Type for {@link ListCostCentersResponse}.
 *
 * **Example** (Reference the ListCostCentersResponse type)
 *
 * ```ts
 * import type { ListCostCentersResponse } from "@beep/runpod"
 *
 * type ListCostCentersResponseValue = ListCostCentersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListCostCentersResponse = typeof ListCostCentersResponse.Type;

/**
 * Generated RUNPOD schema for `ListCpuTypesResponse`.
 *
 * **Example** (Inspect the ListCpuTypesResponse schema)
 *
 * ```ts
 * import { ListCpuTypesResponse } from "@beep/runpod"
 *
 * console.log(ListCpuTypesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListCpuTypesResponse = S.StructWithRest(
  S.Struct({ cpus: S.Array(CpuType) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListCpuTypesResponse", {
    description: "Generated RUNPOD schema for ListCpuTypesResponse.",
    identifier: "ListCpuTypesResponse",
  }),
);

/**
 * Type for {@link ListCpuTypesResponse}.
 *
 * **Example** (Reference the ListCpuTypesResponse type)
 *
 * ```ts
 * import type { ListCpuTypesResponse } from "@beep/runpod"
 *
 * type ListCpuTypesResponseValue = ListCpuTypesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListCpuTypesResponse = typeof ListCpuTypesResponse.Type;

/**
 * Generated RUNPOD schema for `ListDataCentersResponse`.
 *
 * **Example** (Inspect the ListDataCentersResponse schema)
 *
 * ```ts
 * import { ListDataCentersResponse } from "@beep/runpod"
 *
 * console.log(ListDataCentersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListDataCentersResponse = S.StructWithRest(
  S.Struct({ dataCenters: S.Array(DataCenter) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListDataCentersResponse", {
    description: "Generated RUNPOD schema for ListDataCentersResponse.",
    identifier: "ListDataCentersResponse",
  }),
);

/**
 * Type for {@link ListDataCentersResponse}.
 *
 * **Example** (Reference the ListDataCentersResponse type)
 *
 * ```ts
 * import type { ListDataCentersResponse } from "@beep/runpod"
 *
 * type ListDataCentersResponseValue = ListDataCentersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListDataCentersResponse = typeof ListDataCentersResponse.Type;

/**
 * Generated RUNPOD schema for `ListDelegationsResponse`.
 *
 * **Example** (Inspect the ListDelegationsResponse schema)
 *
 * ```ts
 * import { ListDelegationsResponse } from "@beep/runpod"
 *
 * console.log(ListDelegationsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListDelegationsResponse = S.StructWithRest(
  S.Struct({ delegations: S.Array(EcrDelegation) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListDelegationsResponse", {
    description: "Generated RUNPOD schema for ListDelegationsResponse.",
    identifier: "ListDelegationsResponse",
  }),
);

/**
 * Type for {@link ListDelegationsResponse}.
 *
 * **Example** (Reference the ListDelegationsResponse type)
 *
 * ```ts
 * import type { ListDelegationsResponse } from "@beep/runpod"
 *
 * type ListDelegationsResponseValue = ListDelegationsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListDelegationsResponse = typeof ListDelegationsResponse.Type;

/**
 * Generated RUNPOD schema for `ListEndpointBillingResponse`.
 *
 * **Example** (Inspect the ListEndpointBillingResponse schema)
 *
 * ```ts
 * import { ListEndpointBillingResponse } from "@beep/runpod"
 *
 * console.log(ListEndpointBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListEndpointBillingResponse = S.StructWithRest(
  S.Struct({
    records: S.Array(EndpointBillingRecord),
    metadata: EndpointBillingMetadata,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListEndpointBillingResponse", {
    description: "Generated RUNPOD schema for ListEndpointBillingResponse.",
    documentation:
      "Time-bucketed Runpod public endpoint billing records plus metadata for the resolved query, record count, and total endpoint amount.\n",
    identifier: "ListEndpointBillingResponse",
  }),
);

/**
 * Type for {@link ListEndpointBillingResponse}.
 *
 * **Example** (Reference the ListEndpointBillingResponse type)
 *
 * ```ts
 * import type { ListEndpointBillingResponse } from "@beep/runpod"
 *
 * type ListEndpointBillingResponseValue = ListEndpointBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListEndpointBillingResponse =
  typeof ListEndpointBillingResponse.Type;

/**
 * Generated RUNPOD schema for `ListEndpointBuildsResponse`.
 *
 * **Example** (Inspect the ListEndpointBuildsResponse schema)
 *
 * ```ts
 * import { ListEndpointBuildsResponse } from "@beep/runpod"
 *
 * console.log(ListEndpointBuildsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListEndpointBuildsResponse = S.StructWithRest(
  S.Struct({
    builds: S.Array(Build).annotateKey({
      description:
        "Build history, newest first, cursor-paginated (an omitted `limit`\ndefaults to 100). Page with `cursor`/`limit` to walk the full\nhistory, or fetch any build by id via\n`GET /v2/serverless/{id}/builds/{buildId}`.\n",
    }),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListEndpointBuildsResponse", {
    description: "Generated RUNPOD schema for ListEndpointBuildsResponse.",
    identifier: "ListEndpointBuildsResponse",
  }),
);

/**
 * Type for {@link ListEndpointBuildsResponse}.
 *
 * **Example** (Reference the ListEndpointBuildsResponse type)
 *
 * ```ts
 * import type { ListEndpointBuildsResponse } from "@beep/runpod"
 *
 * type ListEndpointBuildsResponseValue = ListEndpointBuildsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListEndpointBuildsResponse = typeof ListEndpointBuildsResponse.Type;

/**
 * Generated RUNPOD schema for `RolloutSummary`.
 *
 * **Example** (Inspect the RolloutSummary schema)
 *
 * ```ts
 * import { RolloutSummary } from "@beep/runpod"
 *
 * console.log(RolloutSummary.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RolloutSummary = S.StructWithRest(
  S.Struct({
    inProgress: S.Boolean.annotateKey({
      description: "True while any worker is still running an older version.",
    }),
    workersOnLatest: S.Int.annotateKey({
      description: "Workers running the endpoint's current version.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    workersTotal: S.Int.annotateKey({
      description: "All workers currently allocated to the endpoint.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    percentOnLatest: S.Int.annotateKey({
      description:
        "Percentage of workers on the current version (0 when there are no workers).",
    })
      .check(
        S.isGreaterThanOrEqualTo(0).annotate({
          expected: "a value greater than or equal to 0",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(100).annotate({
          expected: "a value less than or equal to 100",
        }),
      ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("RolloutSummary", {
    description: "Generated RUNPOD schema for RolloutSummary.",
    identifier: "RolloutSummary",
  }),
);

/**
 * Type for {@link RolloutSummary}.
 *
 * **Example** (Reference the RolloutSummary type)
 *
 * ```ts
 * import type { RolloutSummary } from "@beep/runpod"
 *
 * type RolloutSummaryValue = RolloutSummary
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RolloutSummary = typeof RolloutSummary.Type;

/**
 * Generated RUNPOD schema for `ReleaseSource`.
 *
 * **Example** (Inspect the ReleaseSource schema)
 *
 * ```ts
 * import { ReleaseSource } from "@beep/runpod"
 *
 * console.log(ReleaseSource.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReleaseSource = S.Literals(["GIT_BUILD", "MANUAL"]).pipe(
  $I.annoteSchema("ReleaseSource", {
    description: "Generated RUNPOD schema for ReleaseSource.",
    documentation:
      "What produced the release.\n- `GIT_BUILD` — a completed GitHub build (see `buildId`)\n- `MANUAL`    — a manual configuration change\n",
    identifier: "ReleaseSource",
  }),
);

/**
 * Type for {@link ReleaseSource}.
 *
 * **Example** (Reference the ReleaseSource type)
 *
 * ```ts
 * import type { ReleaseSource } from "@beep/runpod"
 *
 * type ReleaseSourceValue = ReleaseSource
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReleaseSource = typeof ReleaseSource.Type;

/**
 * Generated RUNPOD schema for `ReleaseDiffEntry`.
 *
 * **Example** (Inspect the ReleaseDiffEntry schema)
 *
 * ```ts
 * import { ReleaseDiffEntry } from "@beep/runpod"
 *
 * console.log(ReleaseDiffEntry.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReleaseDiffEntry = S.StructWithRest(
  S.Struct({
    field: S.String.annotateKey({
      description:
        "The changed configuration field. Top-level (e.g. `gpuCount`,\n`locations`) or template-scoped (e.g. `template.imageName`,\n`template.env`).\n",
    }),
    old: S.Json.annotateKey({
      expected: "JSON value",
      description:
        "Previous value, as raw JSON. Null when the field was added.",
    }),
    "new": S.Json.annotateKey({
      expected: "JSON value",
      description: "New value, as raw JSON. Null when the field was removed.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ReleaseDiffEntry", {
    description: "Generated RUNPOD schema for ReleaseDiffEntry.",
    identifier: "ReleaseDiffEntry",
  }),
);

/**
 * Type for {@link ReleaseDiffEntry}.
 *
 * **Example** (Reference the ReleaseDiffEntry type)
 *
 * ```ts
 * import type { ReleaseDiffEntry } from "@beep/runpod"
 *
 * type ReleaseDiffEntryValue = ReleaseDiffEntry
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReleaseDiffEntry = typeof ReleaseDiffEntry.Type;

/**
 * Generated RUNPOD schema for `Release`.
 *
 * **Example** (Inspect the Release schema)
 *
 * ```ts
 * import { Release } from "@beep/runpod"
 *
 * console.log(Release.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Release = S.StructWithRest(
  S.Struct({
    id: S.String,
    version: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The endpoint configuration version this release produced.",
      }),
    ),
    source: ReleaseSource,
    buildId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "The GitHub build that produced this release. Set when `source` is\n`GIT_BUILD`; null for `MANUAL` releases. Fetch build detail/logs via\n`/v2/serverless/{id}/builds/{buildId}`.\n",
      }),
    ),
    createdByUserId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "ID of the user who created the release.",
      }),
    ),
    workerCount: S.Int.annotateKey({
      description: "Workers currently running this release's version.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    createdAt: S.String.annotateKey({ format: "date-time" }),
    diff: S.Array(ReleaseDiffEntry).annotateKey({
      description: "Configuration fields that changed in this release.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Release", {
    description: "Generated RUNPOD schema for Release.",
    identifier: "Release",
  }),
);

/**
 * Type for {@link Release}.
 *
 * **Example** (Reference the Release type)
 *
 * ```ts
 * import type { Release } from "@beep/runpod"
 *
 * type ReleaseValue = Release
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Release = typeof Release.Type;

/**
 * Generated RUNPOD schema for `ListEndpointReleasesResponse`.
 *
 * **Example** (Inspect the ListEndpointReleasesResponse schema)
 *
 * ```ts
 * import { ListEndpointReleasesResponse } from "@beep/runpod"
 *
 * console.log(ListEndpointReleasesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListEndpointReleasesResponse = S.StructWithRest(
  S.Struct({
    endpointVersion: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The endpoint's current configuration version. Null if unknown.",
      }),
    ),
    rollout: RolloutSummary,
    releases: S.Array(Release).annotateKey({
      description: "Release history, newest first.",
    }),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListEndpointReleasesResponse", {
    description: "Generated RUNPOD schema for ListEndpointReleasesResponse.",
    identifier: "ListEndpointReleasesResponse",
  }),
);

/**
 * Type for {@link ListEndpointReleasesResponse}.
 *
 * **Example** (Reference the ListEndpointReleasesResponse type)
 *
 * ```ts
 * import type { ListEndpointReleasesResponse } from "@beep/runpod"
 *
 * type ListEndpointReleasesResponseValue = ListEndpointReleasesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListEndpointReleasesResponse =
  typeof ListEndpointReleasesResponse.Type;

/**
 * Generated RUNPOD schema for `WorkerStatus`.
 *
 * **Example** (Inspect the WorkerStatus schema)
 *
 * ```ts
 * import { WorkerStatus } from "@beep/runpod"
 *
 * console.log(WorkerStatus.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkerStatus = S.Literals([
  "RUNNING",
  "IDLE",
  "INITIALIZING",
  "THROTTLED",
  "UNHEALTHY",
]).pipe(
  $I.annoteSchema("WorkerStatus", {
    description: "Generated RUNPOD schema for WorkerStatus.",
    documentation:
      "Derived worker state, reconciled from the worker pod's lifecycle status\nand the live job-queue view.\n- `RUNNING`      — actively processing a job\n- `IDLE`         — ready and polling for jobs\n- `INITIALIZING` — starting up, not yet ready\n- `THROTTLED`    — waiting on compute capacity\n- `UNHEALTHY`    — failing health checks\n",
    identifier: "WorkerStatus",
  }),
);

/**
 * Type for {@link WorkerStatus}.
 *
 * **Example** (Reference the WorkerStatus type)
 *
 * ```ts
 * import type { WorkerStatus } from "@beep/runpod"
 *
 * type WorkerStatusValue = WorkerStatus
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WorkerStatus = typeof WorkerStatus.Type;

/**
 * Generated RUNPOD schema for `Worker`.
 *
 * **Example** (Inspect the Worker schema)
 *
 * ```ts
 * import { Worker } from "@beep/runpod"
 *
 * console.log(Worker.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Worker = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "Identifier of the pod backing this worker. Each worker is one pod,\nso there is no separate pod identifier.\n",
    }),
    status: WorkerStatus,
    isStale: S.Boolean.annotateKey({
      description:
        "True when the worker is running an older endpoint configuration than\nthe current one (e.g. mid rolling-update). This is the authoritative\nflag: it is derived from `version` vs the response's `endpointVersion`,\nexcept on legacy endpoints (`endpointVersion` 1) where it falls back\nto a container-image comparison.\n",
    }),
    version: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "Endpoint configuration version this worker is running. Compare with\nthe response's `endpointVersion`. Null if unknown.\n",
      }),
    ),
    gpuCount: S.Int.annotateKey({
      description: "GPUs allocated to the worker.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    image: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "Container image the worker is running.",
      }),
    ),
    uptimeSeconds: S.optionalKey(
      S.Union([
        S.Int.check(
          S.isGreaterThanOrEqualTo(0).annotate({
            expected: "a value greater than or equal to 0",
          }),
        ),
        S.Null,
      ]).annotateKey({
        description:
          "Seconds the worker has been running. Null until the worker is placed and running.",
      }),
    ),
    gpuTypeId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "GPU type the worker is placed on. Null until the worker is placed.",
      }),
    ),
    dataCenterId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "Data center the worker is placed in. Null until the worker is placed.",
      }),
    ),
    startedAt: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "When the worker last started. Null if it has not started.",
        format: "date-time",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Worker", {
    description: "Generated RUNPOD schema for Worker.",
    identifier: "Worker",
  }),
);

/**
 * Type for {@link Worker}.
 *
 * **Example** (Reference the Worker type)
 *
 * ```ts
 * import type { Worker } from "@beep/runpod"
 *
 * type WorkerValue = Worker
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Worker = typeof Worker.Type;

/**
 * Generated RUNPOD schema for `WorkerSummary`.
 *
 * **Example** (Inspect the WorkerSummary schema)
 *
 * ```ts
 * import { WorkerSummary } from "@beep/runpod"
 *
 * console.log(WorkerSummary.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WorkerSummary = S.StructWithRest(
  S.Struct({
    running: S.Int.annotateKey({
      description: "Workers actively processing a job.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    idle: S.Int.annotateKey({
      description: "Ready workers polling for jobs.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    initializing: S.Int.annotateKey({
      description: "Workers starting up, not yet ready.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    throttled: S.Int.annotateKey({
      description: "Workers waiting on compute capacity.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    unhealthy: S.Int.annotateKey({
      description: "Workers failing health checks.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    total: S.Int.annotateKey({
      description: "All workers currently allocated to the endpoint.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("WorkerSummary", {
    description: "Generated RUNPOD schema for WorkerSummary.",
    documentation:
      "Histogram of the returned workers by status. The per-status counts are a\nroll-up of the `workers` array, so `running + idle + initializing +\nthrottled + unhealthy == total == len(workers)`.\n",
    identifier: "WorkerSummary",
  }),
);

/**
 * Type for {@link WorkerSummary}.
 *
 * **Example** (Reference the WorkerSummary type)
 *
 * ```ts
 * import type { WorkerSummary } from "@beep/runpod"
 *
 * type WorkerSummaryValue = WorkerSummary
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WorkerSummary = typeof WorkerSummary.Type;

/**
 * Generated RUNPOD schema for `ListEndpointWorkersResponse`.
 *
 * **Example** (Inspect the ListEndpointWorkersResponse schema)
 *
 * ```ts
 * import { ListEndpointWorkersResponse } from "@beep/runpod"
 *
 * console.log(ListEndpointWorkersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListEndpointWorkersResponse = S.StructWithRest(
  S.Struct({
    workers: S.Array(Worker),
    summary: WorkerSummary,
    endpointVersion: S.optionalKey(
      S.Union([S.Int, S.Null]).annotateKey({
        description:
          "The endpoint's current configuration version. A worker whose\n`version` differs is running stale config (see `worker.isStale`).\nNull if unknown.\n",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListEndpointWorkersResponse", {
    description: "Generated RUNPOD schema for ListEndpointWorkersResponse.",
    identifier: "ListEndpointWorkersResponse",
  }),
);

/**
 * Type for {@link ListEndpointWorkersResponse}.
 *
 * **Example** (Reference the ListEndpointWorkersResponse type)
 *
 * ```ts
 * import type { ListEndpointWorkersResponse } from "@beep/runpod"
 *
 * type ListEndpointWorkersResponseValue = ListEndpointWorkersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListEndpointWorkersResponse =
  typeof ListEndpointWorkersResponse.Type;

/**
 * Generated RUNPOD schema for `ListEndpointsResponse`.
 *
 * **Example** (Inspect the ListEndpointsResponse schema)
 *
 * ```ts
 * import { ListEndpointsResponse } from "@beep/runpod"
 *
 * console.log(ListEndpointsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListEndpointsResponse = S.StructWithRest(
  S.Struct({ endpoints: S.Array(Endpoint), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListEndpointsResponse", {
    description: "Generated RUNPOD schema for ListEndpointsResponse.",
    identifier: "ListEndpointsResponse",
  }),
);

/**
 * Type for {@link ListEndpointsResponse}.
 *
 * **Example** (Reference the ListEndpointsResponse type)
 *
 * ```ts
 * import type { ListEndpointsResponse } from "@beep/runpod"
 *
 * type ListEndpointsResponseValue = ListEndpointsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListEndpointsResponse = typeof ListEndpointsResponse.Type;

/**
 * Generated RUNPOD schema for `ListGlobalVolumesResponse`.
 *
 * **Example** (Inspect the ListGlobalVolumesResponse schema)
 *
 * ```ts
 * import { ListGlobalVolumesResponse } from "@beep/runpod"
 *
 * console.log(ListGlobalVolumesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListGlobalVolumesResponse = S.StructWithRest(
  S.Struct({ globalVolumes: S.Array(GlobalVolume), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListGlobalVolumesResponse", {
    description: "Generated RUNPOD schema for ListGlobalVolumesResponse.",
    identifier: "ListGlobalVolumesResponse",
  }),
);

/**
 * Type for {@link ListGlobalVolumesResponse}.
 *
 * **Example** (Reference the ListGlobalVolumesResponse type)
 *
 * ```ts
 * import type { ListGlobalVolumesResponse } from "@beep/runpod"
 *
 * type ListGlobalVolumesResponseValue = ListGlobalVolumesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListGlobalVolumesResponse = typeof ListGlobalVolumesResponse.Type;

/**
 * Generated RUNPOD schema for `ListGpuTypesResponse`.
 *
 * **Example** (Inspect the ListGpuTypesResponse schema)
 *
 * ```ts
 * import { ListGpuTypesResponse } from "@beep/runpod"
 *
 * console.log(ListGpuTypesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListGpuTypesResponse = S.StructWithRest(
  S.Struct({ gpus: S.Array(GpuType) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListGpuTypesResponse", {
    description: "Generated RUNPOD schema for ListGpuTypesResponse.",
    identifier: "ListGpuTypesResponse",
  }),
);

/**
 * Type for {@link ListGpuTypesResponse}.
 *
 * **Example** (Reference the ListGpuTypesResponse type)
 *
 * ```ts
 * import type { ListGpuTypesResponse } from "@beep/runpod"
 *
 * type ListGpuTypesResponseValue = ListGpuTypesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListGpuTypesResponse = typeof ListGpuTypesResponse.Type;

/**
 * Generated RUNPOD schema for `NetworkVolumeBillingRecord`.
 *
 * **Example** (Inspect the NetworkVolumeBillingRecord schema)
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
export const NetworkVolumeBillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description:
        "Total network volume cost in USD for the bucket, across standard and high-performance storage.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    standardAmount: S.Finite.annotateKey({
      description: "Standard storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    highPerformanceAmount: S.Finite.annotateKey({
      description: "High-performance storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    networkVolumeId: S.String.annotateKey({
      description:
        "The network volume this record bills. When the networkVolumeId filter is set every record carries that id; otherwise one record is emitted per network volume per bucket.\n",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("NetworkVolumeBillingRecord", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingRecord.",
    documentation:
      "A single time-bucketed network volume billing record, split into standard and high-performance storage. Returned by GET /v2/billing/network-volumes.\n",
    identifier: "NetworkVolumeBillingRecord",
  }),
);

/**
 * Type for {@link NetworkVolumeBillingRecord}.
 *
 * **Example** (Reference the NetworkVolumeBillingRecord type)
 *
 * ```ts
 * import type { NetworkVolumeBillingRecord } from "@beep/runpod"
 *
 * type NetworkVolumeBillingRecordValue = NetworkVolumeBillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumeBillingRecord = typeof NetworkVolumeBillingRecord.Type;

/**
 * Generated RUNPOD schema for `NetworkVolumeBillingQuery`.
 *
 * **Example** (Inspect the NetworkVolumeBillingQuery schema)
 *
 * ```ts
 * import { NetworkVolumeBillingQuery } from "@beep/runpod"
 *
 * console.log(NetworkVolumeBillingQuery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkVolumeBillingQuery = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    bucketSize: BillingBucketSize,
    networkVolumeId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "The networkVolumeId filter applied, if any.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("NetworkVolumeBillingQuery", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingQuery.",
    documentation:
      "Resolved query window and granularity (routes without a filter).",
    identifier: "NetworkVolumeBillingQuery",
  }),
);

/**
 * Type for {@link NetworkVolumeBillingQuery}.
 *
 * **Example** (Reference the NetworkVolumeBillingQuery type)
 *
 * ```ts
 * import type { NetworkVolumeBillingQuery } from "@beep/runpod"
 *
 * type NetworkVolumeBillingQueryValue = NetworkVolumeBillingQuery
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumeBillingQuery = typeof NetworkVolumeBillingQuery.Type;

/**
 * Generated RUNPOD schema for `NetworkVolumeBillingAmounts`.
 *
 * **Example** (Inspect the NetworkVolumeBillingAmounts schema)
 *
 * ```ts
 * import { NetworkVolumeBillingAmounts } from "@beep/runpod"
 *
 * console.log(NetworkVolumeBillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkVolumeBillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description:
        "Total network volume cost in USD for the bucket, across standard and high-performance storage.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    standardAmount: S.Finite.annotateKey({
      description: "Standard storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    highPerformanceAmount: S.Finite.annotateKey({
      description: "High-performance storage cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("NetworkVolumeBillingAmounts", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingAmounts.",
    documentation:
      "Network volume storage cost, split into standard and high-performance. Backs a record's amounts and the metadata totals.\n",
    identifier: "NetworkVolumeBillingAmounts",
  }),
);

/**
 * Type for {@link NetworkVolumeBillingAmounts}.
 *
 * **Example** (Reference the NetworkVolumeBillingAmounts type)
 *
 * ```ts
 * import type { NetworkVolumeBillingAmounts } from "@beep/runpod"
 *
 * type NetworkVolumeBillingAmountsValue = NetworkVolumeBillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumeBillingAmounts =
  typeof NetworkVolumeBillingAmounts.Type;

/**
 * Generated RUNPOD schema for `NetworkVolumeBillingMetadata`.
 *
 * **Example** (Inspect the NetworkVolumeBillingMetadata schema)
 *
 * ```ts
 * import { NetworkVolumeBillingMetadata } from "@beep/runpod"
 *
 * console.log(NetworkVolumeBillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkVolumeBillingMetadata = S.StructWithRest(
  S.Struct({
    query: NetworkVolumeBillingQuery,
    recordCount: S.Int.annotateKey({
      description:
        "Number of records returned (buckets times distinct volumes).",
    }),
    uniqueNetworkVolumeCount: S.Int.annotateKey({
      description: "Number of distinct network volumes the records span.",
    }),
    totals: NetworkVolumeBillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("NetworkVolumeBillingMetadata", {
    description: "Generated RUNPOD schema for NetworkVolumeBillingMetadata.",
    identifier: "NetworkVolumeBillingMetadata",
  }),
);

/**
 * Type for {@link NetworkVolumeBillingMetadata}.
 *
 * **Example** (Reference the NetworkVolumeBillingMetadata type)
 *
 * ```ts
 * import type { NetworkVolumeBillingMetadata } from "@beep/runpod"
 *
 * type NetworkVolumeBillingMetadataValue = NetworkVolumeBillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolumeBillingMetadata =
  typeof NetworkVolumeBillingMetadata.Type;

/**
 * Generated RUNPOD schema for `ListNetworkVolumeBillingResponse`.
 *
 * **Example** (Inspect the ListNetworkVolumeBillingResponse schema)
 *
 * ```ts
 * import { ListNetworkVolumeBillingResponse } from "@beep/runpod"
 *
 * console.log(ListNetworkVolumeBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListNetworkVolumeBillingResponse = S.StructWithRest(
  S.Struct({
    records: S.Array(NetworkVolumeBillingRecord),
    metadata: NetworkVolumeBillingMetadata,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListNetworkVolumeBillingResponse", {
    description:
      "Generated RUNPOD schema for ListNetworkVolumeBillingResponse.",
    documentation:
      "Time-bucketed network volume billing records plus metadata for the resolved query, record count, distinct volume count, and storage totals.\n",
    identifier: "ListNetworkVolumeBillingResponse",
  }),
);

/**
 * Type for {@link ListNetworkVolumeBillingResponse}.
 *
 * **Example** (Reference the ListNetworkVolumeBillingResponse type)
 *
 * ```ts
 * import type { ListNetworkVolumeBillingResponse } from "@beep/runpod"
 *
 * type ListNetworkVolumeBillingResponseValue = ListNetworkVolumeBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListNetworkVolumeBillingResponse =
  typeof ListNetworkVolumeBillingResponse.Type;

/**
 * Generated RUNPOD schema for `NetworkVolume`.
 *
 * **Example** (Inspect the NetworkVolume schema)
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
export const NetworkVolume = S.StructWithRest(
  S.Struct({
    costCenter: S.optionalKey(ResourceCostCenter),
    tags: S.optionalKey(ResourceTags),
    id: S.String.annotateKey({
      description: "Unique network volume identifier",
    }),
    name: S.String.annotateKey({
      description: "Human-readable name (not required to be unique)",
    }),
    size: S.Int.annotateKey({ description: "Allocated storage in GB" })
      .check(
        S.isGreaterThanOrEqualTo(10).annotate({
          expected: "a value greater than or equal to 10",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(4096).annotate({
          expected: "a value less than or equal to 4096",
        }),
      ),
    dataCenter: S.String.annotateKey({
      description: "Data center location; immutable after creation",
    }),
    type: S.suspend((): S.Codec<VolumeType> => VolumeType).annotateKey({
      description:
        "Storage tier of this volume. Set at creation and immutable.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("NetworkVolume", {
    description: "Generated RUNPOD schema for NetworkVolume.",
    identifier: "NetworkVolume",
  }),
);

/**
 * Type for {@link NetworkVolume}.
 *
 * **Example** (Reference the NetworkVolume type)
 *
 * ```ts
 * import type { NetworkVolume } from "@beep/runpod"
 *
 * type NetworkVolumeValue = NetworkVolume
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkVolume = typeof NetworkVolume.Type;

/**
 * Generated RUNPOD schema for `ListNetworkVolumesResponse`.
 *
 * **Example** (Inspect the ListNetworkVolumesResponse schema)
 *
 * ```ts
 * import { ListNetworkVolumesResponse } from "@beep/runpod"
 *
 * console.log(ListNetworkVolumesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListNetworkVolumesResponse = S.StructWithRest(
  S.Struct({ networkVolumes: S.Array(NetworkVolume), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListNetworkVolumesResponse", {
    description: "Generated RUNPOD schema for ListNetworkVolumesResponse.",
    identifier: "ListNetworkVolumesResponse",
  }),
);

/**
 * Type for {@link ListNetworkVolumesResponse}.
 *
 * **Example** (Reference the ListNetworkVolumesResponse type)
 *
 * ```ts
 * import type { ListNetworkVolumesResponse } from "@beep/runpod"
 *
 * type ListNetworkVolumesResponseValue = ListNetworkVolumesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListNetworkVolumesResponse = typeof ListNetworkVolumesResponse.Type;

/**
 * Generated RUNPOD schema for `OrganizationGroupMember`.
 *
 * **Example** (Inspect the OrganizationGroupMember schema)
 *
 * ```ts
 * import { OrganizationGroupMember } from "@beep/runpod"
 *
 * console.log(OrganizationGroupMember.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationGroupMember = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "User ID." }),
    email: S.Union([S.String, S.Null]).annotateKey({
      description:
        "The member's email address. Null for an account that has none.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationGroupMember", {
    description: "Generated RUNPOD schema for OrganizationGroupMember.",
    documentation: "A member of the group. `id` is the member's user ID.",
    identifier: "OrganizationGroupMember",
  }),
);

/**
 * Type for {@link OrganizationGroupMember}.
 *
 * **Example** (Reference the OrganizationGroupMember type)
 *
 * ```ts
 * import type { OrganizationGroupMember } from "@beep/runpod"
 *
 * type OrganizationGroupMemberValue = OrganizationGroupMember
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationGroupMember = typeof OrganizationGroupMember.Type;

/**
 * Generated RUNPOD schema for `ListOrganizationGroupMembersResponse`.
 *
 * **Example** (Inspect the ListOrganizationGroupMembersResponse schema)
 *
 * ```ts
 * import { ListOrganizationGroupMembersResponse } from "@beep/runpod"
 *
 * console.log(ListOrganizationGroupMembersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListOrganizationGroupMembersResponse = S.StructWithRest(
  S.Struct({
    members: S.Array(OrganizationGroupMember),
    pagination: Pagination,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListOrganizationGroupMembersResponse", {
    description:
      "Generated RUNPOD schema for ListOrganizationGroupMembersResponse.",
    identifier: "ListOrganizationGroupMembersResponse",
  }),
);

/**
 * Type for {@link ListOrganizationGroupMembersResponse}.
 *
 * **Example** (Reference the ListOrganizationGroupMembersResponse type)
 *
 * ```ts
 * import type { ListOrganizationGroupMembersResponse } from "@beep/runpod"
 *
 * type ListOrganizationGroupMembersResponseValue = ListOrganizationGroupMembersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListOrganizationGroupMembersResponse =
  typeof ListOrganizationGroupMembersResponse.Type;

/**
 * Generated RUNPOD schema for `OrganizationGroup`.
 *
 * **Example** (Inspect the OrganizationGroup schema)
 *
 * ```ts
 * import { OrganizationGroup } from "@beep/runpod"
 *
 * console.log(OrganizationGroup.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationGroup = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Group ID." }),
    name: S.String.annotateKey({ description: "Group name." }),
    memberCount: S.Int.annotateKey({
      description: "Number of group memberships.",
    }).check(
      S.isGreaterThanOrEqualTo(0).annotate({
        expected: "a value greater than or equal to 0",
      }),
    ),
    createdAt: S.String.annotateKey({ format: "date-time" }),
    updatedAt: S.String.annotateKey({
      description: "Group update time; membership changes need not update it.",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationGroup", {
    description: "Generated RUNPOD schema for OrganizationGroup.",
    documentation: "A group in the authenticated caller's organization.",
    identifier: "OrganizationGroup",
  }),
);

/**
 * Type for {@link OrganizationGroup}.
 *
 * **Example** (Reference the OrganizationGroup type)
 *
 * ```ts
 * import type { OrganizationGroup } from "@beep/runpod"
 *
 * type OrganizationGroupValue = OrganizationGroup
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationGroup = typeof OrganizationGroup.Type;

/**
 * Generated RUNPOD schema for `ListOrganizationGroupsResponse`.
 *
 * **Example** (Inspect the ListOrganizationGroupsResponse schema)
 *
 * ```ts
 * import { ListOrganizationGroupsResponse } from "@beep/runpod"
 *
 * console.log(ListOrganizationGroupsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListOrganizationGroupsResponse = S.StructWithRest(
  S.Struct({ groups: S.Array(OrganizationGroup), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListOrganizationGroupsResponse", {
    description: "Generated RUNPOD schema for ListOrganizationGroupsResponse.",
    identifier: "ListOrganizationGroupsResponse",
  }),
);

/**
 * Type for {@link ListOrganizationGroupsResponse}.
 *
 * **Example** (Reference the ListOrganizationGroupsResponse type)
 *
 * ```ts
 * import type { ListOrganizationGroupsResponse } from "@beep/runpod"
 *
 * type ListOrganizationGroupsResponseValue = ListOrganizationGroupsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListOrganizationGroupsResponse =
  typeof ListOrganizationGroupsResponse.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleType`.
 *
 * **Example** (Inspect the OrganizationRoleType schema)
 *
 * ```ts
 * import { OrganizationRoleType } from "@beep/runpod"
 *
 * console.log(OrganizationRoleType.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleType = S.Literals(["builtin", "custom"]).pipe(
  $I.annoteSchema("OrganizationRoleType", {
    description: "Generated RUNPOD schema for OrganizationRoleType.",
    documentation:
      "Who defines the role. `builtin` roles are Runpod's: `builtin:admin`, `builtin:dev`, `builtin:billing` and `builtin:basic`. A `custom` role is one the organization defined, under its own ID.",
    identifier: "OrganizationRoleType",
  }),
);

/**
 * Type for {@link OrganizationRoleType}.
 *
 * **Example** (Reference the OrganizationRoleType type)
 *
 * ```ts
 * import type { OrganizationRoleType } from "@beep/runpod"
 *
 * type OrganizationRoleTypeValue = OrganizationRoleType
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleType = typeof OrganizationRoleType.Type;

/**
 * Generated RUNPOD schema for `OrganizationRoleRef`.
 *
 * **Example** (Inspect the OrganizationRoleRef schema)
 *
 * ```ts
 * import { OrganizationRoleRef } from "@beep/runpod"
 *
 * console.log(OrganizationRoleRef.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRoleRef = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({
      description:
        "Role ID. A built-in role's ID is `builtin:` followed by its key; a custom role carries its own ID.",
    }),
    type: OrganizationRoleType,
    name: S.String.annotateKey({
      description:
        "The role's display name: `Admin`, `Developer`, `Billing` or `Contributor` for a built-in role, or a custom role's own name. A custom role that has since been deleted reads as `Contributor` while `id` keeps its own ID.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationRoleRef", {
    description: "Generated RUNPOD schema for OrganizationRoleRef.",
    documentation: "An organization role, by ID and display name.",
    identifier: "OrganizationRoleRef",
  }),
);

/**
 * Type for {@link OrganizationRoleRef}.
 *
 * **Example** (Reference the OrganizationRoleRef type)
 *
 * ```ts
 * import type { OrganizationRoleRef } from "@beep/runpod"
 *
 * type OrganizationRoleRefValue = OrganizationRoleRef
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRoleRef = typeof OrganizationRoleRef.Type;

/**
 * Generated RUNPOD schema for `OrganizationInvite`.
 *
 * **Example** (Inspect the OrganizationInvite schema)
 *
 * ```ts
 * import { OrganizationInvite } from "@beep/runpod"
 *
 * console.log(OrganizationInvite.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationInvite = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Invite ID." }),
    email: S.String.annotateKey({
      description:
        "Email address the invitation was sent to. The invitee accepts by signing in with a verified account on this address.",
    }),
    role: OrganizationRoleRef,
    createdAt: S.String.annotateKey({
      description: "When the invite was sent.",
      format: "date-time",
    }),
    expiresAt: S.String.annotateKey({
      description: "When the invite can no longer be accepted.",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationInvite", {
    description: "Generated RUNPOD schema for OrganizationInvite.",
    documentation:
      "A pending invitation to join the caller's organization. An invite stops being listed once it is accepted, revoked or expired.",
    identifier: "OrganizationInvite",
  }),
);

/**
 * Type for {@link OrganizationInvite}.
 *
 * **Example** (Reference the OrganizationInvite type)
 *
 * ```ts
 * import type { OrganizationInvite } from "@beep/runpod"
 *
 * type OrganizationInviteValue = OrganizationInvite
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationInvite = typeof OrganizationInvite.Type;

/**
 * Generated RUNPOD schema for `ListOrganizationInvitesResponse`.
 *
 * **Example** (Inspect the ListOrganizationInvitesResponse schema)
 *
 * ```ts
 * import { ListOrganizationInvitesResponse } from "@beep/runpod"
 *
 * console.log(ListOrganizationInvitesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListOrganizationInvitesResponse = S.StructWithRest(
  S.Struct({
    invites: S.Array(OrganizationInvite).annotateKey({
      description: "Pending invites, newest first.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListOrganizationInvitesResponse", {
    description: "Generated RUNPOD schema for ListOrganizationInvitesResponse.",
    identifier: "ListOrganizationInvitesResponse",
  }),
);

/**
 * Type for {@link ListOrganizationInvitesResponse}.
 *
 * **Example** (Reference the ListOrganizationInvitesResponse type)
 *
 * ```ts
 * import type { ListOrganizationInvitesResponse } from "@beep/runpod"
 *
 * type ListOrganizationInvitesResponseValue = ListOrganizationInvitesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListOrganizationInvitesResponse =
  typeof ListOrganizationInvitesResponse.Type;

/**
 * Generated RUNPOD schema for `OrganizationRole`.
 *
 * **Example** (Inspect the OrganizationRole schema)
 *
 * ```ts
 * import { OrganizationRole } from "@beep/runpod"
 *
 * console.log(OrganizationRole.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationRole = S.Union(
  [BuiltinOrganizationRole, CustomOrganizationRole],
  { mode: "oneOf" },
).pipe(
  $I.annoteSchema("OrganizationRole", {
    description: "Generated RUNPOD schema for OrganizationRole.",
    documentation:
      "A role an organization member or invite can hold: one of Runpod's built-in roles, or a custom role the organization defined.",
    identifier: "OrganizationRole",
  }),
);

/**
 * Type for {@link OrganizationRole}.
 *
 * **Example** (Reference the OrganizationRole type)
 *
 * ```ts
 * import type { OrganizationRole } from "@beep/runpod"
 *
 * type OrganizationRoleValue = OrganizationRole
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationRole = typeof OrganizationRole.Type;

/**
 * Generated RUNPOD schema for `ListOrganizationRolesResponse`.
 *
 * **Example** (Inspect the ListOrganizationRolesResponse schema)
 *
 * ```ts
 * import { ListOrganizationRolesResponse } from "@beep/runpod"
 *
 * console.log(ListOrganizationRolesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListOrganizationRolesResponse = S.StructWithRest(
  S.Struct({
    roles: S.Array(OrganizationRole).annotateKey({
      description: "Built-in and custom roles, oldest first.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListOrganizationRolesResponse", {
    description: "Generated RUNPOD schema for ListOrganizationRolesResponse.",
    identifier: "ListOrganizationRolesResponse",
  }),
);

/**
 * Type for {@link ListOrganizationRolesResponse}.
 *
 * **Example** (Reference the ListOrganizationRolesResponse type)
 *
 * ```ts
 * import type { ListOrganizationRolesResponse } from "@beep/runpod"
 *
 * type ListOrganizationRolesResponseValue = ListOrganizationRolesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListOrganizationRolesResponse =
  typeof ListOrganizationRolesResponse.Type;

/**
 * Generated RUNPOD schema for `OrganizationGroupRef`.
 *
 * **Example** (Inspect the OrganizationGroupRef schema)
 *
 * ```ts
 * import { OrganizationGroupRef } from "@beep/runpod"
 *
 * console.log(OrganizationGroupRef.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationGroupRef = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Group ID." }),
    name: S.String.annotateKey({ description: "Group name." }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationGroupRef", {
    description: "Generated RUNPOD schema for OrganizationGroupRef.",
    documentation: "An organization group, by ID and name.",
    identifier: "OrganizationGroupRef",
  }),
);

/**
 * Type for {@link OrganizationGroupRef}.
 *
 * **Example** (Reference the OrganizationGroupRef type)
 *
 * ```ts
 * import type { OrganizationGroupRef } from "@beep/runpod"
 *
 * type OrganizationGroupRefValue = OrganizationGroupRef
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationGroupRef = typeof OrganizationGroupRef.Type;

/**
 * Generated RUNPOD schema for `OrganizationUser`.
 *
 * **Example** (Inspect the OrganizationUser schema)
 *
 * ```ts
 * import { OrganizationUser } from "@beep/runpod"
 *
 * console.log(OrganizationUser.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationUser = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "User ID." }),
    email: S.Union([S.String, S.Null]).annotateKey({
      description:
        "The member's email address. Null for an account that has none.",
    }),
    role: OrganizationRoleRef,
    groups: S.Array(OrganizationGroupRef).annotateKey({
      description: "The groups the member belongs to, by name.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationUser", {
    description: "Generated RUNPOD schema for OrganizationUser.",
    documentation:
      "A member of the caller's organization. `id` is the member's user ID.",
    identifier: "OrganizationUser",
  }),
);

/**
 * Type for {@link OrganizationUser}.
 *
 * **Example** (Reference the OrganizationUser type)
 *
 * ```ts
 * import type { OrganizationUser } from "@beep/runpod"
 *
 * type OrganizationUserValue = OrganizationUser
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationUser = typeof OrganizationUser.Type;

/**
 * Generated RUNPOD schema for `ListOrganizationUsersResponse`.
 *
 * **Example** (Inspect the ListOrganizationUsersResponse schema)
 *
 * ```ts
 * import { ListOrganizationUsersResponse } from "@beep/runpod"
 *
 * console.log(ListOrganizationUsersResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListOrganizationUsersResponse = S.StructWithRest(
  S.Struct({
    users: S.Array(OrganizationUser).annotateKey({
      description: "Every member of the organization.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListOrganizationUsersResponse", {
    description: "Generated RUNPOD schema for ListOrganizationUsersResponse.",
    identifier: "ListOrganizationUsersResponse",
  }),
);

/**
 * Type for {@link ListOrganizationUsersResponse}.
 *
 * **Example** (Reference the ListOrganizationUsersResponse type)
 *
 * ```ts
 * import type { ListOrganizationUsersResponse } from "@beep/runpod"
 *
 * type ListOrganizationUsersResponseValue = ListOrganizationUsersResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListOrganizationUsersResponse =
  typeof ListOrganizationUsersResponse.Type;

/**
 * Generated RUNPOD schema for `PodBillingRecord`.
 *
 * **Example** (Inspect the PodBillingRecord schema)
 *
 * ```ts
 * import { PodBillingRecord } from "@beep/runpod"
 *
 * console.log(PodBillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodBillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description: "Total pod cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "GPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    cpuAmount: S.Finite.annotateKey({
      description: "CPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Pod disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    podId: S.String.annotateKey({
      description:
        "The pod this record bills. When the podId filter is set every record carries that id; otherwise one record is emitted per pod per bucket.\n",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodBillingRecord", {
    description: "Generated RUNPOD schema for PodBillingRecord.",
    documentation:
      "A single time-bucketed pod billing record, covering both GPU and CPU pods. Returned by GET /v2/billing/pods.\n",
    identifier: "PodBillingRecord",
  }),
);

/**
 * Type for {@link PodBillingRecord}.
 *
 * **Example** (Reference the PodBillingRecord type)
 *
 * ```ts
 * import type { PodBillingRecord } from "@beep/runpod"
 *
 * type PodBillingRecordValue = PodBillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodBillingRecord = typeof PodBillingRecord.Type;

/**
 * Generated RUNPOD schema for `PodBillingQuery`.
 *
 * **Example** (Inspect the PodBillingQuery schema)
 *
 * ```ts
 * import { PodBillingQuery } from "@beep/runpod"
 *
 * console.log(PodBillingQuery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodBillingQuery = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    bucketSize: BillingBucketSize,
    podId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "The podId filter applied, if any.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodBillingQuery", {
    description: "Generated RUNPOD schema for PodBillingQuery.",
    documentation:
      "Resolved query window and granularity (routes without a filter).",
    identifier: "PodBillingQuery",
  }),
);

/**
 * Type for {@link PodBillingQuery}.
 *
 * **Example** (Reference the PodBillingQuery type)
 *
 * ```ts
 * import type { PodBillingQuery } from "@beep/runpod"
 *
 * type PodBillingQueryValue = PodBillingQuery
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodBillingQuery = typeof PodBillingQuery.Type;

/**
 * Generated RUNPOD schema for `PodBillingAmounts`.
 *
 * **Example** (Inspect the PodBillingAmounts schema)
 *
 * ```ts
 * import { PodBillingAmounts } from "@beep/runpod"
 *
 * console.log(PodBillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodBillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description: "Total pod cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "GPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    cpuAmount: S.Finite.annotateKey({
      description: "CPU pod compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Pod disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodBillingAmounts", {
    description: "Generated RUNPOD schema for PodBillingAmounts.",
    documentation:
      "Pod cost components covering both GPU and CPU pods. Backs a record's amounts and the metadata totals.\n",
    identifier: "PodBillingAmounts",
  }),
);

/**
 * Type for {@link PodBillingAmounts}.
 *
 * **Example** (Reference the PodBillingAmounts type)
 *
 * ```ts
 * import type { PodBillingAmounts } from "@beep/runpod"
 *
 * type PodBillingAmountsValue = PodBillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodBillingAmounts = typeof PodBillingAmounts.Type;

/**
 * Generated RUNPOD schema for `PodBillingMetadata`.
 *
 * **Example** (Inspect the PodBillingMetadata schema)
 *
 * ```ts
 * import { PodBillingMetadata } from "@beep/runpod"
 *
 * console.log(PodBillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodBillingMetadata = S.StructWithRest(
  S.Struct({
    query: PodBillingQuery,
    recordCount: S.Int.annotateKey({
      description: "Number of records returned (buckets times distinct pods).",
    }),
    uniquePodCount: S.Int.annotateKey({
      description: "Number of distinct pods the records span.",
    }),
    totals: PodBillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodBillingMetadata", {
    description: "Generated RUNPOD schema for PodBillingMetadata.",
    identifier: "PodBillingMetadata",
  }),
);

/**
 * Type for {@link PodBillingMetadata}.
 *
 * **Example** (Reference the PodBillingMetadata type)
 *
 * ```ts
 * import type { PodBillingMetadata } from "@beep/runpod"
 *
 * type PodBillingMetadataValue = PodBillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodBillingMetadata = typeof PodBillingMetadata.Type;

/**
 * Generated RUNPOD schema for `ListPodBillingResponse`.
 *
 * **Example** (Inspect the ListPodBillingResponse schema)
 *
 * ```ts
 * import { ListPodBillingResponse } from "@beep/runpod"
 *
 * console.log(ListPodBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListPodBillingResponse = S.StructWithRest(
  S.Struct({
    records: S.Array(PodBillingRecord),
    metadata: PodBillingMetadata,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListPodBillingResponse", {
    description: "Generated RUNPOD schema for ListPodBillingResponse.",
    documentation: "Billing records for pods.",
    identifier: "ListPodBillingResponse",
  }),
);

/**
 * Type for {@link ListPodBillingResponse}.
 *
 * **Example** (Reference the ListPodBillingResponse type)
 *
 * ```ts
 * import type { ListPodBillingResponse } from "@beep/runpod"
 *
 * type ListPodBillingResponseValue = ListPodBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListPodBillingResponse = typeof ListPodBillingResponse.Type;

/**
 * Generated RUNPOD schema for `PodAction`.
 *
 * **Example** (Inspect the PodAction schema)
 *
 * ```ts
 * import { PodAction } from "@beep/runpod"
 *
 * console.log(PodAction.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodAction = S.Literals([
  "start",
  "stop",
  "restart",
  "terminate",
]).pipe(
  $I.annoteSchema("PodAction", {
    description: "Generated RUNPOD schema for PodAction.",
    documentation: "State transition to trigger on a pod.",
    identifier: "PodAction",
  }),
);

/**
 * Type for {@link PodAction}.
 *
 * **Example** (Reference the PodAction type)
 *
 * ```ts
 * import type { PodAction } from "@beep/runpod"
 *
 * type PodActionValue = PodAction
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodAction = typeof PodAction.Type;

/**
 * Generated RUNPOD schema for `PodSshEndpoint`.
 *
 * **Example** (Inspect the PodSshEndpoint schema)
 *
 * ```ts
 * import { PodSshEndpoint } from "@beep/runpod"
 *
 * console.log(PodSshEndpoint.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodSshEndpoint = S.StructWithRest(
  S.Struct({
    host: S.String.annotateKey({
      description: "Hostname or IP to connect to.",
    }),
    port: S.Int.annotateKey({ description: "TCP port to connect to." }),
    username: S.String.annotateKey({
      description:
        "SSH username. For the proxy this is an opaque routing token, not a user account on the pod.",
    }),
    command: S.String.annotateKey({
      description:
        "The equivalent `ssh` invocation, ready to run. Add `-i <path>` if the matching private key is not one of your default identities, and `-o StrictHostKeyChecking=no` to skip the host-key prompt on short-lived pods.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodSshEndpoint", {
    description: "Generated RUNPOD schema for PodSshEndpoint.",
    documentation:
      "One way to reach the pod over SSH, as both its parts and a ready-to-run invocation.",
    identifier: "PodSshEndpoint",
  }),
);

/**
 * Type for {@link PodSshEndpoint}.
 *
 * **Example** (Reference the PodSshEndpoint type)
 *
 * ```ts
 * import type { PodSshEndpoint } from "@beep/runpod"
 *
 * type PodSshEndpointValue = PodSshEndpoint
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodSshEndpoint = typeof PodSshEndpoint.Type;

/**
 * Generated RUNPOD schema for `PodSsh`.
 *
 * **Example** (Inspect the PodSsh schema)
 *
 * ```ts
 * import { PodSsh } from "@beep/runpod"
 *
 * console.log(PodSsh.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodSsh = S.StructWithRest(
  S.Struct({
    proxy: S.Union([PodSshEndpoint, S.Null]).annotateKey({
      description:
        "Connection through Runpod's SSH proxy. Works without exposing a port and without a public IP, but carries an interactive shell only — SCP, SFTP, rsync, and port forwarding need `direct`. Null until the pod has a machine assignment.",
    }),
    direct: S.Union([PodSshEndpoint, S.Null]).annotateKey({
      description:
        "Connection straight to the pod's sshd over its published `22/tcp` mapping. Supports the full SSH feature set. Null unless `22/tcp` is in `ports` and the running pod has been assigned a public port for it — so it is usually absent while the pod is provisioning or stopped. It can still appear on a stopped pod, so check that `status` is `RUNNING` before connecting. Also null when listing pods with `GET /v2/pods`; fetch a single pod by ID to obtain the live mapping.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodSsh", {
    description: "Generated RUNPOD schema for PodSsh.",
    documentation:
      "How to connect to this pod over SSH. Both variants authenticate with the account's registered SSH public keys (`PUT /v2/account/ssh-keys`), which reach the pod only if it was created with `startSsh` — a pod created without it has no SSH access regardless of what this block reports.",
    identifier: "PodSsh",
  }),
);

/**
 * Type for {@link PodSsh}.
 *
 * **Example** (Reference the PodSsh type)
 *
 * ```ts
 * import type { PodSsh } from "@beep/runpod"
 *
 * type PodSshValue = PodSsh
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodSsh = typeof PodSsh.Type;

/**
 * Generated RUNPOD schema for `PodClusterRole`.
 *
 * **Example** (Inspect the PodClusterRole schema)
 *
 * ```ts
 * import { PodClusterRole } from "@beep/runpod"
 *
 * console.log(PodClusterRole.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodClusterRole = S.Literals([
  "SLURM_CONTROLLER",
  "SLURM_COMPUTE",
  "RAY_HEAD",
  "RAY_WORKER",
]).pipe(
  $I.annoteSchema("PodClusterRole", {
    description: "Generated RUNPOD schema for PodClusterRole.",
    documentation:
      "A cluster member's role. Assigned for SLURM and RAY clusters; omitted for TRAINING/APPLICATION members.",
    identifier: "PodClusterRole",
  }),
);

/**
 * Type for {@link PodClusterRole}.
 *
 * **Example** (Reference the PodClusterRole type)
 *
 * ```ts
 * import type { PodClusterRole } from "@beep/runpod"
 *
 * type PodClusterRoleValue = PodClusterRole
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodClusterRole = typeof PodClusterRole.Type;

/**
 * Generated RUNPOD schema for `PodCluster`.
 *
 * **Example** (Inspect the PodCluster schema)
 *
 * ```ts
 * import { PodCluster } from "@beep/runpod"
 *
 * console.log(PodCluster.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodCluster = S.Struct({
  id: S.String.annotateKey({
    description: "ID of the cluster this pod belongs to.",
  }),
  rank: S.Union([S.Int, S.Null]).annotateKey({
    description:
      "The pod's node rank within the cluster (NODE_RANK), or null until the index is assigned during provisioning. Rank 0 is the cluster's entry node (`Cluster.primary`); for SLURM it is the controller.",
  }),
  role: S.optionalKey(
    S.suspend((): S.Codec<PodClusterRole> => PodClusterRole).annotateKey({
      description:
        "SLURM or RAY role; omitted for TRAINING/APPLICATION clusters, which do not assign roles.",
    }),
  ),
  ip: S.optionalKey(
    S.String.annotateKey({
      description:
        "The pod's address on the cluster's private overlay network; omitted until the address is assigned.",
    }),
  ),
}).pipe(
  $I.annoteSchema("PodCluster", {
    description: "Generated RUNPOD schema for PodCluster.",
    documentation: "A pod's membership in a cluster.",
    identifier: "PodCluster",
  }),
);

/**
 * Type for {@link PodCluster}.
 *
 * **Example** (Reference the PodCluster type)
 *
 * ```ts
 * import type { PodCluster } from "@beep/runpod"
 *
 * type PodClusterValue = PodCluster
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodCluster = typeof PodCluster.Type;

/**
 * Generated RUNPOD schema for `PodGlobalNetworking`.
 *
 * **Example** (Inspect the PodGlobalNetworking schema)
 *
 * ```ts
 * import { PodGlobalNetworking } from "@beep/runpod"
 *
 * console.log(PodGlobalNetworking.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodGlobalNetworking = S.StructWithRest(
  S.Struct({
    enabled: S.Boolean.annotateKey({
      description:
        "Whether global networking is enabled, giving the pod a private IP reachable across data centers. Derived from whether the pod has an assigned global-network address.",
    }),
    ip: S.optionalKey(
      S.String.annotateKey({
        description:
          "The pod's assigned global-networking IP. Present only when enabled.",
      }),
    ),
    internalDns: S.optionalKey(
      S.String.annotateKey({
        description:
          "Internal DNS name (`<podId>.runpod.internal`), reachable from other globally-networked pods in the same account. Present only when enabled.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodGlobalNetworking", {
    description: "Generated RUNPOD schema for PodGlobalNetworking.",
    identifier: "PodGlobalNetworking",
  }),
);

/**
 * Type for {@link PodGlobalNetworking}.
 *
 * **Example** (Reference the PodGlobalNetworking type)
 *
 * ```ts
 * import type { PodGlobalNetworking } from "@beep/runpod"
 *
 * type PodGlobalNetworkingValue = PodGlobalNetworking
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodGlobalNetworking = typeof PodGlobalNetworking.Type;

/**
 * Generated RUNPOD schema for `PodGpuUtilization`.
 *
 * **Example** (Inspect the PodGpuUtilization schema)
 *
 * ```ts
 * import { PodGpuUtilization } from "@beep/runpod"
 *
 * console.log(PodGpuUtilization.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodGpuUtilization = S.StructWithRest(
  S.Struct({ util: S.optionalKey(S.Int), memoryUtil: S.optionalKey(S.Int) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodGpuUtilization", {
    description: "Generated RUNPOD schema for PodGpuUtilization.",
    documentation: "Per-GPU utilization metrics.",
    identifier: "PodGpuUtilization",
  }),
);

/**
 * Type for {@link PodGpuUtilization}.
 *
 * **Example** (Reference the PodGpuUtilization type)
 *
 * ```ts
 * import type { PodGpuUtilization } from "@beep/runpod"
 *
 * type PodGpuUtilizationValue = PodGpuUtilization
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodGpuUtilization = typeof PodGpuUtilization.Type;

/**
 * Generated RUNPOD schema for `Utilization`.
 *
 * **Example** (Inspect the Utilization schema)
 *
 * ```ts
 * import { Utilization } from "@beep/runpod"
 *
 * console.log(Utilization.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Utilization = S.StructWithRest(
  S.Struct({ util: S.optionalKey(S.Int) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Utilization", {
    description: "Generated RUNPOD schema for Utilization.",
    documentation:
      "Single-value utilization percentage (0–100). Shared by `cpu` and `memory`.",
    identifier: "Utilization",
  }),
);

/**
 * Type for {@link Utilization}.
 *
 * **Example** (Reference the Utilization type)
 *
 * ```ts
 * import type { Utilization } from "@beep/runpod"
 *
 * type UtilizationValue = Utilization
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Utilization = typeof Utilization.Type;

/**
 * Generated RUNPOD schema for `PodRuntimePort`.
 *
 * **Example** (Inspect the PodRuntimePort schema)
 *
 * ```ts
 * import { PodRuntimePort } from "@beep/runpod"
 *
 * console.log(PodRuntimePort.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodRuntimePort = S.StructWithRest(
  S.Struct({
    private: S.optionalKey(S.Int),
    public: S.optionalKey(S.Union([S.Int, S.Null])),
    type: S.optionalKey(S.String),
    ip: S.optionalKey(S.Union([S.String, S.Null])),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodRuntimePort", {
    description: "Generated RUNPOD schema for PodRuntimePort.",
    documentation: "Live port mapping for a running pod.",
    identifier: "PodRuntimePort",
  }),
);

/**
 * Type for {@link PodRuntimePort}.
 *
 * **Example** (Reference the PodRuntimePort type)
 *
 * ```ts
 * import type { PodRuntimePort } from "@beep/runpod"
 *
 * type PodRuntimePortValue = PodRuntimePort
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodRuntimePort = typeof PodRuntimePort.Type;

/**
 * Generated RUNPOD schema for `PodRuntime`.
 *
 * **Example** (Inspect the PodRuntime schema)
 *
 * ```ts
 * import { PodRuntime } from "@beep/runpod"
 *
 * console.log(PodRuntime.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodRuntime = S.StructWithRest(
  S.Struct({
    uptime: S.optionalKey(
      S.Int.annotateKey({ description: "Seconds since the container started" }),
    ),
    gpus: S.Array(PodGpuUtilization).pipe(S.optionalKey),
    cpu: S.optionalKey(Utilization),
    memory: S.optionalKey(Utilization),
    ports: S.Array(PodRuntimePort).pipe(S.optionalKey),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodRuntime", {
    description: "Generated RUNPOD schema for PodRuntime.",
    documentation: "Live utilization metrics for a running pod.",
    identifier: "PodRuntime",
  }),
);

/**
 * Type for {@link PodRuntime}.
 *
 * **Example** (Reference the PodRuntime type)
 *
 * ```ts
 * import type { PodRuntime } from "@beep/runpod"
 *
 * type PodRuntimeValue = PodRuntime
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodRuntime = typeof PodRuntime.Type;

/**
 * Generated RUNPOD schema for `Pod`.
 *
 * **Example** (Inspect the Pod schema)
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
export const Pod = S.StructWithRest(
  S.Struct({
    args: S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
    cmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    entrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    disk: S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
    env: S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
    image: S.String.annotateKey({ description: "Docker image reference" }),
    ports: S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
    registry: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
    costCenter: S.optionalKey(ResourceCostCenter),
    tags: S.optionalKey(ResourceTags),
    id: S.String,
    name: S.String,
    status: PodStatus,
    actions: S.Array(PodAction).annotateKey({
      description: "Valid state transitions for the current status.",
    }),
    mounts: Mounts,
    gpu: S.optionalKey(
      S.suspend((): S.Codec<GpuConfig> => GpuConfig).annotateKey({
        description: "Present for GPU pods; omitted from CPU pods.",
      }),
    ),
    cpu: S.optionalKey(
      S.suspend((): S.Codec<CpuConfig> => CpuConfig).annotateKey({
        description: "Present for CPU pods; omitted from GPU pods.",
      }),
    ),
    cloud: Cloud,
    dataCenterId: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Data center where the pod is running (assigned by scheduler)",
    }),
    cudaVersion: S.Union([S.String, S.Null]).annotateKey({
      description:
        "CUDA version reported by the host machine. Retained while the pod is stopped — a stopped pod keeps its machine assignment and resumes onto the same host. Null means unknown or not applicable (CPU pods, or a host that has not reported one), not that CUDA is absent.",
    }),
    ssh: S.suspend((): S.Codec<PodSsh> => PodSsh).annotateKey({
      description:
        "SSH connection details, via the Runpod proxy or directly to the pod's published `22/tcp` port.",
    }),
    cluster: S.optionalKey(
      S.suspend((): S.Codec<PodCluster> => PodCluster).annotateKey({
        description:
          "Cluster membership; omitted from a standalone pod. Member pods are managed through `/v2/clusters/{id}` — they are excluded from `GET /v2/pods` by default (pass `includeClusterPods=true` to include them) and cannot be modified or deleted via the pod endpoints.",
      }),
    ),
    template: S.Union([S.String, S.Null]).annotateKey({
      description: "ID of the template this pod was created from",
    }),
    cost: S.Finite.annotateKey({
      description:
        "The pod's hourly compute rate in USD. It's returned in every status, including `EXITED`, so it isn't what you're paying right now: a stopped pod isn't billed for compute, only for its volume disk.",
      format: "float",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    locked: S.Boolean.annotateKey({
      description: "Whether the pod is locked (prevents stopping or resetting)",
    }),
    globalNetworking: PodGlobalNetworking,
    runtime: S.Union([PodRuntime, S.Null]).annotateKey({
      description:
        "Live utilization metrics. Null when the pod is not RUNNING, and when listing pods with `GET /v2/pods`; fetch a single pod by ID to obtain metrics.",
    }),
    createdAt: S.String.annotateKey({ format: "date-time" }),
    startedAt: S.Union([S.String, S.Null]).annotateKey({ format: "date-time" }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Pod", {
    description: "Generated RUNPOD schema for Pod.",
    documentation:
      "Reusable container configuration shared across templates, pods, serverless endpoints, and clusters. Adding a field here automatically propagates to all of them.\n",
    identifier: "Pod",
  }),
);

/**
 * Type for {@link Pod}.
 *
 * **Example** (Reference the Pod type)
 *
 * ```ts
 * import type { Pod } from "@beep/runpod"
 *
 * type PodValue = Pod
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Pod = typeof Pod.Type;

/**
 * Generated RUNPOD schema for `ListPodsResponse`.
 *
 * **Example** (Inspect the ListPodsResponse schema)
 *
 * ```ts
 * import { ListPodsResponse } from "@beep/runpod"
 *
 * console.log(ListPodsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListPodsResponse = S.StructWithRest(
  S.Struct({ pods: S.Array(Pod), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListPodsResponse", {
    description: "Generated RUNPOD schema for ListPodsResponse.",
    documentation:
      "Mixin for cursor-paginated list responses. Compose it with `allOf` next to the resource's bare list schema so that a list shape shared with a non-paginated endpoint (e.g. a cluster's member pods) does not inherit a pagination block it cannot honour.\n",
    identifier: "ListPodsResponse",
  }),
);

/**
 * Type for {@link ListPodsResponse}.
 *
 * **Example** (Reference the ListPodsResponse type)
 *
 * ```ts
 * import type { ListPodsResponse } from "@beep/runpod"
 *
 * type ListPodsResponseValue = ListPodsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListPodsResponse = typeof ListPodsResponse.Type;

/**
 * Generated RUNPOD schema for `QueuedPodStatus`.
 *
 * **Example** (Inspect the QueuedPodStatus schema)
 *
 * ```ts
 * import { QueuedPodStatus } from "@beep/runpod"
 *
 * console.log(QueuedPodStatus.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueuedPodStatus = S.Literals([
  "QUEUED",
  "DEPLOYED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]).pipe(
  $I.annoteSchema("QueuedPodStatus", {
    description: "Generated RUNPOD schema for QueuedPodStatus.",
    documentation:
      "Where a queued pod is in its life.\n- `QUEUED`    — waiting for capacity (from `queue.startsAt` when set)\n- `DEPLOYED`  — capacity came and a pod was created; `podId` names it\n- `FAILED`    — capacity came but the deploy was refused for good; `failureReason` says why\n- `EXPIRED`   — `queue.expiresAt` passed without capacity\n- `CANCELLED` — cancelled with `DELETE /v2/queued-pods/{id}`\n",
    identifier: "QueuedPodStatus",
  }),
);

/**
 * Type for {@link QueuedPodStatus}.
 *
 * **Example** (Reference the QueuedPodStatus type)
 *
 * ```ts
 * import type { QueuedPodStatus } from "@beep/runpod"
 *
 * type QueuedPodStatusValue = QueuedPodStatus
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueuedPodStatus = typeof QueuedPodStatus.Type;

/**
 * Generated RUNPOD schema for `QueuedPodFailureReason`.
 *
 * **Example** (Inspect the QueuedPodFailureReason schema)
 *
 * ```ts
 * import { QueuedPodFailureReason } from "@beep/runpod"
 *
 * console.log(QueuedPodFailureReason.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueuedPodFailureReason = S.Literals([
  "INSUFFICIENT_BALANCE",
  "SPENDING_LIMIT",
  "GPU_QUOTA_EXCEEDED",
  "GPU_CONCURRENCY_EXCEEDED",
  "ORG_RESTRICTED",
  "UNKNOWN",
]).pipe(
  $I.annoteSchema("QueuedPodFailureReason", {
    description: "Generated RUNPOD schema for QueuedPodFailureReason.",
    documentation:
      "Why a `FAILED` queued pod could not deploy once capacity came.\n- `INSUFFICIENT_BALANCE`     — the account balance was too low\n- `SPENDING_LIMIT`           — the deploy would have passed the spending limit\n- `GPU_QUOTA_EXCEEDED`       — the account's quota for this GPU type was reached\n- `GPU_CONCURRENCY_EXCEEDED` — the plan's concurrent GPU cap was reached\n- `ORG_RESTRICTED`           — the account joined an organization, which cannot use queued deploys\n- `UNKNOWN`                  — anything else; contact support\n",
    identifier: "QueuedPodFailureReason",
  }),
);

/**
 * Type for {@link QueuedPodFailureReason}.
 *
 * **Example** (Reference the QueuedPodFailureReason type)
 *
 * ```ts
 * import type { QueuedPodFailureReason } from "@beep/runpod"
 *
 * type QueuedPodFailureReasonValue = QueuedPodFailureReason
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueuedPodFailureReason = typeof QueuedPodFailureReason.Type;

/**
 * Generated RUNPOD schema for `QueuedPodSchedule`.
 *
 * **Example** (Inspect the QueuedPodSchedule schema)
 *
 * ```ts
 * import { QueuedPodSchedule } from "@beep/runpod"
 *
 * console.log(QueuedPodSchedule.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueuedPodSchedule = S.StructWithRest(
  S.Struct({
    startsAt: S.Union([S.String, S.Null]).annotateKey({
      description: "When waiting begins. Null when it began with the request.",
      format: "date-time",
    }),
    expiresAt: S.String.annotateKey({
      description: "When waiting ends.",
      format: "date-time",
    }),
    allowedHours: S.Union([PodQueueAllowedHours, S.Null]).annotateKey({
      description: "Null when any hour is allowed.",
    }),
    notifyEmail: S.Union([S.String, S.Null]).annotateKey({
      description: "Null when no email was asked for.",
      format: "email",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("QueuedPodSchedule", {
    description: "Generated RUNPOD schema for QueuedPodSchedule.",
    documentation: "The `queue` options as stored, with the defaults applied.",
    identifier: "QueuedPodSchedule",
  }),
);

/**
 * Type for {@link QueuedPodSchedule}.
 *
 * **Example** (Reference the QueuedPodSchedule type)
 *
 * ```ts
 * import type { QueuedPodSchedule } from "@beep/runpod"
 *
 * type QueuedPodScheduleValue = QueuedPodSchedule
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueuedPodSchedule = typeof QueuedPodSchedule.Type;

/**
 * Generated RUNPOD schema for `QueuedPod`.
 *
 * **Example** (Inspect the QueuedPod schema)
 *
 * ```ts
 * import { QueuedPod } from "@beep/runpod"
 *
 * console.log(QueuedPod.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueuedPod = S.StructWithRest(
  S.Struct({
    id: S.String,
    status: QueuedPodStatus,
    podId: S.Union([S.String, S.Null]).annotateKey({
      description:
        "The pod created once capacity came; null until then. Read it with `GET /v2/pods/{id}`.",
    }),
    failureReason: S.Union([QueuedPodFailureReason, S.Null]).annotateKey({
      description: "Set only when `status` is `FAILED`.",
    }),
    name: S.String.annotateKey({ description: "The name the pod will carry." }),
    image: S.Union([S.String, S.Null]).annotateKey({
      description:
        "The image the pod will run. Null when it comes from `templateId` at deploy time.",
    }),
    templateId: S.Union([S.String, S.Null]).annotateKey({
      description:
        "The template the scheduler resolves at deploy time. Null for queued\npods from this API, which expands `templateId` into `image` when\nthe request is made.\n",
    }),
    gpu: BaseGpuConfig,
    cloud: Cloud,
    dataCenterIds: S.Array(S.String).annotateKey({
      description:
        "The data centers the deploy is limited to; empty when any will do.",
    }),
    queue: QueuedPodSchedule,
    createdAt: S.String.annotateKey({ format: "date-time" }),
    resolvedAt: S.Union([S.String, S.Null]).annotateKey({
      description:
        "When the queued pod deployed, failed or expired. Null while it waits, and after a cancel.",
      format: "date-time",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("QueuedPod", {
    description: "Generated RUNPOD schema for QueuedPod.",
    documentation:
      "A pod waiting for capacity, or the record of one that waited. It\ncarries what identifies and schedules the request; the full container\nsettings are not echoed back, keep your create request.\n",
    identifier: "QueuedPod",
  }),
);

/**
 * Type for {@link QueuedPod}.
 *
 * **Example** (Reference the QueuedPod type)
 *
 * ```ts
 * import type { QueuedPod } from "@beep/runpod"
 *
 * type QueuedPodValue = QueuedPod
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueuedPod = typeof QueuedPod.Type;

/**
 * Generated RUNPOD schema for `ListQueuedPodsResponse`.
 *
 * **Example** (Inspect the ListQueuedPodsResponse schema)
 *
 * ```ts
 * import { ListQueuedPodsResponse } from "@beep/runpod"
 *
 * console.log(ListQueuedPodsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListQueuedPodsResponse = S.StructWithRest(
  S.Struct({ queuedPods: S.Array(QueuedPod), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListQueuedPodsResponse", {
    description: "Generated RUNPOD schema for ListQueuedPodsResponse.",
    documentation:
      "Mixin for cursor-paginated list responses. Compose it with `allOf` next to the resource's bare list schema so that a list shape shared with a non-paginated endpoint (e.g. a cluster's member pods) does not inherit a pagination block it cannot honour.\n",
    identifier: "ListQueuedPodsResponse",
  }),
);

/**
 * Type for {@link ListQueuedPodsResponse}.
 *
 * **Example** (Reference the ListQueuedPodsResponse type)
 *
 * ```ts
 * import type { ListQueuedPodsResponse } from "@beep/runpod"
 *
 * type ListQueuedPodsResponseValue = ListQueuedPodsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListQueuedPodsResponse = typeof ListQueuedPodsResponse.Type;

/**
 * Generated RUNPOD schema for `Registry`.
 *
 * **Example** (Inspect the Registry schema)
 *
 * ```ts
 * import { Registry } from "@beep/runpod"
 *
 * console.log(Registry.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Registry = S.StructWithRest(
  S.Struct({ id: S.String, name: S.String }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Registry", {
    description: "Generated RUNPOD schema for Registry.",
    identifier: "Registry",
  }),
);

/**
 * Type for {@link Registry}.
 *
 * **Example** (Reference the Registry type)
 *
 * ```ts
 * import type { Registry } from "@beep/runpod"
 *
 * type RegistryValue = Registry
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Registry = typeof Registry.Type;

/**
 * Generated RUNPOD schema for `ListRegistriesResponse`.
 *
 * **Example** (Inspect the ListRegistriesResponse schema)
 *
 * ```ts
 * import { ListRegistriesResponse } from "@beep/runpod"
 *
 * console.log(ListRegistriesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListRegistriesResponse = S.StructWithRest(
  S.Struct({ registries: S.Array(Registry) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListRegistriesResponse", {
    description: "Generated RUNPOD schema for ListRegistriesResponse.",
    identifier: "ListRegistriesResponse",
  }),
);

/**
 * Type for {@link ListRegistriesResponse}.
 *
 * **Example** (Reference the ListRegistriesResponse type)
 *
 * ```ts
 * import type { ListRegistriesResponse } from "@beep/runpod"
 *
 * type ListRegistriesResponseValue = ListRegistriesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListRegistriesResponse = typeof ListRegistriesResponse.Type;

/**
 * Generated RUNPOD schema for `Secret`.
 *
 * **Example** (Inspect the Secret schema)
 *
 * ```ts
 * import { Secret } from "@beep/runpod"
 *
 * console.log(Secret.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Secret = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Unique secret identifier" }),
    name: S.String.annotateKey({
      description:
        "Unique, human-readable name — the `<name>` referenced by the `RUNPOD_SECRET_<name>` placeholder. Immutable after creation.",
    }),
    description: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "Human-readable description",
      }),
    ),
    createdAt: S.String.annotateKey({
      description: "When the secret was created",
      format: "date-time",
    }),
    valueLastUpdatedAt: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description:
          "When the secret's value was last set (creation or rotation)",
        format: "date-time",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Secret", {
    description: "Generated RUNPOD schema for Secret.",
    documentation:
      "An account-scoped secret: an encrypted string stored by Runpod, referenced from pod, serverless, and template environment variables with the `{{ RUNPOD_SECRET_<name> }}` placeholder, substituted with the secret's value when the pod or worker boots. The value is write-only and never returned by the API.",
    identifier: "Secret",
  }),
);

/**
 * Type for {@link Secret}.
 *
 * **Example** (Reference the Secret type)
 *
 * ```ts
 * import type { Secret } from "@beep/runpod"
 *
 * type SecretValue = Secret
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Secret = typeof Secret.Type;

/**
 * Generated RUNPOD schema for `ListSecretsResponse`.
 *
 * **Example** (Inspect the ListSecretsResponse schema)
 *
 * ```ts
 * import { ListSecretsResponse } from "@beep/runpod"
 *
 * console.log(ListSecretsResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListSecretsResponse = S.StructWithRest(
  S.Struct({ secrets: S.Array(Secret) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListSecretsResponse", {
    description: "Generated RUNPOD schema for ListSecretsResponse.",
    identifier: "ListSecretsResponse",
  }),
);

/**
 * Type for {@link ListSecretsResponse}.
 *
 * **Example** (Reference the ListSecretsResponse type)
 *
 * ```ts
 * import type { ListSecretsResponse } from "@beep/runpod"
 *
 * type ListSecretsResponseValue = ListSecretsResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListSecretsResponse = typeof ListSecretsResponse.Type;

/**
 * Generated RUNPOD schema for `ServerlessBillingRecord`.
 *
 * **Example** (Inspect the ServerlessBillingRecord schema)
 *
 * ```ts
 * import { ServerlessBillingRecord } from "@beep/runpod"
 *
 * console.log(ServerlessBillingRecord.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerlessBillingRecord = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    totalAmount: S.Finite.annotateKey({
      description: "Total serverless cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "Serverless GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    cpuAmount: S.Finite.annotateKey({
      description: "Serverless CPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Serverless disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    feeAmount: S.Finite.annotateKey({
      description:
        "Unused and always 0. Platform charges are included in the GPU and CPU amounts.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    serverlessId: S.String.annotateKey({
      description:
        "The serverless endpoint this record bills. When the serverlessId filter is set every record carries that id; otherwise one record is emitted per serverless endpoint per bucket.\n",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ServerlessBillingRecord", {
    description: "Generated RUNPOD schema for ServerlessBillingRecord.",
    documentation:
      "A single time-bucketed serverless billing record. Returned by GET /v2/billing/serverless.\n",
    identifier: "ServerlessBillingRecord",
  }),
);

/**
 * Type for {@link ServerlessBillingRecord}.
 *
 * **Example** (Reference the ServerlessBillingRecord type)
 *
 * ```ts
 * import type { ServerlessBillingRecord } from "@beep/runpod"
 *
 * type ServerlessBillingRecordValue = ServerlessBillingRecord
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ServerlessBillingRecord = typeof ServerlessBillingRecord.Type;

/**
 * Generated RUNPOD schema for `ServerlessBillingQuery`.
 *
 * **Example** (Inspect the ServerlessBillingQuery schema)
 *
 * ```ts
 * import { ServerlessBillingQuery } from "@beep/runpod"
 *
 * console.log(ServerlessBillingQuery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerlessBillingQuery = S.StructWithRest(
  S.Struct({
    startTime: S.String.annotateKey({
      description: "Start of the range, inclusive (RFC 3339).",
      format: "date-time",
    }),
    endTime: S.String.annotateKey({
      description: "End of the range, exclusive (RFC 3339).",
      format: "date-time",
    }),
    bucketSize: BillingBucketSize,
    serverlessId: S.optionalKey(
      S.Union([S.String, S.Null]).annotateKey({
        description: "The serverlessId filter applied, if any.",
      }),
    ),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ServerlessBillingQuery", {
    description: "Generated RUNPOD schema for ServerlessBillingQuery.",
    documentation:
      "Resolved query window and granularity (routes without a filter).",
    identifier: "ServerlessBillingQuery",
  }),
);

/**
 * Type for {@link ServerlessBillingQuery}.
 *
 * **Example** (Reference the ServerlessBillingQuery type)
 *
 * ```ts
 * import type { ServerlessBillingQuery } from "@beep/runpod"
 *
 * type ServerlessBillingQueryValue = ServerlessBillingQuery
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ServerlessBillingQuery = typeof ServerlessBillingQuery.Type;

/**
 * Generated RUNPOD schema for `ServerlessBillingAmounts`.
 *
 * **Example** (Inspect the ServerlessBillingAmounts schema)
 *
 * ```ts
 * import { ServerlessBillingAmounts } from "@beep/runpod"
 *
 * console.log(ServerlessBillingAmounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerlessBillingAmounts = S.StructWithRest(
  S.Struct({
    totalAmount: S.Finite.annotateKey({
      description: "Total serverless cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    gpuAmount: S.Finite.annotateKey({
      description: "Serverless GPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    cpuAmount: S.Finite.annotateKey({
      description: "Serverless CPU compute cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    diskAmount: S.Finite.annotateKey({
      description: "Serverless disk cost in USD for the bucket.",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
    feeAmount: S.Finite.annotateKey({
      description:
        "Unused and always 0. Platform charges are included in the GPU and CPU amounts.\n",
      format: "double",
    }).check(S.isFinite().annotate({ expected: "a finite number" })),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ServerlessBillingAmounts", {
    description: "Generated RUNPOD schema for ServerlessBillingAmounts.",
    documentation:
      "Serverless cost components, inclusive of platform charges. Backs a record's amounts and the metadata totals.\n",
    identifier: "ServerlessBillingAmounts",
  }),
);

/**
 * Type for {@link ServerlessBillingAmounts}.
 *
 * **Example** (Reference the ServerlessBillingAmounts type)
 *
 * ```ts
 * import type { ServerlessBillingAmounts } from "@beep/runpod"
 *
 * type ServerlessBillingAmountsValue = ServerlessBillingAmounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ServerlessBillingAmounts = typeof ServerlessBillingAmounts.Type;

/**
 * Generated RUNPOD schema for `ServerlessBillingMetadata`.
 *
 * **Example** (Inspect the ServerlessBillingMetadata schema)
 *
 * ```ts
 * import { ServerlessBillingMetadata } from "@beep/runpod"
 *
 * console.log(ServerlessBillingMetadata.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerlessBillingMetadata = S.StructWithRest(
  S.Struct({
    query: ServerlessBillingQuery,
    recordCount: S.Int.annotateKey({
      description:
        "Number of records returned (buckets times distinct endpoints).",
    }),
    uniqueServerlessCount: S.Int.annotateKey({
      description: "Number of distinct serverless endpoints the records span.",
    }),
    totals: ServerlessBillingAmounts,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ServerlessBillingMetadata", {
    description: "Generated RUNPOD schema for ServerlessBillingMetadata.",
    identifier: "ServerlessBillingMetadata",
  }),
);

/**
 * Type for {@link ServerlessBillingMetadata}.
 *
 * **Example** (Reference the ServerlessBillingMetadata type)
 *
 * ```ts
 * import type { ServerlessBillingMetadata } from "@beep/runpod"
 *
 * type ServerlessBillingMetadataValue = ServerlessBillingMetadata
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ServerlessBillingMetadata = typeof ServerlessBillingMetadata.Type;

/**
 * Generated RUNPOD schema for `ListServerlessBillingResponse`.
 *
 * **Example** (Inspect the ListServerlessBillingResponse schema)
 *
 * ```ts
 * import { ListServerlessBillingResponse } from "@beep/runpod"
 *
 * console.log(ListServerlessBillingResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListServerlessBillingResponse = S.StructWithRest(
  S.Struct({
    records: S.Array(ServerlessBillingRecord),
    metadata: ServerlessBillingMetadata,
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListServerlessBillingResponse", {
    description: "Generated RUNPOD schema for ListServerlessBillingResponse.",
    documentation: "Billing records for serverless.",
    identifier: "ListServerlessBillingResponse",
  }),
);

/**
 * Type for {@link ListServerlessBillingResponse}.
 *
 * **Example** (Reference the ListServerlessBillingResponse type)
 *
 * ```ts
 * import type { ListServerlessBillingResponse } from "@beep/runpod"
 *
 * type ListServerlessBillingResponseValue = ListServerlessBillingResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListServerlessBillingResponse =
  typeof ListServerlessBillingResponse.Type;

/**
 * Generated RUNPOD schema for `Template`.
 *
 * **Example** (Inspect the Template schema)
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
export const Template = S.StructWithRest(
  S.Struct({
    args: S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
    cmd: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    entrypoint: S.optionalKey(
      S.Array(S.String).annotateKey({
        description:
          "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
      }),
    ),
    disk: S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
    env: S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
    image: S.String.annotateKey({ description: "Docker image reference" }),
    ports: S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
    registry: S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
    id: S.String,
    name: S.String,
    mounts: TemplateMounts,
    serverless: S.Boolean.annotateKey({
      description:
        "Whether this template is for serverless workers (true) or pods (false)",
    }),
    public: S.Boolean.annotateKey({
      description: "Whether this template is visible to other Runpod users",
    }),
    category: TemplateCategory,
    startSsh: S.Boolean.annotateKey({
      description:
        "Whether containers created from this template get SSH access provisioned at startup (`PUBLIC_KEY` env injection).",
    }),
    startJupyter: S.Boolean.annotateKey({
      description:
        "Whether containers created from this template start JupyterLab at startup (`JUPYTER_PASSWORD` env injection).",
    }),
    allowedCudaVersions: S.Array(S.String).annotateKey({
      description:
        "Acceptable CUDA versions for containers created from this template, as `major.minor`. Empty means any version. Expanded into GPU pod and serverless endpoint creates; CPU pods ignore it.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Template", {
    description: "Generated RUNPOD schema for Template.",
    documentation:
      "Reusable container configuration shared across templates, pods, serverless endpoints, and clusters. Adding a field here automatically propagates to all of them.\n",
    identifier: "Template",
  }),
);

/**
 * Type for {@link Template}.
 *
 * **Example** (Reference the Template type)
 *
 * ```ts
 * import type { Template } from "@beep/runpod"
 *
 * type TemplateValue = Template
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Template = typeof Template.Type;

/**
 * Generated RUNPOD schema for `ListTemplatesResponse`.
 *
 * **Example** (Inspect the ListTemplatesResponse schema)
 *
 * ```ts
 * import { ListTemplatesResponse } from "@beep/runpod"
 *
 * console.log(ListTemplatesResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ListTemplatesResponse = S.StructWithRest(
  S.Struct({ templates: S.Array(Template), pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("ListTemplatesResponse", {
    description: "Generated RUNPOD schema for ListTemplatesResponse.",
    documentation:
      "Mixin for cursor-paginated list responses. Compose it with `allOf` next to the resource's bare list schema so that a list shape shared with a non-paginated endpoint (e.g. a cluster's member pods) does not inherit a pagination block it cannot honour.\n",
    identifier: "ListTemplatesResponse",
  }),
);

/**
 * Type for {@link ListTemplatesResponse}.
 *
 * **Example** (Reference the ListTemplatesResponse type)
 *
 * ```ts
 * import type { ListTemplatesResponse } from "@beep/runpod"
 *
 * type ListTemplatesResponseValue = ListTemplatesResponse
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ListTemplatesResponse = typeof ListTemplatesResponse.Type;

/**
 * Generated RUNPOD schema for `LogSource`.
 *
 * **Example** (Inspect the LogSource schema)
 *
 * ```ts
 * import { LogSource } from "@beep/runpod"
 *
 * console.log(LogSource.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LogSource = S.Literals(["container", "system"]).pipe(
  $I.annoteSchema("LogSource", {
    description: "Generated RUNPOD schema for LogSource.",
    documentation:
      "Log source to include in a log stream.\n- `container` — container stdout/stderr log stream\n- `system`    — host lifecycle/userlogs stream\n",
    identifier: "LogSource",
  }),
);

/**
 * Type for {@link LogSource}.
 *
 * **Example** (Reference the LogSource type)
 *
 * ```ts
 * import type { LogSource } from "@beep/runpod"
 *
 * type LogSourceValue = LogSource
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LogSource = typeof LogSource.Type;

/**
 * Generated RUNPOD schema for `NetworkMountPatch`.
 *
 * **Example** (Inspect the NetworkMountPatch schema)
 *
 * ```ts
 * import { NetworkMountPatch } from "@beep/runpod"
 *
 * console.log(NetworkMountPatch.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NetworkMountPatch = S.Struct({
  volumeId: S.String.annotateKey({
    description:
      "ID of an existing NetworkVolume in the same data center as the pod.",
  }),
  path: S.optionalKey(
    S.String.annotateKey({
      description:
        "Mount path inside the container. Required when mounting; optional when moving a mounted volume.",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  remove: S.optionalKey(
    S.Boolean.annotateKey({
      description: "Unmount the volume. Cannot be combined with `path`.",
    }),
  ),
}).pipe(
  $I.annoteSchema("NetworkMountPatch", {
    description: "Generated RUNPOD schema for NetworkMountPatch.",
    documentation:
      "Mounts, moves, or unmounts one network volume. Mounting a volume the\npod does not have requires `path`.\n",
    identifier: "NetworkMountPatch",
  }),
);

/**
 * Type for {@link NetworkMountPatch}.
 *
 * **Example** (Reference the NetworkMountPatch type)
 *
 * ```ts
 * import type { NetworkMountPatch } from "@beep/runpod"
 *
 * type NetworkMountPatchValue = NetworkMountPatch
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NetworkMountPatch = typeof NetworkMountPatch.Type;

/**
 * Generated RUNPOD schema for `Organization`.
 *
 * **Example** (Inspect the Organization schema)
 *
 * ```ts
 * import { Organization } from "@beep/runpod"
 *
 * console.log(Organization.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Organization = S.StructWithRest(
  S.Struct({
    id: S.String.annotateKey({ description: "Organization ID." }),
    name: S.String.annotateKey({ description: "Organization name." }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Organization", {
    description: "Generated RUNPOD schema for Organization.",
    documentation: "The authenticated caller's current organization.",
    identifier: "Organization",
  }),
);

/**
 * Type for {@link Organization}.
 *
 * **Example** (Reference the Organization type)
 *
 * ```ts
 * import type { Organization } from "@beep/runpod"
 *
 * type OrganizationValue = Organization
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Organization = typeof Organization.Type;

/**
 * Generated RUNPOD schema for `OrganizationCapabilityFamily`.
 *
 * **Example** (Inspect the OrganizationCapabilityFamily schema)
 *
 * ```ts
 * import { OrganizationCapabilityFamily } from "@beep/runpod"
 *
 * console.log(OrganizationCapabilityFamily.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationCapabilityFamily = S.StructWithRest(
  S.Struct({
    family: S.String.annotateKey({
      description:
        "What the capability applies to. A capability is written `FAMILY:VERB`, e.g. `POD:VIEW`.",
    }),
    verbs: S.Array(S.String).annotateKey({
      description:
        "The verbs a custom role can grant on this family, in catalog order.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationCapabilityFamily", {
    description: "Generated RUNPOD schema for OrganizationCapabilityFamily.",
    identifier: "OrganizationCapabilityFamily",
  }),
);

/**
 * Type for {@link OrganizationCapabilityFamily}.
 *
 * **Example** (Reference the OrganizationCapabilityFamily type)
 *
 * ```ts
 * import type { OrganizationCapabilityFamily } from "@beep/runpod"
 *
 * type OrganizationCapabilityFamilyValue = OrganizationCapabilityFamily
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationCapabilityFamily =
  typeof OrganizationCapabilityFamily.Type;

/**
 * Generated RUNPOD schema for `OrganizationCapabilityCatalog`.
 *
 * **Example** (Inspect the OrganizationCapabilityCatalog schema)
 *
 * ```ts
 * import { OrganizationCapabilityCatalog } from "@beep/runpod"
 *
 * console.log(OrganizationCapabilityCatalog.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationCapabilityCatalog = S.StructWithRest(
  S.Struct({
    version: S.Int.annotateKey({
      description: "Major version of the capability catalog.",
    }),
    families: S.Array(OrganizationCapabilityFamily).annotateKey({
      description: "Capability families, in catalog order.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("OrganizationCapabilityCatalog", {
    description: "Generated RUNPOD schema for OrganizationCapabilityCatalog.",
    documentation: "The capabilities a custom role can grant.",
    identifier: "OrganizationCapabilityCatalog",
  }),
);

/**
 * Type for {@link OrganizationCapabilityCatalog}.
 *
 * **Example** (Reference the OrganizationCapabilityCatalog type)
 *
 * ```ts
 * import type { OrganizationCapabilityCatalog } from "@beep/runpod"
 *
 * type OrganizationCapabilityCatalogValue = OrganizationCapabilityCatalog
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationCapabilityCatalog =
  typeof OrganizationCapabilityCatalog.Type;

/**
 * Generated RUNPOD schema for `OrganizationGroupInput`.
 *
 * **Example** (Inspect the OrganizationGroupInput schema)
 *
 * ```ts
 * import { OrganizationGroupInput } from "@beep/runpod"
 *
 * console.log(OrganizationGroupInput.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OrganizationGroupInput = S.Struct({
  id: S.String.annotateKey({ description: "Group ID." }).check(
    S.isMinLength(1).annotate({
      expected: "a value with a length of at least 1",
    }),
  ),
}).pipe(
  $I.annoteSchema("OrganizationGroupInput", {
    description: "Generated RUNPOD schema for OrganizationGroupInput.",
    documentation: "An organization group, by ID.",
    identifier: "OrganizationGroupInput",
  }),
);

/**
 * Type for {@link OrganizationGroupInput}.
 *
 * **Example** (Reference the OrganizationGroupInput type)
 *
 * ```ts
 * import type { OrganizationGroupInput } from "@beep/runpod"
 *
 * type OrganizationGroupInputValue = OrganizationGroupInput
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationGroupInput = typeof OrganizationGroupInput.Type;

/**
 * Generated RUNPOD schema for `Paginated`.
 *
 * **Example** (Inspect the Paginated schema)
 *
 * ```ts
 * import { Paginated } from "@beep/runpod"
 *
 * console.log(Paginated.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Paginated = S.StructWithRest(
  S.Struct({ pagination: Pagination }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("Paginated", {
    description: "Generated RUNPOD schema for Paginated.",
    documentation:
      "Mixin for cursor-paginated list responses. Compose it with `allOf` next to the resource's bare list schema so that a list shape shared with a non-paginated endpoint (e.g. a cluster's member pods) does not inherit a pagination block it cannot honour.\n",
    identifier: "Paginated",
  }),
);

/**
 * Type for {@link Paginated}.
 *
 * **Example** (Reference the Paginated type)
 *
 * ```ts
 * import type { Paginated } from "@beep/runpod"
 *
 * type PaginatedValue = Paginated
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Paginated = typeof Paginated.Type;

/**
 * Generated RUNPOD schema for `PersistentMountPatch`.
 *
 * **Example** (Inspect the PersistentMountPatch schema)
 *
 * ```ts
 * import { PersistentMountPatch } from "@beep/runpod"
 *
 * console.log(PersistentMountPatch.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PersistentMountPatch = S.Struct({
  size: S.optionalKey(
    S.Int.annotateKey({
      description:
        "Volume disk size in GB. Can only grow; a smaller size than the current one is rejected with 400.",
    }).check(
      S.isGreaterThanOrEqualTo(10).annotate({
        expected: "a value greater than or equal to 10",
      }),
    ),
  ),
  path: S.optionalKey(
    S.String.annotateKey({
      description: "Mount path inside the container.",
    }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  remove: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Removes the volume disk. Not supported yet: `remove: true` is\nrejected with 400.\n",
    }),
  ),
}).pipe(
  $I.annoteSchema("PersistentMountPatch", {
    description: "Generated RUNPOD schema for PersistentMountPatch.",
    documentation:
      "Adds the pod's volume disk, grows it, or moves it. Adding a disk\nrequires `size`; on a pod that already has one, omitted fields are\nleft as they are. Not available on CPU pods.\n",
    identifier: "PersistentMountPatch",
  }),
);

/**
 * Type for {@link PersistentMountPatch}.
 *
 * **Example** (Reference the PersistentMountPatch type)
 *
 * ```ts
 * import type { PersistentMountPatch } from "@beep/runpod"
 *
 * type PersistentMountPatchValue = PersistentMountPatch
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PersistentMountPatch = typeof PersistentMountPatch.Type;

/**
 * Generated RUNPOD schema for `PodActionRequest`.
 *
 * **Example** (Inspect the PodActionRequest schema)
 *
 * ```ts
 * import { PodActionRequest } from "@beep/runpod"
 *
 * console.log(PodActionRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodActionRequest = S.Struct({ action: PodAction }).pipe(
  $I.annoteSchema("PodActionRequest", {
    description: "Generated RUNPOD schema for PodActionRequest.",
    identifier: "PodActionRequest",
  }),
);

/**
 * Type for {@link PodActionRequest}.
 *
 * **Example** (Reference the PodActionRequest type)
 *
 * ```ts
 * import type { PodActionRequest } from "@beep/runpod"
 *
 * type PodActionRequestValue = PodActionRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodActionRequest = typeof PodActionRequest.Type;

/**
 * Generated RUNPOD schema for `PodExecRequest`.
 *
 * **Example** (Inspect the PodExecRequest schema)
 *
 * ```ts
 * import { PodExecRequest } from "@beep/runpod"
 *
 * console.log(PodExecRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodExecRequest = S.Struct({
  command: S.TupleWithRest(
    S.Tuple([
      S.String.check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      )
        .check(
          S.isMaxCodePoints(4096).annotate({
            expected: "a string with at most 4096 code points",
          }),
        )
        .check(
          S.isPattern(
            new globalThis.RegExp(
              "^[^\\x00]*[^\\t-\\r    - \\u2028\\u2029  　\\x00][^\\x00]*$",
              "u",
            ),
          ).annotate({
            expected:
              "a string matching the RegExp ^[^\\x00]*[^\\t-\\r    - \\u2028\\u2029  　\\x00][^\\x00]*$",
          }),
        ),
    ]),
    [
      S.String.check(
        S.isMaxCodePoints(4096).annotate({
          expected: "a string with at most 4096 code points",
        }),
      ).check(
        S.isPattern(new globalThis.RegExp("^[^\\x00]*$", "u")).annotate({
          expected: "a string matching the RegExp ^[^\\x00]*$",
        }),
      ),
    ],
  )
    .annotateKey({
      description:
        'Command to run, as an argv array of 1-256 arguments of at most 4096\ncharacters each. It is run directly, never through a shell; for\npipes, redirects or globbing pass `["sh", "-c", "..."]`. The first\nelement, the program, must contain a non-whitespace character;\nlater arguments may be empty. No argument may contain a NUL\ncharacter.\n',
    })
    .check(
      S.isMaxLength(256).annotate({
        expected: "a value with a length of at most 256",
      }),
    ),
  timeoutSeconds: S.optionalKey(
    S.Int.annotateKey({
      description:
        "How long the call waits for the command to finish, in seconds. A\ncommand still running at this point returns with `timedOut: true`.\n",
      default: 20,
    })
      .check(
        S.isGreaterThanOrEqualTo(1).annotate({
          expected: "a value greater than or equal to 1",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(25).annotate({
          expected: "a value less than or equal to 25",
        }),
      ),
  ),
  cwd: S.optionalKey(
    S.String.annotateKey({
      description:
        "Absolute working directory for the command, at most 1024 characters\nand without control characters. Defaults to the image's `WORKDIR`.\n",
    })
      .check(
        S.isMaxCodePoints(1024).annotate({
          expected: "a string with at most 1024 code points",
        }),
      )
      .check(
        S.isPattern(
          new globalThis.RegExp("^\\/[^\\x00-\\x1f\\x7f]*$", "u"),
        ).annotate({
          expected: "a string matching the RegExp ^\\/[^\\x00-\\x1f\\x7f]*$",
        }),
      ),
  ),
  env: S.optionalKey(
    S.Record(
      S.String,
      S.String.check(
        S.isMaxCodePoints(16384).annotate({
          expected: "a string with at most 16384 code points",
        }),
      ).check(
        S.isPattern(new globalThis.RegExp("^[^\\x00]*$", "u")).annotate({
          expected: "a string matching the RegExp ^[^\\x00]*$",
        }),
      ),
    )
      .annotateKey({
        description:
          "Up to 64 environment variables added to the container's environment\nfor this command only. A name is 1-256 characters and must not\ncontain `=` or a NUL character; a value is at most 16384 characters\nand must not contain a NUL character.\n",
      })
      .check(
        S.isMaxProperties(64).annotate({
          expected: "a value with at most 64 entries",
        }),
      )
      .check(
        S.isPropertyNames(
          S.String.check(
            S.isMinLength(1).annotate({
              expected: "a value with a length of at least 1",
            }),
          )
            .check(
              S.isMaxCodePoints(256).annotate({
                expected: "a string with at most 256 code points",
              }),
            )
            .check(
              S.isPattern(new globalThis.RegExp("^[^=\\x00]+$", "u")).annotate({
                expected: "a string matching the RegExp ^[^=\\x00]+$",
              }),
            ),
        ).annotate({
          expected: "an object with property names matching the schema",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("PodExecRequest", {
    description: "Generated RUNPOD schema for PodExecRequest.",
    identifier: "PodExecRequest",
  }),
);

/**
 * Type for {@link PodExecRequest}.
 *
 * **Example** (Reference the PodExecRequest type)
 *
 * ```ts
 * import type { PodExecRequest } from "@beep/runpod"
 *
 * type PodExecRequestValue = PodExecRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodExecRequest = typeof PodExecRequest.Type;

/**
 * Generated RUNPOD schema for `PodExecResult`.
 *
 * **Example** (Inspect the PodExecResult schema)
 *
 * ```ts
 * import { PodExecResult } from "@beep/runpod"
 *
 * console.log(PodExecResult.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodExecResult = S.StructWithRest(
  S.Struct({
    stdout: S.String.annotateKey({
      description:
        "The command's standard output, as UTF-8 with invalid bytes\nreplaced. Capped at 1 MiB; see `truncated`.\n",
    }),
    stderr: S.String.annotateKey({
      description:
        "The command's standard error, as UTF-8 with invalid bytes\nreplaced. Capped at 1 MiB; see `truncated`.\n",
    }),
    exitCode: S.Union([S.Int, S.Null]).annotateKey({
      description:
        "The command's exit code. A non-zero code is a result, not an error.\nNull only when `timedOut` is `true`.\n",
    }),
    timedOut: S.Boolean.annotateKey({
      description:
        "The call stopped waiting at `timeoutSeconds`. It does not mean the\ncommand was stopped: it may still be running inside the container.\n",
    }),
    truncated: S.Boolean.annotateKey({
      description: "`stdout` or `stderr` reached the 1 MiB cap and was cut.",
    }),
    durationMs: S.Int.annotateKey({
      description:
        "Wall time of the command as measured on the pod's machine, in milliseconds.",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("PodExecResult", {
    description: "Generated RUNPOD schema for PodExecResult.",
    identifier: "PodExecResult",
  }),
);

/**
 * Type for {@link PodExecResult}.
 *
 * **Example** (Reference the PodExecResult type)
 *
 * ```ts
 * import type { PodExecResult } from "@beep/runpod"
 *
 * type PodExecResultValue = PodExecResult
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodExecResult = typeof PodExecResult.Type;

/**
 * Generated RUNPOD schema for `PodList`.
 *
 * **Example** (Inspect the PodList schema)
 *
 * ```ts
 * import { PodList } from "@beep/runpod"
 *
 * console.log(PodList.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PodList = S.StructWithRest(S.Struct({ pods: S.Array(Pod) }), [
  S.Record(S.String, S.Json.annotate({ expected: "JSON value" })),
]).pipe(
  $I.annoteSchema("PodList", {
    description: "Generated RUNPOD schema for PodList.",
    documentation:
      "A bare list of pods. `GET /v2/clusters/{id}/pods` returns it as-is (a cluster's members are a small, complete set); `GET /v2/pods` composes it with the pagination block via ListPodsResponse.\n",
    identifier: "PodList",
  }),
);

/**
 * Type for {@link PodList}.
 *
 * **Example** (Reference the PodList type)
 *
 * ```ts
 * import type { PodList } from "@beep/runpod"
 *
 * type PodListValue = PodList
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PodList = typeof PodList.Type;

/**
 * Generated RUNPOD schema for `Product`.
 *
 * **Example** (Inspect the Product schema)
 *
 * ```ts
 * import { Product } from "@beep/runpod"
 *
 * console.log(Product.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Product = S.Literals(["POD", "CLUSTER", "SERVERLESS"]).pipe(
  $I.annoteSchema("Product", {
    description: "Generated RUNPOD schema for Product.",
    documentation:
      "Catalog product availability context. Availability is product-specific, so this is required whenever availability is requested.",
    identifier: "Product",
  }),
);

/**
 * Type for {@link Product}.
 *
 * **Example** (Reference the Product type)
 *
 * ```ts
 * import type { Product } from "@beep/runpod"
 *
 * type ProductValue = Product
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Product = typeof Product.Type;

/**
 * Generated RUNPOD schema for `QueuedPodList`.
 *
 * **Example** (Inspect the QueuedPodList schema)
 *
 * ```ts
 * import { QueuedPodList } from "@beep/runpod"
 *
 * console.log(QueuedPodList.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueuedPodList = S.StructWithRest(
  S.Struct({ queuedPods: S.Array(QueuedPod) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("QueuedPodList", {
    description: "Generated RUNPOD schema for QueuedPodList.",
    identifier: "QueuedPodList",
  }),
);

/**
 * Type for {@link QueuedPodList}.
 *
 * **Example** (Reference the QueuedPodList type)
 *
 * ```ts
 * import type { QueuedPodList } from "@beep/runpod"
 *
 * type QueuedPodListValue = QueuedPodList
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QueuedPodList = typeof QueuedPodList.Type;

/**
 * Generated RUNPOD schema for `RateLimitHeader`.
 *
 * **Example** (Inspect the RateLimitHeader schema)
 *
 * ```ts
 * import { RateLimitHeader } from "@beep/runpod"
 *
 * console.log(RateLimitHeader.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RateLimitHeader = S.String.pipe(
  $I.annoteSchema("RateLimitHeader", {
    description: "Generated RUNPOD schema for RateLimitHeader.",
    documentation:
      "Live per-window quota state. Optional — omitted for rate-limit-exempt\ncallers.\n\nA structured-field list with one member per window (`minute`, `hour`,\n`day`), each carrying the remaining request count `r` and seconds until\nthe window resets `t` (at least 1). Windows are fixed and aligned to the\nclock, not sliding. Returned on responses to authenticated requests,\nnot only on 429s.\n",
    identifier: "RateLimitHeader",
  }),
);

/**
 * Type for {@link RateLimitHeader}.
 *
 * **Example** (Reference the RateLimitHeader type)
 *
 * ```ts
 * import type { RateLimitHeader } from "@beep/runpod"
 *
 * type RateLimitHeaderValue = RateLimitHeader
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RateLimitHeader = typeof RateLimitHeader.Type;

/**
 * Generated RUNPOD schema for `RateLimitPolicyHeader`.
 *
 * **Example** (Inspect the RateLimitPolicyHeader schema)
 *
 * ```ts
 * import { RateLimitPolicyHeader } from "@beep/runpod"
 *
 * console.log(RateLimitPolicyHeader.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RateLimitPolicyHeader = S.String.pipe(
  $I.annoteSchema("RateLimitPolicyHeader", {
    description: "Generated RUNPOD schema for RateLimitPolicyHeader.",
    documentation:
      "Static per-window quota policy. Optional — omitted for rate-limit-exempt\ncallers.\n\nA structured-field list with one member per window (`minute`, `hour`,\n`day`), each carrying the quota `q` and the window length in seconds `w`.\nReturned on responses to authenticated requests, not only on 429s.\n\nLimits are per user, and every `/v2` route counts toward the same\nlimits; creating pods has no separate limit. Read the current quotas from\nthis header instead of hard-coding them, because they can change and some\naccounts have higher limits. A 429 only slows you down: wait for the\n`Retry-After` time and retry. Your account isn't suspended.\n",
    identifier: "RateLimitPolicyHeader",
  }),
);

/**
 * Type for {@link RateLimitPolicyHeader}.
 *
 * **Example** (Reference the RateLimitPolicyHeader type)
 *
 * ```ts
 * import type { RateLimitPolicyHeader } from "@beep/runpod"
 *
 * type RateLimitPolicyHeaderValue = RateLimitPolicyHeader
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RateLimitPolicyHeader = typeof RateLimitPolicyHeader.Type;

/**
 * Generated RUNPOD schema for `ResendAuthenticationAttemptRequest`.
 *
 * **Example** (Inspect the ResendAuthenticationAttemptRequest schema)
 *
 * ```ts
 * import { ResendAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * console.log(ResendAuthenticationAttemptRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResendAuthenticationAttemptRequest = S.Struct({
  codeVerifier: CodeVerifier,
}).pipe(
  $I.annoteSchema("ResendAuthenticationAttemptRequest", {
    description:
      "Generated RUNPOD schema for ResendAuthenticationAttemptRequest.",
    identifier: "ResendAuthenticationAttemptRequest",
  }),
);

/**
 * Type for {@link ResendAuthenticationAttemptRequest}.
 *
 * **Example** (Reference the ResendAuthenticationAttemptRequest type)
 *
 * ```ts
 * import type { ResendAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * type ResendAuthenticationAttemptRequestValue = ResendAuthenticationAttemptRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResendAuthenticationAttemptRequest =
  typeof ResendAuthenticationAttemptRequest.Type;

/**
 * Generated RUNPOD schema for `TagFilterKey`.
 *
 * **Example** (Inspect the TagFilterKey schema)
 *
 * ```ts
 * import { TagFilterKey } from "@beep/runpod"
 *
 * console.log(TagFilterKey.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TagFilterKey = S.String.check(
  S.isMinLength(1).annotate({
    expected: "a value with a length of at least 1",
  }),
)
  .check(
    S.isMaxCodePoints(191).annotate({
      expected: "a string with at most 191 code points",
    }),
  )
  .check(
    S.isPattern(
      new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　�]", "u"),
    ).annotate({
      expected:
        "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　�]",
      identifier: "TagFilterKey",
    }),
  )
  .pipe(
    $I.annoteSchema("TagFilterKey", {
      description: "Generated RUNPOD schema for TagFilterKey.",
      documentation:
        "Tag key, 1–191 characters as sent, with at least one that is not whitespace. Leading and trailing whitespace is ignored. Keys under the reserved `runpod:` prefix, in any letter case, are rejected.",
    }),
  );

/**
 * Type for {@link TagFilterKey}.
 *
 * **Example** (Reference the TagFilterKey type)
 *
 * ```ts
 * import type { TagFilterKey } from "@beep/runpod"
 *
 * type TagFilterKeyValue = TagFilterKey
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TagFilterKey = typeof TagFilterKey.Type;

/**
 * Generated RUNPOD schema for `TagCondition`.
 *
 * **Example** (Inspect the TagCondition schema)
 *
 * ```ts
 * import { TagCondition } from "@beep/runpod"
 *
 * console.log(TagCondition.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TagCondition = S.Struct({
  key: TagFilterKey,
  values: S.optionalKey(
    S.Array(
      S.String.check(
        S.isMaxCodePoints(191).annotate({
          expected: "a string with at most 191 code points",
        }),
      ),
    )
      .annotateKey({
        description:
          'Matches a tag under `key` with any one of these values, compared exactly. Omitted or empty, the condition only requires the key to be present. `""` matches a tag whose value is empty. At most 100.',
      })
      .check(
        S.isMaxLength(100).annotate({
          expected: "a value with a length of at most 100",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("TagCondition", {
    description: "Generated RUNPOD schema for TagCondition.",
    identifier: "TagCondition",
  }),
);

/**
 * Type for {@link TagCondition}.
 *
 * **Example** (Reference the TagCondition type)
 *
 * ```ts
 * import type { TagCondition } from "@beep/runpod"
 *
 * type TagConditionValue = TagCondition
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TagCondition = typeof TagCondition.Type;

/**
 * Generated RUNPOD schema for `ResourceFilters`.
 *
 * **Example** (Inspect the ResourceFilters schema)
 *
 * ```ts
 * import { ResourceFilters } from "@beep/runpod"
 *
 * console.log(ResourceFilters.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ResourceFilters = S.Struct({
  tags: S.optionalKey(
    S.Array(TagCondition)
      .annotateKey({
        description:
          "Conditions on the resource's tags. A resource must match every condition; repeating a key adds a condition rather than widening the first one. At most 25, the most tags one resource can carry.",
      })
      .check(
        S.isMaxLength(25).annotate({
          expected: "a value with a length of at most 25",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("ResourceFilters", {
    description: "Generated RUNPOD schema for ResourceFilters.",
    documentation:
      "An empty object, or an empty `tags` array, filters nothing.",
    identifier: "ResourceFilters",
  }),
);

/**
 * Type for {@link ResourceFilters}.
 *
 * **Example** (Reference the ResourceFilters type)
 *
 * ```ts
 * import type { ResourceFilters } from "@beep/runpod"
 *
 * type ResourceFiltersValue = ResourceFilters
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ResourceFilters = typeof ResourceFilters.Type;

/**
 * Generated RUNPOD schema for `SshKeys`.
 *
 * **Example** (Inspect the SshKeys schema)
 *
 * ```ts
 * import { SshKeys } from "@beep/runpod"
 *
 * console.log(SshKeys.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SshKeys = S.StructWithRest(
  S.Struct({
    keys: S.Array(S.String).annotateKey({
      description:
        "The account's registered SSH public keys, one authorized_keys-style entry per element (`<type> <base64-key> [comment]`).",
    }),
  }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("SshKeys", {
    description: "Generated RUNPOD schema for SshKeys.",
    identifier: "SshKeys",
  }),
);

/**
 * Type for {@link SshKeys}.
 *
 * **Example** (Reference the SshKeys type)
 *
 * ```ts
 * import type { SshKeys } from "@beep/runpod"
 *
 * type SshKeysValue = SshKeys
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SshKeys = typeof SshKeys.Type;

/**
 * Generated RUNPOD schema for `TemplateList`.
 *
 * **Example** (Inspect the TemplateList schema)
 *
 * ```ts
 * import { TemplateList } from "@beep/runpod"
 *
 * console.log(TemplateList.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TemplateList = S.StructWithRest(
  S.Struct({ templates: S.Array(Template) }),
  [S.Record(S.String, S.Json.annotate({ expected: "JSON value" }))],
).pipe(
  $I.annoteSchema("TemplateList", {
    description: "Generated RUNPOD schema for TemplateList.",
    documentation:
      "A bare list of templates. `GET /v2/catalog/templates` returns it as-is (the catalog is a capped, curated set); `GET /v2/templates` composes it with the pagination block via ListTemplatesResponse.\n",
    identifier: "TemplateList",
  }),
);

/**
 * Type for {@link TemplateList}.
 *
 * **Example** (Reference the TemplateList type)
 *
 * ```ts
 * import type { TemplateList } from "@beep/runpod"
 *
 * type TemplateListValue = TemplateList
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TemplateList = typeof TemplateList.Type;

/**
 * Generated RUNPOD schema for `UpdateClusterRequest`.
 *
 * **Example** (Inspect the UpdateClusterRequest schema)
 *
 * ```ts
 * import { UpdateClusterRequest } from "@beep/runpod"
 *
 * console.log(UpdateClusterRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateClusterRequest = S.Struct({
  name: S.optionalKey(
    S.String.check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateClusterRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateClusterRequest", {
      description: "Generated RUNPOD schema for UpdateClusterRequest.",
      documentation:
        "Request body for updating a cluster. Only the cluster name can be\nchanged — this endpoint is a rename. Compute shape, type, and container\nconfiguration are fixed at creation.\n",
    }),
  );

/**
 * Type for {@link UpdateClusterRequest}.
 *
 * **Example** (Reference the UpdateClusterRequest type)
 *
 * ```ts
 * import type { UpdateClusterRequest } from "@beep/runpod"
 *
 * type UpdateClusterRequestValue = UpdateClusterRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateClusterRequest = typeof UpdateClusterRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateCostCenterRequest`.
 *
 * **Example** (Inspect the UpdateCostCenterRequest schema)
 *
 * ```ts
 * import { UpdateCostCenterRequest } from "@beep/runpod"
 *
 * console.log(UpdateCostCenterRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateCostCenterRequest = S.Struct({
  value: S.String.annotateKey({
    description: "Leading and trailing whitespace is trimmed.",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(50).annotate({
        expected: "a string with at most 50 code points",
      }),
    )
    .check(
      S.isPattern(new globalThis.RegExp("^\\s*\\S", "u")).annotate({
        expected: "a string matching the RegExp ^\\s*\\S",
      }),
    ),
}).pipe(
  $I.annoteSchema("UpdateCostCenterRequest", {
    description: "Generated RUNPOD schema for UpdateCostCenterRequest.",
    identifier: "UpdateCostCenterRequest",
  }),
);

/**
 * Type for {@link UpdateCostCenterRequest}.
 *
 * **Example** (Reference the UpdateCostCenterRequest type)
 *
 * ```ts
 * import type { UpdateCostCenterRequest } from "@beep/runpod"
 *
 * type UpdateCostCenterRequestValue = UpdateCostCenterRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateCostCenterRequest = typeof UpdateCostCenterRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateEndpointGpuConfig`.
 *
 * **Example** (Inspect the UpdateEndpointGpuConfig schema)
 *
 * ```ts
 * import { UpdateEndpointGpuConfig } from "@beep/runpod"
 *
 * console.log(UpdateEndpointGpuConfig.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateEndpointGpuConfig = S.Struct({
  pools: S.optionalKey(
    S.Array(S.String)
      .annotateKey({
        description:
          'Serverless GPU pool IDs (as returned by `GET /v2/catalog/gpus` in\n`pool`). Workers are placed on whichever listed pool has capacity.\nNarrow a pool down to specific cards with `excludedTypes`.\n\nOn `PATCH`, `pools` and `excludedTypes` are one selection and are\nreplaced together, so sending `pools` by itself **clears the\nexclusions**. Two cases:\n\n- **Changing pools, keeping exclusions** — send both fields in one\n  request: `{"gpu": {"pools": ["ADA_24"], "excludedTypes":\n  ["NVIDIA L40"]}}`. `GET` the endpoint first to read the current\n  `excludedTypes` and resend the ones that still apply to the new\n  pools; an exclusion naming a type outside `pools` is a 400.\n- **Changing only `count` or a CUDA constraint** — omit `pools`:\n  `{"gpu": {"minCudaVersion": "12.4"}}`. The pool list and the\n  exclusions are both left exactly as they are.\n\n`excludedTypes` documents the full rule.\n',
      })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      ),
  ),
  excludedTypes: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\s*[^-\\s]", "u")).annotate({
          expected: "a string matching the RegExp ^\\s*[^-\\s]",
        }),
      ),
    )
      .annotateKey({
        description:
          'GPU **type** IDs to subtract from the selected pools — the `id`\nfield of `GET /v2/catalog/gpus`, the same identifiers pods take in\n`gpu.id`. Workers run on every type in `pools` except these. Omit to\nuse the whole pool.\n\nPools stay the unit of selection; types are the unit of\nsubtraction. There is no inclusive allowlist: a card later added to\none of your pools becomes eligible, which is the honest reading of\n"this pool, minus these".\n\nTied to `pools`, because the two together are one selection:\nsupplying `pools` replaces that selection wholesale, so a `PATCH`\nsending `pools` **without `excludedTypes`** **clears** them —\nrestate them to keep them. A `PATCH` that omits `pools` leaves both\nthe pools and the exclusions untouched, so changing only a CUDA\nconstraint cannot widen a pinned endpoint.\n\nRejected with 400 if a value is not a GPU type in one of `pools`,\nso a typo cannot produce a filter that does nothing. Surrounding whitespace\nis trimmed, so `" NVIDIA L40"` and `"NVIDIA L40"` mean the same card.\n',
      })
      .check(S.isUnique().annotate({ expected: "an array with unique items" })),
  ),
  count: S.optionalKey(
    S.Int.annotateKey({ description: "GPUs per worker", default: 1 }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  allowedCudaVersions: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
          expected: "a string matching the RegExp ^\\d+\\.\\d+$",
        }),
      ),
    ).annotateKey({
      description:
        "Acceptable CUDA versions for worker placement, as\n`major.minor`. An explicit `[]` clears the constraint;\nomitting the field leaves it unchanged. Takes effect as\nworkers are replaced.\n\nA non-empty set is mutually exclusive with minCudaVersion (400\nif both are sent). An explicit `[]` states no constraint, so it\nmay accompany a floor.\nSetting one does not clear the other — clear it explicitly in\nthe same patch if the endpoint already carries it.\n",
    }),
  ),
  minCudaVersion: S.optionalKey(
    S.String.annotateKey({
      description:
        'Lowest acceptable CUDA version for worker placement, as\n`major.minor`. An explicit `""` clears the floor; omitting the\nfield leaves it unchanged. Takes effect as workers are\nreplaced.\n\nMutually exclusive with a non-empty allowedCudaVersions (400 if\nboth are sent); an explicit `[]` there states no constraint and\nmay accompany this floor.\n',
    }).check(
      S.isPattern(new globalThis.RegExp("^$|^\\d+\\.\\d+$", "u")).annotate({
        expected: "a string matching the RegExp ^$|^\\d+\\.\\d+$",
      }),
    ),
  ),
}).pipe(
  $I.annoteSchema("UpdateEndpointGpuConfig", {
    description: "Generated RUNPOD schema for UpdateEndpointGpuConfig.",
    documentation:
      "Partial GPU update — every field is optional and an omitted one is left\nunchanged. Unlike create, `pools` is optional, so changing only a CUDA\nconstraint does not require resending the pool list.\n\n`excludedTypes` requires `pools`, because the two are one selection and\nonly a supplied `pools` replaces it — an exclusion on its own would\notherwise be silently dropped.\n",
    identifier: "UpdateEndpointGpuConfig",
  }),
);

/**
 * Type for {@link UpdateEndpointGpuConfig}.
 *
 * **Example** (Reference the UpdateEndpointGpuConfig type)
 *
 * ```ts
 * import type { UpdateEndpointGpuConfig } from "@beep/runpod"
 *
 * type UpdateEndpointGpuConfigValue = UpdateEndpointGpuConfig
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateEndpointGpuConfig = typeof UpdateEndpointGpuConfig.Type;

/**
 * Generated RUNPOD schema for `UpdateEndpointRequest`.
 *
 * **Example** (Inspect the UpdateEndpointRequest schema)
 *
 * ```ts
 * import { UpdateEndpointRequest } from "@beep/runpod"
 *
 * console.log(UpdateEndpointRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateEndpointRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  cpu: S.optionalKey(
    S.Array(CreateCpuConfig)
      .annotateKey({
        description:
          "Complete replacement CPU selection. Valid only for an existing CPU\nendpoint; endpoint compute family cannot be changed.\n",
      })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      )
      .check(S.isUnique().annotate({ expected: "an array with unique items" })),
  ),
  dataCenterIds: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Preferred data centers for placement. Omit or pass an empty array to let the scheduler choose.",
    }),
  ),
  flashboot: S.optionalKey(FlashBoot),
  gpu: S.optionalKey(UpdateEndpointGpuConfig),
  name: S.optionalKey(
    S.String.check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  networkVolumes: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Network volume IDs. Pass `[]` to detach.",
    }),
  ),
  mounts: S.optionalKey(EndpointMountsInput),
  scaling: S.optionalKey(EndpointScaling),
  templateId: S.optionalKey(
    S.String.annotateKey({
      description:
        "ID of a serverless template whose container settings are\napplied as if they were provided in this PATCH body (image,\nargs, disk, ports, env, registry). Explicit body fields\noverride the template's; `env` merges template and body per\nkey (body wins) and, per PATCH semantics, replaces the\nendpoint's env. One-time application — no link to the\ntemplate is retained. Must be one of your templates or a\npublic template (unknown or inaccessible ID → 404); must be\na serverless template (→ 422).\n",
    }),
  ),
  timeout: S.optionalKey(S.Int),
  workers: S.optionalKey(EndpointWorkers),
}).pipe(
  $I.annoteSchema("UpdateEndpointRequest", {
    description: "Generated RUNPOD schema for UpdateEndpointRequest.",
    identifier: "UpdateEndpointRequest",
  }),
);

/**
 * Type for {@link UpdateEndpointRequest}.
 *
 * **Example** (Reference the UpdateEndpointRequest type)
 *
 * ```ts
 * import type { UpdateEndpointRequest } from "@beep/runpod"
 *
 * type UpdateEndpointRequestValue = UpdateEndpointRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateEndpointRequest = typeof UpdateEndpointRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateGlobalVolumeRequest`.
 *
 * **Example** (Inspect the UpdateGlobalVolumeRequest schema)
 *
 * ```ts
 * import { UpdateGlobalVolumeRequest } from "@beep/runpod"
 *
 * console.log(UpdateGlobalVolumeRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateGlobalVolumeRequest = S.Struct({
  name: S.optionalKey(
    S.String.annotateKey({
      description:
        "New human-readable name, 1–191 characters with at least one non-whitespace character. Leading and trailing whitespace is trimmed.\n",
    })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      )
      .check(
        S.isMaxCodePoints(191).annotate({
          expected: "a string with at most 191 code points",
        }),
      )
      .check(
        S.isPattern(
          new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　]", "u"),
        ).annotate({
          expected:
            "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　]",
        }),
      ),
  ),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateGlobalVolumeRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateGlobalVolumeRequest", {
      description: "Generated RUNPOD schema for UpdateGlobalVolumeRequest.",
      documentation:
        "Only the provided fields are updated. At least one field must be\npresent; an empty body is rejected.\n",
    }),
  );

/**
 * Type for {@link UpdateGlobalVolumeRequest}.
 *
 * **Example** (Reference the UpdateGlobalVolumeRequest type)
 *
 * ```ts
 * import type { UpdateGlobalVolumeRequest } from "@beep/runpod"
 *
 * type UpdateGlobalVolumeRequestValue = UpdateGlobalVolumeRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateGlobalVolumeRequest = typeof UpdateGlobalVolumeRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateNetworkVolumeRequest`.
 *
 * **Example** (Inspect the UpdateNetworkVolumeRequest schema)
 *
 * ```ts
 * import { UpdateNetworkVolumeRequest } from "@beep/runpod"
 *
 * console.log(UpdateNetworkVolumeRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateNetworkVolumeRequest = S.Struct({
  name: S.optionalKey(
    S.String.annotateKey({ description: "New human-readable name" }).check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  size: S.optionalKey(
    S.Int.annotateKey({
      description:
        "New size in GB. Must be greater than or equal to the current size —\nnetwork volume storage cannot be reduced.\n",
    })
      .check(
        S.isGreaterThanOrEqualTo(10).annotate({
          expected: "a value greater than or equal to 10",
        }),
      )
      .check(
        S.isLessThanOrEqualTo(4096).annotate({
          expected: "a value less than or equal to 4096",
        }),
      ),
  ),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateNetworkVolumeRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateNetworkVolumeRequest", {
      description: "Generated RUNPOD schema for UpdateNetworkVolumeRequest.",
      documentation:
        "Only the provided fields are updated. At least one field must be\npresent; an empty body is rejected.\n",
    }),
  );

/**
 * Type for {@link UpdateNetworkVolumeRequest}.
 *
 * **Example** (Reference the UpdateNetworkVolumeRequest type)
 *
 * ```ts
 * import type { UpdateNetworkVolumeRequest } from "@beep/runpod"
 *
 * type UpdateNetworkVolumeRequestValue = UpdateNetworkVolumeRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateNetworkVolumeRequest = typeof UpdateNetworkVolumeRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateOrganizationGroupRequest`.
 *
 * **Example** (Inspect the UpdateOrganizationGroupRequest schema)
 *
 * ```ts
 * import { UpdateOrganizationGroupRequest } from "@beep/runpod"
 *
 * console.log(UpdateOrganizationGroupRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateOrganizationGroupRequest = S.Struct({
  name: S.String.annotateKey({
    description:
      "Group name with at least one non-whitespace character; surrounding whitespace is trimmed.",
  })
    .check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    )
    .check(
      S.isMaxCodePoints(191).annotate({
        expected: "a string with at most 191 code points",
      }),
    )
    .check(
      S.isPattern(
        new globalThis.RegExp("[^\\t-\\r    - \\u2028\\u2029  　]", "u"),
      ).annotate({
        expected:
          "a string matching the RegExp [^\\t-\\r    - \\u2028\\u2029  　]",
      }),
    ),
}).pipe(
  $I.annoteSchema("UpdateOrganizationGroupRequest", {
    description: "Generated RUNPOD schema for UpdateOrganizationGroupRequest.",
    identifier: "UpdateOrganizationGroupRequest",
  }),
);

/**
 * Type for {@link UpdateOrganizationGroupRequest}.
 *
 * **Example** (Reference the UpdateOrganizationGroupRequest type)
 *
 * ```ts
 * import type { UpdateOrganizationGroupRequest } from "@beep/runpod"
 *
 * type UpdateOrganizationGroupRequestValue = UpdateOrganizationGroupRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateOrganizationGroupRequest =
  typeof UpdateOrganizationGroupRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateOrganizationRoleRequest`.
 *
 * **Example** (Inspect the UpdateOrganizationRoleRequest schema)
 *
 * ```ts
 * import { UpdateOrganizationRoleRequest } from "@beep/runpod"
 *
 * console.log(UpdateOrganizationRoleRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateOrganizationRoleRequest = S.Struct({
  name: S.optionalKey(OrganizationRoleName),
  capabilities: S.optionalKey(OrganizationRoleCapabilitiesInput),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateOrganizationRoleRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateOrganizationRoleRequest", {
      description: "Generated RUNPOD schema for UpdateOrganizationRoleRequest.",
      documentation:
        "The fields to change; omitted fields are unchanged. `capabilities` replaces the role's whole grant set rather than adding to it.",
    }),
  );

/**
 * Type for {@link UpdateOrganizationRoleRequest}.
 *
 * **Example** (Reference the UpdateOrganizationRoleRequest type)
 *
 * ```ts
 * import type { UpdateOrganizationRoleRequest } from "@beep/runpod"
 *
 * type UpdateOrganizationRoleRequestValue = UpdateOrganizationRoleRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateOrganizationRoleRequest =
  typeof UpdateOrganizationRoleRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateOrganizationUserRequest`.
 *
 * **Example** (Inspect the UpdateOrganizationUserRequest schema)
 *
 * ```ts
 * import { UpdateOrganizationUserRequest } from "@beep/runpod"
 *
 * console.log(UpdateOrganizationUserRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateOrganizationUserRequest = S.Struct({
  role: S.optionalKey(OrganizationRoleInput),
  groups: S.optionalKey(
    S.Array(OrganizationGroupInput)
      .annotateKey({
        description:
          "The member's groups after the change: the whole set, by ID. An empty list removes the member from every group.",
      })
      .check(S.isUnique().annotate({ expected: "an array with unique items" })),
  ),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateOrganizationUserRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateOrganizationUserRequest", {
      description: "Generated RUNPOD schema for UpdateOrganizationUserRequest.",
      documentation:
        "Changes to a member. Send `role`, `groups`, or both; an omitted field is left as it is.",
    }),
  );

/**
 * Type for {@link UpdateOrganizationUserRequest}.
 *
 * **Example** (Reference the UpdateOrganizationUserRequest type)
 *
 * ```ts
 * import type { UpdateOrganizationUserRequest } from "@beep/runpod"
 *
 * type UpdateOrganizationUserRequestValue = UpdateOrganizationUserRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateOrganizationUserRequest =
  typeof UpdateOrganizationUserRequest.Type;

/**
 * Generated RUNPOD schema for `UpdatePodMounts`.
 *
 * **Example** (Inspect the UpdatePodMounts schema)
 *
 * ```ts
 * import { UpdatePodMounts } from "@beep/runpod"
 *
 * console.log(UpdatePodMounts.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdatePodMounts = S.Struct({
  persistent: S.optionalKey(PersistentMountPatch),
  network: S.optionalKey(
    S.Array(NetworkMountPatch)
      .annotateKey({
        description:
          "Network volumes to mount, move, or unmount. Up to 8 entries, so\na request can unmount 4 volumes and mount 4 others; the pod can\nstill hold at most 4 afterwards.\n",
      })
      .check(
        S.isMaxLength(8).annotate({
          expected: "a value with a length of at most 8",
        }),
      ),
  ),
  global: S.optionalKey(
    S.Array(GlobalMountPatch)
      .annotateKey({
        description:
          "Global volumes to mount, move, or unmount. Up to 2 entries, so a\nrequest can swap the global volume; the pod can still hold at\nmost 1 afterwards.\n",
      })
      .check(
        S.isMaxLength(2).annotate({
          expected: "a value with a length of at most 2",
        }),
      ),
  ),
}).pipe(
  $I.annoteSchema("UpdatePodMounts", {
    description: "Generated RUNPOD schema for UpdatePodMounts.",
    documentation:
      "Changes to a pod's mounts. Each entry names one volume by `volumeId`\nand changes only that volume; volumes that are not listed, and kinds\nthat are omitted, are left as they are. Omitting `mounts` or sending\n`{}` changes nothing.\n\n- A listed volume the pod does not have is mounted at `path`.\n- A listed volume the pod already has moves to `path` (or stays\n  put when `path` is omitted).\n- `remove: true` unmounts the volume. It cannot be combined with\n  `path`, and the volume must be mounted on the pod.\n- To swap a volume, remove the old one and add the new one in the\n  same request.\n\nLimits are checked against the pod as it would be after the request\nand rejected with 400: at most 4 network volumes and 1 global\nvolume, and a volume disk cannot share a pod with network or global\nvolumes. A volume disk can be added to a pod that has no volumes\nmounted (or unmounts them all in the same request), and it can only\ngrow. Removing a volume disk is not supported yet.\n",
    identifier: "UpdatePodMounts",
  }),
);

/**
 * Type for {@link UpdatePodMounts}.
 *
 * **Example** (Reference the UpdatePodMounts type)
 *
 * ```ts
 * import type { UpdatePodMounts } from "@beep/runpod"
 *
 * type UpdatePodMountsValue = UpdatePodMounts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdatePodMounts = typeof UpdatePodMounts.Type;

/**
 * Generated RUNPOD schema for `UpdatePodRequest`.
 *
 * **Example** (Inspect the UpdatePodRequest schema)
 *
 * ```ts
 * import { UpdatePodRequest } from "@beep/runpod"
 *
 * console.log(UpdatePodRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdatePodRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  globalNetworking: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Enable (true) or disable (false) global networking. Takes effect on the next pod start/restart, not live. Requires an NVIDIA GPU and a global-networking-enabled data center. See `GET /v2/catalog/datacenters` (`globalNetwork`) for eligible data centers.",
    }),
  ),
  locked: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Lock the pod (true) or unlock it (false). Locked pods cannot be stopped or reset.",
    }),
  ),
  mounts: S.optionalKey(UpdatePodMounts),
  name: S.optionalKey(
    S.String.check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  templateId: S.optionalKey(
    S.String.annotateKey({
      description:
        "ID of a pod template whose container settings are applied as\nif they were provided in this PATCH body (image, args, disk,\nports, env, registry — mounts are not applied on update).\nExplicit body fields override the template's; `env` merges\ntemplate and body per key (body wins) and, per PATCH\nsemantics, replaces the pod's env. One-time application —\nno link to the template is retained. Must be one of your\ntemplates or a public template (unknown or inaccessible ID\n→ 404); must not be a serverless template (→ 422).\n",
    }),
  ),
}).pipe(
  $I.annoteSchema("UpdatePodRequest", {
    description: "Generated RUNPOD schema for UpdatePodRequest.",
    identifier: "UpdatePodRequest",
  }),
);

/**
 * Type for {@link UpdatePodRequest}.
 *
 * **Example** (Reference the UpdatePodRequest type)
 *
 * ```ts
 * import type { UpdatePodRequest } from "@beep/runpod"
 *
 * type UpdatePodRequestValue = UpdatePodRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdatePodRequest = typeof UpdatePodRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateSecretRequest`.
 *
 * **Example** (Inspect the UpdateSecretRequest schema)
 *
 * ```ts
 * import { UpdateSecretRequest } from "@beep/runpod"
 *
 * console.log(UpdateSecretRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateSecretRequest = S.Struct({
  value: S.optionalKey(
    S.String.annotateKey({
      description:
        "New secret value, replacing the current one. Write-only. Must be smaller than 16 MiB of UTF-8 text (strictly under 16,777,216 bytes).",
    })
      .check(
        S.isMinLength(1).annotate({
          expected: "a value with a length of at least 1",
        }),
      )
      .check(
        S.isMaxCodePoints(16777216).annotate({
          expected: "a string with at most 16777216 code points",
        }),
      ),
  ),
  description: S.optionalKey(
    S.String.annotateKey({
      description:
        'New human-readable description, at most 65,535 bytes of UTF-8 text. Send `""` to clear.',
    }).check(
      S.isMaxCodePoints(65535).annotate({
        expected: "a string with at most 65535 code points",
      }),
    ),
  ),
})
  .check(
    S.isMinProperties(1).annotate({
      expected: "a value with at least 1 entry",
      identifier: "UpdateSecretRequest",
    }),
  )
  .pipe(
    $I.annoteSchema("UpdateSecretRequest", {
      description: "Generated RUNPOD schema for UpdateSecretRequest.",
      documentation:
        "Only the provided fields are updated; at least one field is required.\nThe secret's `name` is immutable.\n",
    }),
  );

/**
 * Type for {@link UpdateSecretRequest}.
 *
 * **Example** (Reference the UpdateSecretRequest type)
 *
 * ```ts
 * import type { UpdateSecretRequest } from "@beep/runpod"
 *
 * type UpdateSecretRequestValue = UpdateSecretRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateSecretRequest = typeof UpdateSecretRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateSshKeysRequest`.
 *
 * **Example** (Inspect the UpdateSshKeysRequest schema)
 *
 * ```ts
 * import { UpdateSshKeysRequest } from "@beep/runpod"
 *
 * console.log(UpdateSshKeysRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateSshKeysRequest = S.Struct({
  keys: S.Array(
    S.String.check(
      S.isPattern(
        new globalThis.RegExp(
          "^(ssh|ecdsa|sk)-[^\\s]+ [^\\s]+([ \\t][^\\n\\r]*)?$",
          "u",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp ^(ssh|ecdsa|sk)-[^\\s]+ [^\\s]+([ \\t][^\\n\\r]*)?$",
      }),
    ),
  ).annotateKey({
    description:
      "The full set of SSH public keys to register — this is a complete\nreplacement, not a merge. Each entry is an authorized_keys-style\nline: `<type> <base64-key> [comment]`, e.g. from\n`~/.ssh/id_ed25519.pub`. Send `[]` to remove all keys. These keys\nare provisioned into pods created with `startSsh` and\nauthenticate both SSH paths reported in the pod's `ssh` block.\n",
  }),
}).pipe(
  $I.annoteSchema("UpdateSshKeysRequest", {
    description: "Generated RUNPOD schema for UpdateSshKeysRequest.",
    identifier: "UpdateSshKeysRequest",
  }),
);

/**
 * Type for {@link UpdateSshKeysRequest}.
 *
 * **Example** (Reference the UpdateSshKeysRequest type)
 *
 * ```ts
 * import type { UpdateSshKeysRequest } from "@beep/runpod"
 *
 * type UpdateSshKeysRequestValue = UpdateSshKeysRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateSshKeysRequest = typeof UpdateSshKeysRequest.Type;

/**
 * Generated RUNPOD schema for `UpdateTemplateRequest`.
 *
 * **Example** (Inspect the UpdateTemplateRequest schema)
 *
 * ```ts
 * import { UpdateTemplateRequest } from "@beep/runpod"
 *
 * console.log(UpdateTemplateRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpdateTemplateRequest = S.Struct({
  args: S.optionalKey(
    S.String.annotateKey({
      description:
        'The container\'s command, as a single raw string. This is the field `entrypoint` and `cmd` encode into, exposed in its stored form.\n\nTwo shapes are accepted. A bare shell string is treated as CMD and split into arguments, which is what the console\'s "Container start command" field writes. A JSON object of the form `{"entrypoint":[...],"cmd":[...]}` sets either or both explicitly.\n\nResponses always return both representations: `args` exactly as stored, plus the deconstructed `entrypoint` and `cmd`. Supplying `args` together with `entrypoint` or `cmd` is allowed only when they describe the same command, so a read-modify-write client can send back everything it received. Send `""` to clear, omit to leave unchanged.\n',
    }),
  ),
  cmd: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container CMD in exec form. When the image defines an ENTRYPOINT, this is the argument list passed to it. Encoded into the `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  entrypoint: S.optionalKey(
    S.Array(S.String).annotateKey({
      description:
        "Container ENTRYPOINT in exec form, overriding the image's own. Encoded into `args` field; supplying both is allowed only when they describe the same command. Send `[]` to clear, omit to leave unchanged.\n",
    }),
  ),
  disk: S.optionalKey(
    S.Int.annotateKey({
      description: "Container disk in GB (ephemeral, wiped on restart)",
    }).check(
      S.isGreaterThanOrEqualTo(1).annotate({
        expected: "a value greater than or equal to 1",
      }),
    ),
  ),
  env: S.optionalKey(
    S.Record(S.String, S.String).annotateKey({
      description: "Environment variables as key-value pairs",
    }),
  ),
  image: S.optionalKey(
    S.String.annotateKey({ description: "Docker image reference" }),
  ),
  ports: S.optionalKey(
    S.Array(S.String).annotateKey({
      description: "Exposed ports, formatted as port/protocol",
    }),
  ),
  registry: S.optionalKey(
    S.Union([S.String, S.Null]).annotateKey({
      description:
        "Container registry credential ID for a private image: one of\nyour credentials from `/v2/registries`. Leave it unset for a\nprivate Amazon ECR image. Runpod pulls those with an ECR\ndelegation (`/v2/registries/delegations`) matched to the\nimage's account, region and repository at pull time, so there\nis no delegation ID to pass here (a delegation ID is not a\ncredential ID). A credential set here is used instead of any\ndelegation.\n",
    }),
  ),
  allowedCudaVersions: S.optionalKey(
    S.Array(
      S.String.check(
        S.isPattern(new globalThis.RegExp("^\\d+\\.\\d+$", "u")).annotate({
          expected: "a string matching the RegExp ^\\d+\\.\\d+$",
        }),
      ),
    ).annotateKey({
      description:
        "Acceptable CUDA versions for pods created from this template. An explicit `[]` clears the constraint; omitting the field leaves it unchanged.",
    }),
  ),
  category: S.optionalKey(TemplateCategory),
  mounts: S.optionalKey(TemplateMounts),
  name: S.optionalKey(
    S.String.check(
      S.isMinLength(1).annotate({
        expected: "a value with a length of at least 1",
      }),
    ),
  ),
  public: S.optionalKey(S.Boolean),
  serverless: S.optionalKey(S.Boolean),
  startJupyter: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Start JupyterLab at container startup (`JUPYTER_PASSWORD` env injection). See the create-time field for details.",
    }),
  ),
  startSsh: S.optionalKey(
    S.Boolean.annotateKey({
      description:
        "Provision SSH access at container startup (`PUBLIC_KEY` env injection). See the create-time field for details.",
    }),
  ),
}).pipe(
  $I.annoteSchema("UpdateTemplateRequest", {
    description: "Generated RUNPOD schema for UpdateTemplateRequest.",
    identifier: "UpdateTemplateRequest",
  }),
);

/**
 * Type for {@link UpdateTemplateRequest}.
 *
 * **Example** (Reference the UpdateTemplateRequest type)
 *
 * ```ts
 * import type { UpdateTemplateRequest } from "@beep/runpod"
 *
 * type UpdateTemplateRequestValue = UpdateTemplateRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateTemplateRequest = typeof UpdateTemplateRequest.Type;

/**
 * Generated RUNPOD schema for `VerifyAuthenticationAttemptRequest`.
 *
 * **Example** (Inspect the VerifyAuthenticationAttemptRequest schema)
 *
 * ```ts
 * import { VerifyAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * console.log(VerifyAuthenticationAttemptRequest.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VerifyAuthenticationAttemptRequest = S.Struct({
  code: S.String.annotateKey({
    description: "Verification code from the email.",
  }).check(
    S.isPattern(new globalThis.RegExp("^[0-9]{6}$", "u")).annotate({
      expected: "a string matching the RegExp ^[0-9]{6}$",
    }),
  ),
  codeVerifier: CodeVerifier,
}).pipe(
  $I.annoteSchema("VerifyAuthenticationAttemptRequest", {
    description:
      "Generated RUNPOD schema for VerifyAuthenticationAttemptRequest.",
    identifier: "VerifyAuthenticationAttemptRequest",
  }),
);

/**
 * Type for {@link VerifyAuthenticationAttemptRequest}.
 *
 * **Example** (Reference the VerifyAuthenticationAttemptRequest type)
 *
 * ```ts
 * import type { VerifyAuthenticationAttemptRequest } from "@beep/runpod"
 *
 * type VerifyAuthenticationAttemptRequestValue = VerifyAuthenticationAttemptRequest
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VerifyAuthenticationAttemptRequest =
  typeof VerifyAuthenticationAttemptRequest.Type;
