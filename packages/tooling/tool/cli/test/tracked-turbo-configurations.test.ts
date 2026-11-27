import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));
const Strings = S.Array(S.String).pipe(S.withDecodingDefaultKey(Effect.succeed([])));

const turboRootPrefix = "$TURBO_ROOT$/";
const TurboInputsFile = S.Struct({ tasks: S.Record(S.String, S.Struct({ inputs: Strings })) });
const decodeTurboInputsFile = S.decodeEffect(S.fromJsonString(TurboInputsFile));
const rootRelativeGlob = (id: string, glob: string): O.Option<string> =>
  Str.startsWith(turboRootPrefix)(glob)
    ? O.some(Str.slice(Str.length(turboRootPrefix))(glob))
    : Str.startsWith("//#")(id)
      ? O.some(glob)
      : O.none();
const reachesNestedLanes = (id: string) => (glob: string) =>
  O.exists(
    rootRelativeGlob(id, glob),
    (relative) => Str.startsWith("**")(relative) || Str.startsWith(".claude/*")(relative)
  );
const excludesNestedLanes = (id: string) => (glob: string) =>
  Str.startsWith("!")(glob) && O.contains(rootRelativeGlob(id, Str.slice(1)(glob)), ".claude/worktrees/**");

describe("Root-reaching task inputs", () => {
  it.layer(PlatformLayer)("tracked Turbo configurations", (it) => {
    it.effect(
      "exclude nested lanes from every task whose inputs glob from the repository root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* findRepoRoot();
        const listing = yield* StepExec.runCaptured({
          command: "git",
          args: ["ls-files", "-z", "--", "turbo.json", "*/turbo.json"],
          cwd: repo,
          source: "stdout",
          extendEnv: true,
          env: { GIT_LITERAL_PATHSPECS: "0" },
        });
        expect(listing.exitCode, listing.output).toBe(0);
        const files = A.filter(Str.split("\0")(listing.output), Str.isNonEmpty);
        expect(files).toContain("turbo.json");
        expect(files).toContain("packages/foundation/modeling/identity/turbo.json");
        const offenders = yield* Effect.forEach(
          files,
          Effect.fnUntraced(function* (file) {
            const text = yield* fs.readFileString(path.join(repo, file));
            const { tasks } = yield* decodeTurboInputsFile(text);
            return A.flatMap(R.toEntries(tasks), ([id, { inputs }]) =>
              A.some(inputs, reachesNestedLanes(id)) && !A.some(inputs, excludesNestedLanes(id))
                ? [`${file} ${id}`]
                : []
            );
          }),
          { concurrency: 1 }
        );
        expect(A.flatten(offenders)).toEqual([]);
      })
    );

    it("classifies root-reaching globs by task scope", () => {
      expect(reachesNestedLanes("//#lint:typos")("**/*")).toBe(true);
      expect(reachesNestedLanes("//#lint:holds")("**/package.json")).toBe(true);
      expect(reachesNestedLanes("lint")("$TURBO_ROOT$/**/package.json")).toBe(true);
      expect(reachesNestedLanes("lint")("**/*.ts")).toBe(false);
      expect(reachesNestedLanes("//#lint:typos")("!**/*")).toBe(false);
      expect(reachesNestedLanes("//#fallow:audit:check")("apps/**")).toBe(false);
      expect(reachesNestedLanes("//#fallow:audit:check")(".claude/skills/**")).toBe(false);
      expect(excludesNestedLanes("//#lint:holds")("!.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("//#lint:holds")("!$TURBO_ROOT$/.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("lint")("!$TURBO_ROOT$/.claude/worktrees/**")).toBe(true);
      expect(excludesNestedLanes("lint")("!.claude/worktrees/**")).toBe(false);
      expect(excludesNestedLanes("lint")("$TURBO_ROOT$/.claude/worktrees/**")).toBe(false);
    });
  });
});
