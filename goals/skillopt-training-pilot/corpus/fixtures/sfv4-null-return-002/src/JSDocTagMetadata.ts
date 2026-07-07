export interface JSDocTagMetadata {
  readonly tag: string;
  readonly repeatable: boolean;
}

const metadataByTag: Readonly<Record<string, JSDocTagMetadata>> = {
  example: { tag: "example", repeatable: true },
  since: { tag: "since", repeatable: false },
};

export const getJSDocTagMetadata = (tag: string): JSDocTagMetadata | undefined => metadataByTag[tag];
