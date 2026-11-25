import { NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const noticeIdentifier = "@beep/law-practice-use-cases/DailyNotice/DailyNotice.schemas/NoticeMessage";

describe("NoticeMessage", () => {
  it("carries only a string subject and body, and no scoped field", () => {
    const document = NoticeMessage.pipe(S.toEncoded, S.toJsonSchemaDocument);
    const definition = document.definitions[noticeIdentifier];
    expect(R.keys(document.definitions)).toEqual([noticeIdentifier]);
    expect(R.keys(NoticeMessage.fields)).toEqual(["subject", "body"]);
    expect(definition).toMatchObject({
      type: "object",
      properties: { subject: { type: "string" }, body: { type: "string" } },
      required: ["subject", "body"],
    });
    expect(R.keys(definition?.properties ?? {})).toEqual(["subject", "body"]);
  });
});
