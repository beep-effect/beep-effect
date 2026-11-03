import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { renderTruncatedLines, writeArtifact } from "@beep/repo-cli-kit/artifacts/ArtifactIo";
import { asArrayBufferView, concatBytes } from "@beep/repo-cli-kit/cli/Bytes";
import {
  commandErrorFields,
  messageWithCause,
  reportCommandError,
  resolveCommandExitCode,
} from "@beep/repo-cli-kit/cli/CommandErrorFields";
import { REPO_CLI_ENTRY_PATH } from "@beep/repo-cli-kit/cli/EntryPath";
import { turboCacheSecretSessionEnvironment, turboSecretSessionStep } from "@beep/repo-cli-kit/cli/EnvConfig";
import { CliReportedExit, failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { CliJsonError, CommandJsonOutput, formatJsonValue, printCommandJson } from "@beep/repo-cli-kit/cli/Json";
import { LINT_POLICY_SUBCOMMANDS } from "@beep/repo-cli-kit/cli/LintRouting";
import { optionalProp } from "@beep/repo-cli-kit/cli/OptionRecord";
import { makePolicyFindingLogger } from "@beep/repo-cli-kit/cli/PolicyFindingLogger";
import { printJsonOrLines, printLines } from "@beep/repo-cli-kit/cli/Printer";
import { isProgressEnabled, renderProgressBar } from "@beep/repo-cli-kit/cli/Progress";
import { isWithinRoot } from "@beep/repo-cli-kit/PathContainment";
import { QualityTaskStep } from "@beep/repo-cli-kit/process/StepExec";
import { UUID } from "@beep/repo-cli-kit/schema/Uuid";
import { nearestRank } from "@beep/repo-cli-kit/stats/NearestRank";
import { mentionsAnyToken, mentionsToken } from "@beep/repo-cli-kit/WholeToken";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

// Collects every chunk the command JSON sink would have written to stdout.
const captureJsonOutput = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const chunks = A.empty<string>();
  return Effect.as(
    effect.pipe(
      Effect.provideService(CommandJsonOutput, (text) =>
        Effect.sync(() => {
          chunks.push(text);
        })
      )
    ),
    chunks
  );
};

const decodeCommandErrorFields = S.decodeEffect(S.Struct(commandErrorFields));

describe("cli/Bytes", () => {
  it("concatenates chunks in order into one buffer", () => {
    const joined = concatBytes([Uint8Array.of(1, 2), new Uint8Array(0), Uint8Array.of(3)]);
    expect(A.fromIterable(joined)).toEqual([1, 2, 3]);
    expect(concatBytes([]).byteLength).toBe(0);
  });

  it("copies a view into a buffer it owns", () => {
    const source = Uint8Array.of(9, 8, 7);
    const copy = asArrayBufferView(source.subarray(1));
    expect(A.fromIterable(copy)).toEqual([8, 7]);
    expect(copy.buffer).toBeInstanceOf(ArrayBuffer);
    expect(copy.buffer).not.toBe(source.buffer);
  });
});

describe("cli/ExitCodeError", () => {
  it.effect("fails with a silent reported exit, data-first and data-last, defaulting the code to 1", () =>
    Effect.gen(function* () {
      const defaulted = yield* Effect.flip(failWithReportedExit("rendered already"));
      expect(defaulted).toBeInstanceOf(CliReportedExit);
      expect(defaulted.message).toBe("rendered already");
      expect(defaulted.exitCode).toBe(1);
      expect(defaulted[Runtime.errorExitCode]).toBe(1);
      expect(defaulted[Runtime.errorReported]).toBe(false);

      const explicit = yield* Effect.flip(failWithReportedExit("blocked", 3));
      expect(explicit[Runtime.errorExitCode]).toBe(3);

      const dataLast = yield* Effect.flip(pipe("piped", failWithReportedExit(4)));
      expect(dataLast.message).toBe("piped");
      expect(dataLast.exitCode).toBe(4);

      const dataLastDefault = yield* Effect.flip(pipe("piped", failWithReportedExit()));
      expect(dataLastDefault.exitCode).toBe(1);
    })
  );
});

describe("cli/CommandErrorFields", () => {
  it("renders the cause message of an Error, a message-bearing record, and anything else", () => {
    expect(messageWithCause("read failed", new Error("ENOENT"))).toBe("read failed: ENOENT");
    expect(messageWithCause("read failed", { message: "boom" })).toBe("read failed: boom");
    expect(messageWithCause("read failed", { message: 7 })).toBe('read failed: {"message":7}');
    expect(messageWithCause("read failed", "plain")).toBe("read failed: plain");
    expect(pipe("piped", messageWithCause(new Error("cause")))).toBe("piped: cause");
  });

  it("defaults a missing exit code to 1", () => {
    expect(resolveCommandExitCode(undefined)).toBe(1);
    expect(resolveCommandExitCode(0)).toBe(0);
    expect(resolveCommandExitCode(2)).toBe(2);
  });

  it.effect("decodes the shared command error fields with optional keys", () =>
    Effect.gen(function* () {
      expect(yield* decodeCommandErrorFields({ message: "m", command: "git", exitCode: 2 })).toEqual({
        message: "m",
        command: "git",
        exitCode: 2,
      });
      expect(yield* decodeCommandErrorFields({ message: "m" })).toEqual({ message: "m" });
    })
  );

  it.effect("prints the prefixed message to stderr and fails with a silent reported exit", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(reportCommandError("beep-cli yeet")({ message: "lane is dirty" }));
      expect(failure).toBeInstanceOf(CliReportedExit);
      expect(failure.message).toBe("beep-cli yeet: lane is dirty");
      expect(failure.exitCode).toBe(1);
      expect(yield* TestConsole.errorLines).toEqual(["beep-cli yeet: lane is dirty"]);
    })
  );
});

