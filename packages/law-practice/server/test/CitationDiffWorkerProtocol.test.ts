import { packCitationDiffSteps, unpackCitationDiffSteps } from "@beep/law-practice-server/internal/Citation/DiffSteps";
import {
  CitationDiffJobLayout,
  CitationDiffWorkerJob,
  CitationDiffWorkerSuccess,
  citationDiffOutputByteCapacity,
  decodeCitationDiffJob,
  decodeCitationDiffReply,
  encodeCitationDiffJob,
  encodeCitationDiffReply,
  preflightCitationDiffJob,
  readCitationDiffFrames,
} from "@beep/law-practice-server/internal/Citation/DiffWorkerProtocol";
import { CitationPythonSliceLayout } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationSpanDiffStep } from "@beep/law-practice-server/internal/Citation/SpanOffsets";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

const native = (length: number) =>
  CitationPythonSliceLayout.make({ width: 1, pythonLength: length, utf16Units: length, byteLength: length });
const prepare = (length: number) => ({
  plan: CitationDiffJobLayout.make({
    before: native(length),
    after: native(length + 1),
    maximumSteps: 10,
    maximumInputUtf16: 1024,
  }),
  job: CitationDiffWorkerJob.make({
    beforeWidth: 1,
    afterWidth: 1,
    beforeBytes: new Uint8Array(length).fill(97),
    afterBytes: new Uint8Array(length + 1).fill(98),
    maximumSteps: 10,
    maximumInputUtf16: 1024,
  }),
});
it.effect("charges exact complete diff request frames across every base64 residue", () =>
  Effect.gen(function* () {
    for (const length of [0, 1, 2, 3, 255]) {
      const { plan, job } = prepare(length);
      const frame = yield* encodeCitationDiffJob(job, plan, 4096);
      const count = yield* preflightCitationDiffJob(plan, frame.byteLength);
      expect(count).toBe(frame.byteLength);
      const decoded = yield* decodeCitationDiffJob(frame.slice(0, -1));
      expect(decoded).toEqual(job);
      const refused = yield* encodeCitationDiffJob(job, plan, frame.byteLength - 1).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
    }
  })
);
it.effect("bounds packed emission by the complete success frame and validates native edit coherence", () =>
  Effect.gen(function* () {
    const expected = [CitationSpanDiffStep.make({ operation: "=", amount: 2 })];
    const packed = yield* packCitationDiffSteps(expected, 4096);
    const reply = CitationDiffWorkerSuccess.make({ steps: packed });
    const frame = yield* encodeCitationDiffReply(reply, 4096);
    const capacity = yield* citationDiffOutputByteCapacity(frame.byteLength);
    expect(capacity).toBeGreaterThanOrEqual(8);
    const decoded = yield* decodeCitationDiffReply(frame.slice(0, -1));
    expect(decoded).toEqual(reply);
    const steps = yield* unpackCitationDiffSteps(packed, 1, 2, 2);
    expect(steps).toEqual(expected);
    const refused = yield* encodeCitationDiffReply(reply, frame.byteLength - 1).pipe(Effect.flip);
    expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
    const mismatch = yield* unpackCitationDiffSteps(packed, 1, 1, 2).pipe(Effect.flip);
    expect(mismatch).toMatchObject({ reason: "invalid-frame" });
    const corrupt = new Uint8Array(packed);
    corrupt[0] = 3;
    const unknown = yield* unpackCitationDiffSteps(corrupt, 1, 2, 2).pipe(Effect.flip);
    expect(unknown).toMatchObject({ reason: "invalid-frame" });
  })
);
it.effect("rejects malformed structure and invalid UTF-8 before variable message decoding", () =>
  Effect.gen(function* () {
    const encoder = new TextEncoder();
    for (const text of ["[]", '{"x":{"y":{"z":{}}}}', '{"_tag":"Diff","version":"wrong"}', '{"x":"unterminated']) {
      const refused = yield* decodeCitationDiffJob(encoder.encode(text)).pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "invalid-frame" });
    }
    const invalidUtf8 = yield* decodeCitationDiffJob(new Uint8Array([255])).pipe(Effect.flip);
    expect(invalidUtf8).toMatchObject({ reason: "invalid-frame" });
  })
);
it.effect("uses bounded fragmented framing and rejects excess bytes before delivering a job", () =>
  Effect.gen(function* () {
    const { job, plan } = prepare(3);
    const frame = yield* encodeCitationDiffJob(job, plan, 4096);
    let seen = 0;
    const receive = Effect.fnUntraced(function* (body: Uint8Array) {
      yield* decodeCitationDiffJob(body);
      seen++;
    });
    yield* readCitationDiffFrames(
      Stream.fromIterable(A.map(A.fromIterable(frame), (byte) => new Uint8Array([byte]))),
      frame.byteLength,
      1,
      receive
    );
    expect(seen).toBe(1);
    seen = 0;
    const refused = yield* readCitationDiffFrames(Stream.make(frame), frame.byteLength - 1, 1, receive).pipe(
      Effect.flip
    );
    expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
    expect(seen).toBe(0);
    const extra = yield* readCitationDiffFrames(
      Stream.make(Bytes.concat([frame, new Uint8Array([10])])),
      4096,
      1,
      receive
    ).pipe(Effect.flip);
    expect(extra).toMatchObject({ reason: "invalid-frame" });
  })
);
