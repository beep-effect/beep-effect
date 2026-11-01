import {
  Cancelled,
  CliAudience,
  CliDoc,
  CliFailure,
  CliLinks,
  CliRuntime,
  CliTheme,
  Doc,
  NotInteractive,
  Render,
  SchemaIssueRenderer,
} from "@beep/cli-kit";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import { MemoryFileSystem } from "@beep/memfs";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import type { Block, Document } from "@beep/cli-kit";
import type { AudienceKind, StreamEnv } from "@beep/runtime-env";

const platformServices = Layer.mergeAll(
  Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}),
  MemoryFileSystem.layer,
  Path.layer,
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  )
);

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);

const layers = (audience: AudienceKind, stdout: Partial<StreamEnv> = {}, stderr: Partial<StreamEnv> = {}) => {
  const terminal = TerminalEnv.layerTest({
    stdinIsTerminal: true,
    stdout: { isTerminal: true, ...stdout },
    stderr: { isTerminal: true, ...stderr },
  });
  return Layer.mergeAll(
    terminal,
    CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
    Audience.layerTest(audience),
    CliLinks.layerTest("vscode")
  );
};

/** The context a stderr report is rendered with, built from the same services a CLI has. */
const contextFor = Effect.fnUntraced(function* (
  audience: AudienceKind,
  stderr: Partial<StreamEnv> = {},
  options?: { readonly displayPath?: (p: string) => string }
) {
  const context = yield* Render.context("stderr").pipe(
    provideBuilt(layers(audience, {}, { color: stderr.color ?? "none", hyperlinks: stderr.hyperlinks ?? false }))
  );
  return { ...context, ...options };
});

const plain = Effect.fnUntraced(function* (doc: Document, audience: AudienceKind = "agent") {
  return Render.plain(doc, yield* contextFor(audience));
});

class Boom extends S.TaggedError<Boom, { readonly brand: unique symbol }>()("Boom", { message: S.String }) {
  override readonly name = "Boom";
}

const kinds = (doc: Document): ReadonlyArray<string> => A.map(doc, (block: Block) => block._tag);

/** A defect whose stack is exactly `frames`, as V8 prints them. */
const errorWithStack = (message: string, frames: ReadonlyArray<string>): Error => {
  const error = new Error(message);
  error.stack = A.join([`Error: ${message}`, ...A.map(frames, (frame) => `    at ${frame}`)], "\n");
  return error;
};

const USER = "/repo/src/run.ts";
const INTERNAL_FRAMES = [
  "Module._compile (node:internal/modules/cjs/loader:1554:14)",
  "IteratorImpl.~effect/Effect/successCont (file:///repo/node_modules/.pnpm/effect@4.0.0/node_modules/effect/dist/internal/effect.js:987:28)",
  "Generator.next (<anonymous>)",
  "/home/me/work/packages/effect/src/internal/effect.ts:10:5",
];

