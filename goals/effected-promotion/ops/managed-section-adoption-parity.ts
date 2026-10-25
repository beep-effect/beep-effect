/**
 * Managed-section adoption parity (roadmap PR R8, map sites #89, #90, #260, #311).
 *
 * R8 moves three hand-rolled marker splicers in repo-cli onto `@beep/managed-section`:
 * the Observability standard section (`spliceStandardSection`), the Explore Atlas README status
 * region (`buildExplorationProjection`) and the Models generated block (`extractGeneratedBlock`).
 * The oracle is byte identity of every generated surface, so this script fingerprints what each
 * one produces over the live repository:
 *
 * - `observability`: `standards/architecture/12-observability.md` spliced with `STANDARD_SECTION`;
 * - `atlas`: the whole `buildExplorationProjection` plan (the Atlas bytes, every README projection
 *   and every issue);
 * - `models`: `extractGeneratedBlock` for every `beep-models:begin <id>` marker that is a whole line in
 *   a git-tracked file (prose that mentions a marker mid-line is covered by the `mid-line` probe).
 *
 * It also runs hand-written probes through the same exported functions (CRLF documents, duplicate,
 * orphaned, unterminated and mid-line markers, a block id outside the section-key grammar), so every
 * behaviour shift the switch makes has a witness.
 *
 * Run it once before the switch to record the baseline (`--out`), then after the switch with
 * `--before <baseline>`: every surface must match the baseline exactly, and every probe that changed
 * must be listed in `INTENDED_SHIFTS` with its reason. Nothing here runs in CI; the reports ride in
 * `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/managed-section-adoption-parity.ts [--out <report.json>] [--before <baseline.json>]
 *
 * Exit status is non-zero when a surface differs or a probe shift is unclassified.
 */
import * as NodeURL from "node:url";
import { buildExplorationProjection } from "@beep/repo-cli/commands/Explore";
import { extractGeneratedBlock } from "@beep/repo-cli/commands/Models";
import { STANDARD_SECTION, spliceStandardSection } from "@beep/repo-cli/commands/Observability";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PacketEventStoreLive } from "../../../packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketEventStore.ts";

const TOOL = "goals/effected-promotion/ops/managed-section-adoption-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const OBSERVABILITY_STANDARD = "standards/architecture/12-observability.md";

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const relative = (path: string): string => (Str.startsWith(repoRoot)(path) ? Str.slice(repoRoot.length)(path) : path);

const Probe = S.Struct({ id: S.String, output: S.NullOr(S.String) });
const ProbeShift = S.Struct({ id: S.String, before: S.NullOr(S.String), after: S.NullOr(S.String), reason: S.String });

const Surfaces = S.Struct({
  observability: S.Struct({
    path: S.String,
    inputSha256: S.String,
    outputSha256: S.NullOr(S.String),
    rewrites: S.Boolean,
  }),
  atlas: S.Struct({
    atlasSha256: S.String,
    readmes: S.Array(S.Struct({ path: S.String, existingSha256: S.String, projectedSha256: S.String })),
    issues: S.Array(S.Struct({ slug: S.String, path: S.String, detail: S.String })),
  }),
  models: S.Array(S.Struct({ path: S.String, blockId: S.String, extractedSha256: S.NullOr(S.String) })),
});

const Report = S.Struct({
  tool: S.String,
  surfaces: Surfaces,
  probes: S.Struct({ splice: S.Array(Probe), extract: S.Array(Probe) }),
  comparison: S.optionalKey(
    S.Struct({
      baseline: S.String,
      surfacesIdentical: S.Boolean,
      probeShifts: S.Array(ProbeShift),
      unclassified: S.Array(S.String),
    })
  ),
});
type Report = typeof Report.Type;
const ReportJson = S.fromJsonString(Report);
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(ReportJson);

class ParityFailed extends Data.TaggedError("ParityFailed")<{ readonly reasons: ReadonlyArray<string> }> {}

class GitFailed extends Data.TaggedError("GitFailed")<{ readonly exitCode: number }> {}

const BEGIN = "<!-- BEGIN GENERATED: INSTRUMENTATION CATALOG -->";
const END = "<!-- END GENERATED: INSTRUMENTATION CATALOG -->";
const modelsBegin = (id: string) => `<!-- beep-models:begin ${id} -->`;
const modelsEnd = (id: string) => `<!-- beep-models:end ${id} -->`;

