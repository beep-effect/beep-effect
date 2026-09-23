import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  CategoryEnum,
  ConversationProcessingState,
  ConversationSource,
  ConversationStatus,
  ConversationVisibility,
  ExternalIntegrationConversationSource,
  PostProcessingModel,
  PostProcessingStatus,
} from "../../beep/ConversationEnums.ts";

const decodeConversationSource = S.decodeUnknownEffect(ConversationSource);

const decode = <A>(schema: S.Codec<A>, input: unknown): A => Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("ConversationEnums", () => {
  it("decodes frozen wire values", () => {
    expect(decode(CategoryEnum, "romantic")).toBe("romantic");
    expect(decode(ExternalIntegrationConversationSource, "audio_transcript")).toBe("audio_transcript");
    expect(decode(ExternalIntegrationConversationSource, "other_text")).toBe("other_text");
    expect(decode(PostProcessingStatus, "canceled")).toBe("canceled");
    expect(decode(ConversationStatus, "completed")).toBe("completed");
    expect(decode(ConversationVisibility, "private")).toBe("private");
    expect(decode(PostProcessingModel, "prerecorded")).toBe("prerecorded");
    expect(decode(ConversationProcessingState, "none")).toBe("none");
    expect(decode(ConversationProcessingState, "local_pending")).toBe("local_pending");
  });

  it("collapses unknown conversation sources and rejects non-strings", () => {
    expect(decode(ConversationSource, "pendant")).toBe("unknown");
    expect(decode(ConversationSource, "omi")).toBe("omi");
    expect(Effect.runSyncExit(decodeConversationSource(1))._tag).toBe("Failure");
  });

  it("derives arbitraries", () => {
    for (const schema of [
      CategoryEnum,
      ConversationSource,
      ConversationVisibility,
      PostProcessingStatus,
      ConversationStatus,
      PostProcessingModel,
      ExternalIntegrationConversationSource,
      ConversationProcessingState,
    ]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});
