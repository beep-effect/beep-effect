// Below this floor the artifact is a tree-shaken stub, not a real bundle —
// the Bun.build failure mode this harness exists to catch. Roughly half the
// initial 7864-byte baseline; adjust deliberately alongside baselines.
import { dual } from "effect/Function";

export const minimumBundleRawBytes = 4096;

type BundleSizeBaseline = {
  readonly baselineRawBytes: number;
  readonly minimumRawBytes?: number;
};

export const compareBundleSize: {
  (baseline: BundleSizeBaseline): (currentRawBytes: number) => BundleSizeComparison;
  (currentRawBytes: number, baseline: BundleSizeBaseline): BundleSizeComparison;
} = dual(2, (currentRawBytes: number, baseline: BundleSizeBaseline): BundleSizeComparison => {
  const { baselineRawBytes, minimumRawBytes = minimumBundleRawBytes } = baseline;
  const delta = currentRawBytes - baselineRawBytes;
  return {
    currentRawBytes,
    baselineRawBytes,
    minimumRawBytes,
    delta,
    isCollapse: currentRawBytes < minimumRawBytes,
    isRegression: delta > 0,
  };
});

type BundleSizeComparison = {
  readonly baselineRawBytes: number;
  readonly currentRawBytes: number;
  readonly delta: number;
  readonly isCollapse: boolean;
  readonly isRegression: boolean;
  readonly minimumRawBytes: number;
};

const formatSignedDelta = (delta: number): string => (delta >= 0 ? `+${delta}` : `${delta}`);

export const formatBundleSizeLine: {
  (baselineRawBytes: number): (currentRawBytes: number) => string;
  (currentRawBytes: number, baselineRawBytes: number): string;
} = dual(
  2,
  (currentRawBytes: number, baselineRawBytes: number): string =>
    `bundle-size rawBytes current=${currentRawBytes} baseline=${baselineRawBytes} delta=${formatSignedDelta(
      currentRawBytes - baselineRawBytes
    )}`
);
