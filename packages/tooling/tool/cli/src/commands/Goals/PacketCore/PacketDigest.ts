/**
 * Canonical encoding and content addressing for packet events.
 *
 * **Details**
 *
 * An event's identity is the sha-256 digest of its canonical JSON encoding:
 * recursively key-sorted, compact, with absent keys omitted. The digest is
 * never stored inside the event file — it is recomputed at read time and
 * verified against the file name, so a tampered or corrupted event surfaces
 * as a chain issue instead of being trusted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str } from "@beep/utils";
import { Effect, Order, Struct } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isJsonRecord } from "../Inventory.ts";
import { PacketEvent, PacketEventType } from "./PacketCore.schemas.ts";
import type { PacketEventId } from "./PacketCore.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/PacketCore/PacketDigest");

/**
 * Width of the zero-padded sequence segment in event file names.
 *
 * **Example** (Read the padding width)
 *
 * ```ts
 * import { PACKET_EVENT_SEQ_WIDTH } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PACKET_EVENT_SEQ_WIDTH) // 5
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_EVENT_SEQ_WIDTH = 5;

// JSON.stringify is used ONLY on primitives here: string escaping must match
// JSON exactly, and no schema codec expresses a key-sorted canonical form.
const canonicalPrimitive = (value: string | number | boolean): string => JSON.stringify(value);

const isJsonPrimitive = (value: unknown): value is string | number | boolean =>
  P.isString(value) || P.isNumber(value) || P.isBoolean(value);

const definedEntries = (value: Readonly<Record<string, unknown>>): ReadonlyArray<readonly [string, unknown]> =>
  pipe(
    Struct.keys(value),
    A.sort(Order.String),
    A.map((key) => {
      const entry = value[key];
      return entry === undefined ? O.none<readonly [string, unknown]>() : O.some([key, entry] as const);
    }),
    A.getSomes
  );

type CanonicalPads = {
  readonly open: string;
  readonly close: string;
  readonly joiner: string;
  readonly keyGap: string;
};

const canonicalPads = (indent: number, depth: number): CanonicalPads => {
  if (indent === 0) {
    return { open: "", close: "", joiner: ",", keyGap: "" };
  }
  const open = `\n${Str.repeat(indent * (depth + 1))(" ")}`;
  return { open, close: `\n${Str.repeat(indent * depth)(" ")}`, joiner: `,${open}`, keyGap: " " };
};

const canonicalArray = (value: ReadonlyArray<unknown>, indent: number, depth: number): string => {
  if (!A.isReadonlyArrayNonEmpty(value)) {
    return "[]";
  }
  const pads = canonicalPads(indent, depth);
  const items = A.map(value, (item) => canonicalAtDepth(item, indent, depth + 1));
  return `[${pads.open}${A.join(items, pads.joiner)}${pads.close}]`;
};

const canonicalObject = (value: Readonly<Record<string, unknown>>, indent: number, depth: number): string => {
  const entries = definedEntries(value);
  if (!A.isReadonlyArrayNonEmpty(entries)) {
    return "{}";
  }
  const pads = canonicalPads(indent, depth);
  const rendered = A.map(
    entries,
    ([key, entry]) => `${canonicalPrimitive(key)}:${pads.keyGap}${canonicalAtDepth(entry, indent, depth + 1)}`
  );
  return `{${pads.open}${A.join(rendered, pads.joiner)}${pads.close}}`;
};

const canonicalAtDepth = (value: unknown, indent: number, depth: number): string => {
  if (value === null) {
    return "null";
  }
  if (isJsonPrimitive(value)) {
    return canonicalPrimitive(value);
  }
  if (A.isArray(value)) {
    return canonicalArray(value, indent, depth);
  }
  return isJsonRecord(value) ? canonicalObject(value, indent, depth) : "null";
};

/**
 * Render a value as compact canonical JSON: keys recursively sorted, absent
 * keys omitted, no whitespace.
 *
 * **Example** (Key order never changes the rendering)
 *
 * ```ts
 * import { canonicalJsonText } from "@beep/repo-cli/test/Goals"
 *
 * console.log(canonicalJsonText({ b: 1, a: [true, null] })) // {"a":[true,null],"b":1}
 * console.log(canonicalJsonText({ a: [true, null], b: 1 })) // {"a":[true,null],"b":1}
 * ```
 *
 * @param value - Plain JSON-encodable value.
 * @returns Deterministic compact JSON text.
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJsonText = (value: unknown): string => canonicalAtDepth(value, 0, 0);

/**
 * Render a value as pretty canonical JSON: keys recursively sorted, 2-space
 * indentation, trailing newline.
 *
 * **Details**
 *
 * Used for committed derived files (event records, the trace projection) so
 * they stay reviewable in diffs while remaining byte-deterministic.
 *
 * **Example** (Render a small object)
 *
 * ```ts
 * import { canonicalJsonTextPretty } from "@beep/repo-cli/test/Goals"
 *
 * console.log(canonicalJsonTextPretty({ b: 1, a: 2 })) // "{\n  \"a\": 2,\n  \"b\": 1\n}\n"
 * ```
 *
 * @param value - Plain JSON-encodable value.
 * @returns Deterministic pretty JSON text ending in a newline.
 * @category encoding
 * @since 0.0.0
 */
export const canonicalJsonTextPretty = (value: unknown): string => `${canonicalAtDepth(value, 2, 0)}\n`;