const SPLICE_PROBES: ReadonlyArray<readonly [string, string]> = [
  ["lf", `# T\n\n${BEGIN}\nold\n${END}\n\nrest\n`],
  ["crlf", `# T\r\n\r\n${BEGIN}\r\nold\r\n${END}\r\n\r\nrest\r\n`],
  ["missing", "# none\n"],
  ["end-before-begin", `${END}\n${BEGIN}\n`],
  ["unterminated", `${BEGIN}\nold\n`],
  ["duplicate", `${BEGIN}\na\n${END}\n${BEGIN}\nb\n${END}\n`],
  ["mid-line", `x ${BEGIN}\nold\n${END}\n`],
  ["trailing-space", `${BEGIN}  \nold\n${END}  \nrest\n`],
  ["empty", `# 12\n\n${BEGIN}\n${END}\n`],
  ["bom", `﻿${BEGIN}\nold\n${END}\n`],
];

const EXTRACT_PROBES: ReadonlyArray<readonly [string, string, string]> = [
  ["lf", `intro\n${modelsBegin("x")}\nbody\n${modelsEnd("x")}\noutro\n`, "x"],
  ["missing-id", `intro\n${modelsBegin("x")}\nbody\n${modelsEnd("x")}\noutro\n`, "y"],
  ["crlf-multiline", `intro\r\n${modelsBegin("x")}\r\none\r\ntwo\r\n${modelsEnd("x")}\r\n`, "x"],
  ["padded-body", `${modelsBegin("x")}\n\n  body  \n\n${modelsEnd("x")}\n`, "x"],
  ["end-before-begin", `${modelsEnd("x")}\nbody\n${modelsBegin("x")}\n`, "x"],
  ["unterminated", `${modelsBegin("x")}\nbody\n`, "x"],
  ["duplicate", `${modelsBegin("x")}\na\n${modelsEnd("x")}\n${modelsBegin("x")}\nb\n${modelsEnd("x")}\n`, "x"],
  ["other-block-unterminated", `${modelsBegin("x")}\nbody\n${modelsEnd("x")}\n${modelsBegin("y")}\n`, "x"],
  ["mid-line", `a ${modelsBegin("x")}\nbody\n${modelsEnd("x")}\n`, "x"],
  ["invalid-id", `${modelsBegin("a b")}\nbody\n${modelsEnd("a b")}\n`, "a b"],
];

// Probe outputs the switch changes on purpose. Every key is a `<family>:<probe id>`.
const INTENDED_SHIFTS: Record<string, string> = {
  "splice:crlf":
    "The section is rendered in the document's dominant line ending, so a CRLF standard no longer gains LF-only lines.",
  "splice:duplicate":
    "A second marker pair is a duplicate section and refuses (the splice used to rewrite the first pair and leave the second).",
  "splice:mid-line": "A marker must start its line; a marker after other text on the line is prose, not a marker.",
  "splice:trailing-space":
    "Trailing blanks after a marker belong to the marker line, so the rewrite renders the canonical marker without them.",
  "extract:crlf-multiline": "The block body is read with its line endings normalized to LF, as the expected body is.",
  "extract:end-before-begin":
    "An end marker before its begin marker is an orphaned end and reads as no block (it used to read as missing too, through the index order).",
  "extract:unterminated": "An unterminated block reads as no block.",
  "extract:duplicate":
    "A block that appears twice reads as no block, so a stale second copy surfaces as drift instead of hiding behind the first.",
  "extract:mid-line": "A marker must start its line.",
  "extract:invalid-id": "A block id outside the section-key grammar names no block.",
};

const gitGrepFiles = (needle: string) =>
  Effect.suspend(() => {
    const result = Bun.spawnSync(["git", "grep", "-l", "-z", "-F", needle], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    // `git grep` exits 1 when nothing matches.
    return result.exitCode === 0 || result.exitCode === 1
      ? Effect.succeed(A.filter(Str.split("\u0000")(result.stdout.toString()), Str.isNonEmpty))
      : Effect.fail(new GitFailed({ exitCode: result.exitCode }));
  });

const blockIdsIn = (text: string): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(Str.matchAll(/^<!-- beep-models:begin ([A-Za-z0-9][A-Za-z0-9._-]*) -->\r?$/gm)(text)),
    A.map((match) => match[1] ?? ""),
    A.filter(Str.isNonEmpty),
    A.dedupe,
    A.sort(Order.String)
  );

const optionText = O.getOrNull;

