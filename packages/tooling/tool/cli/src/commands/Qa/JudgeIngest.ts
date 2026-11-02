/**
 * The `beep qa judge-ingest` writer.
 *
 * The judge emits JSON and nothing else; the CLI is the single writer of
 * `inventory.json` and `inventory.md`. Ingest is where an inventory earns the
 * right to exist: it must parse as the last fenced JSON block, decode as
 * `qa-inventory/v1` (which already forces `requiredCount` to agree with the
 * findings), and survive the round cross-check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { writeFileWithinRootAtomically } from "@beep/file-processing/PathSafety";
import { SessionStore } from "@beep/qa-capture";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import {
  applyGateCertificatePlan,
  EvidenceDigest,
  EvidenceSubject,
  GateCertificateApplyVerdict,
  GateCertificateReceipt,
} from "@beep/skill-contract";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { encodeQaInventory } from "./Inventory.schemas.ts";
import {
  evidenceCrossCheckVerdictToCrossCheck,
  extractLastJsonBlock,
  raiseCrossCheckFailure,
  settleAgainstRound,
} from "./JudgeCheck.ts";
import {
  certifyQaJudgeSettlement,
  DeclaredRoundCoherentInput,
  DeclaredRoundCoherentVerdict,
  evaluateDeclaredRoundCoherent,
  evaluateJudgeOutputInventoryDecodes,
  JudgeOutputInventoryDecodesInput,
  JudgeOutputInventoryDecodesVerdict,
  QaJudgeCertificate,
  QaJudgeSettlement,
} from "./JudgeContract.ts";
import { QaCommandError } from "./Qa.errors.ts";
import { renderInventoryMarkdown } from "./Qa.render.ts";
import { qaRootPath, readEventLog } from "./Qa.session.ts";
import type { RoundLayout } from "@beep/qa-capture";
import type { GateCertificateApplyPlan } from "@beep/skill-contract";
import type * as Digest from "effect/crypto/Digest";
import type { QaInventory } from "./Inventory.schemas.ts";
import type { JudgeOutputDecodeFailure } from "./JudgeContract.ts";
import type { QaJudgeIngestOptions } from "./Qa.schemas.ts";

const encodeJsonEffect = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeGateCertificateJson = S.encodeEffect(S.fromJsonString(GateCertificateReceipt));
const decodeGateCertificateJson = S.decodeEffect(S.fromJsonString(GateCertificateReceipt));
const decodeSha256HexFromBytes = S.decodeEffect(Sha256HexFromBytes);
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
const evidenceSubjectEquivalence = S.toEquivalence(EvidenceSubject);

/**
 * File name of the schema-validated inventory inside a round.
 *
 * **Example** (Log inventory JSON filename)
 *
 * ```ts
 * import { INVENTORY_JSON_FILE } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 *
 * console.log(INVENTORY_JSON_FILE) // "inventory.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const INVENTORY_JSON_FILE = "inventory.json";

/**
 * File name of the rendered inventory inside a round.
 *
 * **Example** (Log inventory markdown filename)
 *
 * ```ts
 * import { INVENTORY_MARKDOWN_FILE } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 *
 * console.log(INVENTORY_MARKDOWN_FILE) // "inventory.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const INVENTORY_MARKDOWN_FILE = "inventory.md";

/**
 * File name of the QA judge gate certificate inside a round.
 *
 * **Details**
 *
 * Written beside `inventory.json` by every `judge-lint` run that finds an
 * inventory and by every `judge-ingest` run that writes one. Its envelope
 * subject is the SHA-256 of the exact `inventory.json` bytes.
 *
 * **Example** (Log the certificate filename)
 *
 * ```ts
 * import { GATE_CERTIFICATE_FILE } from "@beep/repo-cli/commands/Qa"
 *
 * console.log(GATE_CERTIFICATE_FILE) // "gate-certificate.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GATE_CERTIFICATE_FILE = "gate-certificate.json";

/**
 * Absolute path of a round's `inventory.json`.
 *
 * **Example** (Resolve inventory JSON path)
 *
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * import { inventoryJsonPath } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import * as Effect from "effect/Effect";
 * import * as Path from "effect/Path";
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const layout = RoundLayout.make({
 *     clipsDir: "/repo/.beep/qa/round-1/clips",
 *     eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *     framesDir: "/repo/.beep/qa/round-1/frames",
 *     reportPath: "/repo/.beep/qa/round-1/report.md",
 *     root: "/repo/.beep/qa/round-1",
 *     round: 1,
 *     sessionPath: "/repo/.beep/qa/round-1/session.json",
 *     sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *     videoDir: "/repo/.beep/qa/round-1/video"
 *   })
 *   return inventoryJsonPath(path, layout)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const inventoryJsonPath: {
  (layout: RoundLayout): (path: Path.Path) => string;
  (path: Path.Path, layout: RoundLayout): string;
} = dual(2, (path: Path.Path, layout: RoundLayout): string => path.join(layout.root, INVENTORY_JSON_FILE));

/**
 * Decode a judge inventory candidate through the inventory-decodes gate,
 * failing with the caller's message for each decode failure.
 *
 * **Example** (Decode a candidate inventory)
 *
 * ```ts
 * import { decodeJudgeInventory } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import * as Effect from "effect/Effect";
 * const decoded = decodeJudgeInventory("{}", {
 *   "inventory-schema-rejected": "schema rejected",
 *   "malformed-json": "not JSON",
 * })
 * console.log(Effect.isEffect(decoded)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const decodeJudgeInventory = Effect.fn("QaJudgeIngest.decodeJudgeInventory")(function* (
  candidate: string,
  messages: JudgeOutputDecodeMessages
): Effect.fn.Return<QaInventory, QaCommandError> {
  const verdict = yield* evaluateJudgeOutputInventoryDecodes(JudgeOutputInventoryDecodesInput.make({ candidate }));
  return yield* requireDecodedInventory(verdict, messages);
});

/**
 * Operator message for each judge-output decode failure stage.
 *
 * @category models
 * @since 0.0.0
 */
