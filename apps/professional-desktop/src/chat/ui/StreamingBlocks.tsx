/**
 * Lightweight renderer for the in-flight assistant turn.
 *
 * Renders a `ReadonlyArray<AssistantBlock>` directly to DOM — no Lexical,
 * no schema decode — so blocks paint as each one finishes streaming. Trimmed to
 * the assistant block vocabulary (paragraph, heading, quote, list, code,
 * table, youtube) and inline vocabulary (styled text, link) defined by
 * `@beep/agents-domain`'s {@link AssistantBlock}.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { AssistantBlock, InlineNode } from "@beep/agents-domain/values/AssistantContent";
import { CodeBlockView } from "@beep/editor/code-block-view";
import { MermaidView } from "@beep/editor/mermaid-view";
import { YouTubeEmbed } from "@beep/editor/youtube-embed";
import { sanitizeUrl } from "@beep/lexical-schema/Lexical.normalize";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { thunk0 } from "@beep/utils/thunk";
import { dual } from "effect/Function";
import * as Hash from "effect/Hash";
import * as MutableHashMap from "effect/MutableHashMap";
import type { TableBlock } from "@beep/agents-domain/values/AssistantContent";
import type { JSX, ReactNode } from "react";

/**
 * Upper bound on how many leading characters of untrusted content are ever
 * materialized or hashed for keying. Assistant content is attacker-influenceable
 * and unbounded (a single code/Mermaid block can be megabytes); capping the
 * sampled prefix keeps every key derivation O(KEY_SAMPLE_LIMIT) instead of
 * O(content) on each streaming re-render.
 */
const KEY_SAMPLE_LIMIT = 4096;

/**
 * Collapses a content-derived render string into a fixed-length, collision-
 * resistant token. The raw serialized key is never hashed whole: only a bounded
 * leading sample feeds {@link Hash.string}, and the full length is appended so
 * distinct content sharing the same prefix still yields distinct keys. This
 * caps the per-render hashing work so untrusted content cannot force large
 * string materialization.
 *
 * **Example** (Generate deterministic bounded key)
 *
 * ```ts
 * import { boundedKey } from "@/chat/ui/StreamingBlocks"
 *
 * const key = boundedKey("paragraph:Hello world")
 * console.log(boundedKey("paragraph:Hello world") === key) // true (deterministic)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const boundedKey = (raw: string): string => {
  const sample = Str.length(raw) > KEY_SAMPLE_LIMIT ? Str.takeLeft(raw, KEY_SAMPLE_LIMIT) : raw;
  return `${Hash.string(sample).toString(36)}-${Str.length(raw).toString(36)}`;
};

/**
 * Computes occurrence-disambiguated, length-bounded keys for an entire list in
 * a single pass. Replaces the previous per-item prior-scan that recomputed
 * `renderKey` for every earlier candidate (O(n^2) over untrusted content); a
 * running `MutableHashMap` count keeps this linear and the emitted keys bounded.
 *
 * **Example** (Disambiguate duplicate occurrence keys)
 *
 * ```ts
 * import { stableOccurrenceKeys } from "@/chat/ui/StreamingBlocks"
 *
 * // data-first
 * const keys = stableOccurrenceKeys(["a", "a", "b"], (item) => item)
 * console.log(keys[0] !== keys[1]) // true — duplicate content disambiguated
 *
 * // data-last
 * const keyer = stableOccurrenceKeys((item: string) => item)
 * console.log(keyer(["a", "a", "b"]).length) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stableOccurrenceKeys: {
  <Item>(renderKey: (item: Item) => string): (items: ReadonlyArray<Item>) => ReadonlyArray<string>;
  <Item>(items: ReadonlyArray<Item>, renderKey: (item: Item) => string): ReadonlyArray<string>;
} = dual(2, <Item,>(items: ReadonlyArray<Item>, renderKey: (item: Item) => string): ReadonlyArray<string> => {
  const counts = MutableHashMap.empty<string, number>();
  return A.map(items, (item) => {
    const baseKey = boundedKey(renderKey(item));
    const occurrence = O.getOrElse(MutableHashMap.get(counts, baseKey), thunk0);
    MutableHashMap.set(counts, baseKey, occurrence + 1);
    return occurrence === 0 ? baseKey : `${baseKey}#${occurrence}`;
  });
});

// Every part of a key is bounded AT CONSTRUCTION. `boundedKey` hashes a 256-character
// sample, but it was handed a string that had already been built in full — so the guard
// against a megabyte paragraph materialized the megabyte in order to bound it. A single
// text node was enough: its whole body went into the key before anything trimmed it.
const inlineRenderKey = (node: InlineNode): string =>
  InlineNode.match(node, {
    text: (t) =>
      `text:${Str.length(t.text).toString(36)}:${Str.takeLeft(t.text, KEY_SAMPLE_LIMIT)}:${t.bold === true ? "b" : ""}:${t.italic === true ? "i" : ""}:${t.code === true ? "c" : ""}`,
    link: (l) => `link:${Str.takeLeft(l.url, KEY_SAMPLE_LIMIT)}:${Str.takeLeft(l.text, KEY_SAMPLE_LIMIT)}`,
  });

/** The content's true size, counted without ever concatenating it. */
const inlinesLength = (nodes: ReadonlyArray<InlineNode>): number =>
  A.reduce(nodes, 0, (total, node) =>
    InlineNode.match(node, {
      text: (t) => total + Str.length(t.text),
      link: (l) => total + Str.length(l.url) + Str.length(l.text),
    })
  );

