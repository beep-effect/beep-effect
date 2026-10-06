import { M365, M365ListMessagesRequest } from "@beep/m365";
import {
  loadOutboxConfig,
  makeOutboxLiveServices,
  makeOutboxToolkitHandlers,
  OutboxDraftCreated,
  OutboxSendResult,
  OutboxToolkit,
  outboxHandlerSettings,
} from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Clock, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// Absent, blank, or unresolved `op://` values count as absent, so the suite
// skips instead of authenticating with a placeholder.
const envText = (name: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(Bun.env[name]),
    O.map(Str.trim),
    O.filter((value) => Str.isNonEmpty(value) && !Str.startsWith("op://")(value))
  );

const liveEnv = O.all({
  clientId: envText("M365_OUTBOX_CLIENT_ID"),
  mailbox: envText("M365_OUTBOX_MAILBOX"),
  privateKey: envText("M365_OUTBOX_CERT_PRIVATE_KEY"),
  tenantId: envText("M365_OUTBOX_TENANT_ID"),
  thumbprintSha256: envText("M365_OUTBOX_CERT_THUMBPRINT_SHA256"),
});

const optedIn = (name: string): boolean => O.exists(envText(name), (value) => value === "1");

// Credentials alone allow a token and a read. Every mailbox write needs an
// explicit opt-in: M365_OUTBOX_LIVE_WRITE=1 for creating and deleting a draft,
// M365_OUTBOX_LIVE_SEND=1 (which implies write) for sending one message.
const liveSend = optedIn("M365_OUTBOX_LIVE_SEND");
const liveWrite = liveSend || optedIn("M365_OUTBOX_LIVE_WRITE");

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);

const isDraftCreated = S.is(OutboxDraftCreated);
const isSendResult = S.is(OutboxSendResult);

const head = <A, E, R>(stream: Stream.Stream<A, E, R>): Effect.Effect<A, E, R> =>
  Stream.runHead(stream).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.die(new Error("the tool returned no result")),
        onSome: Effect.succeed,
      })
    )
  );

