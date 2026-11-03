import * as Parser from "@beep/toml/internal/parser";
import * as Semantic from "@beep/toml/internal/semantic";
import { TomlParseError } from "@beep/toml/Toml";
import { TomlDocument } from "@beep/toml/TomlDocument";
import { assert, it, vi } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";

it.effect("parser and semantic defects retain their identity", () =>
  Effect.gen(function* () {
    const defect = new Error("unexpected engine defect");
    const parser = vi.spyOn(Parser, "parseExpressions").mockImplementation(() => {
      throw defect;
    });
    try {
      const exit = yield* Effect.exit(TomlDocument.parse("a=1"));
      if (Exit.isSuccess(exit)) return assert.fail("expected a defect");
      assertSuccess(
        Result.map(Cause.findDie(exit.cause), (reason) => reason.defect),
        defect
      );
    } finally {
      parser.mockRestore();
    }
    const analyzer = vi.spyOn(Semantic, "analyze").mockImplementation(() => {
      throw defect;
    });
    try {
      const exit = yield* Effect.exit(TomlDocument.parse("a=1"));
      if (Exit.isSuccess(exit)) return assert.fail("expected a defect");
      assertSuccess(
        Result.map(Cause.findDie(exit.cause), (reason) => reason.defect),
        defect
      );
    } finally {
      analyzer.mockRestore();
    }
  })
);
it.effect("synthetic documents materialize unrecorded semantic violations", () =>
  Effect.gen(function* () {
    const parsed = yield* TomlDocument.parse("a=1\na=2\n");
    const synthetic = TomlDocument.make({ source: parsed.source, expressions: parsed.expressions, diagnostics: [] });
    const result1 = yield* Effect.result(synthetic.toValue());
    assertFailure(result1, TomlParseError.make({ diagnostics: parsed.diagnostics }));
  })
);
