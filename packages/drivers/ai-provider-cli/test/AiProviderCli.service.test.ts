import {
  AiProviderCli,
  AiProviderCliAuthProbe,
  AiProviderCliAuthStatus,
  AiProviderCliError,
  AiProviderCliExitCode,
  AiProviderCliProcessResult,
  AiProviderCliProvider,
} from "@beep/ai-provider-cli";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ProviderArbitrary = S.toArbitrary(AiProviderCliProvider);
const AuthStatusArbitrary = S.toArbitrary(AiProviderCliAuthStatus);
const ExitCodeArbitrary = S.toArbitrary(AiProviderCliExitCode);
const ProcessResultArbitrary = S.toArbitrary(AiProviderCliProcessResult);
const AuthProbeArbitrary = S.toArbitrary(AiProviderCliAuthProbe);
const ErrorArbitrary = S.toArbitrary(AiProviderCliError);

const sameProcessResult = S.toEquivalence(AiProviderCliProcessResult);
const sameAuthProbe = S.toEquivalence(AiProviderCliAuthProbe);
const sameError = S.toEquivalence(AiProviderCliError);

const runner = (provider: AiProviderCliProvider, _command: string, args: ReadonlyArray<string>) =>
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

    expect(Result.getOrThrow(S.encodeResult(AiProviderCliError)(fullError))).toEqual({
      _tag: "AiProviderCliError",
      command: "claude",
      exitCode: 127,
      message: "Failed",
      operation: "checkAuth",
      provider: "claude",
      stderr: "err",
      stdout: "out",
    });
    expect(Result.getOrThrow(S.encodeResult(AiProviderCliError)(minimalError))).toEqual({
      _tag: "AiProviderCliError",
      message: "Failed",
      operation: "checkAuth",
      provider: "codex",
    });
    expect(Result.getOrThrow(S.encodeResult(AiProviderCliProcessResult)(processResult))).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "ok",
    });
    expect(Result.getOrThrow(S.encodeResult(AiProviderCliAuthProbe)(authProbe))).toEqual({
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
              S.decodeUnknownResult(AiProviderCliProvider)(
                Result.getOrThrow(S.encodeResult(AiProviderCliProvider)(provider))
              )
            )
          ).toBe(provider);
          expect(
            Result.getOrThrow(
              S.decodeUnknownResult(AiProviderCliAuthStatus)(
                Result.getOrThrow(S.encodeResult(AiProviderCliAuthStatus)(status))
              )
            )
          ).toBe(status);
          expect(
            Result.getOrThrow(
              S.decodeUnknownResult(AiProviderCliExitCode)(
                Result.getOrThrow(S.encodeResult(AiProviderCliExitCode)(exitCode))
              )
            )
          ).toBe(exitCode);
          expect(
            sameProcessResult(
              Result.getOrThrow(
                S.decodeUnknownResult(AiProviderCliProcessResult)(
                  Result.getOrThrow(S.encodeResult(AiProviderCliProcessResult)(processResult))
                )
              ),
              processResult
            )
          ).toBe(true);
          expect(
            sameAuthProbe(
              Result.getOrThrow(
                S.decodeUnknownResult(AiProviderCliAuthProbe)(
                  Result.getOrThrow(S.encodeResult(AiProviderCliAuthProbe)(authProbe))
                )
              ),
              authProbe
            )
          ).toBe(true);
          expect(
            sameError(
              Result.getOrThrow(
                S.decodeUnknownResult(AiProviderCliError)(Result.getOrThrow(S.encodeResult(AiProviderCliError)(error)))
              ),
              error
            )
          ).toBe(true);
        }
      ),
      { numRuns: 50 }
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
