// @effect-diagnostics asyncFunction:skip-file globalTimers:skip-file newPromise:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import type { ProcessGuardHost, ProcessGuardOptions } from "../../effected/engine/guard.ts";
import { ProcessGuard } from "../../effected/engine/guard.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

// Compile-time: Node's own `process` satisfies the guard's structural host.
export const nodeFits = (): ProcessGuardOptions => ({
	label: "types",
	host: process,
	load: async () => undefined,
});

class ExitCalled extends S.TaggedError<ExitCalled>()("ExitCalled", {
	code: S.UndefinedOr(S.Finite),
}) {
	override readonly name = "Error";
	override get message() {
		return `exit(${this.code})`;
	}
}

/** A host double: listeners are called by the test, exit throws so nothing after it runs. */
const fakeHost = () => {
	const listeners: {
		uncaughtException?: (error: Error, origin: string) => void;
		unhandledRejection?: (reason: unknown) => void;
	} = {};
	const stderr: Array<string> = [];
	const exits: Array<number | undefined> = [];
	const host: ProcessGuardHost = {
		on: (...[event, listener]:
			| [event: "uncaughtException", listener: (error: Error, origin: string) => void]
			| [event: "unhandledRejection", listener: (reason: unknown) => void]) => {
			if (event === "uncaughtException") listeners.uncaughtException = listener;
			else listeners.unhandledRejection = listener;
		},
		emit: (...[event, value, detail]:
			| [event: "uncaughtException", error: Error, origin: "uncaughtException" | "unhandledRejection"]
			| [event: "unhandledRejection", reason: unknown, promise: Promise<unknown>]) => {
			if (event === "uncaughtException") listeners.uncaughtException?.(value, detail);
			else listeners.unhandledRejection?.(value);
		},
		stderr: { write: (chunk: string) => stderr.push(chunk) },
		exit: (code?: number): never => {
			exits.push(code);
			throw ExitCalled.make({ code });
		},
	};
	const fire = (...[event, value]:
		| [event: "uncaughtException", value: Error]
		| [event: "unhandledRejection", value: unknown]) => {
		try {
			if (event === "uncaughtException") listeners.uncaughtException?.(value, "uncaughtException");
			else listeners.unhandledRejection?.(value);
		} catch (error) {
			if (!S.is(ExitCalled)(error)) throw error;
		}
	};
	return { host, stderr, exits, fire, listeners };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** Run the guard, mapping a double's `exit` throw to `"exited"`. */
const runGuard = (options: ProcessGuardOptions) =>
	ProcessGuard.run(options).then(
		() => "resolved" as const,
		(error: unknown) => (S.is(ExitCalled)(error) ? ("exited" as const) : Promise.reject(error)),
	);

describe("ProcessGuard.parseInjectCrash", () => {
	it("parses every <at>:<kind> pair", () => {
		for (const at of ["load", "connected"] as const)
			for (const kind of ["uncaughtException", "unhandledRejection"] as const)
				assert.deepStrictEqual(ProcessGuard.parseInjectCrash(`${at}:${kind}`), { at, kind });
	});

	it("is undefined for no value and for anything outside the grammar", () => {
		for (const value of [
			undefined,
			"",
			"load",
			"load:",
			":uncaughtException",
			"later:uncaughtException",
			"load:boom",
			"load:uncaughtException:x",
			"LOAD:uncaughtException",
		])
			assert.isUndefined(ProcessGuard.parseInjectCrash(value), String(value));
	});
});

describe("ProcessGuard.run", () => {
	it("installs both listeners before load runs", async () => {
		const { host, listeners } = fakeHost();
		let seen: ReadonlyArray<string> = [];
		await ProcessGuard.run({
			label: "t",
			host,
			load: async () => {
				seen = Object.keys(listeners);
			},
		});
		assert.sameMembers([...seen], ["uncaughtException", "unhandledRejection"]);
	});

	it("launches nothing itself: resolves once load resolves, with load handed the control", async () => {
		const { host } = fakeHost();
		const order: Array<string> = [];
		await ProcessGuard.run({
			label: "t",
			host,
			load: async (guard) => {
				order.push(typeof guard.markConnected, typeof guard.useFormat);
			},
		});
		order.push("resolved");
		assert.deepStrictEqual(order, ["function", "function", "resolved"]);
	});

	it("default policy: both exit 1, after connect too, and report on stderr", async () => {
		const { host, stderr, exits, fire } = fakeHost();
		await ProcessGuard.run({ label: "srv", host, load: async (guard) => guard.markConnected() });
		fire("uncaughtException", new Error("boom"));
		fire("unhandledRejection", new Error("nope"));
		assert.deepStrictEqual(exits, [1, 1]);
		assert.match(stderr[0] ?? "", /^srv: uncaughtException \(uncaughtException\): Error: boom/);
		assert.match(stderr[1] ?? "", /^srv: unhandledRejection: Error: nope/);
	});

	it("exitBeforeConnect: exits until markConnected, then logs and keeps going", async () => {
		const { host, stderr, exits, fire } = fakeHost();
		let markConnected = (): void => undefined;
		await ProcessGuard.run({
			label: "srv",
			host,
			policy: { onUncaught: "exitBeforeConnect", onRejection: "exitBeforeConnect" },
			load: async (guard) => {
				markConnected = guard.markConnected;
			},
		});
		fire("uncaughtException", new Error("before"));
		assert.deepStrictEqual(exits, [1], "load resolving alone is not connected");
		markConnected();
		fire("uncaughtException", new Error("late"));
		fire("unhandledRejection", new Error("late rejection"));
		assert.deepStrictEqual(exits, [1], "no exit once connected");
		assert.strictEqual(stderr.length, 3);
	});

	it("a non-Effect caller marks connected from its own callback, after load has resolved", async () => {
		// The shape an LSP over vscode-languageserver uses: start listening, report connected from the listener.
		const { host, exits, fire } = fakeHost();
		const listening: Array<() => void> = [];
		const server = { listen: (onListening: () => void) => listening.push(onListening) };
		await ProcessGuard.run({
			label: "lsp",
			host,
			policy: { onUncaught: "exitBeforeConnect" },
			load: async (guard) => {
				server.listen(guard.markConnected);
			},
		});
		fire("uncaughtException", new Error("while starting"));
		assert.deepStrictEqual(exits, [1]);
		for (const callback of listening) callback();
		fire("uncaughtException", new Error("while serving"));
		assert.deepStrictEqual(exits, [1]);
	});

	it("onRejection log never exits", async () => {
		const { host, exits, fire } = fakeHost();
		await ProcessGuard.run({
			label: "srv",
			host,
			policy: { onUncaught: "exit", onRejection: "log" },
			load: async () => undefined,
		});
		fire("unhandledRejection", "a string reason");
		assert.deepStrictEqual(exits, []);
	});

	it("a load rejection is reported as startup failed and exits 1, whatever the policy", async () => {
		const { host, stderr, exits } = fakeHost();
		const outcome = await runGuard({
			label: "srv",
			host,
			policy: { onUncaught: "exitBeforeConnect", onRejection: "log" },
			load: async (guard) => {
				guard.markConnected();
				throw new Error("cannot load");
			},
		});
		assert.strictEqual(outcome, "exited");
		assert.deepStrictEqual(exits, [1]);
		assert.match(stderr[0] ?? "", /^srv: startup failed: Error: cannot load/);
	});

	it("uses the caller's formatter once set, and falls back if it throws", async () => {
		const { host, stderr, fire } = fakeHost();
		let throwing = false;
		await ProcessGuard.run({
			label: "srv",
			host,
			policy: { onUncaught: "exit", onRejection: "log" },
			load: async (guard) => {
				guard.useFormat((error) => {
					if (throwing) throw new Error("formatter broke");
					return `fmt:${String(error)}`;
				});
			},
		});
		fire("unhandledRejection", "x");
		throwing = true;
		fire("unhandledRejection", "y");
		assert.deepStrictEqual(stderr, ["srv: unhandledRejection: fmt:x\n", "srv: unhandledRejection: y\n"]);
	});

	it("a startup failure after useFormat is described by that formatter", async () => {
		const { host, stderr } = fakeHost();
		await runGuard({
			label: "srv",
			host,
			load: async (guard) => {
				guard.useFormat((error) => `fmt:${error instanceof Error ? error.message : String(error)}`);
				throw new Error("late");
			},
		});
		assert.deepStrictEqual(stderr, ["srv: startup failed: fmt:late\n"]);
	});

	it("an injectCrash with an unknown kind or phase raises nothing and still loads", async () => {
		const { host, exits, stderr } = fakeHost();
		let loads = 0;
		for (const injectCrash of deliberatelyInvalid<ReadonlyArray<ProcessGuardOptions["injectCrash"]>>([
			{ at: "load", kind: "bogus" },
			{ at: "later", kind: "uncaughtException" },
		])) {
			await ProcessGuard.run({
				label: "srv",
				host,
				injectCrash,
				load: async (guard) => {
					loads += 1;
					guard.markConnected();
				},
			});
		}
		await settle();
		assert.strictEqual(loads, 2);
		assert.deepStrictEqual(exits, []);
		assert.deepStrictEqual(stderr, []);
	});

	const injected = [
		{ kind: "uncaughtException", policy: { onUncaught: "exit" } },
		{ kind: "uncaughtException", policy: { onUncaught: "exitBeforeConnect" } },
		{ kind: "unhandledRejection", policy: { onUncaught: "exit", onRejection: "exit" } },
		{ kind: "unhandledRejection", policy: { onUncaught: "exit", onRejection: "exitBeforeConnect" } },
		{ kind: "unhandledRejection", policy: { onUncaught: "exit", onRejection: "log" } },
	] as const;
	for (const { kind, policy } of injected) {
		const mode = kind === "uncaughtException" ? policy.onUncaught : "onRejection" in policy ? policy.onRejection : undefined;
		const exitsAtLoad = mode !== "log";
		const exitsConnected = mode === "exit";

		it(`injectCrash at load, ${kind} under ${mode}: ${exitsAtLoad ? "exits 1 and never loads" : "logs, then loads"}`, async () => {
			const { host, stderr, exits } = fakeHost();
			const order: Array<string> = [];
			const outcome = await runGuard({
				label: "srv",
				host,
				policy,
				injectCrash: { at: "load", kind },
				load: async () => {
					order.push("load");
				},
			});
			assert.strictEqual(outcome, exitsAtLoad ? "exited" : "resolved");
			assert.deepStrictEqual(exits, exitsAtLoad ? [1] : []);
			assert.deepStrictEqual(order, exitsAtLoad ? [] : ["load"]);
			assert.strictEqual(stderr.length, 1);
			assert.include(stderr[0] ?? "", `srv: ${kind}`);
			assert.include(stderr[0] ?? "", `Error: [injected] ${kind}`);
		});

		it(`injectCrash at connected, ${kind} under ${mode}: ${exitsConnected ? "exits 1" : "logs and keeps serving"}`, async () => {
			const { host, stderr, exits } = fakeHost();
			await ProcessGuard.run({
				label: "srv",
				host,
				policy,
				injectCrash: { at: "connected", kind },
				load: async (guard) => guard.markConnected(),
			});
			// Asynchronous: nothing is reported on the tick markConnected ran on.
			assert.deepStrictEqual(stderr, []);
			while (stderr.length === 0) await settle();
			assert.deepStrictEqual(exits, exitsConnected ? [1] : []);
			assert.strictEqual(stderr.length, 1);
			assert.include(stderr[0] ?? "", `srv: ${kind}`);
		});
	}

	it("injectCrash at connected is raised once however often markConnected is called", async () => {
		const { host, stderr } = fakeHost();
		await ProcessGuard.run({
			label: "srv",
			host,
			policy: { onUncaught: "exitBeforeConnect" },
			injectCrash: { at: "connected", kind: "uncaughtException" },
			load: async (guard) => {
				guard.markConnected();
				guard.markConnected();
			},
		});
		await settle();
		assert.strictEqual(stderr.length, 1);
	});

	it("injectCrash at connected is never raised when markConnected is never called (negative control)", async () => {
		const { host, stderr, exits } = fakeHost();
		await ProcessGuard.run({
			label: "srv",
			host,
			injectCrash: { at: "connected", kind: "uncaughtException" },
			load: async () => undefined,
		});
		await settle();
		assert.deepStrictEqual(exits, []);
		assert.deepStrictEqual(stderr, []);
	});
});
