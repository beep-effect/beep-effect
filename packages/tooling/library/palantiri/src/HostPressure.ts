/**
 * The host-pressure parcel: its spec, the pressure stall line parser, and the
 * pure reducer from pressure files, memory and admission readings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import { dual, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { checkFreshness, Freshness, isFreshItem, unknownSplit } from "./Freshness.ts";
import {
  AdmissionSlots,
  HostMemory,
  HostPressureItem,
  PressureFileReading,
  PressureLine,
  PressureResource,
  PressureSourceInput,
  PressureStall,
  PressureStats,
} from "./HostPressure.models.ts";
import { ParcelSpec } from "./Parcel.models.ts";
import { makeParcelEnvelope, ParcelDraft } from "./ParcelEnvelope.models.ts";
import type * as DateTime from "effect/DateTime";
import type { Freshness as FreshnessType } from "./Freshness.ts";
import type { HostComputeProfile, HostPressureInput, PressureFile } from "./HostPressure.models.ts";
import type { ParcelBudget } from "./Parcel.models.ts";
import type { ParcelEnvelope } from "./ParcelEnvelope.models.ts";

/**
 * Spec of the host-pressure parcel: keyed by host, fresh for 1 minute.
 *
 * **Example** (Read the freshness bound)
 *
 * ```ts
 * import { HostPressureSpec } from "@beep/palantiri/HostPressure"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(HostPressureSpec.freshnessBound)) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HostPressureSpec = ParcelSpec.make({
  id: "host-pressure",
  key: "host",
  freshnessBound: Duration.minutes(1),
  sources: ["proc-pressure", "proc-meminfo", "admission-slots"],
});

const LINE = /^(\S+) avg10=(\S+) avg60=(\S+) avg300=(\S+) total=(\S+)$/;

const decodeLine = S.decodeUnknownOption(PressureLine);

/**
 * Parse one pressure stall line, such as
 * `some avg10=1.50 avg60=0.80 avg300=0.20 total=120000`.
 *
 * **Details**
 *
 * The line is split into its fields, and {@link PressureLine} decodes them:
 * an unknown scope, a missing field, a non-number or a percent outside
 * 0..100 is `None`.
 *
 * **Example** (Parse a line)
 *
 * ```ts
 * import { parsePressureLine } from "@beep/palantiri/HostPressure"
 * import * as O from "effect/Option"
 *
 * const line = parsePressureLine("full avg10=0.25 avg60=0.10 avg300=0.00 total=4200")
 * console.log(O.getOrUndefined(O.map(line, (value) => value.scope))) // "full"
 * console.log(O.isNone(parsePressureLine("some avg10=oops"))) // true
 * ```
 *
 * @param line - One line of a pressure file.
 * @returns The decoded line, or `None` when it is malformed.
 * @category parsing
 * @since 0.0.0
 */
export const parsePressureLine = (line: string): O.Option<PressureLine> =>
  pipe(
    Str.trim(line),
    Str.match(LINE),
    O.flatMap((groups) =>
      decodeLine({ scope: groups[1], avg10: groups[2], avg60: groups[3], avg300: groups[4], total: groups[5] })
    )
  );

const statsOf = (line: PressureLine): PressureStats =>
  PressureStats.make({ avg10: line.avg10, avg60: line.avg60, avg300: line.avg300, total: line.total });

/**
 * Parse a whole pressure file into its `some` and `full` lines.
 *
 * **Details**
 *
 * Blank lines are ignored. Every other line that does not parse counts as
 * malformed. When a scope appears twice, the first line wins.
 *
 * **Example** (Parse a CPU pressure file)
 *
 * ```ts
 * import { parsePressureFile } from "@beep/palantiri/HostPressure"
 * import * as O from "effect/Option"
 *
 * const reading = parsePressureFile("some avg10=2.00 avg60=1.00 avg300=0.50 total=900\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n")
 * console.log(O.getOrUndefined(O.map(reading.some, (stats) => stats.avg10))) // 2
 * console.log(reading.malformedLines) // 0
 * ```
 *
 * @param text - Raw contents of one `/proc/pressure/<resource>` file.
 * @returns The parsed `some` and `full` figures and the malformed-line count.
 * @category parsing
 * @since 0.0.0
 */
