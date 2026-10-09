import { $ScratchpadId } from "@beep/identity/packages";
import { CurrentRuntimeEnv } from "../../env/index.ts";
import type * as Fiber from "effect/Fiber";
import * as Context from "effect/Context";
import * as O from "effect/Option";
import { sanitize } from "../Fmt.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/cli/internal/logSafety");

/**
 * Marks a log line the kit has already rendered, so the logger does not strip the escapes the kit painted into it.
 *
 * @remarks
 * The failure report renders a document for the audience (painted for a person) and writes each line through the
 * logger. That text is not consumer-supplied any more: its consumer text was sanitised when the document was built. A
 * `Reference` rather than a log annotation, so it never appears in a diagnostics record.
 *
 * @internal
 */
export const TrustedLine = Context.Reference<boolean>($I`TrustedLine`, { defaultValue: () => false });

/**
 * Whether the logging fiber runs under GitHub Actions: `CurrentRuntimeEnv`, read from the fiber's own context (a
 * `Logger` callback is synchronous and cannot `yield*`), says so. Absent, no.
 *
 * @internal
 */
export const underActionsIn = (fiber: Fiber.Fiber<unknown, unknown>): boolean => {
	const runtime = Context.getOption(fiber.context, CurrentRuntimeEnv);
	return O.contains(
		O.flatMap(runtime, (env) => env.ci),
		"github-actions",
	);
};

/**
 * The string parts of a log message, sanitised: what a custom `render` receives, so it paints over clean input.
 *
 * @internal
 */
export const sanitizeParts = (message: unknown): unknown => {
	if (P.isString(message)) return sanitize(message);
	if (A.isArray(message)) return message.map((part) => (P.isString(part) ? sanitize(part) : part));
	return message;
};

/**
 * Neutralize the `##[` the runner's legacy parser finds anywhere in a line, inside an NDJSON record, as the JSON escape
 * `##[`: it decodes to the identical text, so the record loses nothing. A `##[` can only sit in a string there.
 *
 * @internal
 */
export const neutralizeJson = (line: string): string => line.replaceAll("##[", "#\\u0023[");
