export interface FrameFileNameInput {
  readonly basename: string;
  readonly extension: "jpg" | "png";
  readonly frame: number;
}

export const formatFrameFileName = (input: FrameFileNameInput): string =>
  `${input.basename}-${String(input.frame).padStart(6, "0")}.${input.extension}`;