export const parsePressureFile = (text: string): PressureFileReading => {
  const lines = A.filter(A.map(Str.split(text, "\n"), Str.trim), Str.isNonEmpty);
  const parsed = A.getSomes(A.map(lines, parsePressureLine));
  const scoped = (scope: PressureLine["scope"]) =>
    O.map(
      A.findFirst(parsed, (line) => line.scope === scope),
      statsOf
    );
  return PressureFileReading.make({
    some: scoped("some"),
    full: scoped("full"),
    malformedLines: lines.length - parsed.length,
  });
};

const unreachable = (detail: string): FreshnessType =>
  Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.some(detail) });

const stallItem =
  (now: DateTime.Utc, readAt: DateTime.Utc, files: ReadonlyArray<PressureFile>) =>
  (resource: PressureResource): PressureStall =>
    O.match(
      A.findFirst(files, (file) => file.resource === resource),
      {
        onNone: () =>
          PressureStall.make({
            resource,
            some: O.none(),
            full: O.none(),
            asOf: readAt,
            freshness: unreachable("no pressure file"),
          }),
        onSome: (file) => {
          const reading = parsePressureFile(file.text);
          return PressureStall.make({
            resource,
            some: reading.some,
            full: reading.full,
            asOf: readAt,
            freshness:
              O.isNone(reading.some) && O.isNone(reading.full)
                ? unreachable("pressure file did not parse")
                : checkFreshness(now, HostPressureSpec.freshnessBound, [readAt]),
          });
        },
      }
    );

/**
 * Every host-pressure reading as an item with its own freshness: one
 * pressure stall item per resource, then memory, then admission occupancy.
 *
 * **Details**
 *
 * A reading within 1 minute of `now` is `Fresh`, an older one
 * `Unknown{stale}`. A resource with no pressure file, or a file with no
 * parsable line, is `Unknown{unreachable}`. A host with no pressure stall
 * information has no pressure items at all; unreadable memory or admission
 * readings have no item.
 *
 * **Example** (Memory only)
 *
 * ```ts
 * import { hostPressureItems } from "@beep/palantiri/HostPressure"
 * import { HostMemoryInput, HostPressureInput, PressureSourceInput } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const now = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const input = HostPressureInput.make({
 *   readAt: now,
 *   pressure: PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure" }),
 *   memory: O.some(HostMemoryInput.make({ availableGib: 40, totalGib: 64 })),
 *   admission: O.none()
 * })
 * console.log(hostPressureItems(input, now).map((item) => item._tag)) // ["HostMemory"]
 * ```
 *
 * @param input - Pressure files, memory and admission readings, and when they were read.
 * @param now - The read time each item's freshness is checked against.
 * @returns Pressure stall items per resource, then memory, then admission occupancy.
 * @category mapping
 * @since 0.0.0
 */
export const hostPressureItems: {
  (now: DateTime.Utc): (input: HostPressureInput) => ReadonlyArray<HostPressureItem>;
  (input: HostPressureInput, now: DateTime.Utc): ReadonlyArray<HostPressureItem>;
} = dual(2, (input: HostPressureInput, now: DateTime.Utc): ReadonlyArray<HostPressureItem> => {
  const fresh = checkFreshness(now, HostPressureSpec.freshnessBound, [input.readAt]);
  const stalls = PressureSourceInput.match(input.pressure, {
    Read: (read) => A.map(PressureResource.literals, stallItem(now, input.readAt, read.files)),
    Missing: A.empty<PressureStall>,
  });
  const memory: ReadonlyArray<HostPressureItem> = A.fromOption(
    O.map(input.memory, (reading) =>
      HostMemory.make({
        availableGib: reading.availableGib,
        totalGib: reading.totalGib,
        ceilingGib: reading.ceilingGib,
        computeProfile: reading.computeProfile,
        asOf: input.readAt,
        freshness: fresh,
      })
    )
  );
  const admission: ReadonlyArray<HostPressureItem> = A.fromOption(
    O.map(input.admission, (reading) =>
      AdmissionSlots.make({
        capacityTokens: reading.capacityTokens,
        activeTokens: reading.activeTokens,
        queued: reading.queued,
        dead: reading.dead,
        hardFloorEngaged: reading.hardFloorEngaged,
        asOf: input.readAt,
        freshness: fresh,
      })
    )
  );
  return A.flatten([stalls, memory, admission]);
});