describe("cli/EntryPath and cli/LintRouting", () => {
  it("pins the repo CLI entry path", () => {
    expect(REPO_CLI_ENTRY_PATH).toBe("packages/tooling/tool/cli/src/bin.ts");
  });

  it("routes the policy lint subcommands without duplicates", () => {
    expect(A.contains(LINT_POLICY_SUBCOMMANDS, "schema-first")).toBe(true);
    expect(A.contains(LINT_POLICY_SUBCOMMANDS, "jsdoc")).toBe(true);
    expect(A.length(A.dedupe(LINT_POLICY_SUBCOMMANDS))).toBe(A.length(LINT_POLICY_SUBCOMMANDS));
  });
});

describe("cli/OptionRecord", () => {
  it("spreads a present value under its key and nothing for an absent one", () => {
    expect(optionalProp("label", O.some("x"))).toEqual({ label: "x" });
    expect(optionalProp("label", O.none())).toEqual({});
    expect(pipe("count", optionalProp(O.some(0)))).toEqual({ count: 0 });
    expect(pipe("count", optionalProp(O.none<number>()))).toEqual({});
  });
});

describe("cli/PolicyFindingLogger", () => {
  const logger = makePolicyFindingLogger({
    issuePrefix: "::policy::",
    encode: (finding: { readonly file: string; readonly line: number }) => Effect.succeed(finding),
    renderSummary: (finding) => `${finding.file}:${finding.line} violates the law`,
  });

  it.effect("renders one compact JSON line after the issue prefix", () =>
    Effect.gen(function* () {
      expect(yield* logger.render({ file: "a.ts", line: 3 })).toBe('::policy::{"file":"a.ts","line":3}');
    })
  );

  it.effect("logs the summary then the machine line to stderr", () =>
    Effect.gen(function* () {
      yield* logger.log({ file: "b.ts", line: 9 });
      expect(yield* TestConsole.errorLines).toEqual(["b.ts:9 violates the law", '::policy::{"file":"b.ts","line":9}']);
    })
  );

  it.effect("propagates the caller's encode failure", () =>
    Effect.gen(function* () {
      const failing = makePolicyFindingLogger({
        issuePrefix: "",
        encode: (_: string) => Effect.fail("encode refused" as const),
        renderSummary: (finding) => finding,
      });
      expect(yield* Effect.flip(failing.render("x"))).toBe("encode refused");
    })
  );
});

describe("cli/Printer", () => {
  it.effect("prints each line once without the forEach index", () =>
    Effect.gen(function* () {
      yield* printLines(["first", "second"]);
      expect(yield* TestConsole.logLines).toEqual(["first", "second"]);
    })
  );

  it.effect("prints the lines in text mode and only the JSON payload in JSON mode", () =>
    Effect.gen(function* () {
      const textChunks = yield* captureJsonOutput(printJsonOrLines(false, { ok: true }, ["ok"]));
      expect(textChunks).toEqual([]);
      expect(yield* TestConsole.logLines).toEqual(["ok"]);

      const jsonChunks = yield* captureJsonOutput(printJsonOrLines(true, { ok: true }, ["ignored"]));
      expect(jsonChunks).toEqual(['{"ok":true}\n']);
      expect(yield* TestConsole.logLines).toEqual(["ok"]);
    })
  );
});

