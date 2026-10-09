// A real CLI, run by CliStdin.test.ts in a child process with real piped stdin and the real NodeTerminal: a flag
// that falls back to a prompt, and a handler that waits before it reads stdin. The wait is the point: a prompt
// runner that attached to stdin in the meantime would have eaten the piped bytes.
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Stdio, Stream } from "effect";
import { Command, Flag, Prompt } from "effect/cli";
import { CliPrompt, CliRuntime } from "../../src/index.js";

const profile = Flag.String("profile").pipe(
	Flag.withFallbackPrompt(
		CliPrompt.fallback(Prompt.Select({ message: "Profile", choices: [{ title: "x", value: "x" }] }), {
			flag: "profile",
			otherwise: "x",
		}),
	),
);

const read = Command.make("read", { profile }, () =>
	Effect.gen(function* () {
		yield* Effect.sleep("30 millis");
		const stdio = yield* Stdio.Stdio;
		const bytes = yield* Stream.runFold(stdio.stdin, () => 0, (total, chunk) => total + chunk.length);
		yield* Console.log(`bytes=${bytes}`);
	}),
);

const root = Command.make("tool").pipe(Command.withSubcommands([read]));

NodeRuntime.runMain(
	CliRuntime.main(Command.runWith(root, { version: "1.0.0" })(process.argv.slice(2)), {
		platform: NodeServices.layer,
		env: {},
	}),
);
