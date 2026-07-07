export interface SourceMetadataInput {
  readonly sourcePath: string;
  readonly owner: string;
}

export interface SourceMetadata {
  readonly sourcePath: string;
  readonly owner: string;
  readonly generatedBy: "sync-data-to-ts";
}

export const makeSourceMetadata = (input: SourceMetadataInput): SourceMetadata => ({
  sourcePath: input.sourcePath,
  owner: input.owner,
  generatedBy: "sync-data-to-ts",
});
