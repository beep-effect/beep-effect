import {
  readTranscriptPage,
  TranscriptCursor,
  TranscriptPage,
  TranscriptPageInput,
} from "@beep/repo-ai-metrics/transcript-page";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TranscriptFrame } from "@beep/repo-ai-metrics/transcript-page";

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const meta = (session = "synthetic-session") =>
  encode({
    type: "session_meta",
    timestamp: "2020-01-02T10:00:00+02:00",
    payload: { id: session, cwd: "/private/synthetic-root" },
  });
const message = encode({
  type: "response_item",
  timestamp: "2020-01-02T08:00:01Z",
  payload: { type: "message", id: "synthetic-message", model: "synthetic-model", content: "private-prompt-😀" },
});
const salt = Redacted.make("synthetic-page-salt");
const temp = FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped());
const input = (
  path: string,
  cursor: O.Option<TranscriptCursor> = O.none(),
  maxBytes = 1024,
  maxLineBytes = 512,
  maxFrames = 10
) => TranscriptPageInput.make({ path, source: "codex", hashSalt: salt, cursor, maxBytes, maxLineBytes, maxFrames });
const accepted = (frame: typeof TranscriptFrame.Type | undefined) => {
  if (frame === undefined || frame._tag !== "Accepted") throw new Error("Expected accepted fixture frame");
  return frame;
};
const decodeTranscriptCursorJson = S.decodeEffect(S.fromJsonString(TranscriptCursor));
const encodeTranscriptCursorJson = S.encodeEffect(S.fromJsonString(TranscriptCursor));

const retryCursor = Effect.fn("TranscriptPageTest.retryCursor")(function* (cursor: TranscriptCursor) {
  return yield* decodeTranscriptCursorJson(yield* encodeTranscriptCursorJson(cursor));
});
const encodeTranscriptPageJson = S.encodeEffect(S.fromJsonString(TranscriptPage));