const observabilitySurface = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const input = yield* fs.readFileString(`${repoRoot}${OBSERVABILITY_STANDARD}`);
  const output = spliceStandardSection(input, STANDARD_SECTION);
  return {
    path: OBSERVABILITY_STANDARD,
    inputSha256: sha256(input),
    outputSha256: O.getOrNull(O.map(output, sha256)),
    rewrites: !O.exists(output, (text) => text === input),
  };
});

const atlasSurface = Effect.gen(function* () {
  const projection = yield* buildExplorationProjection(repoRoot);
  return {
    atlasSha256: sha256(projection.atlasContent),
    readmes: A.map(projection.readmes, (readme) => ({
      path: relative(readme.path),
      existingSha256: sha256(readme.existing),
      projectedSha256: sha256(readme.projected),
    })),
    issues: A.map(projection.issues, (issue) => ({
      slug: issue.slug,
      path: relative(issue.path),
      detail: issue.detail,
    })),
  };
});

const modelsSurface = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const files = A.sort(yield* gitGrepFiles("<!-- beep-models:begin "), Order.String);
  const rows = yield* Effect.forEach(files, (path) =>
    fs.readFileString(`${repoRoot}${path}`).pipe(
      Effect.map((text) =>
        A.map(blockIdsIn(text), (blockId) => ({
          path,
          blockId,
          extractedSha256: O.getOrNull(O.map(extractGeneratedBlock(text, blockId), sha256)),
        }))
      )
    )
  );
  return A.flatten(rows);
});

const probeShifts = (before: Report, after: Report) => {
  const family = (name: "splice" | "extract") => {
    const previous = R.fromEntries(A.map(before.probes[name], (probe) => [probe.id, probe.output] as const));
    return A.filterMap(after.probes[name], (probe) => {
      const was = O.getOrNull(R.get(previous, probe.id));
      return was === probe.output
        ? O.none()
        : O.some({
            id: `${name}:${probe.id}`,
            before: was,
            after: probe.output,
            reason: O.getOrElse(R.get(INTENDED_SHIFTS, `${name}:${probe.id}`), () => ""),
          });
    });
  };
  return [...family("splice"), ...family("extract")];
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const surfaces = {
    observability: yield* observabilitySurface,
    atlas: yield* atlasSurface,
    models: yield* modelsSurface,
  };
  const probes = {
    splice: A.map(SPLICE_PROBES, ([id, text]) => ({
      id,
      output: optionText(spliceStandardSection(text, STANDARD_SECTION)),
    })),
    extract: A.map(EXTRACT_PROBES, ([id, text, blockId]) => ({
      id,
      output: optionText(extractGeneratedBlock(text, blockId)),
    })),
  };
  const current: Report = { tool: TOOL, surfaces, probes };

  const beforeIndex = process.argv.indexOf("--before");
  const baselinePath = beforeIndex === -1 ? O.none<string>() : O.fromNullishOr(process.argv[beforeIndex + 1]);
  const report: Report = yield* O.match(baselinePath, {
    onNone: () => Effect.succeed(current),
    onSome: (path) =>
      fs.readFileString(path).pipe(
        Effect.flatMap(decodeReport),
        Effect.map((before) => {
          const shifts = probeShifts(before, current);
          return {
            ...current,
            comparison: {
              baseline: relative(path),
              surfacesIdentical: JSON.stringify(before.surfaces) === JSON.stringify(current.surfaces),
              probeShifts: shifts,
              unclassified: A.filterMap(shifts, (shift) => (Str.isEmpty(shift.reason) ? O.some(shift.id) : O.none())),
            },
          };
        })
      ),
  });

  const json = yield* encodeReport(report);
  const outIndex = process.argv.indexOf("--out");
  yield* O.match(O.fromNullishOr(outIndex === -1 ? undefined : process.argv[outIndex + 1]), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });

  const reasons = A.appendAll(
    report.comparison === undefined || report.comparison.surfacesIdentical ? [] : ["generated surfaces differ"],
    A.map(report.comparison?.unclassified ?? [], (id) => `unclassified probe shift ${id}`)
  );
  yield* Console.log(
    `observability rewrites=${surfaces.observability.rewrites}; atlas readmes=${surfaces.atlas.readmes.length} issues=${surfaces.atlas.issues.length}; models blocks=${surfaces.models.length}; probe shifts=${report.comparison?.probeShifts.length ?? 0}`
  );
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* new ParityFailed({ reasons });
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer, PacketEventStoreLive.pipe(Layer.provide(NodeServices.layer))))
  )
);
