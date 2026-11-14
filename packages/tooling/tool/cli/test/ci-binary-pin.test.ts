import { CI_BINARY_PIN_FILE, ciBinaryPinCommand } from "@beep/repo-cli/commands/Ci/CiBinaryPin";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// beep-ci-binary.yml runs `beep ci binary-pin --tag <new> --sha256 <hex> --write` after it publishes
// a release, then opens the pin-bump pull request (goals/heavy-pool-diet PERIH-11 slice 2).

const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const runPin = Command.runWith(ciBinaryPinCommand, { version: "0.0.0" });

const OLD_TAG = "beep-ci-a56516d6d309";
const OLD_SHA = "6dfe082df52d4e23ad3b2ca3270e84792c61227e9f60d7eb61b0d3900d61df5c";
const NEW_TAG = "beep-ci-0123456789ab";
const NEW_SHA = A.join(A.replicate("ab", 32), "");

const actionText = (tagLines: ReadonlyArray<string>, shaLines: ReadonlyArray<string>) =>
  A.join(
    [
      "runs:",
      "  using: composite",
      "  steps:",
      "    - name: Fetch and verify the pinned beep CI binary",
      "      env:",
      ...A.map(tagLines, (tag) => `        BEEP_CI_RELEASE_TAG: ${tag}`),
      ...A.map(shaLines, (sha) => `        BEEP_CI_SHA256: ${sha}`),
      "        BEEP_CI_REPOSITORY: ${{ github.repository }}",
      "      run: |",
      '        if [[ "$BEEP_CI_RELEASE_TAG" == *PENDING* ]]; then exit 1; fi',
      "",
    ],
    "\n"
  );

const withPinFile = Effect.fnUntraced(function* (text: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped();
  const file = `${directory}/action.yml`;
  yield* fs.writeFileString(file, text);
  return file;
});

const pinArgs = (file: string, tag: string, sha: string, ...mode: ReadonlyArray<string>) => [
  "--tag",
  tag,
  "--sha256",
  sha,
  "--file",
  file,
  ...mode,
];

