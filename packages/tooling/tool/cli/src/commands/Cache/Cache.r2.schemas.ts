/**
 * Receipts for the R2 cache qualification probe and fleet enrollment.
 *
 * **Details**
 * Ported from the retired `infra/r2-cache/probe.py` and `fleet.py`. Field
 * names keep the Python spelling (`elapsed_s`, `uploaded_duration_ms`, ...)
 * because a probe receipt stored in the bucket by one mode is read back by the
 * next mode, possibly from a receipt the Python probe wrote.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.r2.schemas");

/**
 * Qualification probe mode.
 *
 * **Example** (Check a mode)
 * ```ts
 * import { CacheR2ProbeMode } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheR2ProbeMode.is.ci("ci"))
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheR2ProbeMode = LiteralKit(["seed", "ci", "restore"]).pipe(
  $I.annoteSchema("CacheR2ProbeMode", {
    description: "Workstation seed, protected CI qualification, or workstation restoration of the CI artifact.",
  })
);

/**
 * Decoded probe mode.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheR2ProbeMode = typeof CacheR2ProbeMode.Type;

/**
 * Nonsecret sixteen-hex marker shared by the three probe modes.
 *
 * **Example** (Validate a marker)
 * ```ts
 * import { CacheR2Marker } from "@beep/repo-cli/test/Cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(CacheR2Marker)("0123456789abcdef"))
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheR2Marker = S.String.check(S.isPattern(/^[a-f0-9]{16}$/)).pipe(
  $I.annoteSchema("CacheR2Marker", { description: "Sixteen lowercase hexadecimal characters naming one probe run." })
);

/**
 * Decoded probe marker.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheR2Marker = typeof CacheR2Marker.Type;

/**
 * Turbo run-summary cache facts, retained whole.
 *
 * **Example** (Inspect the read fields)
 * ```ts
 * import { CacheR2TaskCache } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheR2TaskCache.make({ status: "MISS" }).status === "MISS")
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2TaskCache extends S.Opaque<CacheR2TaskCache, { readonly brand: unique symbol }>()(
  S.StructWithRest(
    S.Struct({
      status: S.String,
      remote: S.Boolean.pipe(S.optionalKey),
      timeSaved: S.Finite.pipe(S.optionalKey),
    }),
    [S.Record(S.String, S.Unknown)]
  ).pipe(
    $I.annoteSchema("CacheR2TaskCache", {
      description: "The task's Turbo cache status, remote flag and saved time plus every other summary field.",
    })
  )
) {}

/**
 * Turbo run-summary execution timing retained by the probe.
 *
 * **Example** (Inspect the timing fields)
 * ```ts
 * import { CacheR2TaskExecution } from "@beep/repo-cli/test/Cache"
 * console.assert("startTime" in CacheR2TaskExecution.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2TaskExecution extends S.Opaque<CacheR2TaskExecution, { readonly brand: unique symbol }>()(
  S.Struct({
    startTime: S.Finite.pipe(S.optionalKey),
    endTime: S.Finite.pipe(S.optionalKey),
    exitCode: S.Finite.pipe(S.NullOr, S.optionalKey),
  }).pipe(
    $I.annoteSchema("CacheR2TaskExecution", {
      description: "Start, end and exit code of one Turbo task execution.",
    })
  )
) {}

/**
 * One qualification task row.
 *
 * **Example** (Inspect the exact-hash field)
 * ```ts
 * import { CacheR2TaskRow } from "@beep/repo-cli/test/Cache"
 * console.assert("hash" in CacheR2TaskRow.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2TaskRow extends S.Opaque<CacheR2TaskRow, { readonly brand: unique symbol }>()(
  S.Struct({
    task: S.String,
    hash: S.String,
    cache: CacheR2TaskCache,
    execution: CacheR2TaskExecution,
    elapsed_s: S.Finite,
    mode: S.String,
  }).pipe(
    $I.annoteSchema("CacheR2TaskRow", {
      description: "One Turbo task's exact hash, cache facts, execution timing and requested cache mode.",
    })
  )
) {}

/**
 * One large synthetic payload written by the probe.
 *
 * **Example** (Inspect the integrity field)
 * ```ts
 * import { CacheR2PayloadRow } from "@beep/repo-cli/test/Cache"
 * console.assert("sha256" in CacheR2PayloadRow.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2PayloadRow extends S.Opaque<CacheR2PayloadRow, { readonly brand: unique symbol }>()(
  S.Struct({ hash: S.String, bytes: S.Int, sha256: S.String, upload_s: S.Finite }).pipe(
    $I.annoteSchema("CacheR2PayloadRow", {
      description: "Artifact key, byte size, digest and upload time of one deterministic payload.",
    })
  )
) {}

const receiptFields = {
  mode: S.String,
  marker: S.String,
  status: S.String,
  producer: CacheR2TaskRow.pipe(S.optionalKey),
  consumer: CacheR2TaskRow.pipe(S.optionalKey),
  payloads: S.Array(CacheR2PayloadRow).pipe(S.optionalKey),
  uploaded_duration_ms: S.Finite.pipe(S.optionalKey),
  reader_write_rejected: S.Boolean.pipe(S.optionalKey),
  failure: S.String.pipe(S.optionalKey),
};

/**
 * Probe receipt as stored in the bucket by the seed and CI modes.
 *
 * **Example** (Inspect the reader proof)
 * ```ts
 * import { CacheR2StoredReceipt } from "@beep/repo-cli/test/Cache"
 * console.assert("reader_write_rejected" in CacheR2StoredReceipt.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2StoredReceipt extends S.Opaque<CacheR2StoredReceipt, { readonly brand: unique symbol }>()(
  S.Struct(receiptFields).pipe(
    $I.annoteSchema("CacheR2StoredReceipt", {
      description: "Sanitized seed or CI receipt uploaded under the marker key.",
    })
  )
) {}

/**
 * Sanitized receipt of one probe mode.
 *
 * **Details**
 * Contains no environment values. The restore mode nests the CI receipt it
 * verified under `ci`.
 *
 * **Example** (Inspect the nested CI proof)
 * ```ts
 * import { CacheR2ProbeReceipt } from "@beep/repo-cli/test/Cache"
 * console.assert("ci" in CacheR2ProbeReceipt.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2ProbeReceipt extends S.Opaque<CacheR2ProbeReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ ...receiptFields, ci: CacheR2StoredReceipt.pipe(S.optionalKey) }).pipe(
    $I.annoteSchema("CacheR2ProbeReceipt", {
      description: "Sanitized seed, CI or restore receipt written to .beep/r2-cache/<mode>-proof.json.",
    })
  )
) {}

/**
 * Fleet enrollment status of one checkout.
 *
 * **Example** (Check a status)
 * ```ts
 * import { CacheR2FleetStatus } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheR2FleetStatus.is.enrolled("enrolled"))
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheR2FleetStatus = LiteralKit(["planned", "legacy-use-beep-turbo", "enrolled", "blocked"]).pipe(
  $I.annoteSchema("CacheR2FleetStatus", {
    description: "Plan, unsupported historical resolver, applied enrollment, or failed enrollment.",
  })
);

/**
 * Decoded {@link CacheR2FleetStatus} value.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheR2FleetStatus = typeof CacheR2FleetStatus.Type;

/**
 * One checkout row of the fleet enrollment receipt.
 *
 * **Example** (Inspect the cache mode field)
 * ```ts
 * import { CacheR2FleetRow } from "@beep/repo-cli/test/Cache"
 * console.assert("mode" in CacheR2FleetRow.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2FleetRow extends S.Opaque<CacheR2FleetRow, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    head: S.String,
    mode: S.Literals(["local:rw,remote:rw", "local:rw,remote:r"]),
    status: CacheR2FleetStatus,
    exit_code: S.Int.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("CacheR2FleetRow", {
      description: "Checkout path, HEAD, selected cache mode and enrollment status; never credentials or refs.",
    })
  )
) {}

/**
 * Private sanitized fleet enrollment receipt.
 *
 * **Example** (Inspect the applied flag)
 * ```ts
 * import { CacheR2FleetReceipt } from "@beep/repo-cli/test/Cache"
 * console.assert("applied" in CacheR2FleetReceipt.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2FleetReceipt extends S.Opaque<CacheR2FleetReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ recorded_utc: S.String, applied: S.Boolean, checkouts: S.Array(CacheR2FleetRow) }).pipe(
    $I.annoteSchema("CacheR2FleetReceipt", {
      description: "Recorded time, apply flag and per-checkout rows of one fleet enrollment run.",
    })
  )
) {}

/**
 * HTTP method the probe issues against the Turbo artifact API.
 *
 * **Example** (Check a method)
 * ```ts
 * import { CacheR2Method } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheR2Method.is.HEAD("HEAD"))
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const CacheR2Method = LiteralKit(["GET", "PUT", "HEAD"]).pipe(
  $I.annoteSchema("CacheR2Method", { description: "Artifact read, write or existence probe." })
);

/**
 * Decoded {@link CacheR2Method} value.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CacheR2Method = typeof CacheR2Method.Type;

/**
 * One artifact API request issued by the probe.
 *
 * **Details**
 * Without `api` the request targets the resolved Turbo API; the reader proof
 * names the reader adapter's loopback API instead.
 *
 * **Example** (Read the marker receipt)
 * ```ts
 * import { CacheR2Request } from "@beep/repo-cli/test/Cache"
 * console.assert(CacheR2Request.make({ key: "seed-receipt", method: "GET" }).method === "GET")
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2Request extends S.Opaque<CacheR2Request, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String,
    method: CacheR2Method,
    body: S.Uint8Array.pipe(S.optionalKey),
    api: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("CacheR2Request", {
      description: "Artifact key, method, optional body and optional alternate API base of one probe request.",
    })
  )
) {}

/**
 * One artifact API response observed by the probe.
 *
 * **Example** (Inspect the status field)
 * ```ts
 * import { CacheR2Response } from "@beep/repo-cli/test/Cache"
 * console.assert("status" in CacheR2Response.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2Response extends S.Opaque<CacheR2Response, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.Int,
    body: S.Uint8Array,
    headers: S.Record(S.String, S.String),
    elapsedSeconds: S.Finite,
  }).pipe(
    $I.annoteSchema("CacheR2Response", {
      description: "HTTP status, body bytes, headers and elapsed seconds of one artifact API response.",
    })
  )
) {}

/**
 * Resolved Turbo artifact tuple and checkout root the live probe works in.
 *
 * **Example** (Describe a probe target)
 * ```ts
 * import { CacheR2ProbeTarget } from "@beep/repo-cli/test/Cache"
 * const target = CacheR2ProbeTarget.make({ root: "/repo", api: "http://127.0.0.1:9427", token: "t", team: "team_x" })
 * console.assert(target.team === "team_x")
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2ProbeTarget extends S.Opaque<CacheR2ProbeTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    root: S.String,
    api: S.NonEmptyString,
    token: S.NonEmptyString,
    team: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CacheR2ProbeTarget", {
      description: "Checkout root plus the resolved TURBO_API, TURBO_TOKEN and TURBO_TEAM tuple.",
    })
  )
) {}

/**
 * Inputs of one fleet enrollment run.
 *
 * **Example** (Plan a projects directory)
 * ```ts
 * import { CacheR2FleetRequest } from "@beep/repo-cli/test/Cache"
 * import * as O from "effect/Option"
 * const request = CacheR2FleetRequest.make({
 *   roots: ["/home/me/projects"],
 *   apply: false,
 *   output: O.none(),
 *   workstation: "/repo/infra/r2-cache/workstation.sh"
 * })
 * console.assert(request.apply === false)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheR2FleetRequest extends S.Opaque<CacheR2FleetRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    roots: S.Array(S.String),
    apply: S.Boolean,
    output: S.Option(S.String),
    workstation: S.String,
  }).pipe(
    $I.annoteSchema("CacheR2FleetRequest", {
      description: "Clone roots, apply flag, optional private receipt path and the enrollment script.",
    })
  )
) {}
