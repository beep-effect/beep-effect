import * as S from "effect/Schema";
import * as SG from "effect/SchemaGetter";

export class FrameFileNameInput extends S.Class<FrameFileNameInput>("FrameFileNameInput")({
  basename: S.String,
  frame: S.Number,
  extension: S.Union([S.Literal("jpg"), S.Literal("png")]),
}) {}

export const FormatFrameFileName = FrameFileNameInput.pipe(
  S.decodeTo(S.String, {
    decode: SG.transform(
      (input: FrameFileNameInput) =>
        `${input.basename}-${String(input.frame).padStart(6, "0")}.${input.extension}`,
    ),
    encode: SG.transform(
      () =>
        new FrameFileNameInput({
          basename: "",
          frame: 0,
          extension: "jpg",
        }),
    ),
  }),
);

export const formatFrameFileName: (input: FrameFileNameInput) => string = (input) =>
  S.decodeSync(FormatFrameFileName)(input);
