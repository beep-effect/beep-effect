import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { DeploymentDescriptor } from "@proto/kernel/Deployment";
import { generatedFile } from "@proto/tooling/GeneratedFile";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { ConformanceStack } from "../src/Deployment.ts";

// `bun scripts/entries.ts` writes generated/Practice.entry.ts (what every runner of the pool
// loads) and generated/Practice.front.ts (the front service) from the composed deployment
// descriptors (D13, D40); `--check` fails on drift. The app names no model or process here.
const header = [
  "// Generated from the composed deployment descriptors by scripts/entries.ts. Do not edit:",
  "// `bun run entries` rewrites it, and `bun run entries --check` fails on drift.",
];

/** Every part, ordered so each comes after the parts it uses. */
const ordered = (descriptors: ReadonlyArray<DeploymentDescriptor>) => {
  const parts = A.flatMap(descriptors, (d) => A.map(d.cluster.parts, (part) => ({ owner: d.context, ...part })));
  const out: Array<(typeof parts)[number]> = [];
  let placed = HashSet.empty<string>();
  while (out.length < parts.length) {
    const ready = A.filter(parts, (p) => !HashSet.has(placed, p.name) && A.every(p.uses, (u) => HashSet.has(placed, u)));
    if (ready.length === 0) throw new Error("a cycle among cluster parts");
    for (const p of ready) {
      out.push(p);
      placed = HashSet.add(placed, p.name);
    }
  }
  return out;
};

const entry = (descriptors: ReadonlyArray<DeploymentDescriptor>) => {
  const imports = A.map(descriptors, (d) => `import { ${d.cluster.export} } from "${d.cluster.module}";`);
  const contexts = A.map(descriptors, (d) => `export const ${d.context} = ${d.cluster.export}(platform);`);
  const parts = A.map(ordered(descriptors), (p) =>
    A.isReadonlyArrayEmpty(p.uses)
      ? `export const ${p.name} = ${p.owner}.parts.${p.name};`
      : `export const ${p.name} = ${p.owner}.parts.${p.name}.pipe(Layer.provide(Layer.mergeAll(${A.join(p.uses, ", ")})));`,
  );
  const names = A.map(ordered(descriptors), (p) => p.name);
  return [
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
  ].join("\n");
};

const front = (descriptors: ReadonlyArray<DeploymentDescriptor>) => {
  const used = A.dedupe(A.flatMap(descriptors, (d) => d.cluster.apis));
  const routes = A.map(descriptors, (d) =>
    A.isReadonlyArrayEmpty(d.cluster.apis)
      ? `      ...(yield* ${d.context}.apis),`
      : `      ...(yield* ${d.context}.apis.pipe(Effect.provide(Layer.mergeAll(${A.join(d.cluster.apis, ", ")})))),`,
  );
  return [
    ...header,
    'import * as Docker from "@alchemy.run/docker";',
    'import * as Cluster from "@alchemy.run/effect-cluster";',
    'import * as Effect from "effect/Effect";',
    'import { HttpServerRequest } from "effect/http/HttpServerRequest";',
    'import * as Layer from "effect/Layer";',
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
    "  }).pipe(Effect.provide(Database)),",
    "  Effect.gen(function* () {",
    "    const routes: Readonly<Record<string, Effect.Effect<unknown, unknown, unknown>>> = {",
    ...routes,
    "    };",
    "    return {",
    "      fetch: Effect.gen(function* () {",
    "        const request = yield* HttpServerRequest;",
    '        const segment = new URL(request.url, "http://front").pathname.split("/")[1] ?? "";',
    '        return yield* (routes[segment] ?? routes[""])!;',
    "      }),",
    "    } as never;",
    "  }),",
    ") {}",
    "",
  ].join("\n");
};

Effect.gen(function* () {
  const path = yield* Path.Path;
  const dir = yield* path.fromFileUrl(new URL("../generated/", import.meta.url));
  const argv = process.argv.slice(2);
  yield* generatedFile(path.join(dir, "Practice.entry.ts"), Effect.sync(() => entry(ConformanceStack)), argv);
  yield* generatedFile(path.join(dir, "Practice.front.ts"), Effect.sync(() => front(ConformanceStack)), argv);
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