export type JudgeOutputDecodeMessages = { readonly [Failure in JudgeOutputDecodeFailure]: string };

/**
 * Return the inventory carried by an allowed decode verdict, or fail with the
 * caller's message for the denied stage.
 *
 * **Example** (Fail on malformed JSON)
 *
 * ```ts
 * import {
 *   evaluateJudgeOutputInventoryDecodes,
 *   JudgeOutputInventoryDecodesInput,
 *   requireDecodedInventory
 * } from "@beep/repo-cli/commands/Qa"
 * import * as Effect from "effect/Effect"
 *
 * const program = evaluateJudgeOutputInventoryDecodes(JudgeOutputInventoryDecodesInput.make({ candidate: "{" })).pipe(
 *   Effect.flatMap((verdict) =>
 *     requireDecodedInventory(verdict, { "inventory-schema-rejected": "schema rejected", "malformed-json": "not JSON" })
 *   ),
 *   Effect.flip
 * )
 * console.log(Effect.runSync(program).message) // "not JSON"
 * ```
 *
 * @param verdict - Evaluated judge-output decode verdict.
 * @param messages - Operator message for each decode failure stage.
 * @returns The decoded inventory, or the caller's failure for the denied stage.
 * @category use-cases
 * @since 0.0.0
 */
export const requireDecodedInventory: {
  (
    messages: JudgeOutputDecodeMessages
  ): (verdict: JudgeOutputInventoryDecodesVerdict) => Effect.Effect<QaInventory, QaCommandError>;
  (
    verdict: JudgeOutputInventoryDecodesVerdict,
    messages: JudgeOutputDecodeMessages
  ): Effect.Effect<QaInventory, QaCommandError>;
} = dual(
  2,
  (
    verdict: JudgeOutputInventoryDecodesVerdict,
    messages: JudgeOutputDecodeMessages
  ): Effect.Effect<QaInventory, QaCommandError> =>
    JudgeOutputInventoryDecodesVerdict.match(verdict, {
      allowed: ({ audit }) => Effect.succeed(audit.detail.inventory),
      denied: ({ audit }) =>
        Effect.fail(QaCommandError.make({ cause: audit.detail.issue, message: messages[audit.detail.failure] })),
    })
);

const subjectOfBytes = Effect.fn("QaJudgeIngest.subjectOfBytes")(function* (
  name: string,
  bytes: Uint8Array
): Effect.fn.Return<EvidenceSubject, QaCommandError, Digest.Digest> {
  const sha256 = yield* decodeSha256HexFromBytes(bytes).pipe(
    QaCommandError.mapError(`qa judge could not hash ${name} for the gate certificate.`)
  );
  return EvidenceSubject.make({ digest: EvidenceDigest.make({ sha256 }), name });
});

