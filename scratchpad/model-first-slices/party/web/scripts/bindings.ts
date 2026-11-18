import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { generatedFile } from "@proto/tooling/GeneratedFile";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";

// `bun scripts/bindings.ts` writes src/Party.bindings.ts from the Party contract's Apis;
// `--check` fails on drift. Only the contract is read: the web package never sees the model.
const apis = [
  { name: "Reviewer", api: ReviewerContract, module: "ReviewerApi.contract", exported: "ReviewerContract" },
  { name: "Intake", api: IntakeContract, module: "IntakeApi.contract", exported: "IntakeContract" },
] as const;

/** A served command whose class the contract package exports no `<Module>/<Tag>.command` entry for. */
class NoContractEntry extends S.TaggedError<NoContractEntry, { readonly brand: unique symbol }>()("NoContractEntry", {
  tag: S.String,
  message: S.String,
}) {}

type Served = { readonly kind: string; readonly tag?: string; readonly viewName?: string; readonly queryName?: string };

const render = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestFile = yield* path.fromFileUrl(new URL("../../contract/package.json", import.meta.url));
  const manifest = yield* fs.readFileString(manifestFile);
  const { exports } = yield* S.decodeEffect(
    S.fromJsonString(S.Struct({ exports: S.Record(S.String, S.String) })),
  )(manifest);
  // A command class lives in `<Module>/<Tag>.command.ts`; find its entry point.
  const commandModule = (tag: string) =>
    pipe(
      R.keys(exports),
      A.findFirst(Str.endsWith(`/${tag}.command`)),
      Effect.fromOption,
      Effect.mapBoth({
        onSuccess: (entry) => `@proto/party-contract${pipe(entry, Str.slice(1))}`,
        onFailure: () => NoContractEntry.make({ tag, message: `no contract entry for command ${tag}` }),
      }),
      Effect.orDie,
    );
  const imports: Array<string> = [];
  const blocks: Array<string> = [];
  for (const { name, api, module, exported } of apis) {
    imports.push(`import { ${exported} } from "@proto/party-contract/${module}";`);
    const served = A.sort(
      api.serves as ReadonlyArray<Served>,
      Order.mapInput(Order.String, (entry: Served) => entry.tag ?? entry.viewName ?? entry.queryName ?? ""),
    );
    const lines: Array<string> = [];
    const atoms: Array<string> = [];
    for (const entry of served) {
      if (entry.kind === "Command" && entry.tag !== undefined) {
        const commandEntry = yield* commandModule(entry.tag);
        imports.push(`import { ${entry.tag} } from "${commandEntry}";`);
        lines.push(`  ${entry.tag}: Bindings.command(${exported}, ${entry.tag}, (client) => client.${entry.tag}),`);
        atoms.push(`  ${entry.tag}: commandAtom(${name}.${entry.tag}),`);
      } else if (entry.kind === "View" && entry.viewName !== undefined) {
        lines.push(`  ${entry.viewName}: Bindings.view(${exported}, (client) => client.${entry.viewName}),`);
        atoms.push(`  ${entry.viewName}: viewAtom(${name}.${entry.viewName}),`);
      } else if (entry.kind === "Query" && entry.queryName !== undefined) {
        lines.push(`  ${entry.queryName}: Bindings.query(${exported}, (client) => client.${entry.queryName}),`);
      }
    }
    blocks.push(
      A.join(
        [
        `/** Bindings for \`${exported}\`: each command, view and query it serves. */`,
        `export const ${name} = {`,
        ...lines,
        "} as const;",
        "",
        `/** Atoms over \`${name}\`: a subscription per view key, a command atom per command. */`,
        `export const ${name}Atoms = {`,
        ...atoms,
        "} as const;",
        ],
        "\n",
      ),
    );
  }
  return A.join(
    [
    "// Generated from the Party contract by scripts/bindings.ts. Do not edit:",
    "// `bun run bindings` rewrites it, and `bun run bindings --check` fails on drift.",
    ...A.sort(A.dedupe(imports), Order.String),
    'import * as Bindings from "./Bindings.ts";',
    'import { commandAtom, viewAtom } from "./Party.runtime.ts";',
    "",
    A.join(blocks, "\n\n"),
    "",
    "/** Every generated binding, by contract: the file's designated primary export. */",
    `export const PartyBindings = { ${A.join(A.map(apis, (api) => api.name), ", ")} } as const;`,
    "",
    ],
    "\n",
  );
});

Effect.gen(function* () {
  const path = yield* Path.Path;
  const file = yield* path.fromFileUrl(new URL("../src/Party.bindings.ts", import.meta.url));
  yield* generatedFile(file, render, process.argv.slice(2));
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
