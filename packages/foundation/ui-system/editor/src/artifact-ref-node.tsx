/**
 * Runtime Lexical node for the `artifact-ref` block owned by
 * `@beep/lexical-schema` — a block-level reference to a runtime artifact,
 * rendered as a chip.
 *
 * @packageDocumentation \@beep/editor/artifact-ref-node
 * @since 0.0.0
 */

import { ArtifactRefNode as ArtifactRefNodeSchema } from "@beep/lexical-schema";
import { O } from "@beep/utils";
import * as S from "effect/Schema";
import { DecoratorNode } from "lexical";
import type { EditorConfig, LexicalNode, NodeKey } from "lexical";
import type { JSX } from "react";

/**
 * Serialized wire shape of {@link ArtifactRefNode} — pinned to the
 * `@beep/lexical-schema` encoded contract.
 *
 * @example
 * ```ts
 * import type { SerializedArtifactRefNode } from "@beep/editor/artifact-ref-node"
 *
 * const payload = {
 *   type: "artifact-ref",
 *   version: 1,
 *   artifactId: "artifact-123",
 *   label: "Quarterly report",
 * } satisfies SerializedArtifactRefNode
 *
 * const artifactId: string = payload.artifactId
 * console.log(artifactId) // "artifact-123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SerializedArtifactRefNode = ArtifactRefNodeSchema.Encoded;

/**
 * Schema-derived creation input for `$createArtifactRefNode`. It is the
 * construction subset of the serialized artifact-ref wire shape used by runtime
 * Lexical node construction.
 *
 * @example
 * ```ts
 * import type { ArtifactRefNodeCreateInput } from "@beep/editor/artifact-ref-node"
 *
 * const input: ArtifactRefNodeCreateInput = { artifactId: "artifact-123", label: "Quarterly report" }
 * console.log(input.artifactId) // "artifact-123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArtifactRefNodeCreateInput = Pick<SerializedArtifactRefNode, "artifactId" | "label">;

const decodeArtifactRefNode = S.decodeUnknownOption(ArtifactRefNodeSchema);

const artifactRefInput = (props: ArtifactRefNodeCreateInput) => ({
  type: "artifact-ref",
  version: 1,
  artifactId: props.artifactId,
  ...O.getSomesStruct({ label: O.fromUndefinedOr(props.label) }),
});

const invalidArtifactRefNode = (): ArtifactRefNode => new ArtifactRefNode("");

/**
 * Block-level decorator node referencing a runtime artifact.
 *
 * @example
 * ```tsx
 * import { $createArtifactRefNode } from "@beep/editor/artifact-ref-node"
 *
 * console.log($createArtifactRefNode({ artifactId: "artifact-123" }).getType()) // "artifact-ref"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export class ArtifactRefNode extends DecoratorNode<JSX.Element> {
  __artifactId: string;
  __label: string | undefined;

  constructor(artifactId: string, label?: string, key?: NodeKey) {
    super(key);
    this.__artifactId = artifactId;
    this.__label = label;
  }

  static override getType(): string {
    return "artifact-ref";
  }

  static override clone(node: ArtifactRefNode): ArtifactRefNode {
    return new ArtifactRefNode(node.__artifactId, node.__label, node.__key);
  }

  // Lexical 0.46 widened the base `importJSON` parameter to
  // `SerializedLexicalNode & Record<string, unknown>`; mirror the intersection so
  // the narrowed (schema-pinned, interface-backed) wire shape stays bivariant.
  static override importJSON(serializedNode: SerializedArtifactRefNode & Record<string, unknown>): ArtifactRefNode {
    return O.match(decodeArtifactRefNode(serializedNode), {
      onNone: invalidArtifactRefNode,
      onSome: (decoded) => new ArtifactRefNode(decoded.artifactId, O.getOrUndefined(decoded.label)),
    });
  }

  override exportJSON(): SerializedArtifactRefNode {
    return {
      ...super.exportJSON(),
      type: "artifact-ref",
      artifactId: this.__artifactId,
      ...O.getSomesStruct({ label: O.fromUndefinedOr(this.__label) }),
    };
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement("div");
  }

  override updateDOM(): boolean {
    return false;
  }

  override isInline(): boolean {
    return false;
  }

  getArtifactId(): string {
    return this.getLatest().__artifactId;
  }

  getLabel(): string | undefined {
    return this.getLatest().__label;
  }

  override decorate(): JSX.Element {
    const invalid = O.isNone(
      decodeArtifactRefNode({
        type: "artifact-ref",
        version: 1,
        artifactId: this.__artifactId,
        ...O.getSomesStruct({ label: O.fromUndefinedOr(this.__label) }),
      })
    );
    return (
      <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-sm">
        <span aria-hidden>⧉</span>
        {invalid ? "Artifact unavailable" : (this.__label ?? this.__artifactId)}
      </span>
    );
  }
}

/**
 * Create an {@link ArtifactRefNode}.
 *
 * @example
 * ```tsx
 * import { $createArtifactRefNode } from "@beep/editor/artifact-ref-node"
 *
 * const node = $createArtifactRefNode({ artifactId: "artifact-123", label: "Quarterly report" })
 * console.log(node.getType()) // "artifact-ref"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const $createArtifactRefNode = (props: ArtifactRefNodeCreateInput): ArtifactRefNode =>
  O.match(decodeArtifactRefNode(artifactRefInput(props)), {
    onNone: invalidArtifactRefNode,
    onSome: (decoded) => new ArtifactRefNode(decoded.artifactId, O.getOrUndefined(decoded.label)),
  });

/**
 * Type guard for {@link ArtifactRefNode}.
 *
 * @example
 * ```tsx
 * import { $createArtifactRefNode, $isArtifactRefNode } from "@beep/editor/artifact-ref-node"
 *
 * console.log($isArtifactRefNode($createArtifactRefNode({ artifactId: "a" }))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isArtifactRefNode = (node: LexicalNode | null | undefined): node is ArtifactRefNode =>
  node instanceof ArtifactRefNode;
