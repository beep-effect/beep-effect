/**
 * Schemas for the host-pressure parcel: the kernel pressure stall files,
 * memory and admission readings it reduces from, and the items it serves.
 *
 * **Details**
 *
 * The host reads `/proc/pressure/{cpu,memory,io}` as text and hands it over
 * unparsed; the parser here turns each line into a {@link PressureLine}. A
 * host without pressure stall information (a non-Linux machine, a vendor
 * cloud VM, a container) reports {@link PressureSourceInput} `Missing`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Freshness } from "./Freshness.ts";

const $I = $PalantiriId.create("HostPressure.models");

/**
 * A resource the kernel reports pressure stall information for.
 *
 * **Example** (Narrow a resource)
 *
 * ```ts
 * import { PressureResource } from "@beep/palantiri/HostPressure.models"
 *
 * console.log(PressureResource.is.io("io")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PressureResource = LiteralKit(["cpu", "memory", "io"]).pipe(
  $I.annoteSchema("PressureResource", { description: "A resource with kernel pressure stall information." })
);

/**
 * Runtime type for {@link PressureResource}.
 *
 * @category models
 * @since 0.0.0
 */
export type PressureResource = typeof PressureResource.Type;

/**
 * Which tasks a pressure line measures: `some` tasks stalled, or `full`
 * (every non-idle task stalled at once).
 *
 * **Example** (Narrow a scope)
 *
 * ```ts
 * import { PressureScope } from "@beep/palantiri/HostPressure.models"
 *
 * console.log(PressureScope.is.full("full")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PressureScope = LiteralKit(["some", "full"]).pipe(
  $I.annoteSchema("PressureScope", { description: "Whether some tasks or all non-idle tasks were stalled." })
);

/**
 * Runtime type for {@link PressureScope}.
 *
 * @category models
 * @since 0.0.0
 */
export type PressureScope = typeof PressureScope.Type;

const Percent = S.Finite.check(S.isBetween({ minimum: 0, maximum: 100 }));

const PercentFromString = S.FiniteFromString.pipe(S.decodeTo(Percent));

/**
 * Share of wall time stalled over the last 10, 60 and 300 seconds, in
 * percent, and the total stall time in microseconds.
 *
 * **Example** (Make stall figures)
 *
 * ```ts
 * import { PressureStats } from "@beep/palantiri/HostPressure.models"
 *
 * console.log(PressureStats.make({ avg10: 1.5, avg60: 0.8, avg300: 0.2, total: 120000 }).avg10) // 1.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressureStats extends S.Opaque<PressureStats, { readonly brand: unique symbol }>()(
  S.Struct({
    avg10: Percent,
    avg60: Percent,
    avg300: Percent,
    total: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("PressureStats", {
      description: "Percent of wall time stalled over 10, 60 and 300 seconds, and total stall microseconds.",
    })
  )
) {}

/**
 * The fields of one pressure line, as text, decoded to numbers.
 *
 * **Details**
 *
 * The parser tokenizes `some avg10=0.00 avg60=0.00 avg300=0.00 total=0` into
 * these fields; this schema then checks the scope and decodes each figure, so
 * an unknown scope, a non-number or a percent outside 0..100 is rejected.
 *
 * **Example** (Decode line fields)
 *
 * ```ts
 * import { PressureLine } from "@beep/palantiri/HostPressure.models"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const line = S.decodeUnknownOption(PressureLine)({ scope: "some", avg10: "1.50", avg60: "0.80", avg300: "0.20", total: "120000" })
 * console.log(O.getOrUndefined(O.map(line, (value) => value.avg10))) // 1.5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressureLine extends S.Opaque<PressureLine, { readonly brand: unique symbol }>()(
  S.Struct({
    scope: PressureScope,
    avg10: PercentFromString,
    avg60: PercentFromString,
    avg300: PercentFromString,
    total: S.FiniteFromString.pipe(S.decodeTo(S.Finite.check(S.isGreaterThanOrEqualTo(0)))),
  }).pipe($I.annoteSchema("PressureLine", { description: "One pressure stall line: its scope and stall figures." }))
) {}

/**
 * One parsed pressure file: its `some` and `full` lines, and how many lines
 * did not parse.
 *
 * **Example** (Make an empty reading)
 *
 * ```ts
 * import { PressureFileReading } from "@beep/palantiri/HostPressure.models"
 * import * as O from "effect/Option"
 *
 * console.log(PressureFileReading.make({ some: O.none(), full: O.none(), malformedLines: 0 }).malformedLines) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressureFileReading extends S.Opaque<PressureFileReading, { readonly brand: unique symbol }>()(
  S.Struct({
    some: S.OptionFromNullOr(PressureStats),
    full: S.OptionFromNullOr(PressureStats),
    malformedLines: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("PressureFileReading", {
      description: "A parsed pressure file: its some and full stall figures and its malformed-line count.",
    })
  )
) {}

/**
 * The raw text of one `/proc/pressure/<resource>` file.
 *
 * **Example** (Make a pressure file)
 *
 * ```ts
 * import { PressureFile } from "@beep/palantiri/HostPressure.models"
 *
 * console.log(PressureFile.make({ resource: "cpu", text: "some avg10=0.00 avg60=0.00 avg300=0.00 total=0\n" }).resource) // "cpu"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressureFile extends S.Opaque<PressureFile, { readonly brand: unique symbol }>()(
  S.Struct({ resource: PressureResource, text: S.String }).pipe(
    $I.annoteSchema("PressureFile", { description: "The raw text of one pressure stall file." })
  )
) {}

/**
 * Whether the host has pressure stall information: the files it read, or why
 * it has none.
 *
 * **Example** (A host without pressure files)
 *
 * ```ts
 * import { PressureSourceInput } from "@beep/palantiri/HostPressure.models"
 *
 * const missing = PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure on this host" })
 * console.log(missing._tag) // "Missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PressureSourceInput = S.TaggedUnion({
  Read: { files: S.Array(PressureFile) },
  Missing: { detail: S.String },
}).pipe(
  $I.annoteSchema("PressureSourceInput", {
    description: "The pressure stall files a host read, or why it has none.",
  })
);

/**
 * Runtime type for {@link PressureSourceInput}.
 *
 * @category models
 * @since 0.0.0
 */
