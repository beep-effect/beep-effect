// Slice A of goals/canonical-digest-owner: the stored-digest replay for
// PacketCore events.
//
// Every stored packet event is re-read the way `PacketEventStore` reads it
// (parse, upcast, decode, re-encode) and its digest is recomputed through the
// owner, `JsoncFingerprint.hash` (RFC 8785 plus SHA-256). The digest in the
// file name must equal the owner's digest. A mismatch is not repaired here: per
// the decision `coerced-history-keeps-its-function` it gets a legacy row in
// `goals/canonical-digest-owner/research/encoder-census.md` and is listed in
// `legacyRows` below.
//
// Two sources, both checked in under this package's test tree:
// - `fixtures/canonical-digest-owner/stored-packet-events.jsonl`: every event
//   file ever added on main, one line per event with its source commit. That
//   is the 4 events in the tree, the 71 held by the goals archive repository
//   and the one that exists only in this repository's history (decision
//   `2026-11-12-replay-covers-archived-events`). The tree's events are
//   snapshotted too, not read live: a test that reads packet data has to be
//   registered as a goal-data consumer, which would put every packet-event
//   pull request on the code route.
// - the valid PacketCore fixture streams, which add the `stage-entered` body
//   that no stored event carries.
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import {
  canonicalJsonText,
  PacketEvent,
  PacketTraceEntry,
  packetEventDigest,
  parsePacketEventFileName,
  renderPacketEventFile,
  upcastPacketEventJson,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const StoredEventFile = S.Struct({ source: S.String, path: S.String, text: S.String });
type StoredEventFile = typeof StoredEventFile.Type;

const decodeStoredEventLine = S.decodeUnknownEffect(S.fromJsonString(StoredEventFile));
const decodeJsonUnknown = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodePacketEvent = S.decodeUnknownEffect(PacketEvent);
const encodePacketEvent = S.encodeUnknownEffect(PacketEvent);
const encodePacketTraceEntry = S.encodeUnknownEffect(PacketTraceEntry);

// Checked-in files are inlined by Vite at transform time (the suite's
// `test/support/vite-env.d.ts` convention), so the replay needs no filesystem
// service. Keys are paths relative to this file.
const fixtureEventFiles = import.meta.glob<string>(
  [
    "./fixtures/packet-core/forked/ops/events/*.json",
    "./fixtures/packet-core/golden-linear/ops/events/*.json",
    "./fixtures/packet-core/risk-override/ops/events/*.json",
  ],
  { eager: true, import: "default", query: "?raw" }
);
const snapshotFiles = import.meta.glob<string>("./fixtures/canonical-digest-owner/stored-packet-events.jsonl", {
  eager: true,
  import: "default",
  query: "?raw",
});

// Census rows classed legacy: stored digests that do not recompute through the
// owner, keyed by event path. Empty means every stored event digest is RFC
// 8785 on its preimage.
const legacyRows: ReadonlyArray<string> = [];

const baseName = (path: string): string => pipe(Str.split(path, "/"), A.lastNonEmpty);

// `./fixtures/...` as a package relative path.
const withoutRelativePrefix = Str.replace(/^(?:\.{1,2}\/)+/, "");

const globbedFiles = (source: string, files: Record<string, string>): ReadonlyArray<StoredEventFile> =>
  pipe(
    R.toEntries(files),
    A.filter(([path]) => O.isSome(parsePacketEventFileName(baseName(path)))),
    A.map(([path, text]) => ({ source, path: withoutRelativePrefix(path), text })),
    A.sort(Order.mapInput(Order.String, (file: StoredEventFile) => file.path))
  );

const replay = Effect.fnUntraced(function* (file: StoredEventFile) {
  const parts = yield* Effect.fromOption(parsePacketEventFileName(baseName(file.path)));
  const raw = yield* decodeJsonUnknown(file.text);
  const event = yield* decodePacketEvent(upcastPacketEventJson(raw));
  const encoded = yield* encodePacketEvent(event);
  const owner = yield* JsoncFingerprint.hash(encoded);
  const legacy = yield* packetEventDigest(event);
  const rendered = yield* renderPacketEventFile(event);
  return {
    source: file.source,
    path: file.path,
    type: parts.type,
    stored: parts.id,
    owner,
    legacy,
    rendersBack: rendered === file.text,
  };
});

type ReplayRow = Effect.Success<ReturnType<typeof replay>>;

const replayAll = Effect.fnUntraced(function* (files: ReadonlyArray<StoredEventFile>) {
  return yield* Effect.forEach(files, replay);
});

const mismatchPaths = (rows: ReadonlyArray<ReplayRow>): ReadonlyArray<string> =>
  pipe(
    rows,
    A.filter((row) => row.owner !== row.stored),
    A.map((row) => row.path)
  );

const readSnapshot = Effect.gen(function* () {
  const lines = A.flatMap(R.values(snapshotFiles), (text) => A.filter(Str.split(text, "\n"), Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) => decodeStoredEventLine(line));
});

const sourceCount = (rows: ReadonlyArray<ReplayRow>, prefix: string): number =>
  A.length(A.filter(rows, (row) => Str.startsWith(prefix)(row.source)));

it.layer(Digest.layerWebCrypto, { timeout: "60 seconds" })((it) => {
  describe("canonical digest owner: stored packet event replay", () => {
    it.effect("recomputes every stored event digest through the owner", () =>
      Effect.gen(function* () {
        const files = yield* readSnapshot;
        const rows = yield* replayAll(files);

        // 4 events in the tree, 71 at goals-archive@6187b837 and one deleted
        // with its packet in main's history. A changed count means the
        // snapshot was edited.
        expect(sourceCount(rows, "tree@")).toBe(4);
        expect(sourceCount(rows, "goals-archive@")).toBe(71);
        expect(sourceCount(rows, "main-history@")).toBe(1);
        expect(mismatchPaths(rows)).toStrictEqual(legacyRows);
        // The owner and the encoder that wrote the event agree on all of them.
        expect(A.filter(rows, (row) => row.owner !== row.legacy)).toStrictEqual([]);
        // The stored file is the indented renderer's output of the same event,
        // so the renderer is a view: no digest is taken over its bytes.
        expect(A.filter(rows, (row) => !row.rendersBack)).toStrictEqual([]);
        // The snapshot is where parent links and non-genesis bodies come from.
        expect(
          A.dedupe(
            A.sort(
              A.map(rows, (row) => row.type),
              Order.String
            )
          )
        ).toStrictEqual(["packet-created", "risk-tier-overridden", "status-set"]);
      })
    );

    it.effect("recomputes the valid PacketCore fixture streams through the owner", () =>
      Effect.gen(function* () {
        const rows = yield* replayAll(globbedFiles("fixture", fixtureEventFiles));

        expect(A.length(rows)).toBe(13);
        expect(mismatchPaths(rows)).toStrictEqual([]);
        expect(A.filter(rows, (row) => row.owner !== row.legacy)).toStrictEqual([]);
        expect(A.some(rows, (row) => row.type === "stage-entered")).toBe(true);
      })
    );

    // Beyond the stored events: any timeline entry the schema can mint, the
    // value PacketCore's own property test canonicalizes. The encoded form is
    // plain JSON, so the owner emits PacketCore's bytes, except where a
    // free-text field (`actor`, a reason) holds an unpaired surrogate, which
    // PacketCore escapes and the owner refuses.
    it.effect.prop(
      "emits PacketCore's canonical bytes for any trace entry the schema can mint, or refuses an unpaired surrogate",
      [Arbitrary.schema(PacketTraceEntry)],
      Effect.fnUntraced(function* ([entry]) {
        const encoded = yield* encodePacketTraceEntry(entry);
        Result.match(JsoncFingerprint.canonicalizeResult(encoded), {
          onSuccess: (canonical) => expect(canonical).toBe(canonicalJsonText(encoded)),
          onFailure: (failure) => expect(failure.code).toBe("LoneSurrogate"),
        });
      }),
      { arbitrary: fcRuns(50) }
    );
  });
});