/**
 * Bind the exact bytes of a round's `inventory.json` as a certificate subject.
 *
 * **Example** (Bind empty inventory bytes)
 *
 * ```ts
 * import { inventoryEvidenceSubject } from "@beep/repo-cli/commands/Qa"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as Effect from "effect/Effect"
 *
 * const subject = await Effect.runPromise(
 *   inventoryEvidenceSubject(new Uint8Array()).pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(subject.digest.sha256) // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @param bytes - Exact `inventory.json` bytes as read or written.
 * @returns Subject named `inventory.json` carrying the SHA-256 of those bytes.
 * @category use-cases
 * @since 0.0.0
 */
export const inventoryEvidenceSubject = (
  bytes: Uint8Array
): Effect.Effect<EvidenceSubject, QaCommandError, Digest.Digest> => subjectOfBytes(INVENTORY_JSON_FILE, bytes);

/**
 * Certify one judge settlement, write `gate-certificate.json` into the round,
 * and return the receipt with the subject bound to the exact bytes written.
 *
 * **Details**
 *
 * Gates that did not run are certified `untested`; the certificate never
 * states `passed` for them. Legacy outputs are not touched.
 *
 * **Example** (Write a certificate and read back its bound subject)
 *
 * ```ts
 * import { QaJudgeSettlement, writeQaJudgeCertificate } from "@beep/repo-cli/commands/Qa"
 * import { RoundLayout } from "@beep/qa-capture"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract/EvidenceReceipt"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Path from "effect/Path"
 *
 * const layoutFor = (root: string) =>
 *   RoundLayout.make({
 *     clipsDir: `${root}/clips`,
 *     eventsPath: `${root}/events.ndjson`,
 *     framesDir: `${root}/frames`,
 *     reportPath: `${root}/report.md`,
 *     root,
 *     round: 1,
 *     sessionPath: `${root}/session.json`,
 *     sheetsDir: `${root}/sheets`,
 *     videoDir: `${root}/video`
 *   })
 * // A settlement whose gates never ran: every check is certified "untested".
 * const settlement = QaJudgeSettlement.make({
 *   artifact: O.none(),
 *   crossCheck: O.none(),
 *   decode: O.none(),
 *   eventId: O.none(),
 *   inventory: EvidenceSubject.make({
 *     digest: EvidenceDigest.make({
 *       sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *     }),
 *     name: "inventory.json"
 *   }),
 *   round: O.none()
 * })
 * const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, BunCrypto.layer)
 *
 * const written = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const fs = yield* FileSystem.FileSystem
 *     return yield* writeQaJudgeCertificate(layoutFor(yield* fs.makeTempDirectoryScoped()), settlement)
 *   }).pipe(Effect.scoped, Effect.provide(platform))
 * )
 * console.log(written.receipt.predicate.outcome) // "untested"
 * console.log(written.subject.name) // "gate-certificate.json"
 * console.log(written.subject.digest.sha256.length) // 64
 * ```
 *
 * @param layout - Round whose root receives the certificate.
 * @param settlement - Per-gate verdicts bound to the inventory digest.
 * @returns The written certificate and the digest-bound subject of its bytes.
 * @category use-cases
 * @since 0.0.0
 */
export const writeQaJudgeCertificate = Effect.fn("QaJudgeIngest.writeQaJudgeCertificate")(function* (
  layout: RoundLayout,
  settlement: QaJudgeSettlement
): Effect.fn.Return<QaJudgeCertificate, QaCommandError, FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const encoded = yield* encodeQaJudgeCertificate(settlement);
  // Temporary file plus rename: a failed write never truncates a certificate
  // already on disk.
  yield* writeFileWithinRootAtomically({
    bytes: encoded.bytes,
    candidate: GATE_CERTIFICATE_FILE,
    root: layout.root,
  }).pipe(QaCommandError.mapError(`qa judge could not write ${GATE_CERTIFICATE_FILE} into ${layout.root}.`));
  return encoded.certificate;
});

const encodeQaJudgeCertificate = Effect.fn("QaJudgeIngest.encodeQaJudgeCertificate")(function* (
  settlement: QaJudgeSettlement
) {
  const receipt = yield* certifyQaJudgeSettlement(settlement);
  const json = yield* encodeGateCertificateJson(receipt).pipe(
    QaCommandError.mapError("qa judge could not serialize the gate certificate.")
  );
  const bytes = utf8Encoder.encode(json);
  const subject = yield* subjectOfBytes(GATE_CERTIFICATE_FILE, bytes);
  return { bytes, certificate: QaJudgeCertificate.make({ receipt, subject }) };
});

