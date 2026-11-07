import {
  CitationXmlWorkerJob,
  CitationXmlWorkerReply,
  decodeCitationXmlJob,
  decodeCitationXmlReply,
  encodeCitationXmlJob,
  encodeCitationXmlReply,
  preflightCitationXmlJob,
  readCitationXmlFrames,
} from "@beep/law-practice-server/internal/Citation/XmlWorkerProtocol";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

it.effect("preflights XML input before base64 and preserves exact complete-frame sizes", () =>
  Effect.gen(function* () {
    for (const size of [0, 1, 2, 3, 4, 255]) {
      const job = CitationXmlWorkerJob.make({ width: 1, bytes: new Uint8Array(size).fill(65) });
      const count = yield* preflightCitationXmlJob(job.width, size, 4096);
      const frame = yield* encodeCitationXmlJob(job, count);
      expect(frame.byteLength).toBe(count);
      const restored = yield* decodeCitationXmlJob(frame.subarray(0, frame.byteLength - 1));
      expect(restored).toEqual(job);
      const refused = yield* encodeCitationXmlJob(job, count - 1).pipe(Effect.flip);
      expect(refused).toMatchObject({ operation: "annotate", limit: "processMessageBytes" });
    }
  })
);
it.effect("keeps false distinct from missing success and rejects malformed or excess messages", () =>
  Effect.gen(function* () {
    const replies = [
      CitationXmlWorkerReply.cases.Success.make({ balanced: false }),
      CitationXmlWorkerReply.cases.Success.make({ balanced: true }),
      CitationXmlWorkerReply.cases.Failure.make({
        failure: CitationSafetyLimitExceeded.make({ operation: "annotate", limit: "sourceUtf16" }),
      }),
    ];
    for (const reply of replies) {
      const encoded = yield* encodeCitationXmlReply(reply, 4096);
      const exact = yield* encodeCitationXmlReply(reply, encoded.byteLength);
      const decoded = yield* decodeCitationXmlReply(exact.subarray(0, exact.byteLength - 1));
      expect(decoded).toEqual(reply);
      const refusal = yield* encodeCitationXmlReply(reply, encoded.byteLength - 1).pipe(Effect.flip);
      expect(refusal).toMatchObject({ limit: "processMessageBytes" });
    }
    const body = new TextEncoder().encode(
      '{"_tag":"Balance","version":"citation-xml-worker/v1","width":1,"bytes":"AAA$"}'
    );
    const invalid = yield* decodeCitationXmlJob(body).pipe(Effect.flip);
    expect(invalid).toMatchObject({ reason: "invalid-frame" });
    const frame = yield* encodeCitationXmlJob(CitationXmlWorkerJob.make({ width: 1, bytes: new Uint8Array() }), 4096);
    const extra = yield* readCitationXmlFrames(Stream.make(frame, frame), 4096, 1, () => Effect.void).pipe(Effect.flip);
    expect(extra).toMatchObject({ reason: "invalid-frame" });
  })
);
