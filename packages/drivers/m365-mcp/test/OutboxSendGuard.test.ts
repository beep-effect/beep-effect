import { GraphEmailAddress, GraphMessage, GraphRecipient } from "@beep/m365";
import {
  checkSendExpectation,
  OutboxAttachmentDigest,
  OutboxSendCheck,
  OutboxSendExpectation,
  sameAttachments,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { digestOf, recipients } from "./OutboxWorld.fixture.ts";
import type { OutboxSendMismatch, OutboxSendMismatchField } from "@beep/m365-mcp";

const Local = S.Literals(["ada", "ben", "cy", "dee"]);
const Addresses = S.Array(Local).check(S.isMaxLength(4));

// Few names, sizes and digests on purpose: duplicates must be counted, not collapsed.
const GuardCase = S.Struct({
  bcc: Addresses,
  cc: Addresses,
  files: S.Array(
    S.Struct({
      name: S.Literals(["one.pdf", "two.pdf", "notes.txt"]),
      seed: S.Literals([1, 2, 3]),
      size: S.Literals([16, 32]),
    })
  ).check(S.isMaxLength(5)),
  subject: S.String,
  to: Addresses,
});
type GuardCase = typeof GuardCase.Type;

const address = (local: string): string => `${local}@example.test`;
const addresses = A.map(address);

const worldOf = (input: GuardCase) => {
  const stored = A.map(input.files, (file) =>
    OutboxAttachmentDigest.make({ name: file.name, sha256: digestOf(file.seed), size: file.size })
  );
  // The draft as Graph might store it: other letter case, other order, padded subject.
  const draft = GraphMessage.make({
    bccRecipients: O.some(recipients(A.reverse(A.map(addresses(input.bcc), Str.toUpperCase)))),
    ccRecipients: O.some(recipients(A.reverse(addresses(input.cc)))),
    id: "draft-1",
    isDraft: O.some(true),
    subject: O.some(`  ${input.subject} `),
    toRecipients: O.some(recipients(A.map(addresses(input.to), (value) => ` ${value}`))),
  });
  // What a caller restates after get_draft: another order, one address repeated.
  const expect = OutboxSendExpectation.make({
    attachments: A.reverse(stored),
    bcc: addresses(input.bcc),
    cc: addresses(input.cc),
    subject: input.subject,
    to: [...addresses(input.to), ...A.take(addresses(input.to), 1)],
  });
  return { draft, expect, stored };
};

type World = ReturnType<typeof worldOf>;

const check = (world: World, patch: Partial<World> = {}) =>
  checkSendExpectation(OutboxSendCheck.make({ ...world, ...patch }));

const fieldsOf = (mismatch: O.Option<OutboxSendMismatch>): ReadonlyArray<OutboxSendMismatchField> =>
  pipe(
    mismatch,
    O.map((found): ReadonlyArray<OutboxSendMismatchField> => found.fields),
    O.getOrElse((): ReadonlyArray<OutboxSendMismatchField> => [])
  );

const withExpect = (world: World, patch: Partial<OutboxSendExpectation>): Partial<World> => ({
  expect: OutboxSendExpectation.make({ ...world.expect, ...patch }),
});

const otherDigest = (attachment: OutboxAttachmentDigest): OutboxAttachmentDigest =>
  OutboxAttachmentDigest.make({
    name: attachment.name,
    sha256: attachment.sha256 === digestOf(9) ? digestOf(8) : digestOf(9),
    size: attachment.size,
  });

const only = (field: OutboxSendMismatchField) => (): ReadonlyArray<OutboxSendMismatchField> => [field];

const options = { arbitrary: fcRuns(200) };

describe("@beep/m365-mcp outbox send guard", () => {
  it.prop(
    "accepts a faithful restatement regardless of attachment order, address case, order, repeats or subject padding",
    [Arbitrary.schema(GuardCase)],
    ([input]) => {
      const world = worldOf(input);

      assertNone(check(world));
      assert.isTrue(sameAttachments(world.stored, world.expect.attachments));
    },
    options
  );

  it.prop(
    "names exactly the field that was perturbed",
    [Arbitrary.schema(GuardCase)],
    ([input]) => {
      const world = worldOf(input);
      const extra = "zed@example.test";
      const extraFile = OutboxAttachmentDigest.make({ name: "extra.pdf", sha256: digestOf(4), size: 64 });

      assert.deepStrictEqual(fieldsOf(check(world, withExpect(world, { to: [...world.expect.to, extra] }))), ["to"]);
      assert.deepStrictEqual(fieldsOf(check(world, withExpect(world, { cc: [...world.expect.cc, extra] }))), ["cc"]);
      assert.deepStrictEqual(fieldsOf(check(world, withExpect(world, { bcc: [...world.expect.bcc, extra] }))), ["bcc"]);
      assert.deepStrictEqual(fieldsOf(check(world, withExpect(world, { subject: `${world.expect.subject}!` }))), [
        "subject",
      ]);
      // An attachment the caller did not restate, and one the draft does not hold.
      assert.deepStrictEqual(fieldsOf(check(world, { stored: [...world.stored, extraFile] })), ["attachments"]);
      assert.deepStrictEqual(
        fieldsOf(check(world, withExpect(world, { attachments: [...world.expect.attachments, extraFile] }))),
        ["attachments"]
      );
      assert.deepStrictEqual(
        fieldsOf(check(world, { draft: GraphMessage.make({ ...world.draft, isDraft: O.some(false) }) })),
        ["not-a-draft"]
      );
      assert.deepStrictEqual(
        fieldsOf(check(world, { draft: GraphMessage.make({ ...world.draft, isDraft: O.none() }) })),
        ["not-a-draft"]
      );
    },
    options
  );

  it.prop(
    "reports a stored attachment whose bytes changed as a digest mismatch, and a changed size as an attachment mismatch",
    [Arbitrary.schema(GuardCase)],
    ([input]) => {
      const world = worldOf(input);
      const swapFirst = (swap: (attachment: OutboxAttachmentDigest) => OutboxAttachmentDigest) =>
        pipe(
          A.head(world.stored),
          O.map((first) => [swap(first), ...A.drop(world.stored, 1)])
        );
      const sameSize = swapFirst(otherDigest);
      const otherSize = swapFirst((attachment) =>
        OutboxAttachmentDigest.make({ name: attachment.name, sha256: attachment.sha256, size: attachment.size + 1 })
      );

      assert.deepStrictEqual(
        O.map(sameSize, (stored) => fieldsOf(check(world, { stored }))),
        O.map(sameSize, only("attachment-digest"))
      );
      assert.deepStrictEqual(
        O.map(otherSize, (stored) => fieldsOf(check(world, { stored }))),
        O.map(otherSize, only("attachments"))
      );
    },
    options
  );

  it("counts duplicates: two identical stored attachments are not one", () => {
    const world = worldOf({
      bcc: [],
      cc: [],
      files: [
        { name: "one.pdf", seed: 1, size: 16 },
        { name: "one.pdf", seed: 1, size: 16 },
      ],
      subject: "Fixture subject",
      to: ["ada"],
    });

    assertNone(check(world));
    assert.deepStrictEqual(fieldsOf(check(world, withExpect(world, { attachments: A.take(world.stored, 1) }))), [
      "attachments",
    ]);
    // Same names and sizes, but only one of the two digests restated correctly.
    assert.deepStrictEqual(
      fieldsOf(
        check(
          world,
          withExpect(world, {
            attachments: [...A.take(world.stored, 1), ...A.map(A.take(world.stored, 1), otherDigest)],
          })
        )
      ),
      ["attachment-digest"]
    );
  });

  it("treats a recipient without an address as a mismatch, never as absent", () => {
    const world = worldOf({ bcc: [], cc: [], files: [], subject: "Fixture subject", to: ["ada"] });
    const nameless = GraphMessage.make({
      ...world.draft,
      toRecipients: O.map(world.draft.toRecipients, (stored) => [...stored, ...recipients([""])]),
    });

    assert.deepStrictEqual(fieldsOf(check(world, { draft: nameless })), ["to"]);
  });

  it("reads a draft with no recipient lists and no subject as empty, not as a match for anything", () => {
    const world = worldOf({ bcc: [], cc: [], files: [], subject: "", to: [] });
    const bare = GraphMessage.make({ id: "draft-1", isDraft: O.some(true) });

    assertNone(check(world, { draft: bare }));
    assert.deepStrictEqual(
      fieldsOf(
        check(world, {
          draft: bare,
          ...withExpect(world, {
            bcc: ["dee@example.test"],
            cc: ["ben@example.test"],
            subject: "Fixture subject",
            to: ["ada@example.test"],
          }),
        })
      ),
      ["to", "cc", "bcc", "subject"]
    );
  });

  it("treats a recipient whose address field is absent as a mismatch", () => {
    const world = worldOf({ bcc: [], cc: [], files: [], subject: "Fixture subject", to: ["ada"] });
    const addressless = GraphMessage.make({
      ...world.draft,
      toRecipients: O.map(world.draft.toRecipients, (stored) => [
        ...stored,
        GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({})) }),
      ]),
    });

    assert.deepStrictEqual(fieldsOf(check(world, { draft: addressless })), ["to"]);
  });

  it("reports several differing fields in a fixed order", () => {
    const world = worldOf({ bcc: [], cc: ["ben"], files: [], subject: "Fixture subject", to: ["ada"] });

    assert.deepStrictEqual(
      fieldsOf(check(world, withExpect(world, { cc: [], subject: "Other", to: ["cy@example.test"] }))),
      ["to", "cc", "subject"]
    );
  });
});
