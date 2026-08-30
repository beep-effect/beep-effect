import {
  OnePasswordCli,
  OnePasswordCliAccount,
  OnePasswordCliDiagnosticText,
  OnePasswordCliError,
  OnePasswordCliErrorOptions,
  OnePasswordCliExitCode,
  OnePasswordCliProcessResult,
  OnePasswordReferenceProbe,
  OnePasswordReferenceProbeStatus,
} from "@beep/onepassword-cli";
import { NonNegativeInt } from "@beep/schema";
import { OnePasswordReference } from "@beep/shared-domain/values/OnePasswordReference";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Redacted, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ProbeStatusArbitrary = S.toArbitrary(OnePasswordReferenceProbeStatus)(fc);
const ExitCodeArbitrary = S.toArbitrary(OnePasswordCliExitCode)(fc);
const DiagnosticTextArbitrary = S.toArbitrary(OnePasswordCliDiagnosticText)(fc);
const ProcessResultArbitrary = S.toArbitrary(OnePasswordCliProcessResult)(fc);
const AccountArbitrary = S.toArbitrary(OnePasswordCliAccount)(fc);
const ReferenceProbeArbitrary = S.toArbitrary(OnePasswordReferenceProbe)(fc);
const ErrorOptionsArbitrary = S.toArbitrary(OnePasswordCliErrorOptions)(fc).filter((options) =>
  O.isNone(options.cause)
);
const ErrorArbitrary = S.toArbitrary(OnePasswordCliError)(fc).filter((error) => O.isNone(error.cause));

const sameProcessResult = S.toEquivalence(OnePasswordCliProcessResult);
const sameAccount = S.toEquivalence(OnePasswordCliAccount);
const sameReferenceProbe = S.toEquivalence(OnePasswordReferenceProbe);
const sameErrorOptions = S.toEquivalence(OnePasswordCliErrorOptions);
const sameError = S.toEquivalence(OnePasswordCliError);

const successRunner = (_command: string, args: ReadonlyArray<string>) =>
  Effect.succeed(
    OnePasswordCliProcessResult.make({
      exitCode: 0,
      stderr: "",
      stdout: A.contains(args, "whoami") ? "example.1password.com\n" : "discord-token-value",
    })
  );

const missingRunner = (_command: string, _args: ReadonlyArray<string>) =>
  Effect.succeed(
    OnePasswordCliProcessResult.make({
      exitCode: 1,
      stderr: "secret not found",
      stdout: "",
    })
  );

