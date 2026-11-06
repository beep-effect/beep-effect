/**
 * Explicit-root knowledge ledger validation and projection commands.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { KbError } from "./Kb.errors.ts";
import { hasKbCanary, projectKb } from "./Kb.projection.ts";
import { KbReport } from "./Kb.schemas.ts";
import { KbLedger, makeKbLedger } from "./Kb.service.ts";
import { KbGraphExport, makeKbGraphExport } from "./KbGraph.service.ts";
import type { KbView } from "./Kb.schemas.ts";

const ledgerLive = Layer.effect(KbLedger, makeKbLedger);
const printReport = Effect.fn("Kb.printReport")(function* (report: KbReport) {
  const json = yield* S.encodeEffect(S.fromJsonString(KbReport, { space: 2 }))(report).pipe(
    Effect.mapError(() => KbError.make({ message: "Cannot encode validation report" }))
  );
  yield* Console.log(json);
});

/**
 * Build into a fresh or empty directory, rejecting invalid ledgers and canaries before writing.
 * **Details**
 * Refusing nonempty directories prevents stale planning artifacts surviving an outward rebuild.
 * The outward output must be outside the source root. Source text is never copied into artifacts.
 * **Example** (Create a build effect)
 * ```ts
 * import { buildKb } from "@beep/repo-cli/commands/Kb"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(buildKb("/data/ledger", "outward", "/data/view")))
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const buildKb = Effect.fn("Kb.build")(
  function* (root: string, view: KbView, out: string) {
    const ledger = yield* KbLedger;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const loaded = yield* ledger.read(root);
    if (!loaded.report.valid) return yield* KbError.make({ message: "Ledger validation failed; run kb validate" });
    const source = yield* fs.realPath(root);
    yield* fs.makeDirectory(path.dirname(path.resolve(out)), { recursive: true });
    const parent = yield* fs.realPath(path.dirname(path.resolve(out)));
    const target = path.join(parent, path.basename(path.resolve(out)));
    const relative = path.relative(source, target);
    const reverse = path.relative(target, source);
    const insideSource = !Str.startsWith(`..${path.sep}`)(relative) && relative !== ".." && !path.isAbsolute(relative);
    const ancestorOfSource = !Str.startsWith(`..${path.sep}`)(reverse) && reverse !== ".." && !path.isAbsolute(reverse);
    if (Str.isEmpty(relative) || ancestorOfSource || (view === "outward" && insideSource))
      return yield* KbError.make({
        message: "Output cannot replace the source; outward output must be outside the ledger root",
      });
    if (yield* fs.exists(target)) {
      const entries = yield* fs.readDirectory(target);
      if (A.isReadonlyArrayNonEmpty(entries))
        return yield* KbError.make({ message: "Output directory must be empty; use a fresh view directory" });
      const actual = yield* fs.realPath(target);
      if (actual !== target) return yield* KbError.make({ message: "Output directory cannot be a symbolic link" });
    }
    const artifacts = projectKb(loaded.claims, loaded.assertions, view);
    if (view === "outward" && hasKbCanary(artifacts))
      return yield* KbError.make({ message: "Outward canary check failed" });
    yield* fs.makeDirectory(target, { recursive: true });
    for (const [name, content] of R.toEntries(artifacts)) yield* fs.writeFileString(path.join(target, name), content);
    // Inspect the bytes on disk as well as the in-memory projection.
    if (view === "outward") {
      const names = yield* fs.readDirectory(target, { recursive: true });
      for (const name of names) {
        const content = yield* fs.readFileString(path.join(target, name));
        if (Str.includes("CANARY-INTERNAL-")(content))
          return yield* KbError.make({ message: "Outward canary check failed on disk" });
      }
    }
    return loaded.report;
  },
  Effect.mapError((error) => (S.is(KbError)(error) ? error : KbError.make({ message: "Cannot create knowledge view" })))
);

const validate = Command.make(
  "validate",
  { root: Flag.String("root") },
  Effect.fn("Kb.validate")(function* ({ root }) {
    const ledger = yield* KbLedger;
    const { report } = yield* ledger.read(root).pipe(
      Effect.catchTag(
        "KbError",
        Effect.fnUntraced(function* (error) {
          yield* printReport(
            KbReport.make({ valid: false, claims: 0, assertions: 0, outwardEligible: [], violations: [error.message] })
          );
          return yield* error;
        })
      )
    );
    yield* printReport(report);
    if (!report.valid) return yield* KbError.make({ message: "Ledger validation failed" });
  })
).pipe(Command.provide(ledgerLive));
const build = Command.make(
  "build",
  {
    root: Flag.String("root"),
    view: Flag.Literals("view", ["planning", "outward"]),
    out: Flag.String("out"),
  },
  Effect.fn("Kb.buildCommand")(function* ({ root, view, out }) {
    const report = yield* buildKb(root, view, out);
    yield* printReport(report);
  })
).pipe(Command.provide(ledgerLive));

const graph = Command.make(
  "graph",
  {
    root: Flag.String("root"),
    view: Flag.Literals("view", ["planning", "outward"]),
    out: Flag.String("out"),
    force: Flag.Boolean("force").pipe(Flag.withDefault(false)),
  },
  Effect.fn("Kb.graphCommand")(function* ({ root, view, out, force }) {
    const exporter = yield* KbGraphExport;
    const result = yield* exporter.write(root, view, out, force);
    yield* Console.log(
      `Graph written: ${result.stats.nodes} nodes, ${result.stats.links} links, ${result.stats.claims} claims`
    );
  })
).pipe(Command.provide(Layer.effect(KbGraphExport, makeKbGraphExport).pipe(Layer.provide(ledgerLive))));

/**
 * Knowledge ledger command group with mandatory root and output flags.
 * **Example** (Inspect the command name)
 * ```ts
 * import { kbCommand } from "@beep/repo-cli/commands/Kb"
 * console.log(kbCommand.name)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const kbCommand = Command.make("kb", {}, () =>
  Console.log(
    "kb validate --root <dir> | kb build --root <dir> --view planning|outward --out <dir> | kb graph --root <dir> --view planning|outward --out <file> [--force]"
  )
).pipe(
  Command.withDescription("Validate and project a generic evidence ledger"),
  Command.withSubcommands([validate, build, graph])
);