/**
 * Write a set of round artifacts, restoring the previous set if any write fails.
 *
 * **Details**
 *
 * Each file is written with `writeFileWithinRootAtomically` (temporary file
 * plus rename). The prior bytes of every target are read first; when a write
 * fails, every target is put back to its prior bytes, or removed if it did
 * not exist, so a failed run never leaves a new inventory beside an old or
 * missing certificate. Commit and rollback run uninterruptibly, so a
 * cancelled run also ends with a complete old or new set. This is not crash
 * atomicity across files (a process kill can still stop between renames).
 */
const commitRoundArtifacts = Effect.fn("QaJudgeIngest.commitRoundArtifacts")(function* (
  root: string,
  artifacts: ReadonlyArray<readonly [name: string, bytes: Uint8Array]>
): Effect.fn.Return<void, QaCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const write = (name: string, bytes: Uint8Array) =>
    writeFileWithinRootAtomically({ bytes, candidate: name, root }).pipe(Effect.asVoid);
  const prior = yield* Effect.forEach(artifacts, ([name]) =>
    fs
      .exists(path.join(root, name))
      .pipe(
        Effect.flatMap((exists) => (exists ? Effect.asSome(fs.readFile(path.join(root, name))) : Effect.succeedNone))
      )
  ).pipe(QaCommandError.mapError(`qa judge-ingest could not read the previous artifacts in ${root}.`));
  // Only targets that were actually committed are rolled back. Every one of
  // them is restored even if an earlier restore fails; each failure is kept
  // with the file it belongs to.
  const committed = yield* Ref.make(0);
  const restore = (count: number) =>
    Effect.forEach(A.take(A.zip(artifacts, prior), count), ([[name], before]) =>
      O.match(before, {
        onNone: () =>
          fs.remove(path.join(root, name), { force: true }).pipe(QaCommandError.mapError(`could not remove ${name}`)),
        onSome: (bytes) => write(name, bytes).pipe(QaCommandError.mapError(`could not restore ${name}`)),
      }).pipe(
        Effect.match({
          onFailure: (error) => O.some({ error, name }),
          onSuccess: () => O.none(),
        })
      )
    ).pipe(Effect.map((results) => A.getSomes(results)));
  // The commit and its rollback form one uninterruptible critical section: an
  // interruption that arrives mid-commit takes effect only once the set is
  // either fully written or fully restored, never between files.
  yield* Effect.forEach(
    artifacts,
    ([name, bytes]) => write(name, bytes).pipe(Effect.andThen(Ref.update(committed, (count) => count + 1))),
    { discard: true }
  ).pipe(
    Effect.catch((cause) =>
      Effect.flatMap(Ref.get(committed), (count) =>
        Effect.flatMap(restore(count), (failures) =>
          A.match(failures, {
            onEmpty: () =>
              Effect.fail(
                QaCommandError.make({
                  cause,
                  message:
                    count === 0
                      ? `qa judge-ingest could not write into ${root}; no file was changed.`
                      : `qa judge-ingest could not write into ${root}; the previous inventory and gate certificate were restored.`,
                })
              ),
            onNonEmpty: (unrestored) =>
              Effect.fail(
                QaCommandError.make({
                  cause: [cause, ...A.map(unrestored, ({ error }) => error)],
                  message: `qa judge-ingest could not write into ${root}, and restoring ${A.join(
                    A.map(unrestored, ({ name }) => name),
                    ", "
                  )} also failed; the other files were restored. Check ${root} by hand.`,
                })
              ),
          })
        )
      )
    ),
    Effect.uninterruptible
  );
});

