import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { generatedFile } from "@proto/tooling/GeneratedFile";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { ConformanceStack } from "../src/Deployment.ts";

// `bun scripts/entries.ts` writes generated/Practice.entry.ts (what every runner of the pool
// loads) and generated/Practice.front.ts (the front service) from the composed deployment
// descriptors (D13, D40); `--check` fails on drift. The app names no model or process here.
/** A generated file's lines, joined. */
const lines = A.join("\n");

const header = [
  "// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:",
  "// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.",
];

/** The cluster parts use one another in a cycle, so no order places each after the parts it uses. */
class PartCycle extends S.TaggedError<PartCycle, { readonly brand: unique symbol }>()("PartCycle", {
  message: S.String,
}) {}

/** Every part, ordered so each comes after the parts it uses. */
const ordered = Effect.fnUntraced(function* (descriptors: ReadonlyArray<DeploymentDescriptor>) {
  const parts = A.flatMap(descriptors, (d) => A.map(d.cluster.parts, (part) => ({ owner: d.context, ...part })));
  const out: Array<(typeof parts)[number]> = [];
  let placed = HashSet.empty<string>();
  while (out.length < parts.length) {
    const ready = A.filter(parts, (p) => !HashSet.has(placed, p.name) && A.every(p.uses, (u) => HashSet.has(placed, u)));
    if (ready.length === 0) return yield* PartCycle.make({ message: "a cycle among cluster parts" });
    for (const p of ready) {
      out.push(p);
      placed = HashSet.add(placed, p.name);
    }
  }
  return out;
});

const entry = Effect.fnUntraced(function* (descriptors: ReadonlyArray<DeploymentDescriptor>) {
  const placed = yield* ordered(descriptors);
  const imports = A.map(descriptors, (d) => `import { ${d.cluster.export} } from "${d.cluster.module}";`);
  const contexts = A.map(descriptors, (d) => `export const ${d.context} = ${d.cluster.export}(platform);`);
  const parts = A.map(placed, (p) =>
    A.isReadonlyArrayEmpty(p.uses)
      ? `export const ${p.name} = ${p.owner}.parts.${p.name};`
      : `export const ${p.name} = ${p.owner}.parts.${p.name}.pipe(Layer.provide(Layer.mergeAll(${A.join(p.uses, ", ")})));`,
  );
  const names = A.map(placed, (p) => p.name);
  return lines([
    ...header,
    'import * as DomainCluster from "@alchemy.run/domain/EffectCluster";',
    'import * as Layer from "effect/Layer";',
    ...A.sort(imports, Order.String),
    'import { Default } from "../src/Cluster.ts";',
    "",
    "/** The pool's platform: every composed context's entities, under one entity. */",
    "export const platform = DomainCluster.layerEntities({",
    '  name: "Practice",',
    "  main: import.meta.url,",
    '  handler: "PracticeLive",',
    "  pool: Default,",
    "});",
    "",
    "/** Each context's cluster wiring, over the one platform. */",
    ...contexts,
    "",
    "/** Each part, given the parts it uses. */",
    ...parts,
    "",
    "/** What every runner of the pool builds: every part, and so every context's model. */",
    `export const PracticeLive = Layer.mergeAll(${A.join(names, ", ")});`,
    "",
    "export default PracticeLive;",
    "",
  ]);
});

/**
 * Why the front's deploy-time props provide `Database` with `Effect.provide`, in the repo's
 * directive form (reason, owner, exit): Alchemy provides a class's layers per deploy on purpose.
 */
/** The directive's keyword, assembled so this generator's own source does not read as a directive. */
const nextLineDirective = `@${"effect-diagnostics-next-line"}`;
const frontPropsEntryReason =
  "the front class's deploy-time props are an Alchemy class entry point, and Alchemy provides a class's layers per deploy on purpose (alchemy Platform.ts provideClassLayer: a longer-lived build skips source registration on the next deploy). Owner: @proto/practice. Exit: when the stack provides Database through its providers instead, proved by a deploy.";