describe("cli/Json", () => {
  it("pretty-formats a value with a trailing newline", () => {
    expect(formatJsonValue({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });

  it.effect("maps an unencodable payload to CliJsonError without writing", () =>
    Effect.gen(function* () {
      const chunks = A.empty<string>();
      const failure = yield* printCommandJson({ count: 1n }).pipe(
        Effect.provideService(CommandJsonOutput, (text) =>
          Effect.sync(() => {
            chunks.push(text);
          })
        ),
        Effect.flip
      );
      expect(failure).toBeInstanceOf(CliJsonError);
      expect(failure.message).toBe("Failed to encode command JSON output.");
      expect(chunks).toEqual([]);
    })
  );
});

describe("cli/EnvConfig turboSecretSessionStep", () => {
  it("wraps a step without its own env in op run over the sanitized ambient environment", () => {
    const step = QualityTaskStep.make({ label: "docgen", command: "turbo", args: ["run", "docgen"], cwd: "/repo" });
    const wrapped = pipe(step, turboSecretSessionStep({ PATH: "/usr/bin" }));
    expect(wrapped.label).toBe("docgen (op run)");
    expect(wrapped.command).toBe("op");
    expect(wrapped.args).toEqual(["run", "--", "turbo", "run", "docgen"]);
    expect(wrapped.cwd).toBe("/repo");
    expect(wrapped.env).toStrictEqual(turboCacheSecretSessionEnvironment({ PATH: "/usr/bin" }));
  });
});

describe("cli/Progress", () => {
  it("is enabled only when asked and stdout is a TTY", () => {
    const original = process.stdout.isTTY;
    try {
      process.stdout.isTTY = true;
      expect(isProgressEnabled()).toBe(true);
      expect(isProgressEnabled(false)).toBe(false);
      process.stdout.isTTY = false;
      expect(isProgressEnabled()).toBe(false);
    } finally {
      process.stdout.isTTY = original;
    }
  });

  it("renders a bar with the default characters and colorizers", () => {
    expect(renderProgressBar({ fraction: 0.5, width: 4 })).toBe("##--");
    expect(renderProgressBar({ fraction: 2, width: 0 })).toBe("#");
  });
});

describe("PathContainment", () => {
  it.layer(Path.layer)((it) => {
    it.effect("accepts only strict descendants of the root, data-first and data-last", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        expect(isWithinRoot(path, "/repo", "/repo/packages/a")).toBe(true);
        expect(isWithinRoot(path, "/repo", "/repo")).toBe(false);
        expect(isWithinRoot(path, "/repo", "/repo/../etc")).toBe(false);
        expect(isWithinRoot(path, "/repo", "/repository/x")).toBe(false);
        expect(pipe(path, isWithinRoot("/repo", "/repo/docs/x.md"))).toBe(true);
        expect(pipe(path, isWithinRoot("/repo", "/elsewhere"))).toBe(false);
      })
    );
  });
});

describe("WholeToken", () => {
  it("matches a needle only as a whole token", () => {
    const mentionsEffect = mentionsToken("effect");
    expect(mentionsEffect("uses effect here")).toBe(true);
    expect(mentionsEffect("effect")).toBe(true);
    expect(mentionsEffect("(effect)")).toBe(true);
    expect(mentionsEffect("effects")).toBe(false);
    expect(mentionsEffect("side-effect")).toBe(false);
    expect(mentionsEffect("$effect")).toBe(false);
    expect(mentionsEffect("effect_kind")).toBe(false);
  });

  it("escapes regex metacharacters in the needle", () => {
    expect(mentionsToken("a.b")("see a.b now")).toBe(true);
    expect(mentionsToken("a.b")("see axb now")).toBe(false);
  });

  it("matches when any needle appears as a whole token", () => {
    const mentions = mentionsAnyToken(["bun", "node"]);
    expect(mentions("run with node")).toBe(true);
    expect(mentions("bundle nodes")).toBe(false);
    expect(mentionsAnyToken([])("anything")).toBe(false);
  });
});

describe("schema/Uuid", () => {
  const decode = S.decodeUnknownOption(UUID);

  it("trims and accepts an RFC 4122 UUID", () => {
    assertSome(decode(" 123e4567-e89b-12d3-a456-426614174000 "), "123e4567-e89b-12d3-a456-426614174000");
  });

  it("rejects empty and malformed strings", () => {
    assertNone(decode("   "));
    assertNone(decode("not-a-uuid"));
    assertNone(decode(42));
  });
});

describe("stats/NearestRank", () => {
  it("picks the nearest-rank quantile of the sorted values", () => {
    const values = [40, 10, 30, 20];
    assertSome(nearestRank(values, 0.5), 20);
    assertSome(nearestRank(values, 0.95), 40);
    assertSome(nearestRank(values, 0), 10);
    assertSome(nearestRank(values, 1), 40);
    assertSome(pipe(values, nearestRank(0.75)), 30);
  });

  it("is None for an empty sample", () => {
    assertNone(nearestRank([], 0.5));
  });
});

describe("artifacts/ArtifactIo", () => {
  it("renders every item under the limit and an omission line past it", () => {
    const render = (item: number) => `  - ${item}`;
    expect(renderTruncatedLines({ items: [1, 2], render, limit: 5 })).toEqual(["  - 1", "  - 2"]);
    expect(renderTruncatedLines({ items: [1, 2, 3, 4], render, limit: 2 })).toEqual([
      "  - 1",
      "  - 2",
      "  - ... 2 more",
    ]);
    expect(renderTruncatedLines({ items: A.empty<number>(), render, limit: 0 })).toEqual([]);
  });

  it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("writes the body alone when no header is given and maps write failures", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* writeArtifact({ path: "/out/nested/plain.json", body: "{}\n", onError: String });
        expect(yield* fs.readFileString("/out/nested/plain.json")).toBe("{}\n");

        yield* fs.writeFileString("/blocker", "file");
        const failure = yield* Effect.flip(
          writeArtifact({ path: "/blocker/child.json", body: "{}\n", onError: (cause) => ({ mapped: cause }) })
        );
        expect(failure).toHaveProperty("mapped");
      })
    );
  });
});
