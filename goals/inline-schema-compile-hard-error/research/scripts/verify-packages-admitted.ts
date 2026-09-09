/**
 * Admit the packet's sequential package-verification matrix through the
 * machine-wide quality scheduler.
 *
 * Run from the repository root. Pass `--resume` only when the owned-tree
 * fingerprint has not changed since the previous checkpoint.
 */
import {
  AdmissionRequest,
  admissionTokenWeight,
  MemoryStatsLive,
  noAdmissionOriginGate,
  withQualityAdmission,
} from "@beep/repo-cli/test/RepoRun";
import { proofCoordinatorLockPath } from "@beep/repo-cli/test/Yeet";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Data, Effect, Layer, Path } from "effect";
import * as A from "effect/Array";

class PackageVerificationProcessError extends Data.TaggedError("PackageVerificationProcessError")<{
  readonly reason: "exit" | "git" | "spawn";
  readonly message: string;
  readonly exitCode?: number;
}> {}

const repoRoot = process.cwd();
const matrixScript = "goals/inline-schema-compile-hard-error/research/scripts/verify-packages.ts";
const resumeArgs = process.argv.includes("--resume") ? ["--resume"] : [];
const matrixCommand = ["bun", matrixScript, ...resumeArgs];

const gitOutput = (args: ReadonlyArray<string>): string => {
  const child = Bun.spawnSync(["git", ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  if (child.exitCode !== 0) {
    throw new PackageVerificationProcessError({
      reason: "git",
      message: `git ${A.join(args, " ")} failed while preparing package verification admission.`,
      exitCode: child.exitCode,
    });
  }
  return child.stdout.toString().trim();
};

const runMatrix = Effect.acquireUseRelease(
  Effect.try({
    try: () => Bun.spawn(matrixCommand, { cwd: repoRoot, stdout: "inherit", stderr: "inherit" }),
    catch: () =>
      new PackageVerificationProcessError({
        reason: "spawn",
        message: "Failed to start the admitted package-verification matrix.",
      }),
  }),
  (child) =>
    Effect.tryPromise({
      try: () => child.exited,
      catch: () =>
        new PackageVerificationProcessError({
          reason: "exit",
          message: "Failed while waiting for the package-verification matrix.",
        }),
    }).pipe(
      Effect.flatMap((exitCode) =>
        exitCode === 0
          ? Effect.void
          : Effect.fail(
              new PackageVerificationProcessError({
                reason: "exit",
                message: "The package-verification matrix reported a failed package.",
                exitCode,
              })
            )
      )
    ),
  (child) =>
    Effect.sync(() => {
      if (child.exitCode === null) child.kill();
    })
);

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const branch = gitOutput(["branch", "--show-current"]);
  const repositoryIdentity = gitOutput(["config", "--get", "remote.origin.url"]);
  const lockPath = yield* proofCoordinatorLockPath(repositoryIdentity);
  const request = AdmissionRequest.make({
    kind: "full-proof",
    weightTokens: admissionTokenWeight("full-proof"),
    priority: "verify",
    originKey: path.basename(lockPath, ".lock"),
    checkoutRoot: repoRoot,
    branch,
    command: A.join(matrixCommand, " "),
  });

  yield* withQualityAdmission(request, noAdmissionOriginGate, runMatrix);
});

const MainLayer = MemoryStatsLive.pipe(Layer.provideMerge(NodeServices.layer));

NodeRuntime.runMain(program.pipe(Effect.provide(MainLayer)));
