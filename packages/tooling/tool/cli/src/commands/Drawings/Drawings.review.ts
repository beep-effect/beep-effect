/**
 * The `DrawingReview` service: open a review round over the sheet set that
 * was sent, ingest the pages the reviewer sent back, plan the findings from a
 * dispositions file, report status, record deliveries, and guard the approval
 * statement while required findings are open.
 *
 * **Details**
 *
 * Round files live at `<matter>/review/round-<n>/` under the corpus root and
 * nowhere else; reviewer PDFs must live under the corpus root too. Every read
 * of a round file is checked against the hash `round.json` recorded for it. A
 * review round never stands in for an approval.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { InkCoverageRequest, PageTextRequest, PdfPageRef, PdfTools } from "@beep/pdf-tools";
import { Sha256Hex } from "@beep/schema";
import { RenderManifest, sha256Hex } from "@beep/technical-drawing";
import { A, O } from "@beep/utils";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import {
  annotationNotes,
  applyDispositions,
  buildFindings,
  matchSheet,
  statementGuard,
  textLayerNotes,
} from "./Drawings.review.rules.ts";
import {
  DeliveryDraftFacts,
  DeliveryRecord,
  DeliveryWritten,
  ReviewDispositions,
  ReviewedPage,
  ReviewGuardVerdict,
  ReviewIntake,
  ReviewInventory,
  ReviewPageRef,
  ReviewRound,
  ReviewStatus,
  SheetCandidate,
} from "./Drawings.review.schemas.ts";
import type {
  DeliverRequest,
  ReviewIngestRequest,
  ReviewOpenRequest,
  ReviewPlanRequest,
  ReviewRoundLocation,
} from "./Drawings.review.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.review");
const ROUND_DIR = /^round-[1-9][0-9]*$/;

/**
 * Runtime shape of the {@link DrawingReview} service.
 *
 * **Example** (Stub the service)
 *
 * ```ts
 * import type { DrawingReviewShape } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const service: DrawingReviewShape = {
 *   open: () => Effect.die("not implemented"),
 *   ingest: () => Effect.die("not implemented"),
 *   plan: () => Effect.die("not implemented"),
 *   status: () => Effect.die("not implemented"),
 *   deliver: () => Effect.die("not implemented"),
 *   guard: () => Effect.die("not implemented")
 * }
 * console.log(Object.keys(service).length)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DrawingReviewShape {
  readonly deliver: (request: DeliverRequest) => Effect.Effect<DeliveryWritten, DrawingsCommandError>;
  readonly guard: (
    manifestPath: string,
    reviewDir: O.Option<string>
  ) => Effect.Effect<ReviewGuardVerdict, DrawingsCommandError>;
  readonly ingest: (request: ReviewIngestRequest) => Effect.Effect<ReviewStatus, DrawingsCommandError>;
  readonly open: (request: ReviewOpenRequest) => Effect.Effect<ReviewStatus, DrawingsCommandError>;
  readonly plan: (request: ReviewPlanRequest) => Effect.Effect<ReviewStatus, DrawingsCommandError>;
  readonly status: (location: ReviewRoundLocation) => Effect.Effect<ReviewStatus, DrawingsCommandError>;
}

const fail = (message: string) => (cause: unknown) => DrawingsCommandError.new(cause, message);
const refuse = (message: string) => DrawingsCommandError.make({ message });

// The review round records the branded `@beep/schema` digest.
const sha256 = flow(sha256Hex, Effect.map(Sha256Hex.make));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Read one of a review round's files and check it against the hash
 * `round.json` recorded for it.
 *
 * **Details**
 *
 * A file whose bytes no longer hash to the recorded value, a recorded file
 * that is missing, and (unless `draftAllowed`) a file `round.json` records no
 * hash for are refused as "changed outside beep drawings review". A missing
 * file with no recorded hash reads as `None`; so does an unrecorded file when
 * `draftAllowed` (a dispositions draft put in the round before planning).
 *
 * **Example** (Read inventory.json of a round)
 *
 * ```ts
 * import { readRoundFile } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const text = readRoundFile({ file: "/corpus/m-1/review/round-1/inventory.json", recorded: O.none(), draftAllowed: false })
 * console.log(text)
 * ```
 *
 * @param input - The file, the hash round.json records for it, and whether an unrecorded file is a draft.
 * @returns The file's text when it exists and matches, `None` when absent.
 * @category services
 * @since 0.0.0
 */
