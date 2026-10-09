import { Audience } from "../env/index.ts";
import { CommandNeutralizer } from "../github-commands/index.ts";
import { Console, Effect } from "effect";
import { CliTheme } from "./CliTheme.ts";
import { sanitize } from "./Fmt.ts";
import { underGithubActions } from "./internal/autoFormat.ts";
import { Status } from "./Status.ts";

/**
 * Options for {@link CliMessage.status}.
 *
 * @public
 */
export interface CliMessageOptions {
	/**
	 * Where the line goes. Defaults to stderr for a status whose rank is at or above `warning`'s in its
	 * vocabulary, stdout otherwise.
	 */
	readonly stream?: "stdout" | "stderr" | undefined;
}

/**
 * One-line status messages: a glyph and some text, themed for a person and plain for an agent.
 *
 * @remarks
 * Each line goes through `Console`, `log` for stdout and `error` for stderr, never through the logger, so no
 * log level can silence it. Only the glyph is painted; the text stays plain. An `agent` audience gets the glyph
 * and the text and never colour, even when the theme has colour. `success` and `info` go to stdout, `warning`
 * and `failure` to stderr.
 *
 * The text is whatever the caller supplies, so it is sanitised: escape sequences and control characters are removed
 * (a line break is kept as one, a tab becomes a space), as in a document. Under GitHub Actions, where
 * `CurrentRuntimeEnv` says so, a line the runner would read as a workflow command is neutralized as well. The glyph
 * comes from the vocabulary, sanitised too (`Status.glyph`), so a glyph built from data cannot inject an escape either.
 *
 * @public
 */
export class CliMessage {
	private constructor() {}

	/**
	 * Print a status line from a vocabulary.
	 *
	 * @remarks
	 * The stream defaults to stderr when the status ranks at or above `warning` in `vocab`, and stdout
	 * otherwise, so a custom status follows its own rank: a `timeout` ranked 85 goes to stderr.
	 *
	 * @param vocab - the vocabulary the status belongs to
	 * @param name - the status
	 * @param text - the text after the glyph
	 * @param options - the stream override
	 */
	static readonly status = <N extends string>(
		vocab: Status<N>,
		name: N,
		text: string,
		options?: CliMessageOptions,
	): Effect.Effect<void, never, CliTheme | Audience> =>
		Effect.gen(function* () {
			const theme = yield* CliTheme;
			const audience = yield* Audience;
			const def = vocab.def(name);
			const message = sanitize(text);

			// The stream first, then the line painted with THAT stream's colour: a redirected stderr is not coloured
			// because stdout is.
			// Every vocabulary is built from Status.core, so "warning" is always there; the cast only widens the name.
			const warning = (vocab as unknown as Status<"warning">).def("warning").rank;
			const stream = options?.stream ?? (def.rank >= warning ? "stderr" : "stdout");
			const streamTheme = theme.forStream(stream);

			let line: string;
			// An agent sees the theme at colour none: the same line, its glyph sanitised and unpainted.
			line = CliTheme.forAudience(streamTheme, audience.kind).status(vocab, name, message);
			// The runner reads a log line as a command; this is the one place a message's text reaches it.
			if (yield* underGithubActions) line = CommandNeutralizer.text(line);

			yield* stream === "stderr" ? Console.error(line) : Console.log(line);
		});

	/**
	 * A success line, on stdout.
	 *
	 * @param text - the text after the glyph
	 */
	static readonly success = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
		CliMessage.status(Status.core, "success", text);

	/**
	 * An informational line, on stdout.
	 *
	 * @param text - the text after the glyph
	 */
	static readonly info = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
		CliMessage.status(Status.core, "info", text);

	/**
	 * A warning line, on stderr.
	 *
	 * @param text - the text after the glyph
	 */
	static readonly warning = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
		CliMessage.status(Status.core, "warning", text);

	/**
	 * A failure line, on stderr.
	 *
	 * @param text - the text after the glyph
	 */
	static readonly failure = (text: string): Effect.Effect<void, never, CliTheme | Audience> =>
		CliMessage.status(Status.core, "failure", text);
}
