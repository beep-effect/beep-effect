export interface FrameFileNameInput {
  readonly basename: string;
  readonly frame: number;
  readonly extension: "jpg" | "png";
}

export const formatFrameFileName = (input: FrameFileNameInput): string =>
  `${input.basename}-${String(input.frame).padStart(6, "0")}.${input.extension}`;