/**
 * The pressure stall items that are fresh and carry a `some` line: the ones
 * a gauge may record.
 *
 * **Example** (No items, nothing to record)
 *
 * ```ts
 * import { freshPressureStalls } from "@beep/palantiri/HostPressure"
 *
 * console.log(freshPressureStalls([]).length) // 0
 * ```
 *
 * @param items - Host-pressure items.
 * @returns The fresh pressure stall items, paired with their `some` figures.
 * @category filtering
 * @since 0.0.0
 */
export const freshPressureStalls = (
  items: ReadonlyArray<HostPressureItem>
): ReadonlyArray<{ readonly resource: PressureResource; readonly some: PressureStats }> =>
  A.flatMap(items, (item) =>
    HostPressureItem.guards.PressureStall(item) && isFreshItem(item)
      ? A.fromOption(O.map(item.some, (some) => ({ resource: item.resource, some })))
      : A.empty()
  );

/**
 * The ` (ceiling …, profile)` suffix of a memory line, or an empty string
 * when the reading carries neither a ceiling nor a profile.
 *
 * **Example** (Tag a workstation reading)
 *
 * ```ts
 * import { hostMemoryCeilingTag } from "@beep/palantiri/HostPressure"
 * import * as O from "effect/Option"
 *
 * console.log(hostMemoryCeilingTag({ ceilingGib: O.some(125.08), computeProfile: O.some("workstation") }))
 * // " (ceiling 125.1 GiB, workstation)"
 * ```
 *
 * @param memory - A memory reading or item.
 * @returns The suffix to append after "GiB available".
 * @category formatting
 * @since 0.0.0
 */
export const hostMemoryCeilingTag = (memory: {
  readonly ceilingGib: O.Option<number>;
  readonly computeProfile: O.Option<HostComputeProfile>;
}): string =>
  A.match(
    A.getSomes([O.map(memory.ceilingGib, (ceiling) => `ceiling ${Num.round(ceiling, 1)} GiB`), memory.computeProfile]),
    { onEmpty: () => "", onNonEmpty: (parts) => ` (${A.join(parts, ", ")})` }
  );

const labelOf = HostPressureItem.match({
  PressureStall: (stall) => stall.resource,
  HostMemory: () => "meminfo",
  AdmissionSlots: () => "admission",
});

const percent = (value: number): string => `${Num.round(value, 1)}%`;

const describe = (input: HostPressureInput, items: ReadonlyArray<HostPressureItem>) =>
  A.getSomes([
    PressureSourceInput.match(input.pressure, {
      Read: () =>
        A.match(freshPressureStalls(items), {
          onEmpty: O.none,
          onNonEmpty: (stalls) =>
            O.some(
              `${A.join(
                A.map(stalls, (stall) => `${stall.resource} ${percent(stall.some.avg10)}`),
                ", "
              )} stalled (some, avg10)`
            ),
        }),
      Missing: (missing) => O.some(`no pressure stall information (${missing.detail})`),
    }),
    O.map(
      input.memory,
      (memory) =>
        `${Num.round(memory.availableGib, 1)} of ${Num.round(memory.totalGib, 1)} GiB available${hostMemoryCeilingTag(memory)}`
    ),
    O.map(
      input.admission,
      (admission) =>
        `admission ${Num.round(admission.activeTokens, 1)} of ${Num.round(admission.capacityTokens, 1)} tokens active, ${admission.queued} queued${admission.hardFloorEngaged ? ", hard floor engaged" : ""}`
    ),
  ]);

