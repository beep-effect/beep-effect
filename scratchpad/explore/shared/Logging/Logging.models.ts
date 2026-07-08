/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {SchemaUtils} from "@beep/schema";
import {O} from '@beep/utils';
import NodeFS from "node:fs";
import NodePath from "node:path";
import {Result} from "effect";
import {
	RotatingFileSinkError,
	isFileNotFoundError,
	ReadRotatingFileSinkErrorMeta,
	PruneRotatingFileSinkErrorMeta,
	RotateRotatingFileSinkErrorMeta,
	WriteRotatingFileSinkErrorMeta,
	RotatingFileSinkConfigurationError,
	RotatingFileSinkConfigurationErrorMetaMaxFiles,
	RotatingFileSinkConfigurationErrorMetaMaxBytes,
	InitializeRotatingFileSinkErrorMeta,
} from "./Logging.errors.ts";


const $I = $ScratchpadId.create("explore/AiModel.models");

/**
 * {description}
 *
 * @example
 * ```ts
 * import { RotatingFileSinkOptions } from "@beep/explore";
 *
 * RotatingFileSinkOptions.make({
 *  filePath: "/home/user",
 *  maxBytes: 1000000,
 *  maxFiles: 10
 * })
 * ```
 * @category Models
 * @since 0.0.0
 */
export class RotatingFileSinkOptions extends S.Class<RotatingFileSinkOptions>($I`RotatingFileSinkOptions`)({
	filePath: S.String,
	maxBytes: S.Finite.check(S.isGreaterThanOrEqualTo(1)),
	maxFiles: S.Finite.check(S.isGreaterThanOrEqualTo(1)),
	throwOnError: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
}, $I.annote("RotatingFileSinkOptions", {
	description: "",
})) {
}

export class RotatingFileSink extends RotatingFileSinkOptions.extend<RotatingFileSink>($I`RotatingFileSink`)(
	{},
	$I.annote("RotatingFileSink", {
		description: "",
	}),
) {
	private currentSize = 0;

	readonly new = (options: RotatingFileSinkOptions): Result.Result<RotatingFileSink, RotatingFileSinkError> => {
		if (options.maxBytes < 1) {
			throw RotatingFileSinkConfigurationError.make({
				meta: RotatingFileSinkConfigurationErrorMetaMaxBytes.make({
					received: options.maxBytes,
					minimum: 1,
				}),
				cause: O.none(),
			});
		}
		if (options.maxFiles < 1) {
			throw RotatingFileSinkConfigurationError.make({
				meta: RotatingFileSinkConfigurationErrorMetaMaxFiles.make({
					received: options.maxFiles,
					minimum: 1,
				}),
				cause: O.none(),
			});
		}

		const sink = RotatingFileSink.make(options)

		return Result.try({
			try: () => {
				NodeFS.mkdirSync(NodePath.dirname(sink.filePath), {recursive: true});

				return sink
			},
			catch: (cause) => RotatingFileSinkError.make({
				meta: InitializeRotatingFileSinkErrorMeta.make({
					filePath: sink.filePath,
				}),
				cause,
			}),
		}).pipe(Result.map((sink) => {
			sink.currentSize = sink.readCurrentSize()
			sink.pruneOverflowBackups()

			return sink
		}))
	}

	write(chunk: string | Buffer): void {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
		if (buffer.length === 0) return;

		try {
			if (this.currentSize > 0 && this.currentSize + buffer.length > this.maxBytes) {
				this.rotate();
			}

			NodeFS.appendFileSync(this.filePath, buffer);
			this.currentSize += buffer.length;

			if (this.currentSize > this.maxBytes) {
				this.rotate();
			}
		} catch (cause) {
			if (RotatingFileSinkError.is(cause)) {
				throw cause;
			}
			if (this.throwOnError) {
				throw RotatingFileSinkError.make({
					meta: WriteRotatingFileSinkErrorMeta.make({
						filePath: this.filePath,
					}),
					cause,
				});
			}
			this.currentSize = this.readCurrentSize();
		}
	}

	private rotate(): void {
		try {
			const oldest = this.withSuffix(this.maxFiles);
			if (NodeFS.existsSync(oldest)) {
				NodeFS.rmSync(oldest, {force: true});
			}

			for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
				const source = this.withSuffix(index);
				const target = this.withSuffix(index + 1);
				if (NodeFS.existsSync(source)) {
					NodeFS.renameSync(source, target);
				}
			}

			if (NodeFS.existsSync(this.filePath)) {
				NodeFS.renameSync(this.filePath, this.withSuffix(1));
			}

			this.currentSize = 0;
		} catch (cause) {
			if (this.throwOnError) {
				throw RotatingFileSinkError.make({
					meta: RotateRotatingFileSinkErrorMeta.make({

						filePath: this.filePath,
					}),
					cause,
				});
			}
			this.currentSize = this.readCurrentSize();
		}
	}

	private pruneOverflowBackups(): void {
		try {
			const dir = NodePath.dirname(this.filePath);
			const baseName = NodePath.basename(this.filePath);
			for (const entry of NodeFS.readdirSync(dir)) {
				if (!entry.startsWith(`${baseName}.`)) continue;
				const suffix = Number(entry.slice(baseName.length + 1));
				if (!Number.isInteger(suffix) || suffix <= this.maxFiles) continue;
				NodeFS.rmSync(NodePath.join(dir, entry), {force: true});
			}
		} catch (cause) {
			if (this.throwOnError) {
				throw RotatingFileSinkError.make({
					meta: PruneRotatingFileSinkErrorMeta.make({
						operation: "prune",
						filePath: this.filePath,
					}),
					cause,
				});
			}
		}
	}

	private readCurrentSize(): number {
		try {
			return NodeFS.statSync(this.filePath).size;
		} catch (cause) {
			if (isFileNotFoundError(cause)) {
				return 0;
			}
			throw RotatingFileSinkError.make({
				meta: ReadRotatingFileSinkErrorMeta.make({
					filePath: this.filePath,
				}),
				cause,
			});
		}
	}

	private withSuffix(index: number): string {
		return `${this.filePath}.${index}`;
	}
}
