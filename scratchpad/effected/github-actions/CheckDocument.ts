import * as MutableHashMap from "effect/MutableHashMap";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { CheckState } from "./CheckState.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import { ManagedDocument } from "./ManagedDocument.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/github-actions/CheckDocument");

/**
 * What a run knows about one of its checks: the authoritative state, and the
 * presentation facts a renderer projects into the document.
 *
 * @remarks
 * Only `state` is required. The rest exist because a status table needs them:
 * `title` when the display name differs from the registry key, `outcome` for
 * the one-line verdict cell, `url` for linking the check's name, and `detail`
 * for the per-check block a body region carries. A later report for the same
 * key **replaces** the whole entry — last write wins, per field and per check.
 *
 * @public
 */
export class CheckReport extends S.Class<CheckReport>($I`CheckReport`)({
	/** Where the check is now. The last reported state is the authoritative one. */
	state: CheckState.annotateKey({ description: "Where the check is now. The last reported state is the authoritative one." }),
	/** Display name, when it differs from the registry key. */
	title: S.optionalKey(S.String).annotateKey({ description: "Display name, when it differs from the registry key." }),
	/** A one-line verdict, e.g. `in progress...` or `3 packages ready`. */
	outcome: S.optionalKey(S.String).annotateKey({ description: "A one-line verdict, e.g. `in progress...` or `3 packages ready`." }),
	/** A pre-rendered markdown block of per-check detail. */
	detail: S.optionalKey(S.String).annotateKey({ description: "A pre-rendered markdown block of per-check detail." }),
	/** Where the check's name should link. */
	url: S.optionalKey(S.String).annotateKey({ description: "Where the check's name should link." }),
}, $I.annote("CheckReport", { description: "What a run knows about one of its checks: the authoritative state, and the presentation facts a renderer projects into the document." })) {}

/** What each {@link CheckDocumentError} kind reads as. */
const KIND_PROSE = {
	render: "The check document could not be regenerated from the reported state",
	read: "Reading the check document's current text failed",
	sink: "Writing the check document failed",
} as const;

/**
 * Raised when the check document cannot be regenerated, read back or written.
 *
 * @remarks
 * `render` — projecting the registry onto the document failed, almost always
 * because a reported `detail` contains a line the region scanner would read
 * as a marker; the underlying `ManagedDocumentError` rides in `cause`.
 * `read` — the sink's read-back of the live document failed; its error rides
 * in `cause`. `sink` — the consumer's write effect failed; its error rides in
 * `cause`. Callers of `flush` branch on `kind`; the background reconciler
 * never fails a fiber with this — it logs and retries on the next report.
 *
 * @public
 */
