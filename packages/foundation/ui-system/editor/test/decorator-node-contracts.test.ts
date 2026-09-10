// @vitest-environment jsdom

import { $createCodeBlockNode, $isCodeBlockNode, CodeBlockNode } from "@beep/editor/code-block-node";
import { $createMermaidNode, $isMermaidNode, MermaidNode } from "@beep/editor/mermaid-node";
import { describe, expect, it } from "@effect/vitest";
import { createHeadlessEditor } from "@lexical/headless";

const withNodeContext = (assertions: () => void): void => {
  const editor = createHeadlessEditor({
    nodes: [MermaidNode, CodeBlockNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(assertions, { discrete: true });
};

describe("viewer decorator node contracts", () => {
  it("round-trips a mermaid node through its serialized shape", () => {
    withNodeContext(() => {
      const node = $createMermaidNode("graph TD\n  A --> B");

      expect(MermaidNode.getType()).toBe("mermaid");
      expect(node.getTextContent()).toBe("graph TD\n  A --> B");
      expect($isMermaidNode(node)).toBe(true);
      expect($isMermaidNode({ source: "graph TD" })).toBe(false);

      const serialized = node.exportJSON();
      expect(serialized.type).toBe("mermaid");
      expect(serialized.version).toBe(1);
      expect(serialized.source).toBe("graph TD\n  A --> B");

      const imported = MermaidNode.importJSON({ ...serialized });
      expect(imported.getTextContent()).toBe("graph TD\n  A --> B");

      const cloned = MermaidNode.clone(node);
      expect(cloned.getTextContent()).toBe("graph TD\n  A --> B");
      expect(cloned.getKey()).toBe(node.getKey());
    });
  });

  it("rejects a malformed serialized mermaid payload", () => {
    withNodeContext(() => {
      expect(() =>
        MermaidNode.importJSON({ type: "mermaid", version: 1, format: "", source: 42 } as never)
      ).toThrowError();
    });
  });

  it("round-trips a code-block node through its serialized shape", () => {
    withNodeContext(() => {
      const node = $createCodeBlockNode({ code: 'console.log("beep")', language: "typescript" });

      expect(CodeBlockNode.getType()).toBe("codeblock");
      expect(node.getTextContent()).toBe('console.log("beep")');
      expect($isCodeBlockNode(node)).toBe(true);
      expect($isCodeBlockNode("console.log")).toBe(false);

      const serialized = node.exportJSON();
      expect(serialized.type).toBe("codeblock");
      expect(serialized.version).toBe(1);
      expect(serialized.code).toBe('console.log("beep")');
      expect(serialized.language).toBe("typescript");

      const imported = CodeBlockNode.importJSON({ ...serialized });
      expect(imported.getTextContent()).toBe('console.log("beep")');
      expect(imported.__language).toBe("typescript");

      const cloned = CodeBlockNode.clone(node);
      expect(cloned.getTextContent()).toBe('console.log("beep")');
      expect(cloned.__language).toBe("typescript");
      expect(cloned.getKey()).toBe(node.getKey());
    });
  });

  it("rejects a malformed serialized code-block payload", () => {
    withNodeContext(() => {
      expect(() =>
        CodeBlockNode.importJSON({ type: "codeblock", version: 1, format: "", code: "x" } as never)
      ).toThrowError();
    });
  });
});
