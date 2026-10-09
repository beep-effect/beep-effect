import { RedactedCause, redactCause, redactString, sanitizeSensitiveText } from "@beep/observability/CauseRedaction";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const canary = () => A.join(["canary", "Alpha", "4927", "Beta"], "");
const encode = S.encodeEffect(S.fromJsonString(RedactedCause));

describe("CauseRedaction canonical bank compatibility", () => {
  it("preserves rendering while covering the assignment and header unions", () => {
    for (const name of ["TOKEN", "2-session-id", "pass", "passwd"]) {
      const input = `${name} : ${canary()},suffix`;
      expect(sanitizeSensitiveText(input) === `${name} : [REDACTED]`).toBe(true);
      expect(redactString(input, 2048) === `${name} : [REDACTED]`).toBe(true);
    }
    for (const header of ["Authorization", "Proxy-Authorization", "Cookie", "Set-Cookie"]) {
      expect(sanitizeSensitiveText(`${header}: ${canary()}`) === `${header}: [REDACTED]`).toBe(true);
    }
    expect(sanitizeSensitiveText("  public\t text  ")).toBe("public text");
  });
  it.effect("leaves no exact canary in rendered error, cause, detail or fingerprint", () =>
    Effect.gen(function* () {
      const safe = redactCause(Cause.fail(new Error(`TOKEN=${canary()}`)));
      expect(Str.includes(canary())(safe.message)).toBe(false);
      expect(Str.includes(canary())(safe.fingerprint)).toBe(false);
      expect(O.match(safe.detail, { onNone: () => true, onSome: (detail) => !Str.includes(canary())(detail) })).toBe(
        true
      );
      expect(Str.includes(canary())(yield* encode(safe))).toBe(false);
    })
  );
});