describe("@beep/onepassword-cli", () => {
  it("keeps encoded 1Password CLI wire shapes byte-identical", () => {
    const account = OnePasswordCliAccount.make({
      account: O.some(OnePasswordCliDiagnosticText.decodeUnknownSync("example.1password.com")),
      signedIn: true,
    });
    const signedOutAccount = OnePasswordCliAccount.make({
      signedIn: false,
    });
    const errorOptions = OnePasswordCliErrorOptions.make({
      command: O.some("op"),
      exitCode: O.some(OnePasswordCliExitCode.make(1)),
      stderr: O.some(OnePasswordCliDiagnosticText.decodeUnknownSync(" secret not found\n")),
      stdout: O.some(OnePasswordCliDiagnosticText.decodeUnknownSync("")),
    });
    const error = OnePasswordCliError.make({
      command: O.some("op"),
      exitCode: O.some(OnePasswordCliExitCode.make(1)),
      message: "1Password CLI could not resolve the secret reference.",
      operation: "read",
      stderr: O.some(OnePasswordCliDiagnosticText.decodeUnknownSync("secret not found")),
      stdout: O.some(OnePasswordCliDiagnosticText.decodeUnknownSync("")),
    });
    const processResult = OnePasswordCliProcessResult.make({
      exitCode: OnePasswordCliExitCode.make(0),
      stderr: " raw stderr\n",
      stdout: " raw stdout\n",
    });
    const probe = OnePasswordReferenceProbe.make({
      byteLength: NonNegativeInt.make(19),
      reference: OnePasswordReference.make("op://Private/Discord Bot/token"),
      status: "resolved",
    });

    expect(Result.getOrThrow(S.encodeResult(OnePasswordCliAccount)(account))).toEqual({
      account: "example.1password.com",
      signedIn: true,
    });
    expect(Result.getOrThrow(S.encodeResult(OnePasswordCliAccount)(signedOutAccount))).toEqual({
      signedIn: false,
    });
    expect(Result.getOrThrow(S.encodeResult(OnePasswordCliErrorOptions)(errorOptions))).toEqual({
      command: "op",
      exitCode: 1,
      stderr: "secret not found",
      stdout: "",
    });
    expect(Result.getOrThrow(S.encodeResult(OnePasswordCliError)(error))).toEqual({
      _tag: "OnePasswordCliError",
      command: "op",
      exitCode: 1,
      message: "1Password CLI could not resolve the secret reference.",
      operation: "read",
      stderr: "secret not found",
      stdout: "",
    });
    expect(Result.getOrThrow(S.encodeResult(OnePasswordCliProcessResult)(processResult))).toEqual({
      exitCode: 0,
      stderr: " raw stderr\n",
      stdout: " raw stdout\n",
    });
    expect(Result.getOrThrow(S.encodeResult(OnePasswordReferenceProbe)(probe))).toEqual({
      byteLength: 19,
      reference: "op://Private/Discord Bot/token",
      status: "resolved",
    });
    expect(Result.getOrThrow(S.decodeResult(OnePasswordCliDiagnosticText)(" secret not found\n"))).toBe(
      "secret not found"
    );
  });

  it("round-trips schema-derived 1Password CLI payloads", () =>
    fc.assert(
      fc.property(
        ProbeStatusArbitrary,
        ExitCodeArbitrary,
        DiagnosticTextArbitrary,
        ProcessResultArbitrary,
        AccountArbitrary,
        ReferenceProbeArbitrary,
        ErrorOptionsArbitrary,
        ErrorArbitrary,
        (status, exitCode, diagnosticText, processResult, account, probe, errorOptions, error) => {
          expect(
            Result.getOrThrow(
              S.decodeResult(OnePasswordReferenceProbeStatus)(
                Result.getOrThrow(S.encodeResult(OnePasswordReferenceProbeStatus)(status))
              )
            )
          ).toBe(status);
          expect(
            Result.getOrThrow(
              S.decodeResult(OnePasswordCliExitCode)(
                Result.getOrThrow(S.encodeResult(OnePasswordCliExitCode)(exitCode))
              )
            )
          ).toBe(exitCode);
          expect(
            Result.getOrThrow(
              S.decodeResult(OnePasswordCliDiagnosticText)(
                Result.getOrThrow(S.encodeResult(OnePasswordCliDiagnosticText)(diagnosticText))
              )
            )
          ).toBe(diagnosticText);
          expect(
            sameProcessResult(
              Result.getOrThrow(
                S.decodeResult(OnePasswordCliProcessResult)(
                  Result.getOrThrow(S.encodeResult(OnePasswordCliProcessResult)(processResult))
                )
              ),
              processResult
            )
          ).toBe(true);
          expect(
            sameAccount(
              Result.getOrThrow(
                S.decodeResult(OnePasswordCliAccount)(Result.getOrThrow(S.encodeResult(OnePasswordCliAccount)(account)))
              ),
              account
            )
          ).toBe(true);
          expect(
            sameReferenceProbe(
              Result.getOrThrow(
                S.decodeResult(OnePasswordReferenceProbe)(
                  Result.getOrThrow(S.encodeResult(OnePasswordReferenceProbe)(probe))
                )
              ),
              probe
            )
          ).toBe(true);
          expect(
            sameErrorOptions(
              Result.getOrThrow(
                S.decodeResult(OnePasswordCliErrorOptions)(
                  Result.getOrThrow(S.encodeResult(OnePasswordCliErrorOptions)(errorOptions))
                )
              ),
              errorOptions
            )
          ).toBe(true);
          expect(
            sameError(
              Result.getOrThrow(
                S.decodeResult(OnePasswordCliError)(Result.getOrThrow(S.encodeResult(OnePasswordCliError)(error)))
              ),
              error
            )
          ).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  layer(OnePasswordCli.makeLayerFromRunner(successRunner))((it) => {
    it.effect(
      "probes signed-in state and reference metadata without exposing the secret",
      Effect.fnUntraced(function* () {
        const onePassword = yield* OnePasswordCli;

        const account = yield* onePassword.whoami;
        const value = yield* onePassword.read("op://Private/Discord Bot/token");
        const probe = yield* onePassword.probeReference("op://Private/Discord Bot/token");

        expect(account.signedIn).toBe(true);
        expect(O.getOrThrow(account.account)).toBe("example.1password.com");
        expect(Redacted.value(value)).toBe("discord-token-value");
        expect(probe.byteLength).toBe("discord-token-value".length);
        expect(probe.reference).toBe("op://Private/Discord Bot/token");
        expect(probe.status).toBe("resolved");
      })
    );
  });

  layer(OnePasswordCli.makeLayerFromRunner(missingRunner))((it) => {
    it.effect(
      "returns typed driver errors for unresolved references",
      Effect.fnUntraced(function* () {
        const onePassword = yield* OnePasswordCli;
        const result = yield* onePassword.probeReference("op://Private/Missing/token").pipe(Effect.flip);

        expect(result).toBeInstanceOf(OnePasswordCliError);
        expect(result.operation).toBe("read");
        expect(O.getOrThrow(result.stderr)).toBe("secret not found");
      })
    );
  });
});
