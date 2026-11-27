import { CliEnvOptions } from "@beep/cli-kit/CliEnv";
import { CliFailure, CliFailureOptions } from "@beep/cli-kit/CliFailure";
import { CliLinksLinkerOptions } from "@beep/cli-kit/CliLinks";
import { CliLogOptions } from "@beep/cli-kit/CliLog";
import { CliLoggerOptions } from "@beep/cli-kit/CliLogger";
import { FailureDetails, ReportFailuresOptions } from "@beep/cli-kit/CliRuntime";
import { CliTheme, StreamTheme } from "@beep/cli-kit/CliTheme";
import { CountsOptions, Doc, OverflowOptions, TreeInput } from "@beep/cli-kit/Doc";
import { LinksService } from "@beep/cli-kit/internal/declared";
import { FailureSettings, FailureTarget } from "@beep/cli-kit/internal/failureTarget";
import { IssueTreeNode } from "@beep/cli-kit/internal/format";
import { Span } from "@beep/cli-kit/internal/layout";
import { Render, RenderContext } from "@beep/cli-kit/Render";
import { Status } from "@beep/cli-kit/Status";
import { Style, Token } from "@beep/cli-kit/Token";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const identity = (absolute: string): string => absolute;
const links = { mode: "off" as const, target: () => O.none<string>() };

describe("declared option fields: each guard accepts a value the kit builds and refuses another, so none drifts", () => {
  it("environment options take a path callback, a formatter record and a stderr TTY effect", () => {
    assertTrue(S.is(CliEnvOptions)({ displayPath: identity, formatter: {}, stderrIsTerminal: Effect.succeed(true) }));
    assertFalse(S.is(CliEnvOptions)({ formatter: 1 }));
    assertFalse(S.is(CliEnvOptions)({ stderrIsTerminal: true }));
  });

  it("failure options take a record of document renderers", () => {
    assertTrue(S.is(CliFailureOptions)({ displayPath: identity, render: { Boom: () => [] } }));
    assertFalse(S.is(CliFailureOptions)({ render: { Boom: "not a renderer" } }));
  });

  it("the links service needs a mode and a target function", () => {
    assertTrue(S.is(LinksService)(links));
    assertTrue(S.is(CliLinksLinkerOptions)({ audience: "human", hyperlinks: true, links }));
    for (const value of [1, { target: links.target }, { mode: "off" }, { mode: "off", target: "x" }]) {
      assertFalse(S.is(LinksService)(value));
    }
  });

  it("log and logger options take loggers and a render callback", () => {
    assertTrue(S.is(CliLogOptions)({ extraLoggers: [Logger.make(() => undefined)] }));
    assertFalse(S.is(CliLogOptions)({ extraLoggers: [1] }));
    assertTrue(S.is(CliLoggerOptions)({ render: String }));
    assertFalse(S.is(CliLoggerOptions)({ render: 1 }));
  });

  it("failure details carry a cause and a lines callback; report options a render callback", () => {
    const details = {
      cause: Cause.fail("x"),
      defaultLines: [],
      isCancelled: false,
      isDefect: false,
      isNotInteractive: false,
      lines: () => [],
    };
    assertTrue(S.is(FailureDetails)(details));
    assertFalse(S.is(FailureDetails)({ ...details, cause: "x" }));
    assertTrue(S.is(ReportFailuresOptions)({ exitCode: 2, render: () => "x" }));
  });

  it("document options take overflow and total callbacks, and a tree input nests", () => {
    assertTrue(S.is(OverflowOptions)({ cap: 3, overflow: (hidden: number) => `${hidden} more` }));
    assertTrue(S.is(CountsOptions)({ counters: [], layout: "inline", total: () => 0 }));
    assertTrue(S.is(TreeInput)({ label: "root", children: [{ label: "leaf" }] }));
    assertFalse(S.is(TreeInput)({ label: "root", children: [{ children: [] }] }));
  });

  it("a rendering context, its failure target and settings, and a linked span", () => {
    const ctx = Render.contextOf({ audience: "human", color: "basic" });
    assertTrue(S.is(RenderContext)(ctx));
    assertTrue(S.is(FailureTarget)({ ctx, format: "plain", spans: "app" }));
    assertTrue(S.is(FailureSettings)({ appModule: "file:///app/bin.js", displayPath: identity, spans: "off" }));
    assertTrue(S.is(Span)({ text: "a", link: { url: "https://example.test" } }));
    assertTrue(S.is(IssueTreeNode)({ label: "groups", children: [{ label: "g: unknown key" }] }));
  });

  it.layer(CliTheme.layerTest({ color: "basic" }), { timeout: "30 seconds" })("a stream theme", (it) => {
    it.effect("is a StreamTheme, and a theme with a non-function sgr is not", () =>
      Effect.gen(function* () {
        const theme = (yield* CliTheme).forStream("stdout");
        assertTrue(S.is(StreamTheme)(theme));
        assertFalse(S.is(StreamTheme)({ ...theme, sgr: "red" }));
      })
    );
  });
});

describe("builders admit plain records at the IR boundary", () => {
  it("a status whose token is a style keeps the style", () => {
    const vocab = Status.extend({ timeout: { glyph: "⧖", ascii: "[time]", token: Token.hex("#e09a4e"), rank: 85 } });
    assert.deepStrictEqual(Doc.status(vocab, "timeout").def.token, Style.make({ fg: "#e09a4e" }));
  });

  it("Doc.line takes an inline node data-first", () => {
    assert.deepStrictEqual(Doc.line(Doc.text("one")), Doc.line([Doc.text("one")]));
  });

  it("a custom renderer that throws falls through to the generic failure line", () => {
    class Boom extends S.TaggedError<Boom, { readonly brand: unique symbol }>()("Boom", { message: S.String }) {}
    const cause = Cause.fail(Boom.make({ message: "disk full" }));
    const thrown = CliFailure.toDoc(cause, {
      render: {
        Boom: () => {
          throw new Error("renderer bug");
        },
      },
    });
    assert.deepStrictEqual(thrown, CliFailure.toDoc(cause));
  });
});
