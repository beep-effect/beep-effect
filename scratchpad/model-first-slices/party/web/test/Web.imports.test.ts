import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as ImportGraph from "@proto/tooling/ImportGraph";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

/**
 * Screens that opt into `Aggregate.predict` (optimistic prediction with the model's own
 * `decide`) and so may reach model files. Each entry names the screen's entry point, the model
 * files it may reach, and why. Empty: no screen predicts today.
 */
const predictExceptions: ReadonlyArray<{ readonly entry: string; readonly allows: ReadonlyArray<string>; readonly reason: string }> =
  [];

// A model or host file (any context), or a write-model, handler or adapter file anywhere.
const forbidden = (relative: string): boolean =>
  A.some(["party/model/", "party/host/", "authority/model/", "authority/host/", "runs/model/", "runs/host/", "apps/"], (prefix) =>
    Str.startsWith(prefix)(relative),
  ) || A.some([".aggregate.ts", ".handler.ts", ".model.ts", ".adapter.ts"], (suffix) => Str.endsWith(suffix)(relative));

const workspace = Effect.gen(function* () {
  const path = yield* Path.Path;
  const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  return { root, path, packages: yield* ImportGraph.loadWorkspace(root) };
});

/** The forbidden files each entry reaches, less what its listed exception allows. */
const violations = (
  entries: ReadonlyArray<{ readonly entry: string; readonly file: string }>,
  exceptions: typeof predictExceptions,
) =>
  Effect.gen(function* () {
    const { root, path, packages } = yield* workspace;
    return yield* Effect.forEach(entries, ({ entry, file }) =>
      Effect.map(ImportGraph.reachable(packages, [file]), (files) => {
        const allowed = A.flatMap(exceptions, (exception) => (exception.entry === entry ? exception.allows : []));
        return {
          entry,
          reached: files.length,
          bad: A.filter(A.map(files, (f) => path.relative(root, f)), (f) => forbidden(f) && !A.contains(allowed, f)),
        };
      }),
    );
  });

it.effect("the web package's entries reach the contract, never a model or host file", () =>
  Effect.gen(function* () {
    const { path, packages } = yield* workspace;
    const web = yield* Effect.fromOption(HashMap.get(packages, "@proto/party-web"));
    const entries = A.map(R.toEntries(web.exports), ([entry, target]) => ({ entry, file: path.join(web.dir, target) }));
    const found = yield* violations(entries, predictExceptions);
    expect(found.length).toBeGreaterThanOrEqual(8);
    // Not vacuous: the bindings reach the contract's command classes.
    expect(A.some(found, (f) => f.reached > 20)).toBe(true);
    expect(A.filter(found, (f) => f.bad.length > 0)).toEqual([]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("the exception mechanism: a predicting screen fails unless it is listed with the files it may reach", () =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const file = yield* path.fromFileUrl(new URL("./fixtures/Predicting.screen.ts", import.meta.url));
    const entry = { entry: "./Claim/Predicting.screen", file };
    const [unlisted] = yield* violations([entry], []);
    expect(unlisted?.bad).toContain("party/model/src/Claim/Claim.aggregate.ts");
    const [listed] = yield* violations(
      [entry],
      [{ entry: entry.entry, allows: unlisted?.bad ?? [], reason: "predicts ApproveProposal locally" }],
    );
    expect(listed?.bad).toEqual([]);
  }).pipe(Effect.provide(NodeServices.layer)),
);
