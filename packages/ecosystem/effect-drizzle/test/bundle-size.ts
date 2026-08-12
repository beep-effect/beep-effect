export const compareBundleSize = (currentRawBytes: number, baselineRawBytes: number) => {
  const delta = currentRawBytes - baselineRawBytes;
  return {
    currentRawBytes,
    baselineRawBytes,
    delta,
    isRegression: delta > 0,
  };
};

const formatSignedDelta = (delta: number): string => (delta >= 0 ? `+${delta}` : `${delta}`);

export const formatBundleSizeLine = (currentRawBytes: number, baselineRawBytes: number): string =>
  `bundle-size rawBytes current=${currentRawBytes} baseline=${baselineRawBytes} delta=${formatSignedDelta(
    currentRawBytes - baselineRawBytes
  )}`;