export type PressureSourceInput = typeof PressureSourceInput.Type;

/**
 * Memory class of the host a reading came from: a full `workstation` or a
 * sub-envelope `worker` (goal compute-profile-gate-routing).
 *
 * **Example** (Recognize the worker profile)
 *
 * ```ts
 * import { HostComputeProfile } from "@beep/palantiri/HostPressure.models"
 *
 * console.log(HostComputeProfile.is.worker("worker")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HostComputeProfile = LiteralKit(["workstation", "worker"]).pipe(
  $I.annoteSchema("HostComputeProfile", {
    description: "Memory class of the host: a full workstation or a sub-envelope worker.",
  })
);

/**
 * Memory class of the host a reading came from.
 *
 * @category models
 * @since 0.0.0
 */
export type HostComputeProfile = typeof HostComputeProfile.Type;

/**
 * Available and installed memory, in GiB, with the process memory ceiling
 * and the compute profile it resolves to when the reader knows them.
 *
 * **Example** (Make a memory reading)
 *
 * ```ts
 * import { HostMemoryInput } from "@beep/palantiri/HostPressure.models"
 * import * as O from "effect/Option"
 *
 * const reading = HostMemoryInput.make({
 *   availableGib: 40,
 *   totalGib: 64,
 *   ceilingGib: O.some(64),
 *   computeProfile: O.some("workstation")
 * })
 * console.log(reading.totalGib) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HostMemoryInput extends S.Opaque<HostMemoryInput, { readonly brand: unique symbol }>()(
  S.Struct({
    availableGib: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    totalGib: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    ceilingGib: S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    computeProfile: HostComputeProfile.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("HostMemoryInput", {
      description: "Available and installed memory in GiB, with the process ceiling and compute profile when known.",
    })
  )
) {}

/**
 * Machine-wide admission occupancy: capacity and active tokens, queued
 * tickets, dead leases, and whether the memory hard floor is engaged.
 *
 * **Example** (Make an admission reading)
 *
 * ```ts
 * import { AdmissionSlotsInput } from "@beep/palantiri/HostPressure.models"
 *
 * const slots = AdmissionSlotsInput.make({ capacityTokens: 3, activeTokens: 1, queued: 0, dead: 0, hardFloorEngaged: false })
 * console.log(slots.capacityTokens) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionSlotsInput extends S.Opaque<AdmissionSlotsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    capacityTokens: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    activeTokens: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    queued: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    dead: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    hardFloorEngaged: S.Boolean,
  }).pipe(
    $I.annoteSchema("AdmissionSlotsInput", {
      description: "Admission capacity and active tokens, queued tickets, dead leases and the hard-floor flag.",
    })
  )
) {}

/**
 * What the host-pressure source port serves: when it read, the pressure
 * files, memory, and admission occupancy (`None` when unreadable).
 *
 * **Example** (A host with nothing readable)
 *
 * ```ts
 * import { HostPressureInput, PressureSourceInput } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = HostPressureInput.make({
 *   readAt: DateTime.makeUnsafe("2026-10-15T12:00:00Z"),
 *   pressure: PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure" }),
 *   memory: O.none(),
 *   admission: O.none()
 * })
 * console.log(input.pressure._tag) // "Missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HostPressureInput extends S.Opaque<HostPressureInput, { readonly brand: unique symbol }>()(
  S.Struct({
    readAt: S.DateTimeUtcFromString,
    pressure: PressureSourceInput,
    memory: S.OptionFromNullOr(HostMemoryInput),
    admission: S.OptionFromNullOr(AdmissionSlotsInput),
  }).pipe(
    $I.annoteSchema("HostPressureInput", {
      description: "A host's pressure stall files, memory and admission occupancy, and when they were read.",
    })
  )
) {}

/**
 * Host-pressure item: one resource's pressure stall figures.
 *
 * **Example** (Make a pressure stall item)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { PressureStall, PressureStats } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const item = PressureStall.make({
 *   resource: "cpu",
 *   some: O.some(PressureStats.make({ avg10: 2, avg60: 1, avg300: 0.5, total: 10 })),
 *   full: O.none(),
 *   asOf: at,
 *   freshness: Freshness.cases.Fresh.make({ asOf: at })
 * })
 * console.log(item._tag) // "PressureStall"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PressureStall extends S.Opaque<PressureStall, { readonly brand: unique symbol }>()(
  S.TaggedStruct("PressureStall", {
    resource: PressureResource,
    some: S.OptionFromNullOr(PressureStats),
    full: S.OptionFromNullOr(PressureStats),
    asOf: S.DateTimeUtcFromString,
    freshness: Freshness,
  }).pipe(
    $I.annoteSchema("PressureStall", {
      description: "One resource's pressure stall figures: some and full stalls over 10, 60 and 300 seconds.",
    })
  )
) {}

/**
 * Host-pressure item: available and installed memory.
 *
 * **Example** (Make a memory item)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { HostMemory } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const item = HostMemory.make({ availableGib: 40, totalGib: 64, asOf: at, freshness: Freshness.cases.Fresh.make({ asOf: at }) })
 * console.log(item._tag) // "HostMemory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HostMemory extends S.Opaque<HostMemory, { readonly brand: unique symbol }>()(
  S.TaggedStruct("HostMemory", {
    availableGib: S.Finite,
    totalGib: S.Finite,
    ceilingGib: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    computeProfile: HostComputeProfile.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    asOf: S.DateTimeUtcFromString,
    freshness: Freshness,
  }).pipe(
    $I.annoteSchema("HostMemory", {
      description: "Available and installed memory in GiB, with the process ceiling and compute profile when known.",
    })
  )
) {}

/**
 * Host-pressure item: machine-wide admission occupancy.
 *
 * **Example** (Make an admission item)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { AdmissionSlots } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const item = AdmissionSlots.make({
 *   capacityTokens: 3,
 *   activeTokens: 2,
 *   queued: 1,
 *   dead: 0,
 *   hardFloorEngaged: false,
 *   asOf: at,
 *   freshness: Freshness.cases.Fresh.make({ asOf: at })
 * })
 * console.log(item.activeTokens) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionSlots extends S.Opaque<AdmissionSlots, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AdmissionSlots", {
    capacityTokens: S.Finite,
    activeTokens: S.Finite,
    queued: S.Int,
    dead: S.Int,
    hardFloorEngaged: S.Boolean,
    asOf: S.DateTimeUtcFromString,
    freshness: Freshness,
  }).pipe(
    $I.annoteSchema("AdmissionSlots", {
      description: "Admission capacity and active tokens, queued tickets, dead leases and the hard-floor flag.",
    })
  )
) {}

/**
 * Any host-pressure item, tagged by kind.
 *
 * **Example** (Label an item)
 *
 * ```ts
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import { HostMemory, HostPressureItem } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const item = HostMemory.make({ availableGib: 40, totalGib: 64, asOf: at, freshness: Freshness.cases.Fresh.make({ asOf: at }) })
 * console.log(HostPressureItem.match(item, { PressureStall: () => "stall", HostMemory: () => "memory", AdmissionSlots: () => "admission" })) // "memory"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HostPressureItem = S.Union([PressureStall, HostMemory, AdmissionSlots]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("HostPressureItem", { description: "One host-pressure item, tagged by kind." })
);

/**
 * Runtime type for {@link HostPressureItem}.
 *
 * @category models
 * @since 0.0.0
 */
export type HostPressureItem = typeof HostPressureItem.Type;
