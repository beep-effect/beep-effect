// Ported from vitest-agent packages/sdk/__test__/build-report.test.ts at 1cf1ab94 (MIT).
import * as A from "effect/Array";
import type {
  VitestError,
  VitestModule,
  VitestSuite,
  VitestTestCase,
} from "@beep/repo-gate-vitest/internal/VitestShapes";

export const ROOT = "/repo/packages/demo";

const moduleParent: NonNullable<VitestTestCase["parent"]> = { type: "module" };

export const makeTestCase = (
  overrides: {
    readonly name?: string;
    readonly fullName?: string;
    readonly state?: string;
    readonly duration?: number;
    readonly errors?: ReadonlyArray<VitestError>;
    readonly attempts?: ReadonlyArray<string>;
    readonly parent?: VitestTestCase["parent"];
    readonly noResult?: boolean;
    readonly noDiagnostic?: boolean;
  } = {}
): VitestTestCase => {
  const name = overrides.name ?? "my test";
  return {
    type: "test",
    name,
    fullName: overrides.fullName ?? name,
    parent: overrides.parent ?? moduleParent,
    result: () =>
      overrides.noResult === true
        ? undefined
        : {
            state: overrides.state ?? "passed",
            ...(overrides.errors === undefined ? {} : { errors: overrides.errors }),
          },
    diagnostic: () => (overrides.noDiagnostic === true ? undefined : { duration: overrides.duration ?? 10 }),
    attempts: () => A.map(overrides.attempts ?? [], (state) => ({ state })),
  };
};

export const makeSuite = (
  overrides: {
    readonly name?: string;
    readonly state?: string;
    readonly errors?: ReadonlyArray<VitestError>;
    readonly parent?: VitestTestCase["parent"];
  } = {}
): VitestSuite => ({
  type: "suite",
  name: overrides.name ?? "suite",
  parent: overrides.parent ?? moduleParent,
  state: () => overrides.state ?? "passed",
  errors: () => overrides.errors ?? [],
});

export const makeModule = (
  overrides: {
    readonly file?: string;
    readonly state?: string;
    readonly duration?: number;
    readonly tests?: ReadonlyArray<VitestTestCase>;
    readonly suites?: ReadonlyArray<VitestSuite>;
    readonly errors?: ReadonlyArray<VitestError>;
    readonly noDiagnostic?: boolean;
  } = {}
): VitestModule => ({
  type: "module",
  relativeModuleId: overrides.file ?? "test/foo.test.ts",
  state: () => overrides.state ?? "passed",
  children: {
    allTests: () => overrides.tests ?? [],
    allSuites: () => overrides.suites ?? [],
  },
  diagnostic: () => (overrides.noDiagnostic === true ? undefined : { duration: overrides.duration ?? 50 }),
  errors: () => overrides.errors ?? [],
});
