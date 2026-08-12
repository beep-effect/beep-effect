// Below this floor the artifact is a tree-shaken stub, not a real bundle —
// the Bun.build failure mode this harness exists to catch. Roughly half the
// initial 7864-byte baseline; adjust deliberately alongside baselines.
export const minimumBundleRawBytes = 4096;

export const compareBundleSize = (
  currentRawBytes: number,
  baselineRawBytes: number,
  minimumRawBytes: number = minimumBundleRawBytes
) => {
  const delta = currentRawBytes - baselineRawBytes;
  return {
    currentRawBytes,
    baselineRawBytes,
    minimumRawBytes,
    delta,
    isCollapse: currentRawBytes < minimumRawBytes,
    isRegression: delta > 0,
  };
};

const formatSignedDelta = (delta: number): string => (delta >= 0 ? `+${delta}` : `${delta}`);

export const formatBundleSizeLine = (currentRawBytes: number, baselineRawBytes: number): string =>
  `bundle-size rawBytes current=${currentRawBytes} baseline=${baselineRawBytes} delta=${formatSignedDelta(
    currentRawBytes - baselineRawBytes
  )}`;