/**
 * Apply a plan to certificate bytes, recomputing their digest first.
 *
 * **Details**
 *
 * This is the consumer boundary for the kernel's `applyGateCertificatePlan`:
 * the subject the plan is checked against is always the SHA-256 of
 * `bytes`, never a caller-supplied value. The digest is compared before any
 * decode, so any change to the bytes, including corrupt JSON or a receipt that
 * no longer decodes, refuses the plan as `stale-digest`. Only bytes matching
 * the plan's subject are decoded; a decode failure there is a real error.
 *
 * **Example** (Apply a plan, then refuse it once the certificate bytes change)
 *
 * ```ts
 * import {
 *   applyQaJudgeCertificatePlan,
 *   GATE_CERTIFICATE_FILE,
 *   QaJudgeSettlement,
 *   writeQaJudgeCertificate
 * } from "@beep/repo-cli/commands/Qa"
 * import { GateId } from "@beep/skill-contract/Gate"
 * import { GateCertificateApplyPlan } from "@beep/skill-contract/GateCertificate"
 * import { RoundLayout } from "@beep/qa-capture"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract/EvidenceReceipt"
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import * as NodePath from "@effect/platform-node/NodePath"
 * import * as Effect from "effect/Effect"
 * import * as FileSystem from "effect/FileSystem"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 * import * as Path from "effect/Path"
 *
 * const layoutFor = (root: string) =>
 *   RoundLayout.make({
 *     clipsDir: `${root}/clips`,
 *     eventsPath: `${root}/events.ndjson`,
 *     framesDir: `${root}/frames`,
 *     reportPath: `${root}/report.md`,
 *     root,
 *     round: 1,
 *     sessionPath: `${root}/session.json`,
 *     sheetsDir: `${root}/sheets`,
 *     videoDir: `${root}/video`
 *   })
 * // A settlement whose gates never ran: every check is certified "untested".
 * const settlement = QaJudgeSettlement.make({
 *   artifact: O.none(),
 *   crossCheck: O.none(),
 *   decode: O.none(),
 *   eventId: O.none(),
 *   inventory: EvidenceSubject.make({
 *     digest: EvidenceDigest.make({
 *       sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *     }),
 *     name: "inventory.json"
 *   }),
 *   round: O.none()
 * })
 * const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, BunCrypto.layer)
 *
 * const { applied, stale } = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const fs = yield* FileSystem.FileSystem
 *     const path = yield* Path.Path
 *     const root = yield* fs.makeTempDirectoryScoped()
 *     const written = yield* writeQaJudgeCertificate(layoutFor(root), settlement)
 *     const bytes = yield* fs.readFile(path.join(root, GATE_CERTIFICATE_FILE))
 *     const plan = GateCertificateApplyPlan.make({
 *       certificate: written.subject,
 *       checkIds: [GateId.make("judge-output-inventory-decodes")]
 *     })
 *     const changed = Uint8Array.from([...bytes, 10]) // same receipt, one more byte
 *     return {
 *       applied: yield* applyQaJudgeCertificatePlan(plan, bytes),
 *       stale: yield* applyQaJudgeCertificatePlan(plan, changed)
 *     }
 *   }).pipe(Effect.scoped, Effect.provide(platform))
 * )
 * console.log(applied.verdict) // "applied"
 * console.log(stale.verdict === "refused" && stale.reason) // "stale-digest"
 * ```
 *
 * @param plan - Digest-bound apply-by-id plan.
 * @param bytes - Exact `gate-certificate.json` bytes as read.
 * @returns Applied checks, or a refusal value.
 * @category use-cases
 * @since 0.0.0
 */
export const applyQaJudgeCertificatePlan = Effect.fn("QaJudgeIngest.applyQaJudgeCertificatePlan")(function* (
  plan: GateCertificateApplyPlan,
  bytes: Uint8Array
): Effect.fn.Return<GateCertificateApplyVerdict, QaCommandError, Digest.Digest> {
  // Hash first: bytes that differ from the plan's subject are stale whatever
  // they contain, so they are refused before any decode is attempted.
  const subject = yield* subjectOfBytes(GATE_CERTIFICATE_FILE, bytes);
  if (!evidenceSubjectEquivalence(plan.certificate, subject)) {
    return GateCertificateApplyVerdict.cases.refused.make({ reason: "stale-digest", unknownIds: [] });
  }
  const receipt = yield* decodeGateCertificateJson(utf8Decoder.decode(bytes)).pipe(
    QaCommandError.mapError(`qa judge could not decode ${GATE_CERTIFICATE_FILE}.`)
  );
  return applyGateCertificatePlan(plan, subject, receipt);
});

const ingestDecodeMessages: JudgeOutputDecodeMessages = {
  "inventory-schema-rejected":
    "qa judge-ingest rejected the judge inventory. Check schemaVersion, finding ids (R<round>-<nn>), lens values, and that requiredCount equals the P0+P1 count.",
  "malformed-json": "qa judge-ingest could not parse the judge's final JSON block.",
};

const noJsonBlockMessage =
  "qa judge-ingest found no parseable JSON inventory object (fenced or unfenced) in the judge output.";

