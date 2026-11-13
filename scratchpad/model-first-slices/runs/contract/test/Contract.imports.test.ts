import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as ImportGraph from "@proto/tooling/ImportGraph";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import * as Str from "effect/String";

// A file the contract's closure must never reach: anything of a model or host
// package (this context's or another's), or a write-model or handler file anywhere.
const forbidden = (relative: string): boolean =>
  A.some(["party/model/", "party/host/", "authority/model/", "authority/host/", "runs/model/", "runs/host/", "apps/"], (prefix) =>
    Str.startsWith(prefix)(relative),
  ) || A.some([".aggregate.ts", ".handler.ts", ".model.ts", ".adapter.ts"], (suffix) => Str.endsWith(suffix)(relative));

const closureOf = (packageName: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
    const workspace = yield* ImportGraph.loadWorkspace(root);
    const pkg = yield* Effect.fromOption(HashMap.get(workspace, packageName));
    const files = yield* ImportGraph.reachable(workspace, ImportGraph.entriesOf(pkg, path.join));
    return A.map(files, (file) => path.relative(root, file));
  });

it.effect("the contract's module graph reaches no model, host, aggregate or handler", () =>
  Effect.gen(function* () {
    const files = yield* closureOf("@proto/runs-contract");
    // The walk is not vacuous: it reached the commands, the kernel and the contract kit.
    expect(files).toContain("runs/contract/src/Run/ReserveBudget.command.ts");
    expect(files).toContain("shared/kernel/src/Invocation.ts");
    expect(files).toContain("shared/contract-kit/src/Catalog.ts");
    expect(A.filter(files, forbidden)).toEqual([]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("negative control: the same walk from the model's entries reaches its aggregates and handlers", () =>
  Effect.gen(function* () {
    const files = yield* closureOf("@proto/runs-model");
    expect(files).toContain("runs/model/src/Run/AgentRun.aggregate.ts");
    expect(files).toContain("runs/model/src/Run/GrantOnRequest.handler.ts");
  }).pipe(Effect.provide(NodeServices.layer)),
);
