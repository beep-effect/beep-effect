import * as S from "effect/Schema";
import * as SG from "effect/SchemaGetter";

export class SourceMetadataInput extends S.Class<SourceMetadataInput>("SourceMetadataInput")({
  sourcePath: S.String,
  owner: S.String,
}) {}

export class SourceMetadata extends S.Class<SourceMetadata>("SourceMetadata")({
  sourcePath: S.String,
  owner: S.String,
  generatedBy: S.Literal("sync-data-to-ts"),
}) {}

export const MakeSourceMetadata = SourceMetadataInput.pipe(
  S.decodeTo(SourceMetadata, {
    decode: SG.transform(
      (input: SourceMetadataInput) =>
        new SourceMetadata({
          sourcePath: input.sourcePath,
          owner: input.owner,
          generatedBy: "sync-data-to-ts",
        })
    ),
    encode: SG.transform(
      (metadata: SourceMetadata) =>
        new SourceMetadataInput({
          sourcePath: metadata.sourcePath,
          owner: metadata.owner,
        })
    ),
  })
);

export const makeSourceMetadata = S.decodeSync(MakeSourceMetadata);
