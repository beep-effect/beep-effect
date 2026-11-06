import { OutlookItemRef, OutlookItemRefFromInput } from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// Synthetic ids: the base64 body carries `+`, `/` and `=` so every escape path runs.
const decode = S.decodeEffect(OutlookItemRefFromInput);
const encode = S.encodeEffect(OutlookItemRefFromInput);
const refuses = (input: string) => Effect.flip(decode(input)).pipe(Effect.map((error) => error._tag));

describe("OutlookItemRefFromInput", () => {
  it.effect(
    "decodes a new-Outlook conversation link and maps the id to the REST alphabet",
    Effect.fnUntraced(function* () {
      const ref = yield* decode("https://outlook.cloud.microsoft/mail/inbox/id/AAQkAGI2%2BQx%2FZz%3D%3D");
      deepStrictEqual(ref, OutlookItemRef.cases.conversation.make({ id: "AAQkAGI2_Qx-Zz==" }));
    })
  );

  it.effect(
    "decodes a message link without a folder segment",
    Effect.fnUntraced(function* () {
      const ref = yield* decode("https://outlook.office.com/mail/id/AAMkAGI2%2Fmsg%3D");
      deepStrictEqual(ref, OutlookItemRef.cases.message.make({ id: "AAMkAGI2-msg=" }));
    })
  );

  it.effect(
    "reads the classic ItemID query without turning + into a space",
    Effect.fnUntraced(function* () {
      const ref = yield* decode(
        "https://outlook.office365.com/owa/?ItemID=AAMkAGI2+raw%2Bencoded%3D&exvsurl=1&viewmodel=ReadMessageItem"
      );
      deepStrictEqual(ref, OutlookItemRef.cases.message.make({ id: "AAMkAGI2_raw_encoded=" }));
    })
  );

  it.effect(
    "accepts a bare id, percent-encoded or not, with surrounding whitespace",
    Effect.fnUntraced(function* () {
      strictEqual((yield* decode("  AAQkAGI2%2FConv%3D ")).id, "AAQkAGI2-Conv=");
      strictEqual((yield* decode("AAQkAGI2/Conv="))._tag, "conversation");
      strictEqual((yield* decode("ZZZ-not-a-known-prefix"))._tag, "message");
    })
  );

  it.effect(
    "takes the kind from a message:/conversation: prefix and gets every reference back from its encoding",
    Effect.fnUntraced(function* () {
      const shaped = OutlookItemRef.cases.message.make({ id: "AAQkMsgShaped" });
      const decoded = yield* decode("message:AAQkMsgShaped");
      deepStrictEqual(decoded, shaped);
      const decoded1 = yield* decode("conversation: AAMkAGI2%2Fx ");
      deepStrictEqual(decoded1, OutlookItemRef.cases.conversation.make({ id: "AAMkAGI2-x" }));
      const encoded2 = yield* encode(shaped);
      strictEqual(encoded2, "message:AAQkMsgShaped");
      const encoded5 = yield* encode(shaped);
      const decoded3 = yield* decode(encoded5);
      deepStrictEqual(decoded3, shaped);
      const conversation = OutlookItemRef.cases.conversation.make({ id: "AAQkAGI2" });
      const encoded6 = yield* encode(conversation);
      const decoded4 = yield* decode(encoded6);
      deepStrictEqual(decoded4, conversation);
    })
  );

  it.effect(
    "refuses other hosts, links without an id, bad escapes and non-id text",
    Effect.fnUntraced(function* () {
      const tags = yield* Effect.forEach(
        [
          "https://mail.example.test/mail/id/AAMk1",
          "https://outlook.cloud.microsoft/mail/inbox",
          "AAMk%E0%A4%A",
          "two words",
          "",
          "message:",
          "ticket:AAMk1",
        ],
        refuses
      );
      deepStrictEqual(
        tags,
        A.makeBy(7, () => "SchemaError")
      );
    })
  );
});