/**
 * Parse noisy judge output into a schema-valid inventory.
 *
 * **Example** (Parse non-JSON judge output)
 *
 * ```ts
 * import { parseJudgeOutput } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(parseJudgeOutput("no json here"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const parseJudgeOutput = Effect.fn("QaJudgeIngest.parseJudgeOutput")(function* (
  text: string
): Effect.fn.Return<QaInventory, QaCommandError> {
  const block = yield* Effect.fromOption(extractLastJsonBlock(text), () =>
    QaCommandError.make({ message: noJsonBlockMessage })
  );
  return yield* decodeJudgeInventory(block, ingestDecodeMessages);
});

/**
 * Ingest a judge transcript into a round's `inventory.json` and `inventory.md`.
 *
 * **Example** (Ingest judge transcript effect)
 *
 * ```ts
 * import { runQaJudgeIngest } from "@beep/repo-cli/commands/Qa/JudgeIngest"
 * import { QaJudgeIngestOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as Effect from "effect/Effect";
 * const options = QaJudgeIngestOptions.make({ from: "judge-stdout.txt", round: 3 })
 * console.log(Effect.isEffect(runQaJudgeIngest("/repo", options))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaJudgeIngest = Effect.fn("QaJudgeIngest.run")(function* (
  cwd: string,
  options: QaJudgeIngestOptions
  // Every `beep qa` subcommand opens with the same service acquisition and
  // round-layout read; only the error wording each command owns differs.
  // fallow-ignore-next-line code-duplication -- every `beep qa` subcommand repeats this service-acquisition and round-layout prologue with its own error wording. Owner: @beep/repo-cli. Exit: extract a shared Qa round-layout prologue once a third caller needs different wording rules.
): Effect.fn.Return<QaInventory, QaCommandError, FileSystem.FileSystem | Path.Path | SessionStore | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;

  const layout = store.roundLayout(qaRootPath(path, cwd), options.round);
  const raw = yield* fs
    .readFileString(path.resolve(options.from))
    .pipe(QaCommandError.mapError(`qa judge-ingest could not read the judge output at ${options.from}.`));
  const block = yield* Effect.fromOption(extractLastJsonBlock(raw), () =>
    QaCommandError.make({ message: noJsonBlockMessage })
  );
  const decode = yield* evaluateJudgeOutputInventoryDecodes(
    JudgeOutputInventoryDecodesInput.make({ candidate: block })
  );
  const inventory = yield* requireDecodedInventory(decode, ingestDecodeMessages);

  const round = yield* evaluateDeclaredRoundCoherent(
    DeclaredRoundCoherentInput.make({ declaredRound: inventory.round, requestedRound: options.round })
  );
  yield* DeclaredRoundCoherentVerdict.match(round, {
    allowed: () => Effect.void,
    denied: ({ audit }) =>
      Effect.fail(
        QaCommandError.make({
          message: `qa judge-ingest was asked for round ${audit.detail.requestedRound} but the inventory declares round ${audit.detail.declaredRound}.`,
        })
      ),
  });

  const eventLog = yield* readEventLog(layout.eventsPath);
  const settled = yield* settleAgainstRound(layout, inventory, eventLog);
  yield* raiseCrossCheckFailure(options.round, evidenceCrossCheckVerdictToCrossCheck(settled.crossCheck));

  const encoded = yield* encodeQaInventory(inventory).pipe(
    QaCommandError.mapError("qa judge-ingest could not encode the inventory.")
  );
  const json = yield* encodeJsonEffect(encoded).pipe(
    QaCommandError.mapError("qa judge-ingest could not serialize the inventory.")
  );
  const bytes = utf8Encoder.encode(json);

  const certificate = yield* encodeQaJudgeCertificate(
    QaJudgeSettlement.make({
      artifact: O.some(settled.artifact),
      crossCheck: O.some(settled.crossCheck),
      decode: O.some(decode),
      eventId: O.some(settled.eventId),
      inventory: yield* inventoryEvidenceSubject(bytes),
      round: O.some(round),
    })
  );
  // inventory.json, inventory.md and gate-certificate.json are prepared in
  // memory first and committed as one set, restored together on failure.
  yield* commitRoundArtifacts(layout.root, [
    [INVENTORY_JSON_FILE, bytes],
    [INVENTORY_MARKDOWN_FILE, utf8Encoder.encode(renderInventoryMarkdown(inventory))],
    [GATE_CERTIFICATE_FILE, certificate.bytes],
  ]);

  yield* printLines([
    `qa judge-ingest: round ${options.round}`,
    `  findings: ${A.length(inventory.findings)}`,
    `  inventory: ${inventoryJsonPath(path, layout)}`,
    `REQUIRED FINDINGS: ${inventory.requiredCount}`,
  ]);

  return inventory;
});
