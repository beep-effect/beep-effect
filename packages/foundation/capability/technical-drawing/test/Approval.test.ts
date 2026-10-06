import {
  approvalStatement,
  authoredLines,
  EmailAddress,
  EmailConfirmation,
  PdfConfirmation,
  Sha256Hex,
  verifyConfirmation,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect, Result } from "effect";

const hash = Sha256Hex.make("1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988");
const other = Sha256Hex.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const statement = approvalStatement(hash);
const address = (value: string) => EmailAddress.make(value);
const approver = address("attorney@example.com");

const reply = (authoredText: string, from = "attorney@example.com", sender = from) =>
  EmailConfirmation.make({
    internetMessageId: "<reply@example.com>",
    from: address(from),
    sender: address(sender),
    receivedAt: "2026-10-06T12:00:00Z",
    authoredText,
  });

const page = (pageText: string, deliveredBy = "attorney@example.com") =>
  PdfConfirmation.make({
    path: "/corpus/matter/approval.pdf",
    initialedPage: 2,
    pageText,
    deliveredBy: address(deliveredBy),
    attestedBy: "operator",
  });

const reasonOf = (confirmation: Parameters<typeof verifyConfirmation>[0]["confirmation"], sheetSet = hash) =>
  Result.match(verifyConfirmation({ sheetSetSha256: sheetSet, approver, confirmation }), {
    onFailure: (reason) => reason,
    onSuccess: () => "approved",
  });

describe("@beep/technical-drawing approval", () => {
  it.effect(
    "approves a reply whose authored text carries the statement on its own line",
    Effect.fnUntraced(function* () {
      expect(reasonOf(reply(`Thanks, these look right.\n\n${statement}\n\nBest,\nA.\n`))).toBe("approved");
      // trailing whitespace and CRLF are tolerated; nothing else is
      expect(reasonOf(reply(`${statement}  \r\n`))).toBe("approved");
    })
  );

  it.effect(
    "refuses an artifact without the sheet-set hash, or with another set's statement",
    Effect.fnUntraced(function* () {
      expect(reasonOf(reply("Looks good to me.\n"))).toBe("statement-missing");
      expect(reasonOf(reply(`${approvalStatement(other)}\n`))).toBe("statement-missing");
    })
  );

  it.effect(
    "refuses a rejection or a question that quotes the hash without the verbatim line",
    Effect.fnUntraced(function* () {
      expect(reasonOf(reply(`I do not approve design-figure sheet set ${hash} for filing.\n`))).toBe(
        "statement-missing"
      );
      expect(reasonOf(reply(`Should I write "${statement}"?\n`))).toBe("statement-missing");
      expect(reasonOf(reply(`  ${statement}\n`))).toBe("statement-missing");
    })
  );

  it.effect(
    "refuses a reply or plain forward where the statement appears only below the boundary",
    Effect.fnUntraced(function* () {
      const rejection = `No, FIG. 3 is wrong.\n\nOn Mon, Oct 6, 2026 at 9:00 AM Developer wrote:\n> Please reply with:\n> ${statement}\n`;
      expect(reasonOf(reply(rejection))).toBe("statement-only-quoted");
      const forward = `---------- Forwarded message ---------\nFrom: Developer <dev@example.com>\nPlease reply with:\n${statement}\n`;
      expect(reasonOf(reply(forward))).toBe("statement-only-quoted");
      const outlook = `See below.\n\n________________________________\nFrom: Developer\n${statement}\n`;
      expect(reasonOf(reply(outlook))).toBe("statement-only-quoted");
      expect(authoredLines(rejection)).toEqual(["No, FIG. 3 is wrong.", ""]);
    })
  );

  it.effect(
    "refuses a reply whose from or sender is not the recorded approver",
    Effect.fnUntraced(function* () {
      expect(reasonOf(reply(`${statement}\n`, "someone@example.com"))).toBe("sender-mismatch");
      expect(reasonOf(reply(`${statement}\n`, "attorney@example.com", "assistant@example.com"))).toBe(
        "sender-mismatch"
      );
    })
  );

  it.effect(
    "accepts a PDF only when the initialed page carries the statement and the approver delivered it",
    Effect.fnUntraced(function* () {
      expect(reasonOf(page(`Sheet set review\n${statement}\nInitials: AB\n`))).toBe("approved");
      // the request page reprints the statement; the initialed page does not
      expect(reasonOf(page("Initials: AB\nFIG. 1-8 reviewed.\n"))).toBe("statement-missing");
      expect(reasonOf(page(`${statement}\n`, "assistant@example.com"))).toBe("delivery-mismatch");
    })
  );
});
