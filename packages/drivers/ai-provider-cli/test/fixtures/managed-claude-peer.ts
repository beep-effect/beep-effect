import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const Frame = S.Struct({ type: S.String, message: S.optionalKey(S.Struct({ content: S.String })) });
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const Startup = S.Struct({ restricted: S.Literal(true), safeMode: S.Literal(false), settingSources: S.Literal("") });
const Settings = S.Struct({ claudeMdExcludes: S.Tuple([S.Literal("**")]), autoMemoryEnabled: S.Literal(false) });
const program = Effect.gen(function* () {
  const mode = yield* Config.String("FIXTURE_MODE").pipe(Config.withDefault("echo"));
  const stdio = yield* Stdio.Stdio;
  const sessionId = process.argv[process.argv.indexOf("--session-id") + 1];
  yield* S.decodeUnknownEffect(Startup)({
    restricted: process.argv.includes("--restricted"),
    safeMode: process.argv.includes("--safe-mode"),
    settingSources: process.argv[process.argv.indexOf("--setting-sources") + 1],
  }).pipe(Effect.orDie);
  yield* S.decodeUnknownEffect(S.fromJsonString(Settings))(process.argv[process.argv.indexOf("--settings") + 1]).pipe(
    Effect.orDie
  );
  const emit = (value: unknown) =>
    encode(value).pipe(Effect.flatMap((line) => Stream.make(`${line}\n`).pipe(Stream.run(stdio.stdout()))));
  yield* stdio.stdin.pipe(
    Stream.decodeText(),
    Stream.splitLines,
    Stream.runForEach((line) =>
      Effect.gen(function* () {
        const frame = yield* S.decodeEffect(S.fromJsonString(Frame))(line);
        if (frame.type === "control_request") {
          yield* emit({
            type: "control_response",
            response: {
              subtype: "success",
              request_id: "beep-initialize",
              response: { current_permission_mode: "dontAsk" },
            },
          });
        } else if (frame.type === "user") {
          if (mode === "oversized")
            return yield* Stream.make(Str.repeat(1048577)("x")).pipe(Stream.run(stdio.stdout()));
          yield* emit({
            type: "system",
            subtype: "init",
            session_id: sessionId,
            model: "claude-opus-5-5",
            permissionMode: "dontAsk",
          });
          yield* emit({
            type: "result",
            subtype: "success",
            is_error: false,
            session_id: sessionId,
            result: frame.message?.content ?? "",
          });
        }
      })
    )
  );
});
NodeServices.layer.pipe(
  Layer.build,
  Effect.flatMap((context) => program.pipe(Effect.provide(context))),
  Effect.scoped,
  NodeRuntime.runMain
);