export class CheckDocumentError extends S.TaggedError<CheckDocumentError>($I`CheckDocumentError`)("CheckDocumentError", {
	/** Which phase failed: regenerating the document, reading it back, or writing it. */
	kind: S.Literals(["render", "read", "sink"]).annotateKey({ description: "Which phase failed: regenerating the document, reading it back, or writing it." }),
	/** The underlying failure. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure." }),
}, $I.annote("CheckDocumentError", { description: "Raised when the check document cannot be regenerated, read back or written." })) {
	override get message(): string {
		return KIND_PROSE[this.kind];
	}
}

/**
 * A run's identity for staleness ordering: when it started and which run it
 * is.
 *
 * @remarks
 * Two delayed workflows can race for one document — a re-run's stale pass
 * must not overwrite a newer run's regions. The ordering is **total**:
 * `at` compares first (as epoch milliseconds when both sides `Date.parse`
 * cleanly, lexically otherwise), `runId` breaks ties (numerically when both
 * parse to finite numbers, lexically otherwise), and two equal stamps compare
 * as at-least-as-recent — a run may refine its own regions.
 *
 * @public
 */
export class CheckDocumentStamp extends S.Class<CheckDocumentStamp>($I`CheckDocumentStamp`)({
	/** When the run started — ideally an ISO-8601 instant. */
	at: S.String.annotateKey({ description: "When the run started — ideally an ISO-8601 instant." }),
	/** The run's identifier — on GitHub, `GITHUB_RUN_ID`. */
	runId: S.String.annotateKey({ description: "The run's identifier — on GitHub, `GITHUB_RUN_ID`." }),
}, $I.annote("CheckDocumentStamp", { description: "A run's identity for staleness ordering: when it started and which run it is." })) {
	/**
	 * Is `incoming` allowed to overwrite regions stamped `existing`?
	 *
	 * @remarks
	 * Total and reflexive: equal stamps answer `true`, so a run always may
	 * rewrite what it wrote itself. Only a strictly older `incoming` answers
	 * `false`.
	 */
	static isAtLeastAsRecent(
		incoming: { readonly at: string; readonly runId: string },
		existing: { readonly at: string; readonly runId: string },
	): boolean {
		const at = compareAt(incoming.at, existing.at);
		if (at !== 0) {
			return at > 0;
		}
		return compareRunId(incoming.runId, existing.runId) >= 0;
	}
}

/** A total order over two comparable values. */
const order = <T extends string | number>(left: T, right: T): number => (left === right ? 0 : left < right ? -1 : 1);

/** Epoch order when both sides parse as dates, lexical otherwise. */
const compareAt = (left: string, right: string): number => {
	const leftEpoch = Date.parse(left);
	const rightEpoch = Date.parse(right);
	return Number.isNaN(leftEpoch) || Number.isNaN(rightEpoch) ? order(left, right) : order(leftEpoch, rightEpoch);
};

/**
 * Numeric order when both sides are non-blank finite numbers, lexical
 * otherwise.
 *
 * @remarks
 * The blank guard exists because `Number("")` and `Number("  ")` are both a
 * finite `0` — without it a blank `runId` (plausible when `GITHUB_RUN_ID` is
 * unset in a local or self-hosted run) would compare numerically equal to
 * `"0"` and outrank `"-1"`. Blank sides fall to the lexical branch, which
 * stays total and deterministic.
 */
const compareRunId = (left: string, right: string): number => {
	if (left.trim() !== "" && right.trim() !== "") {
		const leftNumber = Number(left);
		const rightNumber = Number(right);
		if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
			return order(leftNumber, rightNumber);
		}
	}
	return order(left, right);
};

/** The stamp a document's own regions carry, when they carry one. */
const stampOf = (meta: Readonly<Record<string, string>>): { at: string; runId: string } | undefined => {
	const at = meta.at;
	const runId = meta.runId;
	return at === undefined || runId === undefined ? undefined : { at, runId };
};

/** The most recent stamp among a document's own regions, if any carry one. */
const maxStampOf = (
	regions: ReadonlyArray<{ readonly meta: Readonly<Record<string, string>> }>,
): { at: string; runId: string } | undefined => {
	let max: { at: string; runId: string } | undefined;
	for (const region of regions) {
		const stamp = stampOf(region.meta);
		if (stamp !== undefined && (max === undefined || CheckDocumentStamp.isAtLeastAsRecent(stamp, max))) {
			max = stamp;
		}
	}
	return max;
};

/**
 * What one reconcile pass did.
 *
 * @remarks
 * `written` — the render changed and the sink wrote it. `unchanged` — the
 * render was byte-identical, so no write was issued. `stale` — the document
 * already carries regions from a more recent run, so the pass was dropped
 * without writing (only possible when {@link CheckDocumentOptions.stamp} is
 * set).
 *
 * @public
 */
export type CheckFlushOutcome = "written" | "unchanged" | "stale";

/**
 * How a rendered document leaves the process: the narrow sink contract.
 *
 * @remarks
 * The function form is one rendered document in, one write effect out —
 * nothing else. That is what lets the sticky PR comment
 * (`PullRequestComment.upsert`), the PR description (`PATCH` on the pull
 * request) and a test's recording `Ref` all fit the same reconciler. The
 * write's success value is ignored; a failure surfaces as
 * {@link CheckDocumentError} with `kind: "sink"`. Provide any services the
 * effects need when constructing the sink — the reconciler runs them as
 * given.
 *
 * The object form adds an optional `read`: the live document's current text,
 * fetched at the start of every pass and used as the base to reconcile
 * against instead of the last text this process wrote. `undefined` means
 * "nothing there yet" — a fresh document. That is what lets two runs share
 * one document: each pass sees what the *other* run wrote, not a private
 * shadow. A failed read surfaces as `kind: "read"`. A bare function is
 * exactly `{ write }`.
 *
 * @public
 */
export type CheckDocumentSink<E = unknown> =
	| ((rendered: string) => Effect.Effect<unknown, E>)
	| {
			/** Write one rendered document. */
			readonly write: (rendered: string) => Effect.Effect<unknown, E>;
			/** The live document's current text, or `undefined` for none yet. */
			readonly read?: Effect.Effect<string | undefined, E> | undefined;
	  };

/**
 * Options for {@link CheckDocument.layer}.
 *
 * @public
 */
export interface CheckDocumentOptions<E = unknown> {
	/** The managed document's namespace, e.g. your action's name. */
	readonly namespace: string;
	/** Which document, within that namespace. */
	readonly key: string;
	/**
	 * The document text to reconcile against initially — a PR body fetched
	 * once at startup, so human content outside the managed regions survives.
	 * Defaults to empty: a fresh document.
	 */
	readonly initial?: string | undefined;
	/**
	 * The pure projection from registry state to region entries.
	 *
	 * @remarks
	 * Called with the full snapshot on every reconcile pass; returns the
	 * regions to replace, keyed however the consumer's document is laid out —
	 * typically one region per check plus a shared status table. It must be a
	 * pure function of the snapshot: rendering the same state twice must
	 * produce the same entries, because byte-identical output is what
	 * suppresses the write.
	 */
	readonly render: (checks: ReadonlyMap<string, CheckReport>) => ReadonlyArray<readonly [key: string, content: string]>;
	/** Where the rendered document goes. */
	readonly sink: CheckDocumentSink<E>;
	/**
	 * This run's identity, for staleness ordering against other runs.
	 *
	 * @remarks
	 * A **per-run constant** — mint it once at startup, never per pass. When
	 * present, every region a pass writes carries `at`/`runId` metadata, and a
	 * pass whose stamp is strictly older than the most recent stamp already on
	 * the document is **dropped** rather than written, so a delayed re-run can
	 * never clobber a newer run's regions. Equal stamps pass: a run may refine
	 * its own regions.
	 *
	 * The constant is what preserves write suppression: the same run rendering
	 * the same state produces byte-identical text (stamp included), so no
	 * write is issued. The accepted corner is that a content-identical pass
	 * therefore does not refresh the document's stamp to "now" — suppression
	 * wins — which is sound because only strictly-older stamps drop.
	 */
	readonly stamp?: { readonly at: string; readonly runId: string } | undefined;
	/**
	 * Debounce parameters: `quiet` is the trailing settle window, `maxWait`
	 * the staleness bound under a steady stream of reports. Defaults: 500
	 * milliseconds and 3 seconds.
	 */
	readonly debounce?:
		| { readonly quiet?: Duration.Input | undefined; readonly maxWait?: Duration.Input | undefined }
		| undefined;
	/**
	 * How long one sink write — or one read-back, when the sink carries a
	 * `read` — may run before the pass fails with `kind: "sink"` (or
	 * `kind: "read"`). Default: 30 seconds.
	 *
	 * @remarks
	 * The reconciler serializes passes behind one permit, and the finalizer's
	 * last flush waits on that same permit — so a sink that never resolves
	 * would otherwise stall every later pass AND scope teardown. The bound
	 * turns a hung write into the ordinary sink failure path: a background
	 * pass logs and retries on the next report, `flush` surfaces the typed
	 * error.
	 */
	readonly sinkTimeout?: Duration.Input | undefined;
}

/**
 * The members of the {@link CheckDocument} service: `report` a check's state,
 * read the `checks` registry and `flush` the document.
 *
 * @public
 */
export interface CheckDocumentShape {
	/**
	 * Record a check's current state and schedule a reconcile.
	 *
	 * @remarks
	 * Never fails and never blocks on the write — the state lands in the
	 * registry, and the debounced background pass projects it. Reporting the
	 * same key again replaces the entry; resolution is **not** terminal, so
	 * `pass` followed by `fail` leaves `fail` even inside one debounce window.
	 */
	readonly report: (check: string, report: CheckReport) => Effect.Effect<void>;
	/** The registry as of now, in first-report order. */
	readonly checks: Effect.Effect<ReadonlyMap<string, CheckReport>>;
	/**
	 * Reconcile immediately, skipping the debounce.
	 *
	 * @remarks
	 * Rendering unchanged state issues no write. Call it at the end of a run;
	 * the layer's finalizer also runs it, so the last burst of reports lands
	 * even when the scope closes inside the quiet window. The outcome says
	 * what the pass did — `written`, `unchanged` or `stale`.
	 */
	readonly flush: Effect.Effect<CheckFlushOutcome, CheckDocumentError>;
}

/**
 * A living document of check state: an in-process registry the run reports
 * into, debounced onto a marker-delimited document, written through a narrow
 * sink.
 *
 * @remarks
 * **Push, not pull.** The run owns its checks and knows when they resolve;
 * nothing here polls GitHub. Consumers call `report` as states change, and a
 * background fiber projects the registry onto a {@link ManagedDocument} —
 * regions replaced from current state, so a check that resolves many times
 * updates its region in place instead of appending.
 *
 * The debounce is **trailing with a max-wait, never leading**: a burst of
 * reports coalesces into one write carrying the *final* state, and a steady
 * stream still surfaces progress every `maxWait`. A pass that renders
 * byte-identical text issues no write at all.
 *
 * `layer` mints fresh state per call — one layer per document. Bind it to a
 * `const` if two parts of a program must share one registry.
 *
 * @example
 * ```ts
 * import { CheckDocument, CheckReport, GitHubMarkdown } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const layer = CheckDocument.layer({
 *   namespace: "my-action",
 *   key: "release-validation",
 *   render: (checks) => [
 *     [
 *       "header",
 *       GitHubMarkdown.table(
 *         ["Check", "Outcome"],
 *         [...checks].map(([key, check]) => [key, check.outcome ?? check.state]),
 *       ),
 *     ],
 *   ],
 *   sink: (rendered) => Effect.log(rendered),
 * });
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* CheckDocument;
 *   yield* doc.report("build", CheckReport.make({ state: "running" }));
 *   yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
 *   yield* doc.flush;
 * });
 * ```
 *
 * @public
 */
export class CheckDocument extends Context.Service<CheckDocument, CheckDocumentShape>()(
	$I`CheckDocument`,
) {
	/**
	 * The reconciler over one document.
	 *
	 * @remarks
	 * Forks the debounce fiber into the layer's scope and registers a
	 * finalizer that flushes once more on the way out, so the scope closing
	 * mid-window cannot strand the final state. A background pass that fails
	 * logs a structured warning and leaves the registry intact — the next
	 * report retries it; only `flush` surfaces the typed error.
	 */
	static layer<E>(options: CheckDocumentOptions<E>): Layer.Layer<CheckDocument> {
		return Layer.effect(
			CheckDocument,
			Effect.gen(function* () {
				const quietMillis = Duration.toMillis(options.debounce?.quiet ?? "500 millis");
				const maxWaitMillis = Math.max(Duration.toMillis(options.debounce?.maxWait ?? "3 seconds"), quietMillis);
				const checksRef = yield* Ref.make(MutableHashMap.empty<string, CheckReport>());
				const writtenRef = yield* Ref.make(options.initial ?? "");
				const versionRef = yield* Ref.make(0);
				const signal = yield* Latch.make(false);
				const gate = yield* Semaphore.make(1);
				const passTimeout = options.sinkTimeout ?? "30 seconds";
				// Normalized once: the bare-function sink is exactly `{ write }`.
				const sink = P.isFunction(options.sink) ? { write: options.sink } : options.sink;
				const stamp = options.stamp;
				const stampMeta = stamp === undefined ? undefined : { at: stamp.at, runId: stamp.runId };
				const staleLoggedRef = yield* Ref.make(false);

				const reconcile = Effect.fn("CheckDocument.reconcile")(function* () {
					const checks = yield* Ref.get(checksRef);
					// With a readable sink each pass reconciles against the LIVE
					// document — what another run wrote, not this process's shadow.
					// `undefined` is "nothing there yet": a fresh document. The same
					// timeout bounds the read as the write, and for the same reason:
					// this pass holds the single permit.
					const current =
						sink.read === undefined
							? yield* Ref.get(writtenRef)
							: ((yield* sink.read.pipe(
									Effect.timeout(passTimeout),
									Effect.mapError((cause) => CheckDocumentError.make({ kind: "read", cause })),
								)) ?? "");
					const document = yield* ManagedDocument.parse({
						namespace: options.namespace,
						key: options.key,
						text: current,
					}).pipe(Effect.mapError((cause) => CheckDocumentError.make({ kind: "render", cause })));
					if (stamp !== undefined) {
						// The drop rule: regions already stamped by a more recent run
						// win; a strictly older pass must not clobber them. Regions
						// carrying no stamp are ignored — they are not evidence of a
						// newer run.
						const existing = maxStampOf(document.regions);
						if (existing !== undefined && !CheckDocumentStamp.isAtLeastAsRecent(stamp, existing)) {
							yield* Effect.annotateCurrentSpan("outcome", "stale");
							// Once stale, every later pass of this run is stale too — the
							// stamp is a per-run constant. INFO on the transition only;
							// repeats (the debounced pass plus an explicit flush is the
							// common pair) log at debug so a chatty run does not repeat
							// the same drop per report.
							const alreadyLogged = yield* Ref.getAndSet(staleLoggedRef, true);
							yield* (alreadyLogged ? Effect.logDebug : Effect.logInfo)(
								"CheckDocument pass dropped: the document carries a more recent run's regions",
								{
									incomingAt: stamp.at,
									incomingRunId: stamp.runId,
									existingAt: existing.at,
									existingRunId: existing.runId,
								},
							);
							return "stale" as const;
						}
						yield* Ref.set(staleLoggedRef, false);
					}
					const entries = options.render(checks.backing);
					const next = yield* document
						.withRegions(
							stampMeta === undefined ? entries : entries.map(([key, content]) => [key, content, stampMeta] as const),
						)
						.pipe(Effect.mapError((cause) => CheckDocumentError.make({ kind: "render", cause })));
					if (next.text === current) {
						return "unchanged" as const;
					}
					// The timeout is load-bearing, not defensive: this pass holds the
					// single permit, and the finalizer's last flush waits on it — an
					// unbounded hung sink would stall reconciling AND scope teardown.
					yield* sink.write(next.text).pipe(
						Effect.timeout(passTimeout),
						Effect.mapError((cause) => CheckDocumentError.make({ kind: "sink", cause })),
					);
					yield* Ref.set(writtenRef, next.text);
					return "written" as const;
				});

				// One pass at a time: the debounce fiber and a manual `flush` must
				// not interleave their read-render-compare-write sequences.
				const flush = gate.withPermits(1)(reconcile());

				// Trailing debounce with a max-wait. The latch wakes the fiber on
				// the first report of a burst; the poll loop then waits for a quiet
				// window (no version movement for `quiet`) or the staleness bound,
				// whichever comes first — so the write always carries the burst's
				// FINAL state, never its first.
				const daemon = Effect.gen(function* () {
					while (true) {
						yield* signal.await;
						yield* signal.close;
						const start = yield* Clock.currentTimeMillis;
						let settled = false;
						while (!settled) {
							const before = yield* Ref.get(versionRef);
							yield* Effect.sleep(quietMillis);
							const after = yield* Ref.get(versionRef);
							const now = yield* Clock.currentTimeMillis;
							settled = after === before || now - start >= maxWaitMillis;
						}
						yield* flush.pipe(
							Effect.catch((failure) =>
								Effect.logWarning("CheckDocument reconcile failed; retrying on the next report", {
									kind: failure.kind,
								}),
							),
						);
					}
				});

				// Registered BEFORE the fork so it runs AFTER the fork's own
				// interruption finalizer: the daemon is already dead when the last
				// flush runs, so the two cannot race for the sink.
				yield* Effect.addFinalizer(() =>
					flush.pipe(
						Effect.catch((failure) => Effect.logWarning("CheckDocument final flush failed", { kind: failure.kind })),
					),
				);
				yield* Effect.forkScoped(daemon);

				const report = Effect.fn("CheckDocument.report")(function* (check: string, entry: CheckReport) {
					yield* Ref.update(checksRef, (current) => {
						const next = MutableHashMap.fromIterable(current);
						MutableHashMap.set(next, check, entry);
						return next;
					});
					yield* Ref.update(versionRef, (count) => count + 1);
					yield* signal.open;
				});

				return { report, checks: Effect.map(Ref.get(checksRef), (checks) => checks.backing), flush } satisfies CheckDocumentShape;
			}),
		);
	}

	/** An inert double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<CheckDocumentShape> = {}): CheckDocumentShape => ({
		report: () => dies("report"),
		checks: dies("checks"),
		flush: dies("flush"),
		...overrides,
	});

	/** {@link CheckDocument.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<CheckDocumentShape> = {}): Layer.Layer<CheckDocument> =>
		Layer.succeed(CheckDocument, CheckDocument.makeTest(overrides));
}

const dies = unstubbed("CheckDocument.makeTest");