describe("ci binary-pin", () => {
  it.layer(platform, { timeout: "60 seconds" })((it) => {
    it.effect("rewrites exactly the two pinned values and is idempotent", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const before = actionText([OLD_TAG], [OLD_SHA]);
        const file = yield* withPinFile(before);
        yield* runPin(pinArgs(file, NEW_TAG, NEW_SHA, "--write"));
        const after = yield* fs.readFileString(file);
        expect(after).toBe(
          Str.replace(
            OLD_SHA,
            NEW_SHA
          )(Str.replace(`BEEP_CI_RELEASE_TAG: ${OLD_TAG}`, `BEEP_CI_RELEASE_TAG: ${NEW_TAG}`)(before))
        );
        yield* runPin(pinArgs(file, NEW_TAG, NEW_SHA, "--write"));
        const again = yield* fs.readFileString(file);
        expect(again).toBe(after);
        yield* runPin(pinArgs(file, NEW_TAG, NEW_SHA, "--check"));
        const lines = yield* TestConsole.logLines;
        expect(lines).toStrictEqual([
          `${file}: ${OLD_TAG} -> ${NEW_TAG} (sha256 ${NEW_SHA}).`,
          `${file} already pins ${NEW_TAG} (sha256 ${NEW_SHA}).`,
          `${file} already pins ${NEW_TAG} (sha256 ${NEW_SHA}).`,
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // The workflow decides from state: it rewrites main's pin to the newest release and opens the
    // pull request only when that changed the file. A re-run after a failed pull-request step starts
    // again from main's unchanged pin, so it must reach the same rewrite; once a bump has merged, the
    // pin already names the newest release and the rewrite leaves the file byte-identical.
    it.effect("a re-run from main's stale pin reaches the same rewrite; a merged pin writes nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const main = actionText([OLD_TAG], [OLD_SHA]);
        const firstAttempt = yield* withPinFile(main);
        yield* runPin(pinArgs(firstAttempt, NEW_TAG, NEW_SHA, "--write"));
        const firstText = yield* fs.readFileString(firstAttempt);
        const rerun = yield* withPinFile(main);
        yield* runPin(pinArgs(rerun, NEW_TAG, NEW_SHA, "--write"));
        const rerunText = yield* fs.readFileString(rerun);
        expect(rerunText).toBe(firstText);
        expect(rerunText).not.toBe(main);
        const merged = yield* withPinFile(firstText);
        yield* runPin(pinArgs(merged, NEW_TAG, NEW_SHA, "--write"));
        const mergedText = yield* fs.readFileString(merged);
        expect(mergedText).toBe(firstText);
        const lines = yield* TestConsole.logLines;
        expect(A.drop(lines, 2)).toStrictEqual([`${merged} already pins ${NEW_TAG} (sha256 ${NEW_SHA}).`]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("checks by default and fails on a different pin without writing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const before = actionText([OLD_TAG], [OLD_SHA]);
        const file = yield* withPinFile(before);
        const failure = yield* Effect.flip(runPin(pinArgs(file, NEW_TAG, NEW_SHA)));
        expect(`${failure}`).toContain(`pins ${OLD_TAG} (sha256 ${OLD_SHA}), not ${NEW_TAG}`);
        const unchanged = yield* fs.readFileString(file);
        expect(unchanged).toBe(before);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect.each([
      ["a tag without the beep-ci prefix", "v1.2.3", NEW_SHA],
      ["a tag with a short sha", "beep-ci-0123", NEW_SHA],
      ["an uppercase tag", "beep-ci-0123456789AB", NEW_SHA],
      ["a short digest", NEW_TAG, "abc123"],
      ["an uppercase digest", NEW_TAG, Str.toUpperCase(NEW_SHA)],
    ] as const)("refuses %s", ([, tag, sha]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const before = actionText([OLD_TAG], [OLD_SHA]);
        const file = yield* withPinFile(before);
        const failure = yield* Effect.flip(runPin(pinArgs(file, tag, sha, "--write")));
        expect(`${failure}`).toContain("Invalid pin");
        const unchanged = yield* fs.readFileString(file);
        expect(unchanged).toBe(before);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect.each([
      ["no tag line", [], [OLD_SHA], "exactly one BEEP_CI_RELEASE_TAG line; found 0"],
      ["two tag lines", [OLD_TAG, OLD_TAG], [OLD_SHA], "exactly one BEEP_CI_RELEASE_TAG line; found 2"],
      ["no digest line", [OLD_TAG], [], "exactly one BEEP_CI_SHA256 line; found 0"],
      ["two digest lines", [OLD_TAG], [OLD_SHA, OLD_SHA], "exactly one BEEP_CI_SHA256 line; found 2"],
    ] as const)("refuses a pin file with %s", ([, tags, shas, message]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const before = actionText(tags, shas);
        const file = yield* withPinFile(before);
        const failure = yield* Effect.flip(runPin(pinArgs(file, NEW_TAG, NEW_SHA, "--write")));
        expect(`${failure}`).toContain(message);
        const unchanged = yield* fs.readFileString(file);
        expect(unchanged).toBe(before);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses --check and --write together", () =>
      Effect.gen(function* () {
        const file = yield* withPinFile(actionText([OLD_TAG], [OLD_SHA]));
        const failure = yield* Effect.flip(runPin(pinArgs(file, NEW_TAG, NEW_SHA, "--check", "--write")));
        expect(`${failure}`).toContain("Pass --check or --write, not both.");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reads the checked-in pin file, which holds exactly one tag and one digest", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* findRepoRoot();
        const text = yield* fs.readFileString(`${root}/${CI_BINARY_PIN_FILE}`);
        const tag = A.fromIterable(Str.matchAll(/^ {8}BEEP_CI_RELEASE_TAG: (beep-ci-[0-9a-f]{12})$/gmu)(text));
        const sha = A.fromIterable(Str.matchAll(/^ {8}BEEP_CI_SHA256: ([0-9a-f]{64})$/gmu)(text));
        expect(A.length(tag)).toBe(1);
        expect(A.length(sha)).toBe(1);
        // The default --file resolves against the repository root; checking the live pin passes.
        yield* runPin(["--tag", tag[0]?.[1] ?? "", "--sha256", sha[0]?.[1] ?? ""]);
        const lines = yield* TestConsole.logLines;
        expect(lines).toStrictEqual([`${CI_BINARY_PIN_FILE} already pins ${tag[0]?.[1]} (sha256 ${sha[0]?.[1]}).`]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