it.layer(platformServices, { timeout: "30 seconds" })((it) => {
  describe("CliFailure.toDoc: a typed failure", () => {
    it.effect("is one failure status line carrying the error's own text", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.fail(Boom.make({ message: "disk full" })));
        assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
        const text = yield* plain(doc);
        assert.strictEqual(Str.split(text, "\n").length, 1);
        assert.include(text, String(Boom.make({ message: "disk full" })));
        assert.include(text, "✗");
      })
    );

    it.effect("a non-error value is its string", () =>
      Effect.gen(function* () {
        assert.include(yield* plain(CliFailure.toDoc(Cause.fail("plain text"))), "plain text");
      })
    );

    it.effect("a failure that cannot be stringified is still one line, never a throw", () =>
      Effect.gen(function* () {
        const hostile: object = Object.create(null);
        const doc = CliFailure.toDoc(Cause.fail(hostile));
        assert.isAbove((yield* plain(doc)).length, 0);
      })
    );

    it.effect("a message with several lines is several lines, the status on the first", () =>
      Effect.gen(function* () {
        const lines = Str.split(yield* plain(CliFailure.toDoc(Cause.fail(new Error("one\ntwo\nthree")))), "\n");
        assert.strictEqual(lines.length, 3);
        assert.include(lines[0] ?? "", "one");
        assert.include(lines[2] ?? "", "three");
      })
    );
  });

  describe("CliFailure.toDoc: who writes the document", () => {
    class Mine extends S.TaggedError<Mine, { readonly brand: unique symbol }>()("Mine", { message: S.String }) {
      override readonly name = "Error";

      [CliDoc](): Document {
        return [Doc.heading(2, "my own"), Doc.paragraph("with a body")];
      }
    }

    it.effect("an error with [CliDoc] uses its document, and nothing else", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.fail(Mine.make({ message: "ignored message" })));
        assert.deepStrictEqual(kinds(doc), ["Heading", "Paragraph"]);
        assert.notInclude(yield* plain(doc), "ignored message");
      })
    );

    it.effect("a throwing [CliDoc] falls back to the generic line", () =>
      Effect.gen(function* () {
        class Bad extends S.TaggedError<Bad, { readonly brand: unique symbol }>()("Bad", { message: S.String }) {
          override readonly name = "Error";

          [CliDoc](): Document {
            throw new Error("nope");
          }
        }
        assert.include(yield* plain(CliFailure.toDoc(Cause.fail(Bad.make({ message: "fallback me" })))), "fallback me");
      })
    );

    it.effect("the per-tag render map is honoured, and [CliDoc] still beats it", () =>
      Effect.gen(function* () {
        const render = {
          Boom: (error: unknown) => {
            assert.instanceOf(error, Boom);
            return [Doc.paragraph(`custom for ${error.message}`)];
          },
        };
        assert.strictEqual(
          yield* plain(CliFailure.toDoc(Cause.fail(Boom.make({ message: "x" })), { render })),
          "custom for x"
        );
        assert.notInclude(
          yield* plain(
            CliFailure.toDoc(Cause.fail(Mine.make({ message: "m" })), {
              render: { Mine: () => [Doc.paragraph("map")] },
            })
          ),
          "map"
        );
        // A tag with no entry is the generic line, and an inherited name is not an entry.
        assert.include(
          yield* plain(CliFailure.toDoc(Cause.fail(Boom.make({ message: "y" })), { render: { Other: () => [] } })),
          "y"
        );
        assert.include(
          yield* plain(CliFailure.toDoc(Cause.fail({ _tag: "constructor", message: "z" }), { render: {} })),
          "z"
        );
      })
    );
  });

  describe("CliFailure.toDoc: a schema failure", () => {
    const Config = S.Struct({
      owner: S.String,
      groups: S.Record(S.String, S.Struct({ repos: S.Array(S.String) })),
    });
    const decode = S.decodeUnknownExit(Config, { onExcessProperty: "error", errors: "all" });
    const failureOf = (input: unknown): { readonly issue: unknown } => {
      const exit = decode(input);
      if (!Exit.isFailure(exit)) throw new Error("expected a failure");
      const reason = A.getUnsafe(exit.cause.reasons, 0);
      if (Cause.isFailReason(reason)) return reason.error;
      return assert.fail("expected a typed failure");
    };

    it.effect("is a Tree, in which every rejected value of today's renderer appears with its path", () =>
      Effect.gen(function* () {
        const error = failureOf({ owner: 1, groups: { g: { repos: ["r"], extra: 1 } }, ownr: "typo" });
        const doc = CliFailure.toDoc(Cause.fail(error));
        assert.deepStrictEqual(kinds(doc), ["Tree"]);
        const text = yield* plain(doc);
        const lines = SchemaIssueRenderer.render(error.issue);
        assert.isAbove(lines.length, 1);
        for (const line of lines) {
          const [message, path] = Str.split(line, " at ");
          assert.include(text, message ?? "", line);
          for (const segment of pipe(
            path ?? "",
            Str.split("."),
            A.filter((s) => s !== "")
          ))
            assert.include(text, segment, line);
        }
        // The nesting is the path: g sits under groups.
        assert.match(text, /groups\n.*g\n.*extra: unknown key/);
      })
    );

    it.effect("a bare issue and an error carrying one give the same tree", () =>
      Effect.gen(function* () {
        const error = failureOf({ owner: "o", groups: {}, ownr: "typo" });
        const viaError = CliFailure.toDoc(Cause.fail(error));
        const viaIssue = CliFailure.toDoc(Cause.fail(error.issue));
        assert.deepStrictEqual(kinds(viaIssue), ["Tree"]);
        assert.include(yield* plain(viaIssue), "ownr: unknown key");
        assert.include(yield* plain(viaError), "ownr: unknown key");
      })
    );

    it.effect("a value with a malformed issue is the generic line, not a throw", () =>
      Effect.gen(function* () {
        assert.include(
          yield* plain(CliFailure.toDoc(Cause.fail({ issue: { not: "an issue" }, message: "weird" }))),
          "weird"
        );
      })
    );
  });

  describe("CliFailure.toDoc: a defect", () => {
    it.effect("is its message, then a collapsible stack of the user's frames only", () =>
      Effect.gen(function* () {
        const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES, `main (${USER}:9:1)`]);
        const doc = CliFailure.toDoc(Cause.die(error));
        assert.deepStrictEqual(kinds(doc), ["Paragraph", "Collapsible"]);
        const text = yield* plain(doc);
        assert.include(text, "Error: boom");
        assert.include(text, "stack");
        assert.include(text, `${USER}:3:4`);
        assert.include(text, `${USER}:9:1`);
        for (const hidden of ["node:internal", "node_modules/effect", "effect/src", "Generator.next"]) {
          assert.notInclude(text, hidden);
        }
      })
    );

    it.effect("a stack of nothing but internal frames says so, with the count, never an empty block", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.die(errorWithStack("boom", INTERNAL_FRAMES)));
        const text = yield* plain(doc);
        assert.include(text, `no user frames (${INTERNAL_FRAMES.length} internal frames hidden)`);
        const stack = O.getOrUndefined(A.findFirst(doc, (block) => block._tag === "Collapsible"));
        assert.isDefined(stack);
        assert.isAbove(stack.body.length, 0);
      })
    );

    it.effect("a single hidden frame is counted as one", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(Cause.die(errorWithStack("boom", [A.getUnsafe(INTERNAL_FRAMES, 0)])))
        );
        assert.include(text, "no user frames (1 internal frames hidden)");
      })
    );

    it.effect("an error with no stack at all says there is none", () =>
      Effect.gen(function* () {
        const error = new Error("bare");
        Object.defineProperty(error, "stack", { value: undefined });
        assert.include(yield* plain(CliFailure.toDoc(Cause.die(error))), "no stack");
      })
    );

    it.effect("displayPath relativises every frame", () =>
      Effect.gen(function* () {
        const error = errorWithStack("boom", [`run (${USER}:3:4)`]);
        const displayPath = (p: string) => Str.replace("/repo/", "")(p);
        const doc = CliFailure.toDoc(Cause.die(error), { displayPath });
        // The context applies the same function to the link's target, as the default report does.
        const text = Render.plain(doc, yield* contextFor("agent", {}, { displayPath }));
        assert.include(text, "src/run.ts:3:4");
        assert.notInclude(text, "/repo/");
      })
    );

    it.effect("a frame is a file link: an editor hyperlink for a human on a linking terminal, never for an agent", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`])));
        const human = Render.ansi(doc, yield* contextFor("human", { hyperlinks: true, color: "basic" }));
        assert.include(human, `${ESC}]8;;vscode://file/repo/src/run.ts:3:4`);
        const agent = Render.plain(doc, yield* contextFor("agent", { hyperlinks: true, color: "basic" }));
        assert.notInclude(agent, ESC);
        const agentAnsi = Render.ansi(doc, yield* contextFor("agent", { hyperlinks: true, color: "basic" }));
        assert.notInclude(agentAnsi, `${ESC}]8`);
      })
    );

    it.effect("file URLs in a stack are paths, and a frame with no file stays plain text", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(
            Cause.die(errorWithStack("boom", ["file:///repo/src/esm%20x.ts:5:6", "eval (eval at <anonymous>)"]))
          )
        );
        assert.include(text, "/repo/src/esm x.ts:5:6");
      })
    );

    it.effect("an Error.cause chain nests as a Tree under the message", () =>
      Effect.gen(function* () {
        const error = new Error("outer", { cause: new Error("middle", { cause: new Error("root") }) });
        const doc = CliFailure.toDoc(Cause.die(error));
        const tree = O.getOrUndefined(A.findFirst(doc, (block) => block._tag === "Tree"));
        assert.isDefined(tree);
        const text = yield* plain(doc);
        const order = A.map(["outer", "middle", "root"], (word) => O.getOrThrow(Str.lastIndexOf(word)(text)));
        assert.deepStrictEqual(
          [...order].sort((a, b) => a - b),
          order
        );
        assert.match(text, /middle\n.*root/);
      })
    );

    it.effect("a cyclic cause chain ends", () =>
      Effect.gen(function* () {
        const a = new Error("a");
        const b = new Error("b", { cause: a });
        a.cause = b;
        assert.include(yield* plain(CliFailure.toDoc(Cause.die(a))), "b");
      })
    );

    it("a self-cause adds no Tree", () => {
      const error = new Error("self");
      error.cause = error;
      assert.deepStrictEqual(kinds(CliFailure.toDoc(Cause.die(error))), ["Paragraph", "Collapsible"]);
    });

    it.effect("a cycle below the defect renders each ancestor once", () =>
      Effect.gen(function* () {
        const a = new Error("a");
        const b = new Error("b", { cause: a });
        a.cause = b;
        const doc = CliFailure.toDoc(Cause.die(new Error("outer", { cause: a })));
        const tree = O.getOrUndefined(A.findFirst(doc, (block) => block._tag === "Tree"));
        assert.isDefined(tree);
        const text = yield* plain([tree]);
        assert.strictEqual(Str.split(text, "\n").length, 3);
        assert.match(text, /outer\n.*Error: a\n.*Error: b$/);
      })
    );

    it.effect("distinct equal-looking errors both remain in the cause chain", () =>
      Effect.gen(function* () {
        const inner = errorWithStack("repeat", []);
        const outer = new Error("repeat", { cause: inner });
        outer.stack = "Error: repeat";
        assert.notStrictEqual(outer, inner);
        assert.strictEqual(String(outer), String(inner));
        assert.strictEqual(outer.stack, inner.stack);
        const doc = CliFailure.toDoc(Cause.die(new Error("root", { cause: outer })));
        const tree = O.getOrUndefined(A.findFirst(doc, (block) => block._tag === "Tree"));
        assert.isDefined(tree);
        const text = yield* plain([tree]);
        assert.strictEqual(Str.split(text, "\n").length, 3);
        assert.lengthOf(A.fromIterable(Str.matchAll(/Error: repeat/g)(text)), 2);
      })
    );

    it.effect("an acyclic cause chain renders at most eight descendants", () =>
      Effect.gen(function* () {
        let error = new Error("cause-9");
        for (let index = 8; index >= 0; index--) error = new Error(`cause-${index}`, { cause: error });
        const doc = CliFailure.toDoc(Cause.die(error));
        const tree = O.getOrUndefined(A.findFirst(doc, (block) => block._tag === "Tree"));
        assert.isDefined(tree);
        const text = yield* plain([tree]);
        assert.strictEqual(Str.split(text, "\n").length, 9);
        assert.include(text, "cause-8");
        assert.notInclude(text, "cause-9");
      })
    );

    it.effect("a defect that is not an Error is its string, with no stack", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.die("just a string"));
        assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
        assert.include(yield* plain(doc), "just a string");
      })
    );
  });

  describe("CliFailure.toDoc: the span path", () => {
    const spanned = Effect.fail(Boom.make({ message: "x" })).pipe(Effect.withSpan("inner"), Effect.withSpan("outer"));

    it.effect("is shown as `in: outer › inner`, outermost first, with the audience's separator", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(spanned);
        if (!Exit.isFailure(exit)) throw new Error("expected a failure");
        const doc = CliFailure.toDoc(exit.cause);
        assert.include(Render.plain(doc, yield* contextFor("agent")), "in: outer > inner");
        assert.include(Render.ansi(doc, yield* contextFor("human")), "in: outer › inner");
      })
    );

    it.effect("a reason with no spans has no `in:` line", () =>
      Effect.gen(function* () {
        assert.notInclude(yield* plain(CliFailure.toDoc(Cause.fail(Boom.make({ message: "x" })))), "in:");
      })
    );

    it.effect("the names are the annotation's StackFrame chain, which is where the runtime keeps them", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(spanned);
        if (!Exit.isFailure(exit)) throw new Error("expected a failure");
        const frame = Context.getOrUndefined(
          Cause.reasonAnnotations(A.getUnsafe(exit.cause.reasons, 0)),
          Cause.StackTrace
        );
        const names: Array<string> = [];
        for (let current = frame; current !== undefined; current = current.parent) names.push(current.name);
        assert.deepStrictEqual(names, ["inner", "outer"]);
      })
    );
  });

  describe("CliFailure.toDoc: interrupts and prompts", () => {
    it.effect("an interrupt-only cause is the single line `interrupted`", () =>
      Effect.gen(function* () {
        const doc = CliFailure.toDoc(Cause.interrupt(3));
        assert.deepStrictEqual(kinds(doc), ["Paragraph"]);
        assert.strictEqual(yield* plain(doc), "interrupted");
      })
    );

    it.effect("interrupts beside a real failure are not rendered: the failure is the story", () =>
      Effect.gen(function* () {
        const cause = Cause.combine(Cause.interrupt(1), Cause.fail(Boom.make({ message: "real" })));
        const text = yield* plain(CliFailure.toDoc(cause));
        assert.include(text, "real");
        assert.notInclude(text, "interrupted");
      })
    );

    it.effect("Cancelled and NotInteractive keep their one fixed line, with no status glyph", () =>
      Effect.gen(function* () {
        assert.strictEqual(
          yield* plain(CliFailure.toDoc(Cause.fail(Cancelled.make({ reason: "escape" })))),
          "cancelled; nothing written"
        );
        assert.strictEqual(
          yield* plain(CliFailure.toDoc(Cause.fail(NotInteractive.make()))),
          "not interactive: run in a terminal or pass the flag"
        );
      })
    );

    it("an empty cause is an empty document", () => {
      assert.deepStrictEqual(CliFailure.toDoc(Cause.empty), []);
    });

    it.effect("every reason of a cause is rendered, in order", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(Cause.combine(Cause.fail(Boom.make({ message: "first" })), Cause.die(new Error("second"))))
        );
        assert.isBelow(O.getOrThrow(Str.indexOf("first")(text)), O.getOrThrow(Str.indexOf("second")(text)));
      })
    );
  });

  describe("CliFailure.toDoc: hostile text", () => {
    const HOSTILE = `bad${ESC}[31m red ${ESC}]8;;http://evil${BEL}link${ESC}]8;;${BEL}\rovertyped`;

    const documents: ReadonlyArray<readonly [string, Document]> = [
      ["a typed error's message", CliFailure.toDoc(Cause.fail(new Error(HOSTILE)))],
      ["a string failure", CliFailure.toDoc(Cause.fail(HOSTILE))],
      ["a defect's message", CliFailure.toDoc(Cause.die(new Error(HOSTILE)))],
      ["a stack frame", CliFailure.toDoc(Cause.die(errorWithStack("m", [`fn${HOSTILE} (${USER}${HOSTILE}:1:2)`])))],
      ["a cause message", CliFailure.toDoc(Cause.die(new Error("o", { cause: new Error(HOSTILE) })))],
      ["a thrown value", CliFailure.toDoc(Cause.die({ toString: () => HOSTILE }))],
    ];

    for (const [name, doc] of documents) {
      it.effect(`${name}: no escape, BEL or carriage return survives plain or colourless ansi`, () =>
        Effect.gen(function* () {
          for (const text of [
            yield* plain(doc),
            Render.ansi(doc, yield* contextFor("human")),
            Render.githubLog(doc, yield* contextFor("ci")),
          ]) {
            assert.notInclude(text, ESC);
            assert.notInclude(text, BEL);
            assert.notInclude(text, "\r");
          }
        })
      );

      it.effect(`${name}: with colour and links on, the only escapes are the kit's own balanced ones`, () =>
        Effect.gen(function* () {
          const text = Render.ansi(doc, yield* contextFor("human", { hyperlinks: true, color: "truecolor" }));
          assert.notInclude(text, "evil");
          assert.notInclude(text, `${ESC}[31m red`);
        })
      );
    }
  });

  describe("CliRuntime: the default failure path", () => {
    const platform = (stdout: boolean) =>
      Layer.mergeAll(
        Stdio.layerTest({ stdinIsTerminal: Effect.succeed(stdout), stdoutIsTerminal: Effect.succeed(stdout) }),
        Layer.succeed(
          Terminal.Terminal,
          Terminal.make({
            columns: Effect.succeed(100),
            rows: Effect.succeed(24),
            size: Effect.die("unused"),
            readInput: Effect.die("unused"),
            readLine: Effect.die("unused"),
            display: () => Effect.void,
          })
        )
      );

    const capturing = () => {
      const err: string[] = [];
      const out: string[] = [];
      const double: Console.Console = Object.assign(Object.create(console), {
        log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
        error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
      });
      return { double, err, out };
    };

    const runMain = Effect.fnUntraced(function* <E>(
      program: Effect.Effect<void, E>,
      env: Record<string, string>,
      tty: boolean,
      options: object = {}
    ) {
      const { double, err, out } = capturing();
      const exit = yield* CliRuntime.main(program, { platform: platform(tty), env: {}, ...options }).pipe(
        Effect.exit,
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
        Effect.provideService(Console.Console, double)
      );
      const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
      return { err, out, code };
    });

    // Fresh errors per run: `reportFailures` marks the error it reports with its exit code, and a shared instance would
    // carry the first run's mark into the next.
    const failing = Effect.suspend(() => Effect.fail(Boom.make({ message: "disk full" })));
    const dying = Effect.suspend(() => Effect.die(errorWithStack("kaboom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES])));

    it.effect("an agent gets the plain rendering: a status line, no escape of any kind", () =>
      Effect.gen(function* () {
        const { err, out, code } = yield* runMain(failing, { AI_AGENT: "claude", TERM: "xterm-256color" }, true);
        assert.strictEqual(code, 1);
        assert.deepStrictEqual(out, []);
        assert.strictEqual(err.length, 1);
        assert.include(err[0] ?? "", "disk full");
        assert.include(err[0] ?? "", "✗");
        assert.notInclude(A.join(err, "\n"), ESC);
      })
    );

    it.effect("a human on a colour terminal gets the painted rendering", () =>
      Effect.gen(function* () {
        const { err, code } = yield* runMain(failing, { TERM: "xterm-256color" }, true);
        assert.strictEqual(code, 1);
        assert.include(A.join(err, "\n"), "disk full");
        assert.include(A.join(err, "\n"), `${ESC}[`);
      })
    );

    it.effect("a defect shows its cleaned stack under a stack heading, for either audience", () =>
      Effect.gen(function* () {
        for (const env of [{ AI_AGENT: "claude" }, { TERM: "xterm-256color" }]) {
          const { err, code } = yield* runMain(dying, env, true);
          assert.strictEqual(code, 1);
          const text = A.join(err, "\n");
          assert.include(text, "kaboom");
          assert.include(text, `${USER}:3:4`);
          assert.notInclude(text, "node:internal");
          assert.notInclude(text, "node_modules/effect");
        }
      })
    );

    it.effect("a real Effect.sync defect shows the frame that threw", () =>
      Effect.gen(function* () {
        let thrown: Error | undefined;
        const program = Effect.sync(() => {
          thrown = new Error("thrown by a thunk");
          throw thrown;
        });
        const { err } = yield* runMain(program, { AI_AGENT: "claude" }, true);
        const text = A.join(err, "\n");
        assert.include(text, "thrown by a thunk");
        // V8 names the thunk's own frame by Effect's method alias, in parentheses; JavaScriptCore (Bun) may print an
        // anonymous frame's location bare. Either way the frame is still the program's.
        const first = /(?:\(|at )([^()\s]*CliFailure\.test\.ts:\d+:\d+)/.exec(thrown?.stack ?? "")?.[1];
        assert.isDefined(first, "control: the engine put the thunk's frame on the stack");
        assert.include(text, first);
      })
    );

    it.effect("exit codes are unchanged: the exitCode option, a marked error's own code, and Cancelled's 130", () =>
      Effect.gen(function* () {
        assert.strictEqual((yield* runMain(failing, {}, true, { exitCode: 7 })).code, 7);
        const marked = CliRuntime.reported(Boom.make({ message: "m" }), 4);
        assert.strictEqual((yield* runMain(Effect.fail(marked), {}, true, { exitCode: 7 })).code, 4);
        const cancelled = yield* runMain(
          Effect.fail(Cancelled.make({ reason: "escape" })),
          { AI_AGENT: "claude" },
          true
        );
        assert.strictEqual(cancelled.code, 130);
        assert.deepStrictEqual(cancelled.err, ["cancelled; nothing written"]);
      })
    );

    it.effect("a consumer render, as a string or as lines, still overrides it", () =>
      Effect.gen(function* () {
        const one = yield* runMain(failing, {}, true, { render: () => "mine" });
        assert.deepStrictEqual(one.err, ["mine"]);
        const many = yield* runMain(failing, {}, true, { render: () => ["a", "b"] });
        assert.deepStrictEqual(many.err, ["a", "b"]);
      })
    );

    it.effect("the failure report is written through the logger and never to stdout", () =>
      Effect.gen(function* () {
        const { out } = yield* runMain(failing, { AI_AGENT: "claude" }, true);
        assert.deepStrictEqual(out, []);
      })
    );

    it.effect("without env the report is the plain rendering too, with no services to ask", () =>
      Effect.gen(function* () {
        const { double, err } = capturing();
        yield* CliRuntime.main(failing, { platform: Layer.empty }).pipe(
          Effect.exit,
          Effect.provideService(Console.Console, double)
        );
        assert.strictEqual(err.length, 1);
        assert.include(err[0] ?? "", "disk full");
        assert.notInclude(err[0] ?? "", ESC);
      })
    );

    it.effect("end to end, a hostile message and stack frame reach stderr with no escape but the kit's own", () =>
      Effect.gen(function* () {
        const hostile = `x${ESC}]8;;http://evil${BEL}y${ESC}[2J\rz`;
        const program = Effect.suspend(() =>
          Effect.die(errorWithStack(hostile, [`fn${hostile} (${USER}${hostile}:1:2)`]))
        );
        for (const env of [{ AI_AGENT: "claude", TERM: "xterm-256color" }, { TERM: "xterm-256color" }]) {
          const { err } = yield* runMain(program, env, true);
          const text = A.join(err, "\n");
          assert.notInclude(text, "evil");
          assert.notInclude(text, BEL);
          assert.notInclude(text, "\r");
          assert.notInclude(text, `${ESC}[2J`);
          // Whatever escapes remain are SGR the kit painted: no OSC and no cursor control.
          assert.notInclude(text, `${ESC}]`);
          for (const line of err) {
            for (const match of Str.matchAll(new RegExp(`${ESC}(.)`, "g"))(line)) assert.strictEqual(match[1], "[");
          }
        }
      })
    );

    it.effect("an audience flag decides the report's audience, and --log-level none does not silence the report", () =>
      Effect.gen(function* () {
        const runTool = Effect.fn("runTool")(function* (
          argv: ReadonlyArray<string>,
          env: Record<string, string> = { TERM: "xterm-256color" }
        ) {
          const { double, err } = capturing();
          const tool = Command.make("tool").pipe(
            Command.withSharedFlags(CliAudience.flags()),
            Command.withSubcommands([Command.make("go", {}, () => Effect.fail(Boom.make({ message: "flagged" })))])
          );
          // The platform main builds the environment from is the colour terminal; the command only gets the
          // services core's runner needs, so they cannot replace the terminal.
          yield* CliRuntime.main(CliAudience.runWith(tool, { version: "1.0.0" })(argv), {
            platform: platform(true),
            env: {},
          }).pipe(
            Effect.exit,
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
            Effect.provideService(Console.Console, double)
          );
          return A.join(err, "\n");
        });
        const flagged = yield* runTool(["--agent", "go"]);
        assert.include(flagged, "flagged");
        assert.notInclude(flagged, ESC);
        const unflagged = yield* runTool(["go"]);
        assert.include(unflagged, "flagged");
        assert.include(unflagged, ESC, "control: with no flag the same terminal is painted");
        // And --human restores the painted report where the environment DETECTED an agent.
        const agentEnv = { AI_AGENT: "x", TERM: "xterm-256color" };
        const detected = yield* runTool(["go"], agentEnv);
        assert.include(detected, "flagged");
        assert.notInclude(detected, ESC, "control: a detected agent gets the plain report");
        const human = yield* runTool(["--human", "go"], agentEnv);
        assert.include(human, "flagged");
        assert.include(human, ESC);
        // --log-level none silences the logger, but not the failure report, which is written outside that scope.
        const silent = yield* runTool(["--log-level", "none", "go"], agentEnv);
        assert.include(silent, "flagged");
      })
    );

    it.effect('--agent rewrites the report target and keeps stackFrames: "all"', () =>
      Effect.gen(function* () {
        const runTool = Effect.fn("runTool")(function* (stackFrames: "app" | "all") {
          const { double, err } = capturing();
          const vendorDefect = Effect.suspend(() => {
            const error = new Error("kaboom");
            error.stack = `Error: kaboom\n    at run (${USER}:3:4)\n    at vendor (/repo/node_modules/vendor/x.js:7:8)`;
            return Effect.die(error);
          });
          const tool = Command.make("tool").pipe(
            Command.withSharedFlags(CliAudience.flags()),
            Command.withSubcommands([Command.make("go", {}, () => vendorDefect)])
          );
          yield* CliRuntime.main(CliAudience.runWith(tool, { version: "1.0.0" })(["--agent", "go"]), {
            platform: platform(true),
            env: { stackFrames },
          }).pipe(
            Effect.exit,
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ TERM: "xterm-256color" })
            ),
            Effect.provideService(Console.Console, double)
          );
          return A.join(err, "\n");
        });
        const all = yield* runTool("all");
        assert.notInclude(all, ESC, "control: the flag made it an agent's report");
        assert.include(all, "node_modules/vendor/x.js:7:8");
        assert.notInclude(yield* runTool("app"), "node_modules/vendor", "control: app hides it");
      })
    );
  });

  describe("CliRuntime.defaultRender", () => {
    it("is the plain lines of the cause: the stack of a defect, a tree for a schema error", () => {
      const cause = Cause.die(errorWithStack("kaboom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES]));
      const lines = CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: true });
      const text = A.join(typeof lines === "string" ? [lines] : lines, "\n");
      assert.include(text, "kaboom");
      assert.include(text, `${USER}:3:4`);
      assert.notInclude(text, ESC);
    });

    it("keeps the fixed lines for the two prompt failures", () => {
      const cancelled = Cause.fail(Cancelled.make({ reason: "interrupt" }));
      assert.deepStrictEqual(CliRuntime.defaultRender(Cause.squash(cancelled), { cause: cancelled, isDefect: false }), [
        "cancelled; nothing written",
      ]);
    });
  });

  describe("CliFailure.toDoc: third-party frames (A3)", () => {
    const THIRD_PARTY = [
      "runTest (file:///repo/node_modules/.pnpm/@vitest+runner@4.0.0/node_modules/@vitest/runner/dist/run.B2x.js:1:2)",
      "/repo/node_modules/tinypool/dist/entry.js:3:4",
      "C:\\repo\\node_modules\\vitest\\dist\\worker.js:5:6",
    ];

    it.effect("hides every node_modules frame by default, not only Effect's", () =>
      Effect.gen(function* () {
        const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...THIRD_PARTY, `main (${USER}:9:1)`]);
        const text = yield* plain(CliFailure.toDoc(Cause.die(error)));
        assert.include(text, `${USER}:3:4`);
        assert.include(text, `${USER}:9:1`);
        for (const frame of ["@vitest", "tinypool", "worker.js"]) assert.notInclude(text, frame);
      })
    );

    it.effect(
      "when they are all that is left, they are shown rather than hidden, and the runtime's still are not (fix 2)",
      () =>
        Effect.gen(function* () {
          const text = yield* plain(
            CliFailure.toDoc(Cause.die(errorWithStack("boom", [...THIRD_PARTY, ...INTERNAL_FRAMES])))
          );
          for (const frame of ["@vitest", "tinypool", "worker.js"]) assert.include(text, frame);
          for (const hidden of ["node:internal", "node_modules/effect", "Generator.next"])
            assert.notInclude(text, hidden);
          assert.notInclude(text, "no user frames");
        })
    );

    it.effect('stackFrames: "all" keeps every frame', () =>
      Effect.gen(function* () {
        const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...THIRD_PARTY, ...INTERNAL_FRAMES]);
        const text = yield* plain(CliFailure.toDoc(Cause.die(error), { stackFrames: "all" }));
        for (const frame of ["@vitest", "tinypool", "worker.js", "node:internal", "Generator.next", `${USER}:3:4`]) {
          assert.include(text, frame);
        }
      })
    );
  });

  describe("CliFailure.toDoc: an installed program's own frames", () => {
    const INSTALLED = [
      "main (/usr/lib/node_modules/my-cli/dist/main.js:10:3)",
      "run (file:///home/me/.local/share/pnpm/store/node_modules/.pnpm/my-cli@1.0.0/node_modules/my-cli/dist/run.js:4:7)",
    ];

    it.effect(
      "when every non-runtime frame is under node_modules, the program's are shown and Effect's still hidden",
      () =>
        Effect.gen(function* () {
          const text = yield* plain(
            CliFailure.toDoc(Cause.die(errorWithStack("boom", [...INSTALLED, ...INTERNAL_FRAMES])))
          );
          assert.include(text, "my-cli/dist/main.js:10:3");
          assert.include(text, "my-cli/dist/run.js:4:7");
          for (const hidden of ["node:internal", "node_modules/effect", "effect/src", "Generator.next"]) {
            assert.notInclude(text, hidden);
          }
          assert.notInclude(text, "no user frames");
        })
    );

    it.effect("a mixed stack shows only the app's frames", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`, ...INSTALLED, ...INTERNAL_FRAMES])))
        );
        assert.include(text, `${USER}:3:4`);
        assert.notInclude(text, "my-cli");
        assert.notInclude(text, "node_modules/effect");
      })
    );

    it.effect("a stack of nothing but runtime and Effect frames still says no user frames, with the count", () =>
      Effect.gen(function* () {
        const text = yield* plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", INTERNAL_FRAMES))));
        assert.include(text, `no user frames (${INTERNAL_FRAMES.length} internal frames hidden)`);
      })
    );
  });

  describe("CliFailure.toDoc: frames are classified by file path, never by name", () => {
    const ALIAS = "PrimitiveImpl.boom [as ~effect/Effect/args] (/abs/probe-defect.ts:10:8)";
    const EFFECT_DIST =
      "PrimitiveImpl.~effect/Effect/evaluate (file:///repo/node_modules/.pnpm/effect@4.0.0/node_modules/effect/dist/internal/effect.js:709:29)";

    it.effect("a user frame carrying Effect's method alias is the program's, and its file is shown", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(Cause.die(errorWithStack("boom", [ALIAS, EFFECT_DIST, ...INTERNAL_FRAMES])))
        );
        assert.include(text, "/abs/probe-defect.ts:10:8");
        assert.notInclude(text, "no user frames");
      })
    );

    it.effect("an Effect dist frame is still hidden, whatever its name", () =>
      Effect.gen(function* () {
        const text = yield* plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [ALIAS, EFFECT_DIST]))));
        assert.include(text, "/abs/probe-defect.ts:10:8");
        assert.notInclude(text, "node_modules/effect");
        assert.notInclude(text, "effect.js");
      })
    );

    it.effect("every node: frame and every frame with no file is the runtime's", () =>
      Effect.gen(function* () {
        const text = yield* plain(
          CliFailure.toDoc(
            Cause.die(
              errorWithStack("boom", [
                ALIAS,
                "FSReqCallback.oncomplete (node:fs:197:5)",
                "process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
                "new Promise (<anonymous>)",
                "Array.map (native)",
              ])
            )
          )
        );
        assert.include(text, "/abs/probe-defect.ts:10:8");
        for (const hidden of ["node:fs", "node:internal", "new Promise", "Array.map"]) assert.notInclude(text, hidden);
      })
    );
  });

  describe("CliFailure.toDoc: the hidden-frame count", () => {
    it.effect("a mixed stack shows its app frames and, after them, how many internal frames were hidden", () =>
      Effect.gen(function* () {
        const frames = [
          `run (${USER}:3:4)`,
          ...INTERNAL_FRAMES,
          "FSReqCallback.oncomplete (node:fs:197:5)",
          `main (${USER}:9:1)`,
        ];
        const text = yield* plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", frames))));
        assert.include(text, `${USER}:3:4`);
        assert.include(text, `${USER}:9:1`);
        const note = `(+${INTERNAL_FRAMES.length + 1} internal frames hidden)`;
        assert.include(text, note);
        assert.isAbove(
          O.getOrThrow(Str.indexOf(note)(text)),
          O.getOrThrow(Str.indexOf(`${USER}:9:1`)(text)),
          "the note follows the frames"
        );
      })
    );

    it.effect("nothing hidden prints no note", () =>
      Effect.gen(function* () {
        const text = yield* plain(CliFailure.toDoc(Cause.die(errorWithStack("boom", [`run (${USER}:3:4)`]))));
        assert.notInclude(text, "hidden");
      })
    );

    it.effect('stackFrames: "all" hides nothing and prints no note', () =>
      Effect.gen(function* () {
        const error = errorWithStack("boom", [`run (${USER}:3:4)`, ...INTERNAL_FRAMES]);
        assert.notInclude(yield* plain(CliFailure.toDoc(Cause.die(error), { stackFrames: "all" })), "hidden");
      })
    );
  });
});
