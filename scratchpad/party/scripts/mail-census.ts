/**
 * Stream enriched mail-index JSONL through the graduated party census.
 *
 * Usage: bun scratchpad/party/scripts/mail-census.ts <out.json> <filter-regex|-> <index.jsonl>...
 * Each row requires content: "party-sha256:<child-message-digest>" from its
 * provenance inventory. The legacy archive id cannot supply message content identity.
 * No corpus files are opened unless explicitly passed as arguments.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ActivityId } from "@beep/party-domain/Ids";
import { emptyCensus, observe, recordDecodeFailure, summarize } from "@beep/party-server/MailCensus";
import { adaptMailRecord, MailIndexInput, MailIndexRecord } from "@beep/party-server/MailIndex";
import { jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ContentBoundMailRecord } from "./MailInput.ts";

const decodeRow = S.decodeUnknownEffect(S.fromJsonString(ContentBoundMailRecord));
const program = Effect.fn("mail-census")(function* (out: string, filterText: string, inputs: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const filter = filterText === "-" ? O.none() : O.some(yield* Effect.try(() => new RegExp(filterText, "i")));
  let census = emptyCensus();
  const producedBy = ActivityId.make("party-act:mail-index-adapter@0.0.0");
  const observedAt = yield* DateTime.now;
  for (const input of inputs) {
    yield* fs.stream(input).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.filter(
        (line) =>
          Str.isNonEmpty(line) && O.match(filter, { onNone: () => true, onSome: (pattern) => pattern.test(line) })
      ),
      Stream.runForEach((line) =>
        decodeRow(line).pipe(
          Effect.matchEffect({
            onFailure: () =>
              Effect.sync(() => {
                census = recordDecodeFailure(census);
              }),
            onSuccess: Effect.fn("mail-census.observe")(function* (row: ContentBoundMailRecord) {
              const ingest = yield* adaptMailRecord(
                MailIndexInput.make({
                  record: MailIndexRecord.make(row),
                  content: row.content,
                  side: "client-file",
                  producedBy,
                  observedAt,
                })
              );
              census = observe(census, ingest);
            }),
          })
        )
      )
    );
  }
  const summary = { inputs: A.length(inputs), filtered: O.isSome(filter), ...summarize(census) };
  yield* fs.writeFileString(out, `${yield* jsonStringifyPretty(summary)}\n`);
  yield* Effect.log(`census written: ${out} (${summary.rows} rows, ${summary.decodeFailures} decode failures)`);
});

const command = Command.make(
  "mail-census",
  {
    out: Argument.String("out.json"),
    filter: Argument.String("filter-regex"),
    inputs: Argument.String("index.jsonl").pipe(Argument.atLeast(1)),
  },
  ({ out, filter, inputs }) => program(out, filter, inputs)
);

// @effect-diagnostics-next-line strictEffectProvide:off -- platform services are provided once at the script entry point. Owner: @beep/scratchpad. Exit: never while this is a Bun entry script.
Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
