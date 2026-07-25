import { Equal, type Fiber } from "effect";
import type { InterpreterFailure } from "./interpreter/Interpreter.model.ts";

/**
 * Promise handle owned by one CodeMode execution.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModePromise {
  readonly fiber: Fiber.Fiber<unknown, InterpreterFailure>;

  constructor(fiber: Fiber.Fiber<unknown, InterpreterFailure>) {
    this.fiber = fiber;
  }

  static readonly new = (
    fiber: Fiber.Fiber<unknown, InterpreterFailure>
  ): CodeModePromise =>
    // Promise handles are mutable runtime identities. Effect hash collections
    // must not structurally traverse the Fiber stored inside them.
    Equal.byReferenceUnsafe(new CodeModePromise(fiber));
}

/**
 * Mutable JavaScript Date value represented by epoch milliseconds.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeDate {
  time: number;

  constructor(time: number) {
    this.time = time;
  }

  static readonly new = (time: number): CodeModeDate => new CodeModeDate(time);
}

/**
 * Mutable JavaScript RegExp value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeRegExp {
  readonly regex: RegExp;

  constructor(pattern: string, flags: string) {
    this.regex = new RegExp(pattern, flags);
  }

  static readonly new = (pattern: string, flags: string): CodeModeRegExp => new CodeModeRegExp(pattern, flags);

  get lastIndex(): unknown {
    return Reflect.get(this.regex, "lastIndex");
  }

  set lastIndex(value: unknown) {
    Reflect.set(this.regex, "lastIndex", value);
  }
}

/**
 * Mutable JavaScript Map value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeMap {
  // crispen: native Map is the guest-language semantic adapter; a HashMap
  // cannot preserve object identity, SameValueZero, or live mutation.
  readonly map = new Map<unknown, unknown>();

  static readonly new = (): CodeModeMap => new CodeModeMap();
}

/**
 * Mutable JavaScript Set value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeSet {
  // crispen: native Set is the guest-language semantic adapter; a HashSet
  // cannot preserve object identity, SameValueZero, or live mutation.
  readonly set = new Set<unknown>();

  static readonly new = (): CodeModeSet => new CodeModeSet();
}

/**
 * Mutable JavaScript URLSearchParams value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeURLSearchParams {
  readonly params: URLSearchParams;

  constructor(params: URLSearchParams) {
    this.params = params;
  }

  static readonly new = (params: URLSearchParams): CodeModeURLSearchParams => new CodeModeURLSearchParams(params);
}

/**
 * Mutable JavaScript URL value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeURL {
  readonly searchParams: CodeModeURLSearchParams;
  readonly url: URL;

  constructor(url: URL) {
    this.url = url;
    this.searchParams = new CodeModeURLSearchParams(url.searchParams);
  }

  static readonly new = (url: URL): CodeModeURL => new CodeModeURL(url);
}

/**
 * Identifies values whose native mutation and identity semantics are part of
 * the guest JavaScript contract.
 *
 * @category guards
 * @since 0.0.0
 */
export const isCodeModeValue = (
  value: unknown
): value is CodeModeDate | CodeModeRegExp | CodeModeMap | CodeModeSet | CodeModeURL | CodeModeURLSearchParams =>
  value instanceof CodeModeDate ||
  value instanceof CodeModeRegExp ||
  value instanceof CodeModeMap ||
  value instanceof CodeModeSet ||
  value instanceof CodeModeURL ||
  value instanceof CodeModeURLSearchParams;
