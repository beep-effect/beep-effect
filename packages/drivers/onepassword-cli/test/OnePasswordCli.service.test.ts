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
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeOnePasswordCliAccountResult = S.decodeResult(OnePasswordCliAccount);
const decodeOnePasswordCliDiagnosticTextResult = S.decodeResult(OnePasswordCliDiagnosticText);
const decodeOnePasswordCliErrorResult = S.decodeResult(OnePasswordCliError);
const decodeOnePasswordCliErrorOptionsResult = S.decodeResult(OnePasswordCliErrorOptions);
const decodeOnePasswordCliExitCodeResult = S.decodeResult(OnePasswordCliExitCode);
const decodeOnePasswordCliProcessResultResult = S.decodeResult(OnePasswordCliProcessResult);
const decodeOnePasswordReferenceProbeResult = S.decodeResult(OnePasswordReferenceProbe);
const decodeOnePasswordReferenceProbeStatusResult = S.decodeResult(OnePasswordReferenceProbeStatus);
const encodeOnePasswordCliAccountResult = S.encodeResult(OnePasswordCliAccount);
const encodeOnePasswordCliDiagnosticTextResult = S.encodeResult(OnePasswordCliDiagnosticText);
const encodeOnePasswordCliErrorResult = S.encodeResult(OnePasswordCliError);
const encodeOnePasswordCliErrorOptionsResult = S.encodeResult(OnePasswordCliErrorOptions);
const encodeOnePasswordCliExitCodeResult = S.encodeResult(OnePasswordCliExitCode);
const encodeOnePasswordCliProcessResultResult = S.encodeResult(OnePasswordCliProcessResult);
const encodeOnePasswordReferenceProbeResult = S.encodeResult(OnePasswordReferenceProbe);
const encodeOnePasswordReferenceProbeStatusResult = S.encodeResult(OnePasswordReferenceProbeStatus);

const ProbeStatusArbitrary = Arbitrary.schema(OnePasswordReferenceProbeStatus);
const ExitCodeArbitrary = Arbitrary.schema(OnePasswordCliExitCode);
const DiagnosticTextArbitrary = Arbitrary.schema(OnePasswordCliDiagnosticText);
const ProcessResultArbitrary = Arbitrary.schema(OnePasswordCliProcessResult);
const AccountArbitrary = Arbitrary.schema(OnePasswordCliAccount);
const ReferenceProbeArbitrary = Arbitrary.schema(OnePasswordReferenceProbe);
const ErrorOptionsArbitrary = Arbitrary.schema(OnePasswordCliErrorOptions).pipe(
  Arbitrary.filter((options) => O.isNone(options.cause))
);
const ErrorArbitrary = Arbitrary.schema(OnePasswordCliError).pipe(Arbitrary.filter((error) => O.isNone(error.cause)));

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

    expect(Result.getOrThrow(encodeOnePasswordCliAccountResult(account))).toEqual({
      account: "example.1password.com",
      signedIn: true,
    });
    expect(Result.getOrThrow(encodeOnePasswordCliAccountResult(signedOutAccount))).toEqual({
      signedIn: false,
    });
    expect(Result.getOrThrow(encodeOnePasswordCliErrorOptionsResult(errorOptions))).toEqual({
      command: "op",
      exitCode: 1,
      stderr: "secret not found",
      stdout: "",
    });
    expect(Result.getOrThrow(encodeOnePasswordCliErrorResult(error))).toEqual({
      _tag: "OnePasswordCliError",
      command: "op",
      exitCode: 1,
      message: "1Password CLI could not resolve the secret reference.",
      operation: "read",
      stderr: "secret not found",
      stdout: "",
    });
    expect(Result.getOrThrow(encodeOnePasswordCliProcessResultResult(processResult))).toEqual({
      exitCode: 0,
      stderr: " raw stderr\n",
      stdout: " raw stdout\n",
    });
    expect(Result.getOrThrow(encodeOnePasswordReferenceProbeResult(probe))).toEqual({
      byteLength: 19,
      reference: "op://Private/Discord Bot/token",
      status: "resolved",
    });
    expect(Result.getOrThrow(decodeOnePasswordCliDiagnosticTextResult(" secret not found\n"))).toBe("secret not found");
  });

  it.prop(
    "round-trips schema-derived 1Password CLI payloads",
    [
      ProbeStatusArbitrary,
      ExitCodeArbitrary,
      DiagnosticTextArbitrary,
      ProcessResultArbitrary,
      AccountArbitrary,
      ReferenceProbeArbitrary,
      ErrorOptionsArbitrary,
      ErrorArbitrary,
    ],
    ([status, exitCode, diagnosticText, processResult, account, probe, errorOptions, error]) => {
      expect(
        Result.getOrThrow(
          decodeOnePasswordReferenceProbeStatusResult(
            Result.getOrThrow(encodeOnePasswordReferenceProbeStatusResult(status))
          )
        )
      ).toBe(status);
      expect(
        Result.getOrThrow(
          decodeOnePasswordCliExitCodeResult(Result.getOrThrow(encodeOnePasswordCliExitCodeResult(exitCode)))
        )
      ).toBe(exitCode);
      expect(
        Result.getOrThrow(
          decodeOnePasswordCliDiagnosticTextResult(
            Result.getOrThrow(encodeOnePasswordCliDiagnosticTextResult(diagnosticText))
          )
        )
      ).toBe(diagnosticText);
      expect(
        sameProcessResult(
          Result.getOrThrow(
            decodeOnePasswordCliProcessResultResult(
              Result.getOrThrow(encodeOnePasswordCliProcessResultResult(processResult))
            )
          ),
          processResult
        )
      ).toBe(true);
      expect(
        sameAccount(
          Result.getOrThrow(
            decodeOnePasswordCliAccountResult(Result.getOrThrow(encodeOnePasswordCliAccountResult(account)))
          ),
          account
        )
      ).toBe(true);
      expect(
        sameReferenceProbe(
          Result.getOrThrow(
            decodeOnePasswordReferenceProbeResult(Result.getOrThrow(encodeOnePasswordReferenceProbeResult(probe)))
          ),
          probe
        )
      ).toBe(true);
      expect(
        sameErrorOptions(
          Result.getOrThrow(
            decodeOnePasswordCliErrorOptionsResult(
              Result.getOrThrow(encodeOnePasswordCliErrorOptionsResult(errorOptions))
            )
          ),
          errorOptions
        )
      ).toBe(true);
      expect(
        sameError(
          Result.getOrThrow(decodeOnePasswordCliErrorResult(Result.getOrThrow(encodeOnePasswordCliErrorResult(error)))),
          error
        )
      ).toBe(true);
    },
    { arbitrary: fcRuns(50) }
  );

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
