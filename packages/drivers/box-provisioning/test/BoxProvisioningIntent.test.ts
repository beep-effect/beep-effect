import { decodeBoxDesiredState } from "@beep/box-provisioning/BoxProvisioningArtifacts";
import {
  BoxAdoption,
  BoxAdoptions,
  BoxDesiredState,
  BoxEntitlements,
  BoxFolderName,
  boxFolderNamesEquivalent,
} from "@beep/box-provisioning/BoxProvisioningIntent";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { desiredFixture } from "./fixtures.ts";

const encodeBoxAdoption = S.encodeEffect(BoxAdoption);
const decodeBoxAdoption = S.decodeEffect(BoxAdoption);
const equivalentBoxAdoption = S.toEquivalence(BoxAdoption);
const encodeBoxAdoptions = S.encodeEffect(BoxAdoptions);
const decodeBoxAdoptions = S.decodeEffect(BoxAdoptions);
const equivalentBoxAdoptions = S.toEquivalence(BoxAdoptions);
const encodeBoxEntitlements = S.encodeEffect(BoxEntitlements);
const decodeBoxEntitlements = S.decodeEffect(BoxEntitlements);
const equivalentBoxEntitlements = S.toEquivalence(BoxEntitlements);

const decodeBoxDesiredState2 = S.decodeEffect(BoxDesiredState);
const decodeBoxDesiredStateOption = S.decodeOption(BoxDesiredState);
const decodeBoxFolderNameOption = S.decodeOption(BoxFolderName);
const encodeBoxDesiredState = S.encodeEffect(BoxDesiredState);

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

    pipe(
      A.every(invalidNames, (name) => O.isNone(decodeBoxFolderNameOption(name))),
      assertTrue
    );
    pipe(decodeBoxFolderNameOption(" Leading"), O.isSome, assertTrue);
    pipe(decodeBoxFolderNameOption(Str.repeat(255)("x")), O.isSome, assertTrue);
  });

  it("compares sibling names case-insensitively after trimming trailing whitespace", () => {
    pipe(boxFolderNamesEquivalent("Workspace", "workspace "), assertTrue);
    pipe(boxFolderNamesEquivalent("Workspace", "Other"), assertFalse);
  });

  it.effect(
    "rejects case-equivalent desired siblings under the same parent",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeBoxDesiredState(desiredFixture);
      const folders = O.getOrElse(O.fromUndefinedOr(encoded.folders), A.empty);
      const first = O.getOrThrow(A.head(folders));
      const duplicate = { ...first, logicalKey: "folder.case-duplicate", name: "fixture WORKSPACE" };

      assertNone(decodeBoxDesiredStateOption({ ...encoded, folders: [...folders, duplicate] }));
    })
  );
  it.effect(
    "decodes a desired state without an adoptions key as an empty allowlist",
    Effect.fnUntraced(function* () {
      const { adoptions: _adoptions, ...withoutAdoptions } = yield* encodeBoxDesiredState(desiredFixture);
      const decoded = yield* decodeBoxDesiredState2(withoutAdoptions);

      pipe(A.isReadonlyArrayEmpty(decoded.adoptions.entries), assertTrue);
    })
  );
  it.effect(
    "rejects a malformed pinned provider id as a typed desired-state schema error",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeBoxDesiredState(desiredFixture);
      const malformed = { ...encoded, rootFolderId: "not a provider id!" };
      const decoded = yield* Effect.option(decodeBoxDesiredState(malformed));
      const error = yield* decodeBoxDesiredState(malformed).pipe(Effect.flip);

      assertNone(decoded);
      expect(error._tag).toBe("BoxProvisioningSchemaError");
    })
  );
  it.effect.prop(
    "round-trips schema-derived adoption and entitlement values",
    { value: Arbitrary.schema(BoxAdoption) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxAdoption(value).pipe(Effect.flatMap(decodeBoxAdoption));
      pipe(equivalentBoxAdoption(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxAdoptions",
    { value: Arbitrary.schema(BoxAdoptions) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxAdoptions(value).pipe(Effect.flatMap(decodeBoxAdoptions));
      pipe(equivalentBoxAdoptions(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
  it.effect.prop(
    "round-trips schema-derived BoxEntitlements",
    { value: Arbitrary.schema(BoxEntitlements) },
    Effect.fnUntraced(function* ({ value }) {
      const decoded = yield* encodeBoxEntitlements(value).pipe(Effect.flatMap(decodeBoxEntitlements));
      pipe(equivalentBoxEntitlements(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(5) }
  );
});
