/**
 * `DrawingIntake`: pull one Outlook message's file attachments into a
 * directory under the corpus root, dedupe them by SHA-256 against the files
 * already there, and write a `drawing-intake/v1` record beside them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  GraphPathSegment,
  loadM365AppOnlyEnv,
  M365,
  M365DownloadMessageAttachmentRequest,
  M365GetMessageRequest,
  M365ListMessageAttachmentsRequest,
  M365ListMessagesRequest,
  OutlookItemRef,
  OutlookItemRefFromInput,
} from "@beep/m365";
import { EmailString } from "@beep/schema";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printLines } from "../../internal/cli/Printer.ts";
import { DrawingIntakeError, DrawingsCommandError } from "./Drawings.errors.ts";
import {
  IntakeAttachment,
  IntakePickFromString,
  IntakeRecord,
  IntakeRequest,
  IntakeResult,
  MessageFacts,
} from "./Drawings.intake.schemas.ts";
import type {
  GraphAttachment,
  GraphMessage,
  GraphRecipient,
  M365AppOnlyConfigInput,
  M365AppOnlyEnvSettings,
  M365Error,
} from "@beep/m365";
import type { Sha256Hex } from "@beep/schema/Sha256";
import type { IntakeAttachmentOutcome, IntakePick } from "./Drawings.intake.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.intake");

const FILE_ATTACHMENT = "#microsoft.graph.fileAttachment";
// Graph answers 404 for an unknown message id and 400 for an id of the wrong kind (a conversation id as a
// message id). A 400 from the conversation listing is a refused query, never "not found".
const MESSAGE_NOT_FOUND_STATUSES = HashSet.make(400, 404);
const LISTING_NOT_FOUND_STATUSES = HashSet.make(404);
const CONVERSATION_PAGE_SIZE = 50;
const MAX_CONVERSATION_PAGES = 20;
const MAX_CONVERSATION_MESSAGES = CONVERSATION_PAGE_SIZE * MAX_CONVERSATION_PAGES;
const RECORD_NAME_PATTERN = /^intake(-\d+)?\.json$/;
const UNSAFE_NAME_PATTERN = /[\p{Cc}<>:"/\\|?*]+/gu;
const WHITESPACE_RUN_PATTERN = /\s+/gu;
const LEADING_DOTS_PATTERN = /^\.+/;
const SHORT_HASH_LENGTH = 8;

const decodeSha256 = S.decodeEffect(Sha256HexFromBytes);
const decodeEmail = S.decodeUnknownEffect(EmailString);
const encodeRecord = S.encodeEffect(S.fromJsonString(IntakeRecord, { space: 2 }));

const refused = (message: string): DrawingIntakeError => DrawingIntakeError.make({ reason: "refused", message });

const mailError =
  (what: string) =>
  (cause: M365Error): DrawingIntakeError => {
    const status = O.match(cause.status, { onNone: () => "", onSome: (code) => ` ${code}` });
    return DrawingIntakeError.make({ reason: "mail", message: `${what} (${cause.reason}${status}).`, cause });
  };

const isNotFoundIn =
  (statuses: HashSet.HashSet<number>) =>
  (error: M365Error | DrawingIntakeError): boolean =>
    error._tag === "M365Error" &&
    error.reason === "response status" &&
    O.exists(error.status, (status) => HashSet.has(statuses, status));

const isMailFailure = (error: DrawingIntakeError): boolean => error.reason === "mail";

const addressOf = (recipient: O.Option<GraphRecipient>): O.Option<string> =>
  pipe(
    recipient,
    O.flatMap((r) => r.emailAddress),
    O.flatMap((email) => email.address),
    O.filter(Str.isNonEmpty)
  );

const rawSenderOf = (message: GraphMessage): O.Option<string> =>
  O.orElse(addressOf(message.from), () => addressOf(message.sender));

// Drafts are never a reviewer's input; the mailbox's own mail (sheets we sent, replies from the outbox) is
// set aside unless the request includes it. A mailbox given as a user id matches no address and sets nothing aside.
const isEligible =
  (mailbox: string, includeOwn: boolean) =>
  (message: GraphMessage): boolean => {
    const own = Str.toLowerCase(mailbox);
    const sentByMailbox = A.some([addressOf(message.from), addressOf(message.sender)], (address) =>
      O.exists(address, (value) => Str.toLowerCase(value) === own)
    );
    return !O.getOrElse(message.isDraft, () => false) && (includeOwn || !sentByMailbox);
  };

const isWithin = (path: Path.Path, root: string, file: string): boolean => {
  const relative = path.relative(root, file);
  return relative.length > 0 && !Str.startsWith("..")(relative) && !path.isAbsolute(relative);
};

// A plain file name: no separators, control or shell-hostile characters, no leading dots, never a record name.
const sanitizedName: (name: string) => string = flow(
  Str.replaceAll(UNSAFE_NAME_PATTERN, "_"),
  Str.replaceAll(WHITESPACE_RUN_PATTERN, " "),
  Str.trim,
  Str.replace(LEADING_DOTS_PATTERN, ""),
  O.liftPredicate(Str.isNonEmpty),
  O.map((name) => (RECORD_NAME_PATTERN.test(name) ? `attachment-${name}` : name)),
  O.getOrElse(() => "attachment")
);

const withShortHash = (fileName: string, sha256: Sha256Hex): string => {
  const tag = ` (${Str.takeLeft(sha256, SHORT_HASH_LENGTH)})`;
  return O.match(Str.lastIndexOf(".")(fileName), {
    onNone: () => `${fileName}${tag}`,
    onSome: (index) =>
      index === 0 ? `${fileName}${tag}` : `${Str.slice(0, index)(fileName)}${tag}${Str.slice(index)(fileName)}`,
  });
};

const recordNameFor = (taken: MutableHashSet.MutableHashSet<string>, n: number): string => {
  const candidate = n === 1 ? "intake.json" : `intake-${n}.json`;
  return MutableHashSet.has(taken, candidate) ? recordNameFor(taken, n + 1) : candidate;
};

const receivedAtOf = (message: GraphMessage): string => O.getOrElse(message.receivedDateTime, () => "");
const newestFirst = Order.flip(Order.mapInput(Order.String, receivedAtOf));

const pickIndex = (pick: IntakePick): number => (pick === "latest" ? 0 : pick - 1);

const escapeODataString = Str.replaceAll("'", "''");

type RowFields = {
  readonly bytes: number;
  readonly sha256?: Sha256Hex;
  readonly savedAs?: string;
  readonly duplicateOf?: string;
};

type IntakeRow = (outcome: IntakeAttachmentOutcome, fields: RowFields) => IntakeAttachment;

// The intake directory as scanned: its real path, the files in it by content hash, and every taken name.
type OutDir = {
  readonly realOut: string;
  readonly byHash: MutableHashMap.MutableHashMap<Sha256Hex, string>;
  readonly taken: MutableHashSet.MutableHashSet<string>;
};

const attachmentNameOf = (attachment: GraphAttachment): string => O.getOrElse(attachment.name, () => "");
const declaredBytesOf = (attachment: GraphAttachment): number => O.getOrElse(attachment.size, () => 0);

const rowFor =
  (attachment: GraphAttachment): IntakeRow =>
  (outcome, fields) =>
    IntakeAttachment.make({
      attachmentId: attachment.id,
      name: attachmentNameOf(attachment),
      savedAs: O.fromUndefinedOr(fields.savedAs),
      contentType: attachment.contentType,
      bytes: fields.bytes,
      sha256: O.fromUndefinedOr(fields.sha256),
      outcome,
      duplicateOf: O.fromUndefinedOr(fields.duplicateOf),
    });

const isItemAttachment = (attachment: GraphAttachment): boolean =>
  O.getOrElse(attachment["@odata.type"], () => FILE_ATTACHMENT) !== FILE_ATTACHMENT;
const isInlineAttachment = (attachment: GraphAttachment): boolean => O.getOrElse(attachment.isInline, () => false);

// The outcome that skips an attachment without downloading it: an item, an inline file, or a declared size over the cap.
const skipOutcomeOf = (maxBytes: number): ((attachment: GraphAttachment) => O.Option<IntakeAttachmentOutcome>) =>
  Match.type<GraphAttachment>().pipe(
    Match.when(isItemAttachment, () => O.some<IntakeAttachmentOutcome>("skipped-item")),
    Match.when(isInlineAttachment, () => O.some<IntakeAttachmentOutcome>("skipped-inline")),
    Match.when(
      (attachment: GraphAttachment) => declaredBytesOf(attachment) > maxBytes,
      () => O.some<IntakeAttachmentOutcome>("skipped-oversize")
    ),
    Match.orElse(() => O.none<IntakeAttachmentOutcome>())
  );

// Content already in the directory: unchanged when it holds the wanted name, otherwise a duplicate of its holder.
const knownRow = (
  row: IntakeRow,
  fields: { readonly bytes: number; readonly sha256: Sha256Hex },
  wanted: string,
  holder: string
): IntakeAttachment =>
  holder === wanted
    ? row("unchanged", { ...fields, savedAs: wanted })
    : row("duplicate", { ...fields, duplicateOf: holder });

type Resolved = {
  readonly message: GraphMessage;
  readonly conversationSize: O.Option<number>;
  readonly setAside: number;
};

/**
 * Runtime shape of the {@link DrawingIntake} service.
 *
 * **Example** (Stub service)
 *
 * ```ts
 * import type { DrawingIntakeShape } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * const service: DrawingIntakeShape = { pull: () => Effect.die("not implemented") }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DrawingIntakeShape {
  readonly pull: (request: IntakeRequest) => Effect.Effect<IntakeResult, DrawingIntakeError>;
}

const makeService = Effect.fn("DrawingIntake.makeService")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const m365 = yield* M365;
  const crypto = yield* Crypto.Crypto;

  const io =
    (what: string) =>
    (cause: unknown): DrawingIntakeError =>
      DrawingIntakeError.make({ reason: "io", message: what, cause });

  const hash = (bytes: Uint8Array) =>
    decodeSha256(bytes).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(io("Could not hash attachment bytes."))
    );

  const asMessage = (mailbox: string, id: string): Effect.Effect<O.Option<Resolved>, DrawingIntakeError> =>
    m365.getMessage(M365GetMessageRequest.make({ messageId: id, userId: O.some(mailbox) })).pipe(
      Effect.map((message) => O.some({ message, conversationSize: O.none(), setAside: 0 })),
      Effect.catchIf(isNotFoundIn(MESSAGE_NOT_FOUND_STATUSES), () => Effect.succeedNone),
      Effect.mapError(mailError("Could not read the message"))
    );

  // Newest-first is applied after the listing, so a conversation cut off at the page cap could hide its
  // newest message: a page link left after the last allowed page refuses the intake instead.
  const collectPages = (
    mailbox: string,
    request: M365ListMessagesRequest,
    collected: ReadonlyArray<GraphMessage>,
    pagesLeft: number
  ): Effect.Effect<ReadonlyArray<GraphMessage>, M365Error | DrawingIntakeError> =>
    m365.listMessages(request).pipe(
      Effect.flatMap((page) => {
        const all = A.appendAll(collected, page.value);
        return O.match(page["@odata.nextLink"], {
          onNone: () => Effect.succeed(all),
          onSome: (link) =>
            pagesLeft > 1
              ? collectPages(
                  mailbox,
                  M365ListMessagesRequest.make({ nextLink: O.some(link), userId: O.some(mailbox) }),
                  all,
                  pagesLeft - 1
                )
              : Effect.fail(
                  refused(
                    `The conversation has more than ${MAX_CONVERSATION_MESSAGES} messages; name the message instead of the conversation.`
                  )
                ),
        });
      })
    );

  // Graph refuses `$orderby` on a property the `$filter` does not name, so the newest-first order, and the
  // draft and own-mail exclusion, are applied here: the listing spans every folder, Sent Items and Drafts included.
  const asConversation = Effect.fnUntraced(function* (
    mailbox: string,
    id: string,
    pick: IntakePick,
    includeOwn: boolean
  ): Effect.fn.Return<O.Option<Resolved>, DrawingIntakeError> {
    const first = M365ListMessagesRequest.make({
      filter: O.some(`conversationId eq '${escapeODataString(id)}'`),
      top: O.some(CONVERSATION_PAGE_SIZE),
      userId: O.some(mailbox),
    });
    const messages = yield* collectPages(mailbox, first, [], MAX_CONVERSATION_PAGES).pipe(
      Effect.catchIf(isNotFoundIn(LISTING_NOT_FOUND_STATUSES), () => Effect.succeed(A.empty<GraphMessage>())),
      Effect.catchTag("M365Error", flow(mailError("Could not list the conversation's messages"), Effect.fail))
    );
    if (!A.isReadonlyArrayNonEmpty(messages)) {
      return O.none();
    }
    const candidates = A.sort(A.filter(messages, isEligible(mailbox, includeOwn)), newestFirst);
    const setAside = A.length(messages) - A.length(candidates);
    if (!A.isReadonlyArrayNonEmpty(candidates)) {
      return yield* refused(
        `The conversation has ${A.length(messages)} message(s), all drafts${includeOwn ? "" : " or sent from the mailbox"}; ` +
          `nothing to pull${includeOwn ? "" : " (--include-own considers the mailbox's own mail)"}.`
      );
    }
    const message = yield* Effect.fromOption(A.get(candidates, pickIndex(pick)), () =>
      refused(
        `The conversation has ${A.length(candidates)} message(s) to pick from (${setAside} set aside); --pick ${pick} is out of range.`
      )
    );
    return O.some({ message, conversationSize: O.some(A.length(candidates)), setAside });
  });

  // The id prefix is only a hint: try the kind it suggests first, then the other. A Graph failure of the
  // first lookup does not stop the second; when neither finds the item, the first failure is reported.
  const resolve = Effect.fn("DrawingIntake.resolve")(function* (request: IntakeRequest) {
    const { id } = request.ref;
    const message = asMessage(request.mailbox, id);
    const conversation = asConversation(request.mailbox, id, request.pick, request.includeOwn);
    const [first, second] = OutlookItemRef.match(request.ref, {
      message: () => [message, conversation] as const,
      conversation: () => [conversation, message] as const,
    });
    const viaFirst = yield* first.pipe(
      Effect.map((found) => ({ found, failure: O.none<DrawingIntakeError>() })),
      Effect.catchIf(isMailFailure, (failure) =>
        Effect.succeed({ found: O.none<Resolved>(), failure: O.some(failure) })
      )
    );
    if (O.isSome(viaFirst.found)) {
      return viaFirst.found.value;
    }
    const viaSecond = yield* second.pipe(
      Effect.catchIf(isMailFailure, (failure) => Effect.fail(O.getOrElse(viaFirst.failure, () => failure)))
    );
    if (O.isSome(viaSecond)) {
      return viaSecond.value;
    }
    return yield* O.getOrElse(viaFirst.failure, () =>
      DrawingIntakeError.make({
        reason: "not-found",
        message: `No message or conversation "${id}" in mailbox "${request.mailbox}".`,
      })
    );
  });

  // Provenance is recorded as far as Graph reports it; a missing or non-SMTP field never stops the pull.
  const factsOf = Effect.fnUntraced(function* (message: GraphMessage) {
    const from = rawSenderOf(message);
    const fromEmail = yield* O.match(from, {
      onNone: () => Effect.succeedNone,
      onSome: (address) => decodeEmail(address).pipe(Effect.option),
    });
    return MessageFacts.make({
      messageId: message.id,
      internetMessageId: message.internetMessageId,
      conversationId: message.conversationId,
      from,
      fromEmail,
      receivedAt: message.receivedDateTime,
      subject: O.getOrElse(message.subject, () => ""),
    });
  });

  const realPathOf = (target: string) =>
    fs.realPath(target).pipe(Effect.mapError(io(`Could not resolve "${target}".`)));

  const nearestExisting = (target: string): Effect.Effect<string, DrawingIntakeError> =>
    fs.exists(target).pipe(
      Effect.mapError(io(`Could not inspect "${target}".`)),
      Effect.flatMap((exists) =>
        exists || path.dirname(target) === target ? Effect.succeed(target) : nearestExisting(path.dirname(target))
      )
    );

  // Every existing file in the intake directory, by content hash (first name wins), plus every taken name.
  const scanOut = Effect.fnUntraced(function* (outDir: string) {
    const names = A.sort(
      yield* fs.readDirectory(outDir).pipe(Effect.mapError(io(`Could not list "${outDir}".`))),
      Order.String
    );
    const byHash = MutableHashMap.empty<Sha256Hex, string>();
    yield* Effect.forEach(
      A.filter(names, (name) => !RECORD_NAME_PATTERN.test(name)),
      Effect.fnUntraced(function* (name) {
        const file = path.join(outDir, name);
        const info = yield* fs.stat(file).pipe(Effect.mapError(io(`Could not stat "${file}".`)));
        if (info.type !== "File") {
          return;
        }
        const sha256 = yield* hash(yield* fs.readFile(file).pipe(Effect.mapError(io(`Could not read "${file}".`))));
        if (!MutableHashMap.has(byHash, sha256)) {
          MutableHashMap.set(byHash, sha256, name);
        }
      }),
      { discard: true }
    );
    return { byHash, taken: MutableHashSet.fromIterable(names) };
  });

  const download = (mailbox: string, messageId: string, attachment: GraphAttachment) =>
    m365
      .downloadMessageAttachment(
        M365DownloadMessageAttachmentRequest.make({ attachmentId: attachment.id, messageId, userId: O.some(mailbox) })
      )
      .pipe(
        Effect.map(({ bytes }) => bytes),
        Effect.mapError(mailError(`Could not download attachment "${attachmentNameOf(attachment)}"`))
      );

  // Write new content under its sanitized name, or that name tagged with a short hash when another file holds it.
  const save = Effect.fnUntraced(function* (out: OutDir, wanted: string, sha256: Sha256Hex, bytes: Uint8Array) {
    const fileName = MutableHashSet.has(out.taken, wanted) ? withShortHash(wanted, sha256) : wanted;
    if (MutableHashSet.has(out.taken, fileName)) {
      return yield* refused(
        `"${fileName}" already exists in "${out.realOut}" with other content; nothing is overwritten.`
      );
    }
    // `wx` fails rather than replace a file that appeared since the scan.
    yield* fs
      .writeFile(path.join(out.realOut, fileName), bytes, { flag: "wx" })
      .pipe(Effect.mapError(io(`Could not write "${fileName}".`)));
    MutableHashMap.set(out.byHash, sha256, fileName);
    MutableHashSet.add(out.taken, fileName);
    return fileName;
  });

  // Hash downloaded bytes and keep them unless they are over the cap or their content is already in the directory.
  const keep = Effect.fnUntraced(function* (
    out: OutDir,
    maxBytes: number,
    attachment: GraphAttachment,
    bytes: Uint8Array
  ) {
    const row = rowFor(attachment);
    if (bytes.byteLength > maxBytes) {
      return row("skipped-oversize", { bytes: bytes.byteLength });
    }
    const sha256 = yield* hash(bytes);
    const wanted = sanitizedName(attachmentNameOf(attachment));
    return yield* O.match(MutableHashMap.get(out.byHash, sha256), {
      onSome: (holder) => Effect.succeed(knownRow(row, { bytes: bytes.byteLength, sha256 }, wanted, holder)),
      onNone: () =>
        save(out, wanted, sha256, bytes).pipe(
          Effect.map((savedAs) => row("saved", { bytes: bytes.byteLength, sha256, savedAs }))
        ),
    });
  });

  const pull = Effect.fn("DrawingIntake.pull")(function* (request: IntakeRequest) {
    const root = path.resolve(request.corpusRoot);
    const outDir = path.resolve(request.outDir);
    if (!isWithin(path, root, outDir)) {
      return yield* refused(`"${outDir}" is not under the corpus root "${root}".`);
    }
    const { message, conversationSize, setAside } = yield* resolve(request);
    const facts = yield* factsOf(message);
    const listed = yield* m365
      .listMessageAttachments(
        M365ListMessageAttachmentsRequest.make({ messageId: message.id, userId: O.some(request.mailbox) })
      )
      .pipe(Effect.mapError(mailError("Could not list the message's attachments")));

    // Re-check on real paths, before and after creating the directory, so a symlink inside the
    // corpus can neither lead the writes out of it nor create a directory outside it.
    const realRoot = yield* realPathOf(root);
    const outsideRoot = (real: string) =>
      real !== realRoot && !isWithin(path, realRoot, real)
        ? Effect.fail(refused(`"${outDir}" resolves outside the corpus root "${root}".`))
        : Effect.void;
    yield* outsideRoot(yield* realPathOf(yield* nearestExisting(outDir)));
    yield* fs.makeDirectory(outDir, { recursive: true }).pipe(Effect.mapError(io(`Could not create "${outDir}".`)));
    const realOut = yield* realPathOf(outDir);
    yield* outsideRoot(realOut);
    if (realOut === realRoot) {
      return yield* refused(`"${outDir}" resolves to the corpus root itself.`);
    }
    const out: OutDir = { realOut, ...(yield* scanOut(realOut)) };
    const take = (attachment: GraphAttachment): Effect.Effect<IntakeAttachment, DrawingIntakeError> =>
      O.match(skipOutcomeOf(request.maxBytes)(attachment), {
        onSome: (outcome) => Effect.succeed(rowFor(attachment)(outcome, { bytes: declaredBytesOf(attachment) })),
        onNone: () =>
          download(request.mailbox, message.id, attachment).pipe(
            Effect.flatMap((bytes) => keep(out, request.maxBytes, attachment, bytes))
          ),
      });

    const attachments = yield* Effect.forEach(listed.value, take);
    const record = IntakeRecord.make({
      schemaVersion: "drawing-intake/v1",
      mailbox: request.mailbox,
      message: facts,
      outDir: realOut,
      attachments,
      pulledAt: DateTime.formatIso(yield* DateTime.now),
    });
    const recordPath = path.join(realOut, recordNameFor(out.taken, 1));
    const json = yield* encodeRecord(record).pipe(Effect.mapError(io("Could not encode the intake record.")));
    yield* fs
      .writeFileString(recordPath, `${json}\n`, { flag: "wx" })
      .pipe(Effect.mapError(io(`Could not write "${recordPath}".`)));
    return IntakeResult.make({ record, recordPath, conversationSize, setAside });
  });

  return { pull } satisfies DrawingIntakeShape;
});

/**
 * Pulls one Outlook message's file attachments into a directory under the corpus root.
 *
 * **Details**
 *
 * The item may be a message id or a conversation id (the newest message, or
 * the `pick`-th newest). A conversation spans every folder, so drafts are
 * never picked, and the mailbox's own mail (sheets it sent, outbox replies)
 * only when `includeOwn` is set. Inline and item attachments are skipped; file
 * attachments are hashed, deduped against the files already in the directory,
 * and written without ever replacing a file. The record goes to
 * `intake.json`, or `intake-<n>.json` when earlier records exist.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { DrawingIntake } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingIntake.layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DrawingIntake extends Context.Service<DrawingIntake, DrawingIntakeShape>()($I`DrawingIntake`) {
  /**
   * Layer over the M365 driver, the file system, path, and crypto services.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { DrawingIntake } from "@beep/repo-cli/commands/Drawings"
   *
   * console.log(DrawingIntake.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<DrawingIntake, never, M365 | FileSystem.FileSystem | Path.Path | Crypto.Crypto> =
    Layer.effect(DrawingIntake, Effect.map(makeService(), DrawingIntake.of));
}

const decodeRef = S.decodeUnknownEffect(OutlookItemRefFromInput);
const decodePick = S.decodeUnknownEffect(IntakePickFromString);
const decodeMailbox = S.decodeUnknownEffect(GraphPathSegment);

const OUTCOME_WIDTH = 17;

const attachmentLine = (row: IntakeAttachment): string => {
  const shown = O.getOrElse(row.savedAs, () => row.name);
  const sha256 = O.match(row.sha256, { onNone: () => "", onSome: (hex) => `  sha256 ${hex}` });
  const duplicate = O.match(row.duplicateOf, { onNone: () => "", onSome: (name) => `  same bytes as ${name}` });
  return `  ${Str.padEnd(OUTCOME_WIDTH)(row.outcome)}${shown}  ${row.bytes} bytes${sha256}${duplicate}`;
};

/**
 * Operator-facing summary of an intake: names, sizes and hashes only.
 *
 * **Details**
 *
 * The subject, sender and body of the message are never printed; they stay in
 * the record under the corpus root.
 *
 * **Example** (Summarise an empty intake)
 *
 * ```ts
 * import { EmailString } from "@beep/schema"
 * import { IntakeRecord, IntakeResult, MessageFacts, renderIntakeSummary } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const lines = renderIntakeSummary(
 *   IntakeResult.make({
 *     record: IntakeRecord.make({
 *       schemaVersion: "drawing-intake/v1",
 *       mailbox: "mailbox@example.test",
 *       message: MessageFacts.make({
 *         messageId: "AAMkAGI2",
 *         internetMessageId: O.some("<id@mail.example.test>"),
 *         conversationId: O.none(),
 *         from: O.some("Sender@example.test"),
 *         fromEmail: O.some(EmailString.make("sender@example.test")),
 *         receivedAt: O.some("2026-10-10T12:00:00Z"),
 *         subject: ""
 *       }),
 *       outDir: "/corpus/in",
 *       attachments: [],
 *       pulledAt: "2026-10-13T00:00:00.000Z"
 *     }),
 *     recordPath: "/corpus/in/intake.json",
 *     conversationSize: O.none()
 *   })
 * )
 * console.log(lines[0]) // "intake: 0 attachment(s) -> /corpus/in"
 * ```
 *
 * @param result - The completed intake whose attachment metadata and record location are displayed.
 * @returns Summary lines containing attachment metadata without message subject, sender or body.
 * @category formatting
 * @since 0.0.0
 */
