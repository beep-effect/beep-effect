import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CreatePerson,
  FcmTokenResponse,
  Person,
  SaveFcmTokenRequest,
  SendAppNotificationRequest,
  SendNotificationRequest,
  SyncUserTimeZoneRequest,
  TimeZoneRejected,
  UploadProfile,
  VoiceReadiness,
  decodePerson,
  deserializeManySafe,
  validateTimeZone,
  voiceReadiness,
} from "../../beep/Other.ts";

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const rejectedReason = (exit: Exit.Exit<string, TimeZoneRejected>): string =>
  Exit.match(exit, {
    onFailure: (cause) => cause.pipe(Cause.findErrorOption, O.map((error) => error.reason), O.getOrElse(() => "no-fail")),
    onSuccess: () => "success",
  });

const personInput = {
  id: "p1",
  name: "Ada",
  createdAt: "2020-01-02T03:04:05.000Z",
  updatedAt: "2020-01-02T03:04:05.000Z",
  speechSamples: ["s1"],
  speechSampleTranscripts: ["hello"],
  speechSamplesVersion: 3,
  voiceReadiness: "ready",
};

describe("Other", () => {
  it("decodes the simple request and response models", () => {
    const token = decode(SaveFcmTokenRequest, { fcmToken: "t", timeZone: "Nowhere/Invalid" });
    assert.strictEqual(token.timeZone, "Nowhere/Invalid");
    assert.strictEqual(decode(FcmTokenResponse, { status: "ok" }).status, "ok");
    const send = decode(SendNotificationRequest, { uid: "u1", title: "T", body: "B", data: { k: "v" } });
    assert.deepStrictEqual(send.data, { k: "v" });
    assert.deepStrictEqual(SendNotificationRequest.make({ uid: "u1", title: "T", body: "B" }).data, {});
    assert.strictEqual(decodeFails(SendNotificationRequest, { uid: "u1", title: "T", body: "B", data: [] }), true);
    const app = decode(SendAppNotificationRequest, { aid: "a1", message: "hi", uid: "u1" });
    assert.strictEqual(app.aid, "a1");
    const profile = decode(UploadProfile, { bytes: [[1, 2], [3]], duration: 4 });
    assert.deepStrictEqual(profile.bytes, [[1, 2], [3]]);
    assert.strictEqual(decodeFails(UploadProfile, { bytes: [[1.5]], duration: 4 }), true);
  });

  it("bounds CreatePerson.name to 2 through 40 characters", () => {
    assert.strictEqual(decode(CreatePerson, { name: "Al" }).name, "Al");
    assert.strictEqual(decodeFails(CreatePerson, { name: "A" }), true);
    assert.strictEqual(decodeFails(CreatePerson, { name: "x".repeat(41) }), true);
  });

  it("validateTimeZone strips, rejects empty, and rejects unknown zones", () => {
    assert.strictEqual(Effect.runSync(validateTimeZone("  Europe/Berlin ")), "Europe/Berlin");
    assert.strictEqual(validateTimeZone("   ").pipe(Effect.runSyncExit, rejectedReason), "time_zone must be a non-empty IANA timezone");
    assert.strictEqual(
      validateTimeZone("Mars/Olympus").pipe(Effect.runSyncExit, rejectedReason),
      "time_zone must be a valid IANA timezone",
    );
  });

  it("SyncUserTimeZoneRequest applies the same rule on decode", () => {
    assert.strictEqual(decode(SyncUserTimeZoneRequest, { timeZone: " America/New_York " }).timeZone, "America/New_York");
    assert.strictEqual(decodeFails(SyncUserTimeZoneRequest, { timeZone: "" }), true);
    assert.strictEqual(decodeFails(SyncUserTimeZoneRequest, { timeZone: "Mars/Olympus" }), true);
  });

  it("decodes every VoiceReadiness member", () => {
    for (const member of ["ready", "saved_sample_awaiting_embedding", "not_learned", "unknown"]) {
      assert.strictEqual(decode(VoiceReadiness, member), member);
    }
    assert.strictEqual(decodeFails(VoiceReadiness, "learned"), true);
  });

  it("voiceReadiness follows every Python branch", () => {
    assert.strictEqual(voiceReadiness("nope"), "unknown");
    assert.strictEqual(voiceReadiness({}), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: null }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: "s1" }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: [] }), "not_learned");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"] }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 2 }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: true }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3.5 }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3 }), "saved_sample_awaiting_embedding");
    assert.strictEqual(
      voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: null }),
      "saved_sample_awaiting_embedding",
    );
    assert.strictEqual(
      voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [] }),
      "saved_sample_awaiting_embedding",
    );
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: "v" }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [0, 0] }), "unknown");
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [1, true] }), "unknown");
    assert.strictEqual(
      voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [1, Number.POSITIVE_INFINITY] }),
      "unknown",
    );
    assert.strictEqual(voiceReadiness({ speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [0.2, -1] }), "ready");
    assert.strictEqual(voiceReadiness({ speechSamples: ["s1"], speechSamplesVersion: 4, speakerEmbedding: [1] }), "ready");
  });

  it("decodes Person with present, null, and missing Option fields", () => {
    const present = decode(Person, personInput);
    assert.strictEqual(present.createdAt.pipe(O.getOrThrow, DateTime.formatIso), "2020-01-02T03:04:05.000Z");
    assert.deepStrictEqual(O.getOrNull(present.speechSampleTranscripts), ["hello"]);
    assert.strictEqual(present.voiceReadiness, "ready");
    const nulls = decode(Person, { ...personInput, createdAt: null, updatedAt: null, speechSampleTranscripts: null });
    assert.strictEqual(O.isNone(nulls.createdAt), true);
    assert.strictEqual(O.isNone(nulls.speechSampleTranscripts), true);
    const { createdAt: _c, updatedAt: _u, speechSampleTranscripts: _t, ...rest } = personInput;
    const missing = decode(Person, rest);
    assert.strictEqual(O.isNone(missing.updatedAt), true);
    const encoded = Effect.runSync(S.encodeEffect(Person)(missing));
    assert.strictEqual(encoded.createdAt, null);
    assert.strictEqual(encoded.updatedAt, null);
    assert.strictEqual(encoded.speechSampleTranscripts, null);
    const made = Person.make({ id: "p2", name: "Bo" });
    assert.deepStrictEqual(made.speechSamples, []);
    assert.strictEqual(made.speechSamplesVersion, 3);
    assert.strictEqual(made.voiceReadiness, "unknown");
  });

  it("decodePerson derives voice readiness from snake_case stored records", () => {
    const derived = Effect.runSync(
      decodePerson({ id: "p1", name: "Ada", speech_samples: ["s1"], speech_samples_version: 3, speaker_embedding: [0.5] }),
    );
    assert.strictEqual(derived.voiceReadiness, "ready");
    assert.deepStrictEqual(derived.speechSamples, ["s1"]);
    const legacy = Effect.runSync(decodePerson({ id: "p1", name: "Ada", created_at: "2020-01-02T03:04:05.000Z" }));
    assert.strictEqual(legacy.voiceReadiness, "unknown");
    assert.strictEqual(legacy.speechSamplesVersion, 3);
    assert.strictEqual(legacy.createdAt.pipe(O.getOrThrow, DateTime.formatIso), "2020-01-02T03:04:05.000Z");
    const claimedKept = Effect.runSync(decodePerson({ id: "p1", name: "Ada", voice_readiness: "ready", speech_samples: [] }));
    assert.strictEqual(claimedKept.voiceReadiness, "ready");
    const claimedRecomputed = Effect.runSync(
      decodePerson({ id: "p1", name: "Ada", voice_readiness: "ready", speech_samples: [], speaker_embedding: [1] }),
    );
    assert.strictEqual(claimedRecomputed.voiceReadiness, "not_learned");
    const invalidClaim = Effect.runSync(decodePerson({ id: "p1", name: "Ada", voice_readiness: "bogus", speech_samples: [] }));
    assert.strictEqual(invalidClaim.voiceReadiness, "not_learned");
    assert.strictEqual(Effect.runSyncExit(decodePerson({ id: "p1" }))._tag, "Failure");
    assert.strictEqual(Effect.runSyncExit(decodePerson("nope"))._tag, "Failure");
  });

  it("deserializeManySafe skips bad records and reports them", () => {
    const skipped: Array<unknown> = [];
    const people = Effect.runSync(
      deserializeManySafe(
        [{ id: "p1", name: "Ada" }, { id: "p2" }, "junk", { id: "p3", name: "Cy", speech_samples: [] }],
        (record) => {
          skipped.push(record);
        },
      ),
    );
    assert.deepStrictEqual(
      people.map((person) => person.id),
      ["p1", "p3"],
    );
    assert.strictEqual(people[1]?.voiceReadiness, "not_learned");
    assert.deepStrictEqual(skipped, [{ id: "p2" }, "junk"]);
    const silent = Effect.runSync(deserializeManySafe([{ id: "p2" }]));
    assert.deepStrictEqual(silent, []);
  });

  it("derives arbitraries", () => {
    for (const schema of [
      SaveFcmTokenRequest,
      SyncUserTimeZoneRequest,
      FcmTokenResponse,
      SendNotificationRequest,
      SendAppNotificationRequest,
      UploadProfile,
      CreatePerson,
      Person,
      VoiceReadiness,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });
});
