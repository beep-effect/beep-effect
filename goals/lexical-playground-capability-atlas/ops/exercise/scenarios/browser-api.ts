import { GROUP, manualScenario } from "./helpers.ts";

const speechManualReason =
  "Chromium fake-media can exercise permission plumbing, but the pinned Web Speech API still depends on a real browser speech service and audible utterance; transcription quality and permission UX require an interactive microphone session.";

export const scenarios = [
  manualScenario({
    activationExercise: "Invoke Speech to text from the document actions cluster with a real microphone utterance.",
    group: GROUP.browserApi,
    id: "document.speech-to-text",
    networkExpectation: "user-initiated",
    reason: speechManualReason,
    title: "Speech to text",
  }),
] as const;
