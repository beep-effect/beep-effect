/**
 * Design-figure vision judge: build a round pack (sheet PNGs, reference
 * photos, rendered drawing-rubric prompt) and ingest the judge's
 * `qa-inventory/v1` reply against the drawing lens family.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { PdfTools, PngRequest } from "@beep/pdf-tools";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { RenderManifest } from "@beep/technical-drawing";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, HashSet, Order, Path, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { DrawingQaLens, decodeQaInventory, QaInventory } from "../Qa/Inventory.schemas.ts";
import { DRAWING_JUDGE_PROMPT_TEMPLATE } from "../Qa/JudgePack.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.judge");
const decodeManifest = S.decodeEffect(S.fromJsonString(RenderManifest));
const SHEET_DPI = 110;
const PHOTO_EXTENSIONS = HashSet.fromIterable([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * One file the judge must open.
 *
 * **Example** (A sheet)
 *
 * ```ts
 * import { DrawingJudgeFile } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingJudgeFile.make({ kind: "sheet", path: "sheets/fig-1.png" }).kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DrawingJudgeFile extends S.Class<DrawingJudgeFile>($I`DrawingJudgeFile`)(
  {
    kind: S.Literals(["sheet", "screenshot"]).annotateKey({
      description: "`sheet` for a figure, `screenshot` for a photo.",
    }),
    path: S.NonEmptyString.annotateKey({ description: "Pack-relative path." }),
  },
  $I.annote("DrawingJudgeFile", { description: "One pack file the judge must open." })
) {}

/**
 * The judge pack's file manifest.
 *
 * **Example** (An empty pack)
 *
 * ```ts
 * import { DrawingJudgeManifest } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingJudgeManifest.make({ round: 1, files: [] }).round)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DrawingJudgeManifest extends S.Class<DrawingJudgeManifest>($I`DrawingJudgeManifest`)(
  {
    round: S.Int.annotateKey({ description: "Judge round." }),
    files: S.Array(DrawingJudgeFile).annotateKey({ description: "Every file the judge must open." }),
  },
  $I.annote("DrawingJudgeManifest", { description: "Round number and file list of a drawing judge pack." })
) {}

const encodeJudgeManifest = S.encodeEffect(S.fromJsonString(DrawingJudgeManifest));
const encodeInventory = S.encodeEffect(S.fromJsonString(QaInventory));

const fail = (message: string) => (cause: unknown) => DrawingsCommandError.new(cause, message);

const figuresTable = (manifest: RenderManifest): string =>
  [
    "| FIG. | View | Description | Sheet |",
    "| --- | --- | --- | --- |",
    ...A.map(
      manifest.figures,
      (f) => `| ${f.figure} | ${f.view} | ${f.description} | \`sheets/fig-${f.figure}.png\` |`
    ),
    ...(A.length(manifest.omissions) === 0
      ? []
      : [
          "",
          "Omitted views (proven by render diff, not drawn):",
          ...A.map(manifest.omissions, (o) => `- ${o.omitted}: ${o.relation} to ${o.shown}`),
        ]),
    "",
    manifest.shaded
      ? "The figures carry procedural straight-line surface shading."
      : "The figures are unshaded line drawings.",
  ].join("\n");

const UnknownJson = S.fromJsonString(S.Unknown);

const fillTemplate = (template: string, values: Readonly<Record<string, string>>): string =>
  pipe(
    R.toEntries(values),
    A.reduce(template, (text, [key, value]) => Str.replaceAll(`{{${key}}}`, value)(text))
  );

const copyPhotos = Effect.fn("DrawingsJudge.copyPhotos")(function* (photosDir: string, packDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs.readDirectory(photosDir).pipe(Effect.mapError(fail(`Could not list "${photosDir}".`)));
  const photos = pipe(
    names,
    A.filter((name) => HashSet.has(PHOTO_EXTENSIONS, path.extname(name).toLowerCase())),
    A.sort(Order.String)
  );
  yield* fs
    .makeDirectory(path.join(packDir, "photos"), { recursive: true })
    .pipe(Effect.mapError(fail("Could not create photos/.")));
  yield* Effect.forEach(photos, (name) =>
    fs
      .copyFile(path.join(photosDir, name), path.join(packDir, "photos", name))
      .pipe(Effect.mapError(fail(`Could not copy "${name}".`)))
  );
  return A.map(photos, (name) => DrawingJudgeFile.make({ kind: "screenshot", path: `photos/${name}` }));
});

/**
 * Build a drawing judge pack next to a render manifest.
 *
 * **Example** (Reference the builder)
 *
 * ```ts
 * import { buildDrawingJudgePack } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(typeof buildDrawingJudgePack)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const buildDrawingJudgePack = Effect.fn("DrawingsJudge.buildPack")(function* (input: {
  readonly manifestPath: string;
  readonly round: number;
  readonly photosDir: O.Option<string>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tools = yield* PdfTools;
  const manifestPath = path.resolve(input.manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const manifest = yield* fs
    .readFileString(manifestPath)
    .pipe(
      Effect.flatMap(decodeManifest),
      Effect.mapError(fail(`Could not read the render manifest "${manifestPath}".`))
    );
  const packDir = path.join(manifestDir, "judge", `round-${input.round}`);
  yield* fs
    .makeDirectory(path.join(packDir, "sheets"), { recursive: true })
    .pipe(Effect.mapError(fail("Could not create the pack.")));
  const sheets = yield* Effect.forEach(manifest.figures, (figure) =>
    tools
      .renderPng(
        PngRequest.make({
          pdfPath: path.join(manifestDir, manifest.pdfFile),
          page: figure.figure,
          dpi: SHEET_DPI,
          outputPath: path.join(packDir, "sheets", `fig-${figure.figure}.png`),
        })
      )
      .pipe(
        Effect.mapError(fail(`Could not render FIG. ${figure.figure}.`)),
        Effect.as(DrawingJudgeFile.make({ kind: "sheet", path: `sheets/fig-${figure.figure}.png` }))
      )
  );
  const photos = yield* O.match(input.photosDir, {
    onNone: () => Effect.succeed(A.empty<DrawingJudgeFile>()),
    onSome: (dir) => copyPhotos(dir, packDir),
  });
  const files = [...sheets, ...photos];
  const judgeManifest = yield* encodeJudgeManifest(DrawingJudgeManifest.make({ round: input.round, files })).pipe(
    Effect.mapError(fail("Could not encode the judge manifest."))
  );
  yield* fs
    .writeFileString(path.join(packDir, "manifest.json"), `${judgeManifest}\n`)
    .pipe(Effect.mapError(fail("Could not write manifest.json.")));
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(fail("Could not find the repository root.")));
  const template = yield* fs
    .readFileString(path.join(repoRoot, DRAWING_JUDGE_PROMPT_TEMPLATE))
    .pipe(Effect.mapError(fail(`Could not read ${DRAWING_JUDGE_PROMPT_TEMPLATE}.`)));
  const prompt = fillTemplate(template, {
    ROUND: `${input.round}`,
    TITLE: manifest.title,
    PACK_DIR: packDir,
    FIGURES: figuresTable(manifest),
    SESSION_REF: "../../manifest.json",
  });
  yield* fs
    .writeFileString(path.join(packDir, "prompt.md"), prompt)
    .pipe(Effect.mapError(fail("Could not write prompt.md.")));
  return { packDir, sheets: A.length(sheets), photos: A.length(photos) };
});

const FENCED_JSON = /```json\s*\n([\s\S]*?)\n```/;

// The judge's final message is a fenced json block followed by one line; a
// bare JSON file is accepted too.
const inventoryText = (text: string): string =>
  pipe(
    O.fromNullishOr(FENCED_JSON.exec(text)),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.getOrElse(() => text)
  );

const drawingLenses = HashSet.fromIterable(DrawingQaLens.literals);

const inventoryProblems = Effect.fn("DrawingsJudge.inventoryProblems")(function* (
  inventory: QaInventory,
  packDir: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lensProblems = pipe(
    inventory.findings,
    A.filter((finding) => !HashSet.has(drawingLenses, finding.lens)),
    A.map((finding) => `${finding.id}: lens "${finding.lens}" is not a drawing-rubric lens`)
  );
  const evidence = A.flatMap(inventory.findings, (finding) =>
    A.map(finding.evidence, (ref) => ({ id: finding.id, ref }))
  );
  const pathProblems = yield* Effect.forEach(evidence, ({ id, ref }) => {
    const resolved = path.resolve(packDir, ref.path);
    const inside = !path.relative(packDir, resolved).startsWith("..");
    return (inside ? fs.exists(resolved) : Effect.succeed(false)).pipe(
      Effect.orElseSucceed(() => false),
      Effect.map((exists) => (exists ? O.none() : O.some(`${id}: evidence "${ref.path}" is not a file in the pack`)))
    );
  });
  return [...lensProblems, ...A.getSomes(pathProblems)];
});

/**
 * Validate a judge reply against the drawing rubric and store it as the
 * round's `inventory.json`.
 *
 * **Example** (Reference the ingester)
 *
 * ```ts
 * import { ingestDrawingJudgeInventory } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(typeof ingestDrawingJudgeInventory)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const ingestDrawingJudgeInventory = Effect.fn("DrawingsJudge.ingest")(function* (input: {
  readonly packDir: string;
  readonly replyPath: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packDir = path.resolve(input.packDir);
  const reply = yield* fs
    .readFileString(input.replyPath)
    .pipe(Effect.mapError(fail(`Could not read "${input.replyPath}".`)));
  const parsed = yield* S.decodeEffect(UnknownJson)(inventoryText(reply)).pipe(
    Effect.mapError(fail("The judge reply has no parseable JSON inventory."))
  );
  const inventory = yield* decodeQaInventory(parsed).pipe(
    Effect.mapError(fail("The judge reply is not a valid qa-inventory/v1 (check requiredCount and lens slugs)."))
  );
  const problems = yield* inventoryProblems(inventory, packDir);
  if (A.length(problems) > 0) {
    return yield* DrawingsCommandError.new(
      problems,
      `The inventory breaks the drawing rubric:\n${A.join(problems, "\n")}`
    );
  }
  const json = yield* encodeInventory(inventory).pipe(Effect.mapError(fail("Could not encode the inventory.")));
  yield* fs
    .writeFileString(path.join(packDir, "inventory.json"), `${json}\n`)
    .pipe(Effect.mapError(fail("Could not write inventory.json.")));
  return inventory;
});