export const renderIntakeSummary = (result: IntakeResult): ReadonlyArray<string> => [
  `intake: ${A.length(result.record.attachments)} attachment(s) -> ${result.record.outDir}`,
  ...O.match(result.conversationSize, {
    onNone: () => [],
    onSome: (size) => [
      `  the link named a conversation; --pick chose among ${size} message(s), newest first` +
        (result.setAside > 0 ? ` (${result.setAside} draft or own message(s) set aside)` : ""),
    ],
  }),
  ...A.map(result.record.attachments, attachmentLine),
  `record: ${result.recordPath}`,
];

/**
 * The app-only lane settings `drawings intake` runs with.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { DrawingIntakeLane } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingIntakeLane)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DrawingIntakeLane extends Context.Service<DrawingIntakeLane, M365AppOnlyEnvSettings>()(
  $I`DrawingIntakeLane`
) {}

/**
 * The intake service and its lane settings, from `<PREFIX>_*` variables.
 *
 * **Details**
 *
 * Loads the settings with `loadM365AppOnlyEnv`, refusing unresolved `op://`
 * values, then builds the mail layer from them. The command passes
 * `M365.makeAppOnlyLiveLayer`; tests pass a fake.
 *
 * **Example** (Bind the live lane)
 *
 * ```ts
 * import { M365 } from "@beep/m365"
 * import { drawingIntakeLaneLayer } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(drawingIntakeLaneLayer({ envPrefix: "CLOUD_M365_DOCKET", mailLayer: M365.makeAppOnlyLiveLayer }))
 * ```
 *
 * @param options - `envPrefix` names the app-only variables (such as `CLOUD_M365_DOCKET`, the read-only docket-intake registration); `mailLayer` builds the M365 layer from the loaded settings.
 * @returns The intake service and lane settings, needing the file-system, path and crypto services.
 * @category layers
 * @since 0.0.0
 */