it.layer(NodeServices.layer, { concurrent: false, timeout: "20 seconds" })(
  "incremental transcript metadata pages",
  (it) => {
    it.effect("uses byte offsets across UTF-8/CRLF and holds an incomplete final line across restart", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        const initial = `\uFEFF${yield* meta()}\r\n${yield* message}\r\n{`;
        yield* fs.writeFileString(path, initial);
        const first = yield* readTranscriptPage(input(path));
        expect(first.frames).toHaveLength(2);
        expect(first.reset).toBe("new");
        expect(first.waitingForPartialLine).toBe(true);
        expect(first.cursor.offset).toBe(new TextEncoder().encode(initial).length - 1);
        assertSome(accepted(first.frames[0]).metadata.sourceTime, "2020-01-02T10:00:00+02:00");
        expect(accepted(first.frames[1]).metadata.session.id).toEqual(accepted(first.frames[0]).metadata.session.id);
        const before = yield* fs.readFile(path);
        const retry = yield* readTranscriptPage(input(path));
        expect(retry.frames).toEqual(first.frames);
        expect(yield* fs.readFile(path)).toEqual(before);
        yield* fs.writeFileString(path, '"type":"response_item","payload":{"type":"message"}}\n', { flag: "a" });
        const second = yield* readTranscriptPage(input(path, O.some(yield* retryCursor(first.cursor))));
        expect(second.reset).toBe("none");
        expect(second.frames).toHaveLength(1);
        expect(second.cursor.lineNumber).toBe(3);
        const grownRetry = yield* readTranscriptPage(input(path));
        expect(A.map(A.take(grownRetry.frames, 2), (frame) => frame.occurrenceId)).toEqual(
          A.map(first.frames, (frame) => frame.occurrenceId)
        );
        expect(accepted(second.frames[0]).metadata.session.id).toEqual(first.cursor.session.id);
        const serialized = yield* encodeTranscriptPageJson(first);
        for (const privateText of [
          dir,
          "private-prompt",
          "synthetic-session",
          "synthetic-message",
          "synthetic-model",
          "/private/synthetic-root",
          "synthetic-page-salt",
        ])
          expect(serialized).not.toContain(privateText);
      })
    );
    it.effect("resets on observed truncation, same-inode rewrite and replacement without reusing occurrence IDs", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFileString(path, `${yield* meta()}\n${yield* message}\n`);
        const first = yield* readTranscriptPage(input(path));
        yield* fs.writeFileString(path, `${yield* meta("other-session")}\n`);
        const truncated = yield* readTranscriptPage(input(path, O.some(first.cursor)));
        expect(truncated.reset).toBe("truncated");
        expect(truncated.cursor.generationId).not.toBe(first.cursor.generationId);
        yield* fs.writeFileString(path, `${yield* meta("third-session")}\n${yield* message}\n`);
        const rewritten = yield* readTranscriptPage(input(path, O.some(truncated.cursor)));
        expect(rewritten.reset).toBe("rewritten");
        yield* fs.rename(path, `${path}.old`);
        yield* fs.writeFileString(path, `${yield* meta("third-session")}\n${yield* message}\n`);
        const replaced = yield* readTranscriptPage(input(path, O.some(rewritten.cursor)));
        expect(replaced.reset).toBe("replaced");
        expect(accepted(replaced.frames[0]).occurrenceId).not.toBe(accepted(rewritten.frames[0]).occurrenceId);
      })
    );
    it.effect("preserves distinct occurrences in copied files and repeated identical records", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFileString(path, `${yield* message}\n${yield* message}\n`);
        yield* fs.copyFile(path, `${path}.copy`);
        const first = yield* readTranscriptPage(input(path));
        const copy = yield* readTranscriptPage(input(`${path}.copy`));
        const a = accepted(first.frames[0]);
        const b = accepted(first.frames[1]);
        const c = accepted(copy.frames[0]);
        expect(a.contentHash).toBe(b.contentHash);
        expect(a.contentHash).toBe(c.contentHash);
        expect(new Set([a.occurrenceId, b.occurrenceId, c.occurrenceId]).size).toBe(3);
        assertNone(a.metadata.session.id);
      })
    );
    it.effect("advances through an oversized growing line with bounded pages and later reaches valid data", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFileString(path, Str.repeat(600)("x"));
        const first = yield* readTranscriptPage(input(path, O.none(), 256, 128));
        expect(first.cursor.offset).toBe(256);
        expect(first.cursor.discarding).toBe(true);
        expect(first.frames[0]).toMatchObject({ _tag: "Rejected", reason: "line-too-long", complete: false });
        expect(first.bytesRead).toBeLessThanOrEqual(2 * 256 + 1281);
        yield* fs.writeFileString(path, '\n{"type":"response_item","payload":{"type":"message"}}\n', { flag: "a" });
        const second = yield* readTranscriptPage(input(path, O.some(first.cursor), 256, 128));
        const third = yield* readTranscriptPage(input(path, O.some(yield* retryCursor(second.cursor)), 256, 128));
        expect(third.frames[0]).toMatchObject({ _tag: "Rejected", reason: "line-too-long", complete: true });
        expect(third.frames[0]?.occurrenceId).toBe(first.frames[0]?.occurrenceId);
        expect(third.frames[1]?._tag).toBe("Accepted");
        expect(third.cursor.discarding).toBe(false);
        expect(third.cursor.lineNumber).toBe(2);
      })
    );
    it.effect("isolates malformed lines, invalid UTF-8 and unknown counters without leaking rejected content", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFile(path, new Uint8Array([0xff, 10]));
        yield* fs.writeFileString(
          path,
          `private-invalid-json\n${yield* encode({ type: "assistant", message: { usage: { input_tokens: -1 } } })}\n${yield* message}\n`,
          { flag: "a" }
        );
        const page = yield* readTranscriptPage(input(path));
        expect(A.map(page.frames, (frame) => (frame._tag === "Rejected" ? frame.reason : frame._tag))).toEqual([
          "invalid-utf8",
          "invalid-json",
          "invalid-shape",
          "Accepted",
        ]);
        const text = yield* encodeTranscriptPageJson(page);
        expect(text).not.toContain("private-invalid-json");
        expect(text).not.toContain("private-prompt");
      })
    );
    it.effect("keeps source session conflicts explicit and usage counting bases separate", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        const lastUsage = { input_tokens: 10, output_tokens: 3, cached_input_tokens: 7 };
        yield* fs.writeFileString(
          path,
          `${yield* meta()}\n${yield* meta("conflicting-session")}\n${yield* encode({ type: "event_msg", payload: { type: "token_count", info: { last_token_usage: lastUsage, total_token_usage: { input_tokens: 999 } } } })}\n`
        );
        const page = yield* readTranscriptPage(input(path));
        assertNone(page.cursor.session.id);
        expect(page.cursor.session.conflicted).toBe(true);
        const usage = accepted(page.frames[2]).metadata.usage;
        assertSome(usage, {
          basis: "last-request",
          input: O.some(10),
          output: O.some(3),
          cacheRead: O.some(7),
          cacheWrite: O.none(),
        });
        const claudePath = `${dir}/claude.jsonl`;
        yield* fs.writeFileString(
          claudePath,
          `${yield* encode({ type: "assistant", sessionId: "synthetic-claude-session", message: { id: "message-id", usage: { input_tokens: 11, output_tokens: 5, cache_read_input_tokens: 8, cache_creation_input_tokens: 2 } } })}\n`
        );
        const claude = yield* readTranscriptPage(TranscriptPageInput.make({ ...input(claudePath), source: "claude" }));
        assertSome(accepted(claude.frames[0]).metadata.usage, {
          basis: "message",
          input: O.some(11),
          output: O.some(5),
          cacheRead: O.some(8),
          cacheWrite: O.some(2),
        });
      })
    );
    it.effect("preserves cumulative-only usage and an explicitly empty last-request measurement", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = `${yield* temp}/usage.jsonl`;
        const cumulative = { total_token_usage: { input_tokens: 0, output_tokens: 9 } };
        const emptyLast = { ...cumulative, last_token_usage: {} };
        const lines = yield* Effect.forEach([cumulative, emptyLast], (info) =>
          encode({ type: "event_msg", payload: { type: "token_count", info } })
        );
        yield* fs.writeFileString(path, `${A.join(lines, "\n")}\n`);
        const page = yield* readTranscriptPage(input(path));
        assertSome(accepted(page.frames[0]).metadata.usage, {
          basis: "cumulative",
          input: O.some(0),
          output: O.some(9),
          cacheRead: O.none(),
          cacheWrite: O.none(),
        });
        assertSome(accepted(page.frames[1]).metadata.usage, {
          basis: "last-request",
          input: O.none(),
          output: O.none(),
          cacheRead: O.none(),
          cacheWrite: O.none(),
        });
      })
    );
    it.effect("honors a frame budget across pages and never reads a large file in full", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/large.jsonl`;
        yield* fs.writeFileString(path, `${yield* message}\n${yield* message}\n`);
        yield* fs.truncate(path, 40 * 1024 * 1024);
        const first = yield* readTranscriptPage(input(path, O.none(), 1024, 512, 1));
        const second = yield* readTranscriptPage(input(path, O.some(first.cursor), 1024, 512, 1));
        expect(first.frames).toHaveLength(1);
        expect(second.frames).toHaveLength(1);
        expect(first.sampledEnd).toBe(40 * 1024 * 1024);
        expect(first.bytesRead).toBeLessThanOrEqual(2 * 1024 + 1281);
        expect(second.bytesRead).toBeLessThanOrEqual(2 * 1024 + 1281);
        expect(first.frames[0]?.occurrenceId).not.toBe(second.frames[0]?.occurrenceId);
      })
    );
    it.effect("rejects foreign cursors and reports permission failure without private paths", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/private-events.jsonl`;
        yield* fs.writeFileString(path, `${yield* message}\n`);
        const first = yield* readTranscriptPage(input(path));
        const foreign = yield* readTranscriptPage(input(`${path}.other`, O.some(first.cursor))).pipe(Effect.flip);
        expect(foreign.reason).toBe("invalid-cursor");
        const denied = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "open",
          description: path,
        });
        const error = yield* readTranscriptPage(input(path)).pipe(
          Effect.provideService(FileSystem.FileSystem, { ...fs, open: () => Effect.fail(denied) }),
          Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" })
        );
        expect(error).toContain("unavailable");
        expect(error).not.toContain(path);
        expect(yield* fs.readFileString(path)).toBe(`${yield* message}\n`);
      })
    );
    it.effect("refuses directories and symlinks before consuming source bytes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFileString(path, `${yield* message}\n`);
        yield* fs.symlink(path, `${path}.link`);
        expect((yield* readTranscriptPage(input(dir)).pipe(Effect.flip)).reason).toBe("identity-unavailable");
        expect((yield* readTranscriptPage(input(`${path}.link`)).pipe(Effect.flip)).reason).toBe("unavailable");
      })
    );
    it.effect("refuses a file that changes during a sampled read and preserves the previous cursor", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const dir = yield* temp;
        const path = `${dir}/events.jsonl`;
        yield* fs.writeFileString(path, `${yield* message}\n`);
        const reads = yield* Ref.make(0);
        const result = yield* readTranscriptPage(input(path)).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            open: (filePath, options) =>
              fs.open(filePath, options).pipe(
                Effect.map((handle) => ({
                  ...handle,
                  stat: handle.stat,
                  read: Effect.fn("TranscriptPageTest.read")(function* (buffer, options) {
                    const count = yield* Ref.updateAndGet(reads, (n) => n + 1);
                    const amount = yield* handle.read(buffer, options);
                    if (count === 2) yield* fs.writeFileString(path, `${yield* meta()}\n`);
                    return amount;
                  }),
                }))
              ),
          }),
          Effect.flip
        );
        expect(result.reason).toBe("unstable");
      })
    );
  }
);
