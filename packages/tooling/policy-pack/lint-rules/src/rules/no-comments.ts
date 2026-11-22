/**
 * `beep/no-comments`: the comment law as an editor-facing oxlint rule.
 *
 * **Details**
 *
 * The rule reports every comment {@link classifyComments} calls banned. It is
 * switched on per swept path through `overrides.files` in `.oxlintrc.json`;
 * the `beep laws comments` growth check is the gate, because a source
 * disable directive can silence any oxlint rule and the scanner rejects
 * those directives.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import * as A from "effect/Array";
import * as R from "effect/Record";
import {
  CommentGrammarInput,
  classifyComments,
  commentLawMessage,
  DeclarationNodeType,
  ExportNodeType,
  isBannedCommentKind,
  MemberNodeType,
  makeAttachmentIndex,
  SourceComment,
} from "./comment-grammar.ts";
import type { Visitor } from "@oxlint/plugins";
import type { AttachmentIndex, GrammarNode } from "./comment-grammar.ts";

const indexedTypes = A.appendAll(
  A.appendAll(ExportNodeType.literals, DeclarationNodeType.literals),
  MemberNodeType.literals
);

/**
 * Oxlint rule that bans free prose, local JSDoc and law-disabling directives.
 *
 * **Example** (Inspect the rule)
 *
 * ```ts
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * console.log(plugin.rules["no-comments"]?.meta?.type) // "problem"
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Ban free prose comments, JSDoc on non-exported symbols and directives that disable the law.",
    },
  },
  create(context) {
    let index: AttachmentIndex = makeAttachmentIndex({ type: "Program", start: 0, end: 0 });
    const enter = (node: GrammarNode): void => index.enter(node);
    const exit = (node: GrammarNode): void => index.exit(node);
    const tracked = R.fromEntries(
      A.flatMap(indexedTypes, (type) => [
        [type, enter],
        [`${type}:exit`, exit],
      ])
    );
    return {
      ...tracked,
      Program(program) {
        index = makeAttachmentIndex(program);
      },
      "Program:exit"(program) {
        const comments = A.map(context.sourceCode.getAllComments(), (comment) =>
          SourceComment.make({ type: comment.type, value: comment.value, start: comment.start, end: comment.end })
        );
        const attachment = index.result();
        const input = CommentGrammarInput.make({ source: context.sourceCode.text, program, comments, attachment });
        for (const comment of classifyComments(input)) {
          if (!isBannedCommentKind(comment.kind)) continue;
          context.report({
            loc: {
              start: context.sourceCode.getLocFromIndex(comment.start),
              end: context.sourceCode.getLocFromIndex(comment.end),
            },
            message: commentLawMessage(comment.kind),
          });
        }
      },
    } as Visitor;
  },
});
