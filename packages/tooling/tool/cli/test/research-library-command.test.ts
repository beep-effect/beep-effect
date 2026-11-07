import { LibraryAcquireOptions, LibraryHopPolicy, libraryCommand } from "@beep/repo-cli/commands/Research";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

// No case reaches the network: flag validation and the Box selection guard fail ahead
// of any catalog read, and the empty temporary library catalogs no source to fetch.
const testLayer = Layer.mergeAll(NodeCommandTestLayer, FetchHttpClient.layer.pipe(Layer.provide(NodeServices.layer)));

const runLibrary = (args: ReadonlyArray<string>) =>
  Command.runWith(libraryCommand, { version: "test", renderErrors: false })(args).pipe(Effect.exit);

const failureText = (exit: Exit.Exit<unknown, unknown>) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "");

const makeLibrary = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "research-library-command-" });
});

describe("LibraryAcquireOptions hop policy", () => {
  layer(testLayer)((it) => {
    it.effect(
      "defaults the hop policy on construction and on decode",
      Effect.fn(function* () {
        const made = LibraryAcquireOptions.make({ sourceIds: [], concurrency: 2, retryFailed: false });
        expect(made.hopPolicy).toEqual(LibraryHopPolicy.make({}));
        expect(made.hopPolicy.domainCap).toBe(25);
        const decoded = yield* S.decodeEffect(LibraryAcquireOptions)({
          sourceIds: ["source-a"],
          concurrency: 3,
          retryFailed: true,
        });
        expect(decoded.hopPolicy.domainCap).toBe(25);
        expect(decoded.hopPolicy.liveGoalStatuses).toEqual(["active", "paused"]);
        const explicit = yield* S.decodeEffect(LibraryAcquireOptions)({
          sourceIds: [],
          concurrency: 1,
          retryFailed: false,
          hopPolicy: { domainCap: 4 },
        });
        expect(explicit.hopPolicy.domainCap).toBe(4);
        const encoded = yield* S.encodeEffect(LibraryAcquireOptions)(explicit);
        expect(encoded.hopPolicy?.domainCap).toBe(4);
      })
    );
  });
});

describe("research library command", () => {
  layer(testLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "rejects out-of-range acquire flags before resolving the library",
      Effect.fn(function* () {
        const library = yield* makeLibrary;
        const concurrency = yield* runLibrary(["acquire", "--library", library, "--concurrency", "0"]);
        expect(failureText(concurrency)).toContain("Concurrency must be between 1 and 8.");
        const cap = yield* runLibrary(["acquire", "--library", library, "--hop2-domain-cap", "-1"]);
        expect(failureText(cap)).toContain("--hop2-domain-cap must be zero or more.");
      })
    );

    it.effect(
      "requires a Box folder or file for the box route",
      Effect.fn(function* () {
        const library = yield* makeLibrary;
        const exit = yield* runLibrary(["acquire", "--library", library, "--route", "box", "--box-public"]);
        expect(failureText(exit)).toContain("--route box needs --box-folder or --box-file.");
      })
    );

    it.effect(
      "routes catalog acquisition with the hop policy to the library",
      Effect.fn(function* () {
        const library = yield* makeLibrary;
        const exit = yield* runLibrary(["acquire", "--library", library, "--hop2-domain-cap", "3"]);
        // The empty library catalogs no sources, so the routed acquisition fetches nothing.
        expect(Exit.isSuccess(exit)).toBe(true);
      })
    );

    it.effect(
      "rejects a negative hops domain cap and reports from the resolved library",
      Effect.fn(function* () {
        const library = yield* makeLibrary;
        const cap = yield* runLibrary(["hops", "--library", library, "--hop2-domain-cap", "-1"]);
        expect(failureText(cap)).toContain("--hop2-domain-cap must be zero or more.");
        const report = yield* runLibrary(["hops", "--library", library, "--limit", "1"]);
        // An empty library loads an empty catalog, so the report prints zero totals and succeeds.
        expect(Exit.isSuccess(report)).toBe(true);
      })
    );
  });
});
