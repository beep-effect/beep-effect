/**
 * The command failure: what each pass failure becomes, and its exit code.
 */

import { BoxError } from "@beep/box";
import { MailTaggingPortError, MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";
import { M365Error } from "@beep/m365";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import {
  PracticeMailTaggingError,
  PracticeMailTaggingFailureKind,
  practiceMailTaggingExitCode,
} from "@/PracticeMailTagging.errors";

describe("PracticeMailTaggingError", () => {
  it("summarizes a port failure and marks only a rate limit as throttled", () => {
    const failed = PracticeMailTaggingError.fromPass(
      MailTaggingPortError.during("DocumentStore", "upload", "HTTP 503", "provider body that must not be kept")
    );
    const throttled = PracticeMailTaggingError.fromPass(
      MailTaggingPortError.throttled("DocumentStore", "upload", "HTTP 429")
    );

    expect(failed.kind).toBe("failed");
    expect(failed.source).toBe("MailTaggingPortError");
    expect(failed.message).toBe("DocumentStore.upload: HTTP 503");
    expect(failed[Runtime.errorExitCode]).toBe(1);
    expect(throttled.kind).toBe("throttled");
  });

  it("summarizes a state failure with its store and file", () => {
    const error = PracticeMailTaggingError.fromPass(
      MailTaggingStateError.make({
        store: "matter-folders",
        failure: "unavailable",
        file: "/private/matter-folders.json",
        line: O.none(),
        message: "file is missing",
      })
    );

    expect(error.kind).toBe("failed");
    expect(error.message).toBe("matter-folders unavailable at /private/matter-folders.json: file is missing");
  });

  it("summarizes driver failures by reason only", () => {
    const throttled = PracticeMailTaggingError.fromPass(
      M365Error.fromReason("throttled", { url: "https://graph.example.test/me" })
    );
    const auth = PracticeMailTaggingError.fromPass(M365Error.fromReason("auth"));
    const box = PracticeMailTaggingError.fromPass(BoxError.fromReason("config"));

    expect(throttled.kind).toBe("throttled");
    expect(throttled.message).toBe("Microsoft 365 driver: throttled");
    expect(auth.kind).toBe("failed");
    expect(box.kind).toBe("failed");
    expect(box.message).toBe("Box driver: config");
  });

  it.effect("names the missing setting of a failed settings read", () =>
    Effect.gen(function* () {
      const configError = yield* Effect.flip(
        Config.NonEmptyString("PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH").parse(ConfigProvider.fromUnknown({}))
      );
      const error = PracticeMailTaggingError.fromConfig(configError);

      expect(error.kind).toBe("failed");
      expect(error.source).toBe("ConfigError");
      expect(error.message).toContain("PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH");
    })
  );

  it("maps each failure kind to its documented exit code", () => {
    expect(practiceMailTaggingExitCode("failed")).toBe(1);
    expect(practiceMailTaggingExitCode("refused")).toBe(2);
    expect(practiceMailTaggingExitCode("throttled")).toBe(3);
    expect(PracticeMailTaggingError.refused("apply needs --yes").source).toBe("Confirmation");
  });

  it("decodes every generated failure kind to itself", () => {
    assertSchemaArbitraryDecodesToSelf(PracticeMailTaggingFailureKind, { runs: 10 });
  });
});