const front = (descriptors: ReadonlyArray<DeploymentDescriptor>) => {
  const used = A.dedupe(A.flatMap(descriptors, (d) => d.cluster.apis));
  const routes = A.map(descriptors, (d) =>
    A.isReadonlyArrayEmpty(d.cluster.apis)
      ? `      ...(yield* ${d.context}.apis),`
      : `      ...(yield* ${d.context}.apis.pipe(Effect.provideContext(parts))),`,
  );
  // The parts the Apis call through, built once into the front's scope, as each context builds
  // its own model (D39): the Apis serve requests long after the front's init returns.
  const parts = A.isReadonlyArrayEmpty(used)
    ? []
    : [
        "    // The parts the Apis call through, built once into the front's scope as each context builds its",
        "    // own model (D39): the Apis serve requests long after this effect returns.",
        `    const parts = yield* Layer.build(Layer.mergeAll(${A.join(used, ", ")}));`,
      ];
  return lines([
    ...header,
    'import * as Docker from "@alchemy.run/docker";',
    'import * as Cluster from "@alchemy.run/effect-cluster";',
    'import type { HttpEffect } from "alchemy/Http";',
    'import * as A from "@beep/utils/Array";',
    'import * as Effect from "effect/Effect";',
    'import { pipe, identity } from "effect/Function";',
    'import { HttpServerRequest } from "effect/http/HttpServerRequest";',
    'import * as HttpServerResponse from "effect/http/HttpServerResponse";',
    'import * as Layer from "effect/Layer";',
    'import * as O from "@beep/utils/Option";',
    'import * as R from "effect/Record";',
    'import * as Str from "@beep/utils/Str";',
    'import { Database } from "../src/Cluster.ts";',
    `import { ${A.join(A.sort([...A.map(descriptors, (d) => d.context), ...used], Order.String), ", ")} } from "./Practice.entry.ts";`,
    "",
    "/** The front: every context's Apis by first path segment; the conformance app at the root. */",
    "export default class PracticeFront extends Docker.Service<PracticeFront>()(",
    '  "PracticeFront",',
    "  Effect.gen(function* () {",
    "    const database = yield* Cluster.Database.Database;",
    "    return {",
    "      main: import.meta.url,",
    "      port: 3000,",
    "      // No host port (phase 6): the conformance driver runs as a service on the stack's network.",
    '      networks: database.network?.kind === "docker" ? [{ name: database.network.name }] : [],',
    "      // Queries run on the front, reading the directory in the cluster's Postgres.",
    "      // Docker.Service rebuilds the front's image only when these props change, not when the code",
    "      // it imports does (notes/phase-5.md): bump FRONT_REVISION to force a new front image.",
    "      env: { CLUSTER_DATABASE_URL: database.url, FRONT_REVISION: \"3\" },",
    "    };",
    "  }).pipe(",
    // The prototype's one inline directive (phase 7): this line is a deploy-time entry point.
    `    // ${nextLineDirective} strictEffectProvide:off -- ${frontPropsEntryReason}`,
    "    Effect.provide(Database),",
    "  ),",
    "  Effect.gen(function* () {",
    ...parts,
    "    const routes: Readonly<Record<string, HttpEffect>> = {",
    ...routes,
    "    };",
    "    return {",
    "      fetch: Effect.gen(function* () {",
    "        const request = yield* HttpServerRequest;",
    '        const segment = pipe(new URL(request.url, "http://front").pathname, Str.split("/"), A.get(1), O.getOrElse(() => ""));',
    "        // A path no context serves goes to the root app; with none, it is not found.",
    '        return yield* O.match(O.orElse(R.get(routes, segment), () => R.get(routes, "")), {',
    "          onNone: () => Effect.succeed(HttpServerResponse.empty({ status: 404 })),",
    "          onSome: identity,",
    "        });",
    "      }),",
    "    };",
    "  }),",
    ") {}",
    "",
  ]);
};

Effect.gen(function* () {
  const path = yield* Path.Path;
  const dir = yield* path.fromFileUrl(new URL("../generated/", import.meta.url));
  const argv = process.argv.slice(2);
  yield* generatedFile(path.join(dir, "Practice.entry.ts"), entry(ConformanceStack), argv);
  yield* generatedFile(path.join(dir, "Practice.front.ts"), Effect.sync(() => front(ConformanceStack)), argv);
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
