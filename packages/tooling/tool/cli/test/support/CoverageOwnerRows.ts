import { CoverageReaderSource, CoverageScopeOwner } from "@beep/repo-cli/test/Quality";
import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as Order from "effect/Order";

// Fixture workspaces for the scanned coverage owner rows (hosted-setup-tax TURB-01): one package
// per row owner, whose test tree reads exactly the reader paths its rows give it. Test-tree reads
// add no dependents, so the reader scan over these sources equals the rows.

type OwnerRow = readonly [readerPath: string, ownerPattern: string, packageName: string];

/** Fixture directory of a row owner: `@beep/repo-cli` lives at `packages/repo-cli`. */
export const rowOwnerPackagePath = (packageName: string): string =>
  `packages/${Str.replace("@beep/", "")(packageName)}`;

/** Sorted unique owners named by the rows. */
export const rowOwnerNames = (rows: ReadonlyArray<OwnerRow>): ReadonlyArray<string> =>
  pipe(
    rows,
    A.map(([, , owner]) => owner),
    A.dedupe,
    A.sort(Order.String)
  );

/** Reader paths whose rows name the owner, in row order. */
export const rowReaderPathsOf: {
  (packageName: string): (rows: ReadonlyArray<OwnerRow>) => ReadonlyArray<string>;
  (rows: ReadonlyArray<OwnerRow>, packageName: string): ReadonlyArray<string>;
} = dual(
  2,
  (rows: ReadonlyArray<OwnerRow>, packageName: string): ReadonlyArray<string> =>
    pipe(
      rows,
      A.filter(([, , owner]) => owner === packageName),
      A.map(([readerPath]) => readerPath),
      A.dedupe
    )
);

/** A module whose string tokens name each reader path once. */
export const readerListText = (readerPaths: ReadonlyArray<string>): string =>
  `export const readers = [${A.join(
    A.map(readerPaths, (readerPath) => `"${readerPath}"`),
    ", "
  )}];\n`;

/** One coverage-bearing fixture owner per row owner. */
export const rowFixtureOwners = (rows: ReadonlyArray<OwnerRow>): ReadonlyArray<CoverageScopeOwner> =>
  A.map(rowOwnerNames(rows), (packageName) =>
    CoverageScopeOwner.make({ packageName, packagePath: rowOwnerPackagePath(packageName), hasCoverage: true })
  );

/** One test-tree reader per row owner, naming the reader paths its rows give it. */
export const rowFixtureReaders = (rows: ReadonlyArray<OwnerRow>): ReadonlyArray<CoverageReaderSource> =>
  A.map(rowOwnerNames(rows), (packageName) =>
    CoverageReaderSource.make({
      filePath: `${rowOwnerPackagePath(packageName)}/test/readers.test.ts`,
      text: readerListText(rowReaderPathsOf(rows, packageName)),
    })
  );
