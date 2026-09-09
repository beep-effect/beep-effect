import {
  AiProviderCli,
  AiProviderCliAuthProbe,
  AiProviderCliAuthStatus,
  AiProviderCliError,
  AiProviderCliExitCode,
  AiProviderCliProcessResult,
  AiProviderCliProvider,
} from "@beep/ai-provider-cli";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { AiProviderCliRunner } from "@beep/ai-provider-cli";

const decodeAiProviderCliAuthProbeResult = S.decodeResult(AiProviderCliAuthProbe);
const decodeAiProviderCliAuthStatusResult = S.decodeResult(AiProviderCliAuthStatus);
const decodeAiProviderCliErrorResult = S.decodeResult(AiProviderCliError);
const decodeAiProviderCliExitCodeResult = S.decodeResult(AiProviderCliExitCode);
const decodeAiProviderCliProcessResultResult = S.decodeResult(AiProviderCliProcessResult);
const decodeAiProviderCliProviderResult = S.decodeResult(AiProviderCliProvider);
const encodeAiProviderCliAuthProbeResult = S.encodeResult(AiProviderCliAuthProbe);
const encodeAiProviderCliAuthStatusResult = S.encodeResult(AiProviderCliAuthStatus);
const encodeAiProviderCliErrorResult = S.encodeResult(AiProviderCliError);
const encodeAiProviderCliExitCodeResult = S.encodeResult(AiProviderCliExitCode);
const encodeAiProviderCliProcessResultResult = S.encodeResult(AiProviderCliProcessResult);
const encodeAiProviderCliProviderResult = S.encodeResult(AiProviderCliProvider);

const ProviderArbitrary = S.toArbitrary(AiProviderCliProvider)(fc);
const AuthStatusArbitrary = S.toArbitrary(AiProviderCliAuthStatus)(fc);
const ExitCodeArbitrary = S.toArbitrary(AiProviderCliExitCode)(fc);
const ProcessResultArbitrary = S.toArbitrary(AiProviderCliProcessResult)(fc);
const AuthProbeArbitrary = S.toArbitrary(AiProviderCliAuthProbe)(fc);
const ErrorArbitrary = S.toArbitrary(AiProviderCliError)(fc);

const sameProcessResult = S.toEquivalence(AiProviderCliProcessResult);
const sameAuthProbe = S.toEquivalence(AiProviderCliAuthProbe);
const sameError = S.toEquivalence(AiProviderCliError);

const runner: AiProviderCliRunner = ({ args, provider }) =>
  Effect.succeed(
    AiProviderCliProcessResult.make({
      exitCode: provider === "claude" ? 0 : 1,
      stderr: provider === "claude" ? "" : "not logged in",
      stdout: A.join(args, " "),
    })
  );

describe("@beep/ai-provider-cli", () => {
  it("keeps encoded provider CLI wire shapes byte-identical", () => {
    const fullError = AiProviderCliError.make({
      command: O.some("claude"),
      exitCode: O.some(127),
      message: "Failed",
      operation: "checkAuth",
      provider: "claude",
      stderr: O.some("err"),
      stdout: O.some("out"),
    });
    const minimalError = AiProviderCliError.make({
      message: "Failed",
      operation: "checkAuth",
      provider: "codex",
    });
    const processResult = AiProviderCliProcessResult.make({
      exitCode: 0,
      stderr: "",
      stdout: "ok",
    });
    const authProbe = AiProviderCliAuthProbe.make({
      command: "claude",
      provider: "claude",
      status: "authenticated",
    });

    expect(Result.getOrThrow(encodeAiProviderCliErrorResult(fullError))).toEqual({
      _tag: "AiProviderCliError",
      command: "claude",
      exitCode: 127,
      message: "Failed",
      operation: "checkAuth",
      provider: "claude",
      stderr: "err",
      stdout: "out",
    });
    expect(Result.getOrThrow(encodeAiProviderCliErrorResult(minimalError))).toEqual({
      _tag: "AiProviderCliError",
      message: "Failed",
      operation: "checkAuth",
      provider: "codex",
    });
    expect(Result.getOrThrow(encodeAiProviderCliProcessResultResult(processResult))).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "ok",
    });
    expect(Result.getOrThrow(encodeAiProviderCliAuthProbeResult(authProbe))).toEqual({
      command: "claude",
      provider: "claude",
      status: "authenticated",
    });
  });

  it("round-trips schema-derived provider CLI payloads", () =>
    fc.assert(
      fc.property(
        ProviderArbitrary,
        AuthStatusArbitrary,
        ExitCodeArbitrary,
        ProcessResultArbitrary,
        AuthProbeArbitrary,
        ErrorArbitrary,
        (provider, status, exitCode, processResult, authProbe, error) => {
          expect(
            Result.getOrThrow(
              decodeAiProviderCliProviderResult(Result.getOrThrow(encodeAiProviderCliProviderResult(provider)))
            )
          ).toBe(provider);
          expect(
            Result.getOrThrow(
              decodeAiProviderCliAuthStatusResult(Result.getOrThrow(encodeAiProviderCliAuthStatusResult(status)))
            )
          ).toBe(status);
          expect(
            Result.getOrThrow(
              decodeAiProviderCliExitCodeResult(Result.getOrThrow(encodeAiProviderCliExitCodeResult(exitCode)))
            )
          ).toBe(exitCode);
          expect(
            sameProcessResult(
              Result.getOrThrow(
                decodeAiProviderCliProcessResultResult(
                  Result.getOrThrow(encodeAiProviderCliProcessResultResult(processResult))
                )
              ),
              processResult
            )
          ).toBe(true);
          expect(
            sameAuthProbe(
              Result.getOrThrow(
                decodeAiProviderCliAuthProbeResult(Result.getOrThrow(encodeAiProviderCliAuthProbeResult(authProbe)))
              ),
              authProbe
            )
          ).toBe(true);
          expect(
            sameError(
              Result.getOrThrow(
                decodeAiProviderCliErrorResult(Result.getOrThrow(encodeAiProviderCliErrorResult(error)))
              ),
              error
            )
          ).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  layer(AiProviderCli.makeLayerFromRunner(runner))((it) => {
    it.effect(
      "maps Claude and Codex CLI exit codes to sanitized auth probes",
      Effect.fnUntraced(function* () {
        const providerCli = yield* AiProviderCli;

        const claude = yield* providerCli.checkAuth("claude");
        const codex = yield* providerCli.checkAuth("codex");

        expect(claude.command).toBe("claude");
        expect(claude.status).toBe("authenticated");
        expect(codex.command).toBe("codex");
        expect(codex.status).toBe("not-authenticated");
      })
    );
  });
});