pipe(
  liveEnv,
  O.match({
    onNone: () =>
      describe("@beep/m365-mcp outbox live smoke (M365_OUTBOX_*)", () => {
        it.skip("skips live Graph calls when the M365_OUTBOX_* settings are absent", () => {
          assertNone(liveEnv);
        });
      }),
    onSome: (env) =>
      describe("@beep/m365-mcp outbox live smoke", () => {
        const LiveLayer = Layer.unwrap(
          loadOutboxConfig().pipe(
            Effect.map((config) =>
              makeOutboxToolkitHandlers(outboxHandlerSettings(config)).pipe(
                Layer.provideMerge(makeOutboxLiveServices(config))
              )
            )
          )
        ).pipe(Layer.provideMerge(PlatformLayer));

        // One synthetic attachment in the first configured root, removed afterwards.
        const stagedAttachment = Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const config = yield* loadOutboxConfig();
          const file = path.join(
            A.headNonEmpty(config.attachments.roots),
            `beep-outbox-live-smoke-${yield* Clock.currentTimeMillis}.txt`
          );
          yield* Effect.acquireRelease(
            fs.writeFileString(file, "Synthetic attachment written by the beep-m365-outbox live smoke.\n"),
            () => Effect.ignore(fs.remove(file))
          );
          return { auditDirectory: config.auditDirectory, file };
        });

        const prepare = Effect.fnUntraced(function* (subject: string) {
          const toolkit = yield* OutboxToolkit;
          const staged = yield* stagedAttachment;
          const created = yield* head(
            yield* toolkit.handle("m365_outbox_create_draft", {
              attachmentPaths: [staged.file],
              body: "Synthetic message written by the beep-m365-outbox live smoke. Safe to delete.",
              bodyType: "text",
              subject,
              to: [env.mailbox],
            })
          );
          assert.isFalse(created.isFailure);
          assert.isTrue(isDraftCreated(created.result));
          return isDraftCreated(created.result)
            ? { ...staged, draft: created.result, subject }
            : yield* Effect.die(new Error("create_draft did not return a draft"));
        });

        it.layer(LiveLayer, { excludeTestServices: true, timeout: "120 seconds" })((it) => {
          it.effect(
            "acquires a token and reads one page of messages, writing nothing",
            Effect.fnUntraced(function* () {
              const m365 = yield* M365;
              const messages = yield* m365.listMessages(
                M365ListMessagesRequest.make({ filter: O.some("isDraft eq true"), userId: O.some(env.mailbox) })
              );

              yield* Effect.logInfo("M365 outbox live: read completed", { draftCount: A.length(messages.value) });
              assert.isAtLeast(A.length(messages.value), 0);
            })
          );

          (liveWrite ? it.effect : it.effect.skip)(
            "prepares a draft with one synthetic attachment, reads it back and deletes it (M365_OUTBOX_LIVE_WRITE=1)",
            Effect.fnUntraced(function* () {
              const toolkit = yield* OutboxToolkit;
              const prepared = yield* prepare(`beep outbox live smoke (draft only) ${yield* Clock.currentTimeMillis}`);

              const view = yield* head(
                yield* toolkit.handle("m365_outbox_get_draft", { draftId: prepared.draft.draftId })
              );
              const deleted = yield* head(
                yield* toolkit.handle("m365_outbox_delete_draft", { draftId: prepared.draft.draftId })
              );

              yield* Effect.logInfo("M365 outbox live: draft prepared and deleted", {
                attachmentCount: A.length(prepared.draft.attachments),
              });
              assert.isFalse(view.isFailure);
              assert.isFalse(deleted.isFailure);
              assert.lengthOf(prepared.draft.attachments, 1);
            })
          );

          (liveSend ? it.effect : it.effect.skip)(
            "sends one message from the mailbox to itself and leaves an intent and an outcome record (M365_OUTBOX_LIVE_SEND=1)",
            Effect.fnUntraced(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const toolkit = yield* OutboxToolkit;
              const prepared = yield* prepare(`beep outbox live smoke ${yield* Clock.currentTimeMillis}`);

              const sent = yield* head(
                yield* toolkit.handle("m365_outbox_send_draft", {
                  draftId: prepared.draft.draftId,
                  expect: {
                    attachments: A.map(prepared.draft.attachments, (attachment) => ({
                      name: attachment.name,
                      sha256: attachment.sha256,
                      size: attachment.size,
                    })),
                    bcc: [],
                    cc: [],
                    subject: prepared.subject,
                    to: [env.mailbox],
                  },
                })
              );
              assert.isFalse(sent.isFailure);
              assert.isTrue(isSendResult(sent.result));
              const result = isSendResult(sent.result)
                ? sent.result
                : yield* Effect.die(new Error("send_draft did not return a send result"));
              const names = yield* fs.readDirectory(prepared.auditDirectory);
              const texts = yield* Effect.forEach(names, (name) =>
                fs.readFileString(path.join(prepared.auditDirectory, name))
              );
              const lines = pipe(texts, A.flatMap(Str.split("\n")), A.filter(Str.includes(`"${result.auditId}"`)));

              // Ids, counts and outcomes only: no address, subject or body is logged.
              yield* Effect.logInfo("M365 outbox live: send completed", {
                auditId: result.auditId,
                auditRecordCount: A.length(lines),
                outcome: result.outcome,
              });
              assert.strictEqual(result.outcome, "sent");
              assert.isTrue(result.auditRecorded);
              assert.lengthOf(lines, 2);
              assert.isTrue(A.some(lines, Str.includes(`"_tag":"send-intent"`)));
              assert.isTrue(A.some(lines, Str.includes(`"_tag":"send-outcome"`)));
            })
          );
        });
      }),
  })
);
