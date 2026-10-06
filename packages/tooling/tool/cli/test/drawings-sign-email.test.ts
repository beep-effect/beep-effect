import { GraphMessageAuthoredText, M365 } from "@beep/m365";
import { MailReaderFromM365 } from "@beep/repo-cli/commands/Drawings";
import { approvalStatement, EmailAddress, MailReader, Sha256Hex, verifyConfirmation } from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import * as S from "effect/Schema";

const sheetSet = Sha256Hex.make("8d5be0c406afacf451f01d2343597810bc62dfee8f0f95bf001bf057bb894029");

// Recorded reply shape: Graph v1.0 message, $select'd fields, text preference.
const recordedReply = {
  "@odata.etag": 'W/"CQAAABYAAAA"',
  id: "AAMkAGI2",
  internetMessageId: "<CAF=reply@mail.example.com>",
  receivedDateTime: "2026-10-06T12:00:00Z",
  from: { emailAddress: { name: "Attorney", address: "Attorney@Example.com" } },
  sender: { emailAddress: { name: "Attorney", address: "attorney@example.com" } },
  uniqueBody: {
    contentType: "text",
    content: `Reviewed all eight sheets.\r\n${approvalStatement(sheetSet)}\r\n\r\nThanks,\r\nA.\r\n`,
  },
};

const unused = Effect.fnUntraced(function* () {
  return yield* Effect.die("not used by drawings sign");
});

const FakeM365 = Layer.effect(
  M365,
  Effect.gen(function* () {
    const message = yield* S.decodeUnknownEffect(GraphMessageAuthoredText)(recordedReply);
    return M365.of({
      createEvent: unused,
      createMasterCategory: unused,
      deleteEvent: unused,
      deltaDriveItems: unused,
      downloadDriveItemContent: unused,
      downloadMessageAttachment: unused,
      ensureMasterCategories: unused,
      findEventsByIdempotencyKey: unused,
      getEvent: unused,
      getListItem: unused,
      getMessage: unused,
      getMessageAuthoredText: Effect.fnUntraced(function* () {
        return message;
      }),
      getSite: unused,
      listDriveItemVersions: unused,
      listDrives: unused,
      listEvents: unused,
      listMasterCategories: unused,
      listMessageAttachments: unused,
      listMessages: unused,
      listSites: unused,
      updateEvent: unused,
      updateMessageCategories: unused,
    });
  })
);

describe("beep drawings sign email", () => {
  it.layer(MailReaderFromM365.pipe(Layer.provide(FakeM365)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "a recorded attorney reply decodes to a non-empty text uniqueBody and approves the sheet set",
      Effect.fnUntraced(function* () {
        const mail = yield* MailReader;
        const confirmation = yield* mail.authoredText("AAMkAGI2");
        expect(confirmation.authoredText.length).toBeGreaterThan(0);
        // addresses are normalised, so a capitalised `from` still matches
        expect(confirmation.from).toBe("attorney@example.com");
        const checked = verifyConfirmation({
          sheetSetSha256: sheetSet,
          approver: EmailAddress.make("attorney@example.com"),
          confirmation,
        });
        expect(Result.isSuccess(checked)).toBe(true);
      })
    );
  });
});