export const readRoundFile = Effect.fn("DrawingReview.readRoundFile")(function* (input: {
  readonly file: string;
  readonly recorded: O.Option<Sha256Hex>;
  readonly draftAllowed: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  const { file } = input;
  if (!(yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false)))) {
    return yield* O.match(input.recorded, {
      onNone: () => Effect.succeedNone,
      onSome: (hash) => Effect.fail(refuse(`"${file}" is missing, but round.json records sha256 ${hash} for it.`)),
    });
  }
  if (O.isNone(input.recorded)) {
    return input.draftAllowed
      ? O.none<string>()
      : yield* refuse(`"${file}" changed outside beep drawings review: round.json records no hash for it.`);
  }
  const bytes = yield* fs.readFile(file).pipe(Effect.mapError(fail(`Could not read "${file}".`)));
  const actual = yield* sha256(bytes);
  if (actual !== input.recorded.value) {
    return yield* refuse(
      `"${file}" changed outside beep drawings review (sha256 ${actual}, round.json records ${input.recorded.value}).`
    );
  }
  return O.some(decoder.decode(bytes));
});

const makeService = Effect.fn("DrawingReview.makeService")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tools = yield* PdfTools;

  const isWithin = (root: string, file: string): boolean => {
    const relative = path.relative(root, file);
    return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
  };

  const decodeJson =
    <A, I>(schema: S.Codec<A, I>, file: string, what: string) =>
    (text: string) =>
      S.decodeEffect(S.fromJsonString(schema))(text).pipe(Effect.mapError(fail(`"${file}" is not a valid ${what}.`)));

  const readJson = <A, I>(schema: S.Codec<A, I>, file: string, what: string) =>
    fs
      .readFileString(file)
      .pipe(Effect.mapError(fail(`Could not read ${what} "${file}".`)), Effect.flatMap(decodeJson(schema, file, what)));

  // Writes `value` as pretty JSON and returns the hash of the bytes written.
  const writeJson = Effect.fn("DrawingReview.writeJson")(function* <A, I>(
    schema: S.Codec<A, I>,
    file: string,
    value: A
  ) {
    const json = yield* S.encodeEffect(S.fromJsonString(schema, { space: 2 }))(value).pipe(
      Effect.mapError(fail(`Could not encode "${file}".`))
    );
    const bytes = encoder.encode(`${json}\n`);
    yield* fs.writeFile(file, bytes).pipe(Effect.mapError(fail(`Could not write "${file}".`)));
    return yield* sha256(bytes);
  });

  const realPath = (file: string, what: string) =>
    fs.realPath(file).pipe(Effect.mapError(fail(`${what} "${file}" does not exist.`)));

  const roundDirOf = Effect.fn("DrawingReview.roundDirOf")(function* (location: ReviewRoundLocation) {
    const root = yield* realPath(location.corpusRoot, "The corpus root");
    const matter = yield* realPath(path.resolve(root, location.matter), "The matter directory");
    if (!isWithin(root, matter)) {
      return yield* refuse(`The matter directory "${matter}" is not under the corpus root "${root}".`);
    }
    return { root, roundDir: path.join(matter, "review", `round-${location.round}`) };
  });

  // Re-hash the sheet set on disk so a round never ties to a PDF that changed.
  const loadSheetSet = Effect.fn("DrawingReview.loadSheetSet")(function* (manifestPath: string) {
    const resolved = path.resolve(manifestPath);
    const manifest = yield* readJson(RenderManifest, resolved, "render manifest");
    const pdfPath = path.join(path.dirname(resolved), manifest.pdfFile);
    const bytes = yield* fs.readFile(pdfPath).pipe(Effect.mapError(fail(`Could not read "${pdfPath}".`)));
    const onDisk = yield* sha256(bytes);
    if (onDisk !== manifest.pdfSha256) {
      return yield* refuse(`"${pdfPath}" no longer matches its manifest (sha256 ${onDisk} ≠ ${manifest.pdfSha256}).`);
    }
    return {
      manifest,
      manifestDir: path.dirname(resolved),
      pdfPath,
      sheetSetSha256: onDisk,
      specSha256: S.decodeOption(Sha256Hex)(manifest.specSha256),
    };
  });

  const readChecked = (input: Parameters<typeof readRoundFile>[0]) =>
    readRoundFile(input).pipe(Effect.provideService(FileSystem.FileSystem, fs));

  const readRound = Effect.fn("DrawingReview.readRound")(function* (roundDir: string, round: number) {
    const roundFile = path.join(roundDir, "round.json");
    if (!(yield* fs.exists(roundFile).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* refuse(`Review round ${round} is not open: "${roundFile}" does not exist.`);
    }
    return yield* readJson(ReviewRound, roundFile, "review round");
  });

  // `checkDispositions` is false only for plan, which replaces dispositions.json.
  const readStatus = Effect.fn("DrawingReview.readStatus")(function* (
    roundDir: string,
    round: number,
    checkDispositions: boolean
  ) {
    const record = yield* readRound(roundDir, round);
    const checked = Effect.fnUntraced(function* <A, I>(
      schema: S.Codec<A, I>,
      name: string,
      what: string,
      recorded: O.Option<Sha256Hex>
    ) {
      const file = path.join(roundDir, name);
      const text = yield* readChecked({ file, recorded, draftAllowed: false });
      return O.isSome(text) ? O.some(yield* decodeJson(schema, file, what)(text.value)) : O.none<A>();
    });
    if (checkDispositions) {
      yield* readChecked({
        file: path.join(roundDir, "dispositions.json"),
        recorded: record.dispositionsSha256,
        draftAllowed: true,
      });
    }
    return ReviewStatus.make({
      roundDir,
      round: record,
      intake: yield* checked(ReviewIntake, "intake.json", "review intake", record.intakeSha256),
      inventory: yield* checked(ReviewInventory, "inventory.json", "review inventory", record.inventorySha256),
    });
  });

  const open = Effect.fn("DrawingReview.open")(function* (request: ReviewOpenRequest) {
    const { roundDir } = yield* roundDirOf(request.location);
    const roundFile = path.join(roundDir, "round.json");
    if (yield* fs.exists(roundFile).pipe(Effect.orElseSucceed(() => false))) {
      return yield* refuse(`Review round ${request.location.round} is already open at "${roundDir}".`);
    }
    const set = yield* loadSheetSet(request.manifestPath);
    const delivery = yield* O.match(request.deliveryPath, {
      onNone: () => Effect.succeedNone,
      onSome: (file) => Effect.asSome(readJson(DeliveryRecord, path.resolve(file), "delivery record")),
    });
    if (O.exists(delivery, (record) => record.sheetSetSha256 !== set.sheetSetSha256)) {
      return yield* refuse(
        `The delivery record names sheet set ${O.getOrThrow(delivery).sheetSetSha256}, not the manifest's ${set.sheetSetSha256}.`
      );
    }
    const round = ReviewRound.make({
      schemaVersion: "drawing-review-round/v1",
      round: request.location.round,
      status: "open",
      reviewedSheetSetSha256: set.sheetSetSha256,
      reviewedSpecSha256: set.specSha256,
      sentMessageId: O.flatMap(delivery, (record) => record.sentMessageId),
    });
    yield* fs
      .makeDirectory(roundDir, { recursive: true })
      .pipe(Effect.mapError(fail(`Could not create "${roundDir}".`)));
    yield* writeJson(ReviewRound, roundFile, round);
    return ReviewStatus.make({ roundDir, round, intake: O.none(), inventory: O.none() });
  });

  const ingestPage = Effect.fn("DrawingReview.ingestPage")(function* (options: {
    readonly request: ReviewIngestRequest;
    readonly set: Effect.Success<ReturnType<typeof loadSheetSet>>;
    readonly pdfPath: string;
    readonly pdfSha256: Sha256Hex;
    readonly page: number;
    readonly annotations: Effect.Success<ReturnType<typeof tools.annotations>>;
  }) {
    const { request, set, pdfPath, page } = options;
    const file = path.basename(pdfPath);
    const candidates = yield* Effect.forEach(set.manifest.figures, (figure) =>
      tools
        .inkCoverage(
          InkCoverageRequest.make({
            base: PdfPageRef.make({ pdfPath: set.pdfPath, page: figure.figure }),
            marked: PdfPageRef.make({ pdfPath, page }),
            dpi: request.dpi,
            dilatePx: request.dilatePx,
          })
        )
        .pipe(
          Effect.mapError(fail(`Could not compare ${file} page ${page} with FIG. ${figure.figure}.`)),
          Effect.map((coverage) => SheetCandidate.make({ figure: figure.figure, page: figure.figure, coverage }))
        )
    );
    const override = pipe(
      A.findFirst(request.figureOverrides, (entry) => entry.file === file && entry.page === page),
      O.map((entry) => entry.figure)
    );
    const match = yield* Result.match(matchSheet({ sheetSetSha256: set.sheetSetSha256, candidates, override }), {
      onFailure: (reason) =>
        Effect.fail(
          refuse(`${file} page ${page}: ${reason}. Name its sheet with --figure ${file}:${page}=<FIG.> to go on.`)
        ),
      onSuccess: Effect.succeed,
    });
    const words = (pdf: string, at: number) =>
      tools
        .pageWords(PageTextRequest.make({ pdfPath: pdf, page: at }))
        .pipe(Effect.mapError(fail(`Could not read the text of "${pdf}" page ${at}.`)));
    const source = ReviewPageRef.make({ file, page });
    const notes = [
      ...textLayerNotes({
        pageBlocks: yield* words(pdfPath, page),
        baseBlocks: yield* words(set.pdfPath, match.page),
        source,
      }),
      ...annotationNotes({ annotations: options.annotations, source }),
    ];
    return ReviewedPage.make({ file, pdfSha256: options.pdfSha256, page, match, notes });
  });

  const ingest = Effect.fn("DrawingReview.ingest")(function* (request: ReviewIngestRequest) {
    const { root, roundDir } = yield* roundDirOf(request.location);
    // Ingest rewrites intake.json and inventory.json, so it reads round.json only.
    const round = yield* readRound(roundDir, request.location.round);
    if (round.status !== "open" && round.status !== "ingested") {
      return yield* refuse(
        `Review round ${round.round} is ${round.status}; ingesting again would drop its dispositions. Open a new round.`
      );
    }
    const set = yield* loadSheetSet(request.manifestPath);
    if (set.sheetSetSha256 !== round.reviewedSheetSetSha256) {
      return yield* refuse(
        `The manifest's sheet set ${set.sheetSetSha256} is not the set review round ${round.round} reviewed (${round.reviewedSheetSetSha256}).`
      );
    }
    const pdfPaths = yield* Effect.forEach(request.pdfPaths, (file) =>
      realPath(path.resolve(file), "The reviewer PDF").pipe(
        Effect.filterOrFail(
          (real) => isWithin(root, real),
          (real) => refuse(`The reviewer PDF "${real}" is not under the corpus root "${root}".`)
        )
      )
    );
    const names = A.map(pdfPaths, (file) => path.basename(file));
    const stray = A.filter(request.figureOverrides, (entry) => !A.contains(names, entry.file));
    if (A.isReadonlyArrayNonEmpty(stray)) {
      return yield* refuse(
        `--figure names a file that is not ingested: ${A.join(
          A.map(stray, (entry) => entry.file),
          ", "
        )}.`
      );
    }
    const pages = yield* Effect.forEach(
      pdfPaths,
      Effect.fnUntraced(function* (pdfPath) {
        const bytes = yield* fs.readFile(pdfPath).pipe(Effect.mapError(fail(`Could not read "${pdfPath}".`)));
        const pdfSha256 = yield* sha256(bytes);
        const structure = yield* tools.inspect(pdfPath).pipe(Effect.mapError(fail(`Could not parse "${pdfPath}".`)));
        const annotations = yield* tools
          .annotations(pdfPath)
          .pipe(Effect.mapError(fail(`Could not read the annotations of "${pdfPath}".`)));
        return yield* Effect.forEach(
          A.map(structure.pages, (_, index) => index + 1),
          (page) => ingestPage({ request, set, pdfPath, pdfSha256, page, annotations })
        );
      })
    ).pipe(Effect.map(A.flatten));
    const intake = ReviewIntake.make({
      schemaVersion: "drawing-review-intake/v1",
      round: round.round,
      reviewedSheetSetSha256: round.reviewedSheetSetSha256,
      pages,
    });
    const sheets = A.map(set.manifest.figures, (figure) => figure.figure);
    const findings = yield* Result.match(buildFindings({ round: round.round, sheets, pages }), {
      onFailure: (reason) => Effect.fail(refuse(`Review round ${round.round}: ${reason}.`)),
      onSuccess: Effect.succeed,
    });
    const inventory = ReviewInventory.make({
      schemaVersion: "drawing-review-inventory/v1",
      round: round.round,
      reviewedSheetSetSha256: round.reviewedSheetSetSha256,
      findings,
    });
    const intakeSha256 = yield* writeJson(ReviewIntake, path.join(roundDir, "intake.json"), intake);
    const inventorySha256 = yield* writeJson(ReviewInventory, path.join(roundDir, "inventory.json"), inventory);
    const next = ReviewRound.make({
      ...round,
      status: "ingested",
      intakeSha256: O.some(intakeSha256),
      inventorySha256: O.some(inventorySha256),
    });
    yield* writeJson(ReviewRound, path.join(roundDir, "round.json"), next);
    return ReviewStatus.make({ roundDir, round: next, intake: O.some(intake), inventory: O.some(inventory) });
  });

  const plan = Effect.fn("DrawingReview.plan")(function* (request: ReviewPlanRequest) {
    const { roundDir } = yield* roundDirOf(request.location);
    const current = yield* readStatus(roundDir, request.location.round, false);
    const round = current.round;
    if (round.status !== "ingested" && round.status !== "planned") {
      return yield* refuse(
        `Review round ${round.round} is ${round.status}; plan a round after ingest and before re-render.`
      );
    }
    const inventory = yield* Effect.fromOption(current.inventory).pipe(
      Effect.mapError(() => refuse(`Review round ${round.round} has no inventory.json; ingest it first.`))
    );
    const source = path.resolve(request.dispositionsPath);
    const bytes = yield* fs.readFile(source).pipe(Effect.mapError(fail(`Could not read "${source}".`)));
    const dispositions = yield* readJson(ReviewDispositions, source, "dispositions file");
    if (dispositions.round !== round.round) {
      return yield* refuse(`"${source}" is for review round ${dispositions.round}, not ${round.round}.`);
    }
    const findings = yield* Result.match(
      applyDispositions({ findings: inventory.findings, entries: dispositions.entries }),
      {
        onFailure: (reason) =>
          Effect.fail(
            refuse(`Review round ${round.round} cannot be planned; every finding needs one disposition:\n${reason}`)
          ),
        onSuccess: Effect.succeed,
      }
    );
    const target = path.join(roundDir, "dispositions.json");
    if (source !== target) {
      yield* fs.writeFile(target, bytes).pipe(Effect.mapError(fail(`Could not write "${target}".`)));
    }
    const planned = ReviewInventory.make({ ...inventory, findings });
    const inventorySha256 = yield* writeJson(ReviewInventory, path.join(roundDir, "inventory.json"), planned);
    const next = ReviewRound.make({
      ...round,
      status: "planned",
      dispositionsSha256: O.some(yield* sha256(bytes)),
      inventorySha256: O.some(inventorySha256),
    });
    yield* writeJson(ReviewRound, path.join(roundDir, "round.json"), next);
    return ReviewStatus.make({ roundDir, round: next, intake: current.intake, inventory: O.some(planned) });
  });

  const status = Effect.fn("DrawingReview.status")(function* (location: ReviewRoundLocation) {
    const { roundDir } = yield* roundDirOf(location);
    return yield* readStatus(roundDir, location.round, true);
  });

  const deliver = Effect.fn("DrawingReview.deliver")(function* (request: DeliverRequest) {
    const set = yield* loadSheetSet(request.manifestPath);
    const draft = yield* readJson(DeliveryDraftFacts, path.resolve(request.draftPath), "outbox draft result");
    if (!A.some(draft.attachments, (attachment) => attachment.sha256 === set.sheetSetSha256)) {
      return yield* refuse(
        `No attachment of the draft is the sheet-set PDF (sha256 ${set.sheetSetSha256}); attach "${path.basename(set.pdfPath)}" itself.`
      );
    }
    const out = O.getOrElse(O.map(request.outPath, path.resolve), () => path.join(set.manifestDir, "delivery.json"));
    if (yield* fs.exists(out).pipe(Effect.orElseSucceed(() => false))) {
      return yield* refuse(`"${out}" already exists; pass --out to record another delivery.`);
    }
    const record = DeliveryRecord.make({
      schemaVersion: "drawing-delivery/v1",
      sheetSetSha256: Sha256Hex.make(set.manifest.pdfSha256),
      pdfSha256: set.sheetSetSha256,
      draftId: draft.draftId,
      sentMessageId: request.sentMessageId,
      internetMessageId: request.internetMessageId,
      attachments: draft.attachments,
      deliveredAt: DateTime.formatIso(yield* DateTime.now),
    });
    yield* writeJson(DeliveryRecord, out, record);
    return DeliveryWritten.make({ path: out, record });
  });

  const ancestorsOf = (dir: string): A.NonEmptyReadonlyArray<string> => {
    const parent = path.dirname(dir);
    return parent === dir ? [dir] : [dir, ...ancestorsOf(parent)];
  };

  // The nearest `review/` directory in the manifest's directory or any above it.
  const findReviewDir = Effect.fn("DrawingReview.findReviewDir")(function* (manifestDir: string) {
    const ancestors = ancestorsOf(manifestDir);
    const hits = yield* Effect.forEach(ancestors, (dir) =>
      fs.stat(path.join(dir, "review")).pipe(
        Effect.map((info) => (info.type === "Directory" ? O.some(path.join(dir, "review")) : O.none<string>())),
        Effect.orElseSucceed(() => O.none<string>())
      )
    );
    return A.head(A.getSomes(hits));
  });

  const guard = Effect.fn("DrawingReview.guard")(function* (manifestPath: string, reviewDir: O.Option<string>) {
    const resolved = path.resolve(manifestPath);
    // Same wording as the approval service, which reads the manifest next.
    const manifest = yield* readJson(RenderManifest, resolved, "render manifest").pipe(
      Effect.mapError((error) => DrawingsCommandError.new(error, `Invalid render manifest "${resolved}".`))
    );
    const manifestDir = path.dirname(resolved);
    const dir = O.isSome(reviewDir) ? O.some(path.resolve(reviewDir.value)) : yield* findReviewDir(manifestDir);
    const entries = yield* O.match(dir, {
      onNone: () => Effect.succeed(A.empty<string>()),
      onSome: (review) =>
        fs
          .readDirectory(review)
          .pipe(
            Effect.map(A.filter((name) => ROUND_DIR.test(name))),
            Effect.map(A.map((name) => path.join(review, name))),
            Effect.mapError(fail(`Could not list "${review}".`))
          ),
    });
    const rounds = yield* Effect.forEach(entries, (roundDir) =>
      fs.exists(path.join(roundDir, "round.json")).pipe(
        Effect.orElseSucceed(() => false),
        Effect.flatMap((exists) =>
          exists
            ? Effect.map(readStatus(roundDir, 0, true), (status) =>
                O.some({ round: status.round, findings: O.map(status.inventory, (inventory) => inventory.findings) })
              )
            : Effect.succeedNone
        )
      )
    );
    const verdict = statementGuard({
      sheetSetSha256: Sha256Hex.make(manifest.pdfSha256),
      specSha256: S.decodeOption(Sha256Hex)(manifest.specSha256),
      rounds: A.getSomes(rounds),
    });
    return O.isSome(dir)
      ? verdict
      : ReviewGuardVerdict.make({
          ...verdict,
          warnings: A.append(
            verdict.warnings,
            `no review/ directory in "${manifestDir}" or any directory above it, so no review round guards this set; pass --review-dir if the matter's rounds live elsewhere`
          ),
        });
  });

  return DrawingReview.of({ open, ingest, plan, status, deliver, guard });
});

/**
 * Review rounds over delivered design-figure sheet sets.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { DrawingReview } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingReview)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DrawingReview extends Context.Service<DrawingReview, DrawingReviewShape>()($I`DrawingReview`) {
  /**
   * The service over `@beep/pdf-tools`, the file system, and paths.
   *
   * **Example** (Provide the PDF tools)
   *
   * ```ts
   * import { DrawingReview } from "@beep/repo-cli/commands/Drawings"
   * import { PdfTools } from "@beep/pdf-tools"
   * import * as Layer from "effect/Layer"
   *
   * console.log(DrawingReview.layer.pipe(Layer.provide(PdfTools.makeLayer())))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<DrawingReview, never, PdfTools | FileSystem.FileSystem | Path.Path> = Layer.effect(
    DrawingReview,
    makeService()
  );
}
