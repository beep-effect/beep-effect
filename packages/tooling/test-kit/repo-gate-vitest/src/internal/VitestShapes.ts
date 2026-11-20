/**
 * The parts of Vitest's reported-task objects the adapter reads, typed by
 * shape instead of by class: Vitest's `TestCase` and `TestModule` carry
 * private fields, so a test fixture could never satisfy the class types.
 * Every field the adapter reads is optional or guarded, because a reporter
 * must survive whatever a test threw.
 *
 * @since 0.0.0
 */

/**
 * A parsed stack frame as Vitest serializes it.
 *
 * @since 0.0.0
 */
interface VitestFrame {
  readonly column?: number | undefined;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly method?: string | undefined;
}

/**
 * A serialized error: a test failure, a module or suite error, or an
 * unhandled error. `stacks` holds parsed frames or, from older callers,
 * already formatted strings.
 *
 * @since 0.0.0
 */
export interface VitestError {
  readonly diff?: unknown;
  readonly message?: unknown;
  readonly name?: unknown;
  readonly stack?: unknown;
  readonly stacks?: ReadonlyArray<string | VitestFrame> | undefined;
}

/**
 * One attempt of a test the runner retried or repeated.
 *
 * @since 0.0.0
 */
interface VitestAttempt {
  readonly state: string;
}

/**
 * What `TestCase.result()` returns; `undefined` while a test is pending.
 *
 * @since 0.0.0
 */
interface VitestResult {
  readonly errors?: ReadonlyArray<VitestError> | undefined;
  readonly state: string;
}

/**
 * What `TestCase.diagnostic()` returns; `undefined` for a test that never ran.
 *
 * @since 0.0.0
 */
interface VitestTestDiagnostic {
  readonly duration: number;
}

/**
 * A suite: its name, state, parent and the errors its hooks threw.
 *
 * @since 0.0.0
 */
export interface VitestSuite {
  errors?(): ReadonlyArray<VitestError>;
  readonly name: string;
  readonly parent?: VitestSuite | VitestParent | undefined;
  state(): string;
  readonly type: "suite";
}

/**
 * The module end of a parent chain.
 *
 * @since 0.0.0
 */
interface VitestParent {
  readonly type: "module";
}

/**
 * A test case.
 *
 * @since 0.0.0
 */
export interface VitestTestCase {
  attempts?(): ReadonlyArray<VitestAttempt>;
  diagnostic(): VitestTestDiagnostic | undefined;
  readonly fullName: string;
  readonly name: string;
  readonly parent?: VitestSuite | VitestParent | undefined;
  result(): VitestResult | undefined;
  readonly type: "test";
}

/**
 * A test module (one test file).
 *
 * @since 0.0.0
 */
export interface VitestModule {
  readonly children: {
    allTests(): Iterable<VitestTestCase>;
    allSuites(): Iterable<VitestSuite>;
  };
  diagnostic(): { readonly duration: number } | undefined;
  errors(): ReadonlyArray<VitestError>;
  readonly relativeModuleId: string;
  state(): string;
  readonly type: "module";
}

/**
 * A line a test printed through `console`, as Vitest hands it to reporters.
 *
 * @since 0.0.0
 */
export interface VitestConsoleLog {
  readonly content: string;
  readonly type: "stdout" | "stderr";
}
