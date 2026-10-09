import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ChildProcess } from "effect/process";
import { ExecContext, LocalExec, LocalExecError } from "../../effected/commands/LocalExec.ts";
import { NpmExecutor } from "../../effected/npm/NpmExecutor.ts";

const cause = LocalExecError.make({ directory: "/project" });
it.layer(LocalExec.layerTest({ context: Effect.fail(cause) }), { timeout: "30 seconds" })((it) => {
it.effect("context detection failures become executor failures with their cause", () => Effect.gen(function* () {
  const error = yield* Effect.flip(NpmExecutor.dlx("npm@11").command(["--version"]));
  assert.strictEqual(error.kind, "executor");
  assert.strictEqual(error.cause, cause);
}));
});

class PipedContext extends ExecContext.extend<PipedContext>("PipedContext")({}) {
  override applyDlx(command: ChildProcess.StandardCommand): ChildProcess.Command {
    return ChildProcess.pipeTo(command, ChildProcess.make("cat"));
  }
}
const context = PipedContext.make({ label: "pipeline", prefix: [], dlxPrefix: [], scriptPrefix: [] });
it.layer(LocalExec.layerContext(context), { timeout: "30 seconds" })((it) => {
it.effect("a launcher returning a pipeline is rejected as an executor failure", () => Effect.gen(function* () {
  const error = yield* Effect.flip(NpmExecutor.dlx("npm@11").command([]));
  assert.strictEqual(error.kind, "executor");
}));

});