/**
 * Compute the lowercase sha-256 hex digest of a text.
 *
 * **Example** (Digest an empty string)
 *
 * ```ts
 * import { sha256Hex } from "@beep/repo-cli/test/Goals"
 *
 * console.log(sha256Hex("").length) // 64
 * ```
 *
 * @param text - Text to digest.
 * @returns Lowercase 64-character hex digest.
 * @category encoding
 * @since 0.0.0
 */
export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex");

const encodePacketEvent = S.encodeUnknownEffect(PacketEvent);

/**
 * Compute a packet event's content-addressed identity: the sha-256 digest of
 * its canonical encoded JSON.
 *
 * **Example** (Build the digest effect for an event)
 *
 * ```ts
 * import { PacketEvent, packetEventDigest } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 1,
 *   expectedRevision: 0,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "packet-created", status: "active" },
 * })
 * console.log(Effect.isEffect(packetEventDigest(event))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const packetEventDigest: (event: PacketEvent) => Effect.Effect<PacketEventId, S.SchemaError> = Effect.fnUntraced(
  function* (event: PacketEvent) {
    const encoded = yield* encodePacketEvent(event);
    return sha256Hex(canonicalJsonText(encoded));
  }
);

/**
 * Render the canonical stored file content for a packet event.
 *
 * **Example** (Build the render effect for an event)
 *
 * ```ts
 * import { PacketEvent, renderPacketEventFile } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 1,
 *   expectedRevision: 0,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "packet-created", status: "active" },
 * })
 * console.log(Effect.isEffect(renderPacketEventFile(event))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const renderPacketEventFile: (event: PacketEvent) => Effect.Effect<string, S.SchemaError> = Effect.fnUntraced(
  function* (event: PacketEvent) {
    const encoded = yield* encodePacketEvent(event);
    return canonicalJsonTextPretty(encoded);
  }
);

const padSeq = (seq: number): string => pipe(`${seq}`, Str.padStart(PACKET_EVENT_SEQ_WIDTH, "0"));

/**
 * Render the `<seq>-<type>-<digest>.json` file name for a packet event.
 *
 * **Example** (Name a genesis event file)
 *
 * ```ts
 * import { PacketEvent, packetEventFileName } from "@beep/repo-cli/test/Goals"
 *
 * const event = PacketEvent.make({
 *   schemaVersion: "packet-event/v1",
 *   packet: "demo",
 *   root: "goals",
 *   seq: 1,
 *   expectedRevision: 0,
 *   at: "2026-08-17T00:00:00.000Z",
 *   actor: "operator",
 *   body: { type: "packet-created", status: "active" },
 * })
 * console.log(packetEventFileName(event, "0".repeat(64)).startsWith("00001-packet-created-")) // true
 * ```
 *
 * @param event - Event whose sequence and body type name the file.
 * @param id - Content digest of the event.
 * @returns The CAS file name inside the packet's `ops/events/` directory.
 * @category encoding
 * @since 0.0.0
 */
export const packetEventFileName: {
  (event: PacketEvent, id: PacketEventId): string;
  (id: PacketEventId): (event: PacketEvent) => string;
} = dual(2, (event: PacketEvent, id: PacketEventId): string => `${padSeq(event.seq)}-${event.body.type}-${id}.json`);

const EVENT_FILE_NAME_PATTERN = /^(\d{5})-([a-z-]+)-([0-9a-f]{64})\.json$/;
const isPacketEventType = S.is(PacketEventType);

/**
 * Parsed identity segments of a packet-event file name.
 *
 * **Example** (Construct parsed segments)
 *
 * ```ts
 * import { PacketEventFileNameParts } from "@beep/repo-cli/test/Goals"
 *
 * const parts = PacketEventFileNameParts.make({ seq: 1, type: "packet-created", id: "0".repeat(64) })
 * console.log(parts.seq) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketEventFileNameParts extends S.Class<PacketEventFileNameParts>($I`PacketEventFileNameParts`)(
  {
    seq: S.Finite,
    type: PacketEventType,
    id: S.String,
  },
  $I.annote("PacketEventFileNameParts", {
    description: "Parsed seq/type/digest segments of a packet-event file name.",
  })
) {}

/**
 * Parse a `<seq>-<type>-<digest>.json` event file name.
 *
 * **Example** (Parse a valid and an invalid name)
 *
 * ```ts
 * import { parsePacketEventFileName } from "@beep/repo-cli/test/Goals"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parsePacketEventFileName(`00002-status-set-${"a".repeat(64)}.json`))) // true
 * console.log(O.isNone(parsePacketEventFileName("notes.md"))) // true
 * ```
 *
 * @param fileName - Candidate file name inside `ops/events/`.
 * @returns Parsed segments, or `None` when the name is not a CAS event file.
 * @category parsing
 * @since 0.0.0
 */
export const parsePacketEventFileName = (fileName: string): O.Option<PacketEventFileNameParts> =>
  pipe(
    Str.match(EVENT_FILE_NAME_PATTERN)(fileName),
    O.flatMap((match) => {
      const seqText = match[1];
      const typeText = match[2];
      const idText = match[3];
      if (!P.isString(seqText) || !P.isString(typeText) || !P.isString(idText)) {
        return O.none();
      }
      if (!isPacketEventType(typeText)) {
        return O.none();
      }
      return O.some(PacketEventFileNameParts.make({ seq: Number(seqText), type: typeText, id: idText }));
    })
  );