const missingParts = (input: HostPressureInput): ReadonlyArray<string> =>
  A.getSomes([
    O.isNone(input.memory) ? O.some("meminfo") : O.none(),
    O.isNone(input.admission) ? O.some("admission") : O.none(),
  ]);

const envelopeFreshness = (
  input: HostPressureInput,
  now: DateTime.Utc,
  items: ReadonlyArray<HostPressureItem>
): FreshnessType =>
  PressureSourceInput.match(input.pressure, {
    Missing: (missing) => unreachable(missing.detail),
    Read: () => {
      const read = checkFreshness(now, HostPressureSpec.freshnessBound, [input.readAt]);
      const incomplete = A.appendAll(
        missingParts(input),
        A.map(
          A.filter(items, (item) => HostPressureItem.guards.PressureStall(item) && !isFreshItem(item)),
          labelOf
        )
      );
      return read._tag === "Fresh" && A.isReadonlyArrayNonEmpty(incomplete)
        ? Freshness.cases.Unknown.make({
            reason: "attribution-incomplete",
            asOf: O.some(read.asOf),
            detail: O.some(`no reading from ${A.join(incomplete, ", ")}`),
          })
        : read;
    },
  });

/**
 * Reduce a host's pressure stall files, memory and admission readings to the
 * host-pressure parcel.
 *
 * **Details**
 *
 * Freshness has two levels. Each item carries its own (see
 * {@link hostPressureItems}). The envelope's describes the read:
 * `Unknown{unreachable}` when the host has no pressure stall information (a
 * non-Linux host, a vendor cloud VM, a container), `Unknown{stale}` when the
 * readings are older than 1 minute, `Unknown{attribution-incomplete}` when a
 * pressure file, memory or admission reading is missing, and `Fresh`
 * otherwise. The summary leads with the split, such as:
 *
 * `5 of 5 readings fresh; cpu 2.1%, memory 0%, io 4.3% stalled (some, avg10); 40 of 64 GiB available`
 *
 * **Example** (A host without pressure stall information)
 *
 * ```ts
 * import { reduceHostPressure } from "@beep/palantiri/HostPressure"
 * import { HostPressureInput, PressureSourceInput } from "@beep/palantiri/HostPressure.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const now = DateTime.makeUnsafe("2026-10-15T12:00:00Z")
 * const input = HostPressureInput.make({
 *   readAt: now,
 *   pressure: PressureSourceInput.cases.Missing.make({ detail: "no /proc/pressure" }),
 *   memory: O.none(),
 *   admission: O.none()
 * })
 * const parcel = reduceHostPressure(input, now, 20)
 * console.log(parcel.freshness._tag === "Unknown" ? parcel.freshness.reason : "fresh") // "unreachable"
 * ```
 *
 * @param input - The host's readings.
 * @param now - The read time.
 * @param budget - The most items to keep.
 * @returns The parcel envelope.
 * @category mapping
 * @since 0.0.0
 */
export const reduceHostPressure: {
  (now: DateTime.Utc, budget: ParcelBudget): (input: HostPressureInput) => ParcelEnvelope;
  (input: HostPressureInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope;
} = dual(3, (input: HostPressureInput, now: DateTime.Utc, budget: ParcelBudget): ParcelEnvelope => {
  const items = hostPressureItems(input, now);
  const split = A.match(unknownSplit(items, labelOf), {
    onEmpty: () => "",
    onNonEmpty: (parts: ReadonlyArray<string>) => `; ${A.join(parts, ", ")}`,
  });
  const details = A.match(describe(input, items), {
    onEmpty: () => "",
    onNonEmpty: (parts: ReadonlyArray<string>) => `; ${A.join(parts, "; ")}`,
  });
  return makeParcelEnvelope(
    ParcelDraft.make({
      spec: HostPressureSpec,
      readAt: now,
      freshness: envelopeFreshness(input, now, items),
      summary: `${A.filter(items, isFreshItem).length} of ${items.length} readings fresh${split}${details}`,
      items,
      budget,
    })
  );
});