export const drawingIntakeLaneLayer = <E>(options: {
  readonly envPrefix: string;
  readonly mailLayer: (appOnly: M365AppOnlyConfigInput) => Layer.Layer<M365, E>;
}): Layer.Layer<
  DrawingIntake | DrawingIntakeLane,
  DrawingsCommandError | E,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> =>
  Layer.unwrap(
    loadM365AppOnlyEnv(options.envPrefix).pipe(
      Effect.mapError((cause) => DrawingsCommandError.new(cause, cause.message)),
      Effect.map((settings) =>
        Layer.merge(
          DrawingIntake.layer.pipe(Layer.provide(options.mailLayer(settings.appOnly))),
          Layer.succeed(DrawingIntakeLane, settings)
        )
      )
    )
  );

/**
 * Handler of `beep drawings intake`.
 *
 * **Details**
 *
 * Decodes `--message` and `--pick`, takes the mailbox from `--mailbox` or the
 * lane settings, pulls through {@link DrawingIntake}, and prints
 * {@link renderIntakeSummary}.
 *
 * **Example** (Reference the handler)
 *
 * ```ts
 * import { runDrawingIntake } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(typeof runDrawingIntake) // "function"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runDrawingIntake = Effect.fn("DrawingsCommand.intake")(function* (options: {
  readonly message: string;
  readonly mailbox: O.Option<string>;
  readonly out: string;
  readonly corpusRoot: string;
  readonly pick: string;
  readonly includeOwn: boolean;
}) {
  const ref = yield* decodeRef(options.message).pipe(
    Effect.mapError(
      DrawingsCommandError.new("--message is not an Outlook web link or a Graph message or conversation id.")
    )
  );
  const pick = yield* decodePick(options.pick).pipe(
    Effect.mapError(DrawingsCommandError.new("--pick must be `latest` or a positive whole number."))
  );
  const lane = yield* DrawingIntakeLane;
  const mailbox = yield* decodeMailbox(O.getOrElse(options.mailbox, () => lane.mailbox)).pipe(
    Effect.mapError(DrawingsCommandError.new("--mailbox must be a mailbox address or user id."))
  );
  const intake = yield* DrawingIntake;
  const result = yield* intake
    .pull(
      IntakeRequest.make({
        ref,
        mailbox,
        outDir: options.out,
        corpusRoot: options.corpusRoot,
        pick,
        includeOwn: options.includeOwn,
      })
    )
    .pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, cause.message)));
  yield* printLines(renderIntakeSummary(result));
});
