import { decodeBoxDesiredState } from "@beep/box-provisioning/BoxProvisioningArtifacts";
import {
  BoxAdoption,
  BoxAdoptions,
  BoxDesiredState,
  BoxEntitlements,
  BoxFolderName,
  boxFolderNamesEquivalent,
} from "@beep/box-provisioning/BoxProvisioningIntent";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { desiredFixture } from "./fixtures.ts";

const decodeBoxDesiredState2 = S.decodeEffect(BoxDesiredState);
const decodeBoxDesiredStateOption = S.decodeOption(BoxDesiredState);
const decodeBoxFolderNameOption = S.decodeOption(BoxFolderName);
const encodeBoxDesiredState = S.encodeEffect(BoxDesiredState);

const assertCodecRoundTrip = <A, I>(schema: S.Codec<A, I>): void => {
  const equivalent = S.toEquivalence(schema);
  const encode = S.encodeSync(schema);
  const decode = S.decodeSync(schema);
  expect(
    Effect.runSync(
      Arbitrary.checkEffect(
        Arbitrary.all([Arbitrary.schema(schema)]),
        ([value]) => equivalent(decode(encode(value)), value),
        fcRuns(5)
      )
    )
  ).toMatchObject({ _tag: "Passed" });
};

describe("@beep/box-provisioning intent", () => {
  it("rejects folder names forbidden by Box and accepts the documented bounds", () => {
    const invalidNames = [
      "",
      "Trailing ",
      "slash/name",
      "backslash\\name",
      ".",
      "..",
      "control\u001f",
      Str.repeat(256)("x"),
    ];

    expect(A.every(invalidNames, (name) => O.isNone(decodeBoxFolderNameOption(name)))).toBe(true);
    expect(O.isSome(decodeBoxFolderNameOption(" Leading"))).toBe(true);
    expect(O.isSome(decodeBoxFolderNameOption(Str.repeat(255)("x")))).toBe(true);
  });

  it("compares sibling names case-insensitively after trimming trailing whitespace", () => {
    expect(boxFolderNamesEquivalent("Workspace", "workspace ")).toBe(true);
    expect(boxFolderNamesEquivalent("Workspace", "Other")).toBe(false);
  });

  it.effect(
    "rejects case-equivalent desired siblings under the same parent",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeBoxDesiredState(desiredFixture);
      const folders = O.getOrElse(O.fromUndefinedOr(encoded.folders), A.empty);
      const first = O.getOrThrow(A.head(folders));
      const duplicate = { ...first, logicalKey: "folder.case-duplicate", name: "fixture WORKSPACE" };

      expect(O.isNone(decodeBoxDesiredStateOption({ ...encoded, folders: [...folders, duplicate] }))).toBe(true);
    })
  );
  it.effect(
    "decodes a desired state without an adoptions key as an empty allowlist",
    Effect.fnUntraced(function* () {
      const { adoptions: _adoptions, ...withoutAdoptions } = yield* encodeBoxDesiredState(desiredFixture);
      const decoded = yield* decodeBoxDesiredState2(withoutAdoptions);

      expect(A.isReadonlyArrayEmpty(decoded.adoptions.entries)).toBe(true);
    })
  );
  it.effect(
    "rejects a malformed pinned provider id as a typed desired-state schema error",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeBoxDesiredState(desiredFixture);
      const malformed = { ...encoded, rootFolderId: "not a provider id!" };
      const decoded = yield* Effect.option(decodeBoxDesiredState(malformed));
      const error = yield* decodeBoxDesiredState(malformed).pipe(Effect.flip);

      expect(O.isNone(decoded)).toBe(true);
      expect(error._tag).toBe("BoxProvisioningSchemaError");
    })
  );
  it("round-trips schema-derived adoption and entitlement values", () => {
    assertCodecRoundTrip(BoxAdoption);
    assertCodecRoundTrip(BoxAdoptions);
    assertCodecRoundTrip(BoxEntitlements);
  });
});