const inlinesRenderKey = (nodes: ReadonlyArray<InlineNode>): string => {
  // The count and the true length still disambiguate two runs that happen to share an
  // opening — they are what a truncated sample would otherwise throw away.
  let key = `${nodes.length.toString(36)}:${inlinesLength(nodes).toString(36)}`;
  for (const node of nodes) {
    if (Str.length(key) >= KEY_SAMPLE_LIMIT) break;
    key = `${key}|${inlineRenderKey(node)}`;
  }
  return key;
};

const tableCellRenderKey = (cell: TableBlock["rows"][number]["cells"][number]): string =>
  `cell:${inlinesRenderKey(cell.children)}`;

const tableRowRenderKey = (row: TableBlock["rows"][number]): string =>
  `row:${A.join(A.map(row.cells, tableCellRenderKey), "|")}`;

/**
 * Derives a content-addressed render key for a single assistant block,
 * dispatched by block variant.
 *
 * **Example** (Derive paragraph block key)
 *
 * ```ts
 * import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent"
 * import * as S from "effect/Schema"
 * import { blockRenderKey } from "@/chat/ui/StreamingBlocks"
 *
 * const block = S.decodeUnknownSync(AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Hello" }],
 * })
 * console.log(blockRenderKey(block).startsWith("paragraph:")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const blockRenderKey = (block: AssistantBlock): string =>
  AssistantBlock.match(block, {
    paragraph: (b) => `paragraph:${inlinesRenderKey(b.children)}`,
    heading: (b) => `heading:${b.level}:${inlinesRenderKey(b.children)}`,
    quote: (b) => `quote:${inlinesRenderKey(b.children)}`,
    list: (b) =>
      `list:${b.listType}:${A.join(
        A.map(b.items, (item) => inlinesRenderKey(item.children)),
        "|"
      )}`,
    // Code blocks are the megabyte offender: never materialize the full body
    // into the key. Length + a bounded leading sample disambiguates stably
    // without copying the whole (possibly attacker-sized) string.
    code: (b) =>
      `code:${b.language ?? ""}:${Str.length(b.code).toString(36)}:${Str.takeLeft(b.code, KEY_SAMPLE_LIMIT)}`,
    table: (b) => `table:${b.headerRow === true ? "header" : "body"}:${A.join(A.map(b.rows, tableRowRenderKey), "|")}`,
    youtube: (b) => `youtube:${b.videoId}`,
  });

// Keep the streaming sink aligned with the persisted Lexical link boundary:
// model-controlled active and unknown protocols collapse to an inert fragment.
const safeLinkUrl = (url: string): O.Option<string> =>
  O.liftPredicate((sanitized: string) => sanitized !== "#")(sanitizeUrl(url));

const Inline = ({ node }: { readonly node: InlineNode }): ReactNode =>
  InlineNode.match(node, {
    text: (t) => {
      let el: ReactNode = t.text;
      if (t.code === true) el = <code className="rounded bg-muted px-1 py-0.5 text-sm">{el}</code>;
      if (t.italic === true) el = <em>{el}</em>;
      if (t.bold === true) el = <strong>{el}</strong>;
      return el;
    },
    link: (l) =>
      O.match(safeLinkUrl(l.url), {
        // A rejected destination still shows its text: the content is not lost,
        // it simply is not clickable.
        onNone: () => <span>{l.text}</span>,
        onSome: (url) => (
          <a className="text-primary underline" href={url} target="_blank" rel="noreferrer noopener">
            {l.text}
          </a>
        ),
      }),
  });

const Inlines = ({ nodes }: { readonly nodes: ReadonlyArray<InlineNode> }): JSX.Element => {
  const keys = stableOccurrenceKeys(nodes, inlineRenderKey);
  return (
    <>
      {A.map(nodes, (node, i) => (
        <Inline key={O.getOrElse(A.get(keys, i), () => `inline-${i}`)} node={node} />
      ))}
    </>
  );
};

const TableRow = ({
  cells,
  header,
}: {
  readonly cells: TableBlock["rows"][number]["cells"];
  readonly header: boolean;
}): JSX.Element => {
  const keys = stableOccurrenceKeys(cells, tableCellRenderKey);
  return (
    <tr className="border-b last:border-b-0">
      {A.map(cells, (cell, i) => {
        const key = O.getOrElse(A.get(keys, i), () => `cell-${i}`);
        return header ? (
          <th key={key} className="bg-muted px-3 py-2 text-left font-medium">
            <Inlines nodes={cell.children} />
          </th>
        ) : (
          <td key={key} className="px-3 py-2 align-top">
            <Inlines nodes={cell.children} />
          </td>
        );
      })}
    </tr>
  );
};

const Table = ({ block }: { readonly block: TableBlock }): JSX.Element => {
  const hasHeader = block.headerRow === true;
  const headerRow = hasHeader ? block.rows[0] : undefined;
  const bodyRows = hasHeader ? A.drop(block.rows, 1) : block.rows;
  const bodyKeys = stableOccurrenceKeys(bodyRows, tableRowRenderKey);

  return (
    // `w-max min-w-full`, not `w-full`: forced to the container's width, a table with
    // more columns than fit crushes each one down and breaks the words inside it. The
    // table takes the width its content needs and the wrapper scrolls. (`overflow-hidden`
    // is gone from the table for the same reason it left the theme — on a table it
    // collapses min-content and licenses exactly that squeeze.)
    <div className="my-3 overflow-x-auto rounded border">
      <table className="w-max min-w-full border-collapse text-sm">
        {headerRow === undefined ? null : (
          <thead>
            <TableRow cells={headerRow.cells} header={true} />
          </thead>
        )}
        <tbody>
          {A.map(bodyRows, (row, i) => (
            <TableRow key={O.getOrElse(A.get(bodyKeys, i), () => `row-${i}`)} cells={row.cells} header={false} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Block = ({ block, renderKey }: { readonly block: AssistantBlock; readonly renderKey: string }): ReactNode =>
  AssistantBlock.match(block, {
    paragraph: (b) => (
      <p className="my-2 leading-relaxed">
        <Inlines nodes={b.children} />
      </p>
    ),
    heading: (b) => {
      const Tag = b.level;
      return (
        <Tag className="my-2 font-semibold">
          <Inlines nodes={b.children} />
        </Tag>
      );
    },
    quote: (b) => (
      <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
        <Inlines nodes={b.children} />
      </blockquote>
    ),
    list: (b) => {
      const itemKeys = stableOccurrenceKeys(b.items, (value) => inlinesRenderKey(value.children));
      const items = A.map(b.items, (item, i) => (
        <li key={O.getOrElse(A.get(itemKeys, i), () => `item-${i}`)} className="ml-4">
          <Inlines nodes={item.children} />
        </li>
      ));
      return b.listType === "number" ? (
        <ol className="my-2 list-decimal pl-4">{items}</ol>
      ) : (
        <ul className="my-2 list-disc pl-4">{items}</ul>
      );
    },
    code: (b) =>
      b.language === "mermaid" ? (
        <MermaidView renderKey={`stream:${renderKey}`} source={b.code} />
      ) : (
        // The same view the persisted transcript renders. A streaming block used to be
        // a bare `<pre>` — no language, nothing to copy — and then changed shape under
        // the reader the moment the turn landed.
        <CodeBlockView code={b.code} language={b.language ?? ""} />
      ),
    table: (b) => <Table block={b} />,
    youtube: (b) => <YouTubeEmbed videoID={b.videoId} />,
  });

/**
 * Renders the in-flight streamed assistant turn's blocks.
 *
 * **Example** (Log StreamingBlocks component name)
 *
 * ```tsx
 * import { StreamingBlocks } from "@/chat/ui/StreamingBlocks"
 *
 * console.log(StreamingBlocks.name) // "StreamingBlocks"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function StreamingBlocks({ blocks }: { readonly blocks: ReadonlyArray<AssistantBlock> }): JSX.Element {
  const blockKeys = stableOccurrenceKeys(blocks, blockRenderKey);
  const keyedBlocks = A.map(blocks, (block, i) => ({
    block,
    renderKey: O.getOrElse(A.get(blockKeys, i), () => `block-${i}`),
  }));

  return (
    <div className="text-sm">
      {A.map(keyedBlocks, ({ block, renderKey }) => (
        <Block key={renderKey} block={block} renderKey={renderKey} />
      ))}
    </div>
  );
}
