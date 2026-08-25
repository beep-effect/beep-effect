import { documentToEditorState } from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import { Effect } from "effect";
import * as O from "effect/Option";

/**
 * Shared "Draft a reply…" seed editor state for the composer stories (used as
 * `initialState` by both the `EditorComposer` and `ChatComposer` stories).
 */
export const draftReplyInitialState = Effect.runSync(
  documentToEditorState(
    MdModel.Document.make({
      children: [MdModel.P.make({ children: [MdModel.Text.make({ value: "Draft a reply…" })] })],
    })
  )
);

const proofText = (value: string) => MdModel.Text.make({ value });

// Canonical document used to prove readable content across capability profiles.
const capabilityProofDocument = MdModel.Document.make({
  children: [
    MdModel.Heading.make({ level: 1, children: [proofText("Capability proof")] }),
    MdModel.P.make({
      children: [
        MdModel.Strong.make({ children: [proofText("Bold")] }),
        proofText(" "),
        MdModel.Em.make({ children: [proofText("italic")] }),
        proofText(" "),
        MdModel.Del.make({ children: [proofText("struck")] }),
        proofText(" "),
        MdModel.Code.make({ value: "inline()" }),
        proofText(" "),
        MdModel.A.make({ href: "https://example.com", children: [proofText("proof link")] }),
      ],
    }),
    MdModel.Ul.make({
      children: [
        MdModel.Li.make({ children: [proofText("First item")] }),
        MdModel.Li.make({ children: [proofText("Second item")] }),
      ],
    }),
    MdModel.TaskList.make({
      children: [MdModel.TaskItem.make({ checked: true, children: [proofText("Checked task")] })],
    }),
    MdModel.BlockQuote.make({ children: [MdModel.P.make({ children: [proofText("Quoted proof")] })] }),
    MdModel.Pre.make({ value: "const proof = true", language: O.some("typescript") }),
    MdModel.Table.make({
      headerRow: true,
      children: [
        MdModel.TableRow.make({
          children: [
            MdModel.TableCell.make({ children: [proofText("A1")] }),
            MdModel.TableCell.make({ children: [proofText("B1")] }),
          ],
        }),
        MdModel.TableRow.make({
          children: [
            MdModel.TableCell.make({ children: [proofText("A2")] }),
            MdModel.TableCell.make({ children: [proofText("B2")] }),
          ],
        }),
      ],
    }),
  ],
});

/** Serialized Lexical projection shared by all capability-profile stories. */
export const capabilityProofInitialState = Effect.runSync(documentToEditorState(capabilityProofDocument));
