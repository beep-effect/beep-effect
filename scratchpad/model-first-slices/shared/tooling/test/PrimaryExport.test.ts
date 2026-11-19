import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import * as ImportGraph from "@proto/tooling/ImportGraph";
import { exempt, violationsOf } from "@proto/tooling/PrimaryExport";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import * as Str from "@beep/utils/Str";
import { thunk0 } from "@beep/utils"

/** Every `<Noun>.<kind>.ts(x)` source file of every workspace package. */
const roleFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  const packages = yield* ImportGraph.loadWorkspace(root);
  const files = yield* Effect.forEach(packages.pipe(HashMap.values, A.fromIterable), (pkg) =>
    Effect.map(
      fs.readDirectory(path.join(pkg.dir, "src"), { recursive: true }).pipe(Effect.orElseSucceed(A.empty)),
      A.map((file) => path.join(pkg.dir, "src", file)),
    ),
    { concurrency: 1 },
  );
  return {
    root,
    files: pipe(
      A.flatten(files),
      A.filter((file) => Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file)),
      A.filter((file) => pipe(path.basename(file), Str.split(".")).length >= 3),
    ),
  };
});

it.layer(NodeServices.layer)("on the workspace's files", (it) => {
  it.effect(
    "every role file has one designated primary export of its kind",
    () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const { root, files } = yield* roleFiles;
        expect(files.length).toBeGreaterThan(150);
        const found = yield* Effect.forEach(files, (file) =>
          Effect.map(
            Effect.promise(() => import(file) as Promise<Record<string, unknown>>),
            (module) => violationsOf(path.relative(root, file), module),
          ),
          { concurrency: 1 },
        );
        expect(A.flatten(found)).toEqual([]);
      }),
    120_000,
  );
});

it("negative controls: a missing primary, a second command, an unknown kind; an exemption names its reason", () => {
  expect(violationsOf("Foo.command.ts", { Bar: { kind: "Command" } })).toMatchObject([{ problem: 'no primary export "Foo" of kind command' }]);
  expect(violationsOf("Foo.command.ts", { Foo: { kind: "Command" }, Bar: { kind: "Command" } })).toMatchObject([
    { problem: "more than one export of kind command: Foo, Bar" },
  ]);
  // A command file's events and rejections are companions, not violations.
  expect(violationsOf("Foo.command.ts", { Foo: { kind: "Command" }, FooDone: { kind: "Event" }, Nope: MissingGrant })).toEqual([]);
  // A rejection file's primary is a tagged error class; an object that only names the kind is not one.
  expect(violationsOf("MissingGrant.rejection.ts", { MissingGrant })).toEqual([]);
  expect(violationsOf("MissingGrant.rejection.ts", { MissingGrant: { kind: "Rejection" } })).toMatchObject([
    { problem: 'no primary export "MissingGrant" of kind rejection' },
  ]);
  expect(violationsOf("Foo.widget.ts", { Foo: {} })).toMatchObject([{ problem: 'unknown kind "widget": add a rule or an exemption' }]);
  expect(violationsOf("Claim.rules.ts", { anything: thunk0 })).toEqual([]);
  expect(Str.isNonEmpty(exempt.rules ?? "")).toBe(true);
});
