export type ExtractFramesInput = {
  readonly inputPath: string;
  readonly outputDir: string;
  readonly fps?: number;
};

export const buildExtractFramesArgs = (input: ExtractFramesInput): ReadonlyArray<string> => {
  const baseArgs = ["-i", input.inputPath, `${input.outputDir}/frame-%06d.png`];

  if (input.fps === undefined) {
    return baseArgs;
  }

  return ["-i", input.inputPath, "-vf", `fps=${input.fps}`, `${input.outputDir}/frame-%06d.png`];
};
