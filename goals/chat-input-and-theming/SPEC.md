# Chat Input & Green Workbench Theming Spec

## Objective

`apps/professional-desktop` gains two user-visible capabilities, shipped as one
packet:

1. **Green workbench theming.** The app launches following the OS light/dark
   preference and exposes a persisted toggle. Dark mode is a near-black,
   green-accented "workbench" (green primary, amber accent, green radial-glow
   background); light mode keeps the green primary over an `oip-web`-style
   parchment background. Theme applies consistently across the sidebar, chat
   thread, message views, and composer.
2. **Feature-flagged rich chat input.** The chat composer becomes a lobehub-style
   Lexical input: a fixed formatting toolbar, a `/` command menu, `@` mentions,
   file/image attachments, plain-Enter-to-send, a live character count (with an
   optional token estimate), and send/stop states — all driven by a typed
   feature-flag config so non-chat surfaces can opt into a subset. The
   placeholder/cursor-alignment bug is fixed, and the slash/mention menus meet the
   WAI-ARIA combobox + IME requirements in the deep-research report.

The generic editor mechanism lives in `@beep/editor` (`foundation/ui-system`);
product meaning (slash items, mention sources, palette values, send wiring) is
injected by the app.

## Non-Goals

- Block rendering, streaming view, read-only `EditorViewer`, block repair, or
  observability (owned by `chat-surface-parity`).
- New node types in `@beep/lexical-schema` — mentions are ephemeral composer
  affordances, not persisted blocks (locked in `rich-text-foundation`).
- Changing the `@beep/ui` global default palette — the green theme is app-local;
  `oip-web` parchment/burgundy is untouched.
- New chat domain entities or tables; no agent/LLM behavior change beyond the
  optional attachment-payload extension (see Decisions §7 + Exception Ledger).
- Adopting `@lobehub/editor` as a dependency — it remains a UX reference only.
- Building a new orb/glow component — reuse the existing `@beep/ui`
  `OrbBackground`.

## Source Hierarchy

1. User objective or issue that created this packet
   (`research/seed/USER_PROMPT_INITIAL.md` + grilled decisions below).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`,
   `standards/architecture/07-non-slice-families.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/professional-desktop` — Lane A theming + Lane B app assembly.
- `packages/foundation/ui-system/editor` (`@beep/editor`) — Lane B generic
  mechanism (feature-flag config + toolbar/slash/mention/attachment plugin infra).
- `packages/foundation/ui-system/ui` (`@beep/ui`) — read-only reuse
  (`createAppTheme`, `AppThemeProvider`, `useThemeMode`, `OrbBackground`) plus the
  placeholder fix in `src/components/editor/editor-ui/content-editable.tsx`.
- (Optional, attachments-on-payload) `@beep/agents-domain` / `-use-cases` /
  `-client` / `-server` + `@beep/anthropic` — only if the payload/vision
  extension is pursued; otherwise the degrade path applies.
- `goals/chat-input-and-theming/**` — this packet.

## Constraints

- No `@lobehub/editor` dependency; lobehub is reference only.
- No `@beep/ui` default-palette change; theming is app-local via `createAppTheme`
  + `AppThemeProvider theme={...}` (mirror `apps/oip-web/src/components/OipThemeProvider.tsx`).
- No `@beep/lexical-schema` node-vocabulary change; mentions serialize to
  text/link.
- Preserve the existing composer contract: `draftAtoms`, `runTurnAtom`,
  `editTargetAtom`, draft autosave, edit-as-branch.
- Reuse existing primitives: `@beep/ui` `createAppTheme`, `AppThemeProvider`,
  `useThemeMode().toggleMode`, `components/orb-background.tsx`; port
  `effect-lexical-chat` patterns (`Atom.family` keyed by `LexicalEditor`, no
  `useEffect`; draft `Atom.kvs`).
- Effect-first throughout. `@beep/editor` is `foundation/ui-system`: it owns the
  mechanism only; product slash items + mention sources are injected by the app.
- Schema-first applies to **wire/persisted/domain payloads** (e.g. any
  `SendTurnRequest` attachment extension is schema-first). This SPEC originally
  carved out the editor feature-flag config and attachment value as "UI config —
  plain TypeScript types", but **that carve-out was superseded during
  implementation**: the repo's schema-first + atom-first laws (which the Source
  Hierarchy ranks above this packet) require `S.Class` + Effect Atom even here, so
  `ComposerFeatures`/`SlashItem`/`MentionOption`/`ComposerAttachment` ship as
  schema classes and all per-composer state is an `Atom.family` keyed by
  `LexicalEditor`. The Feature-flag config contract below describes the shape; read
  its "plain TS" framing as superseded by the schema-first delivery.
- `@beep/editor` feature additions are opt-in (config-gated) so the minimal
  composer behavior and existing `EditorComposerProps` / stories / consumers are
  unchanged by default (additive only).
- The committed `research/` reports (incl. `references/` and
  `deep-research-lexical-chat-composer.md`) are the **authoritative** prior-art
  reference; the external local checkouts (`effect-lexical-chat`, trustgraph) are
  supplementary and may drift — prefer the reports when they conflict.

## Decisions (locked via grill-with-docs session, 2026-06-20)

1. One packet, two lanes. Slug `chat-input-and-theming`.
2. Theming encoded **app-local** via `createAppTheme` (oip-web pattern); `@beep/ui`
   untouched. Default mode = **`system`** + persisted toggle. Reuse the existing
   `OrbBackground` with `tone="green"`.
3. Composer **mechanism in `@beep/editor`**; assembly + product items app-local.
4. v1 features: **fixed** formatting toolbar; `/` slash = **formatting/insert
   items only** (infra ready for product/knowledge commands later); `@` mentions
   **ephemeral**; attachments per the Attachment contract below; **plain Enter
   sends (configurable)**; live **character count** (token estimate optional);
   send/stop states; placeholder/cursor **bug fix**. Slash/mention menus meet the
   combobox + IME a11y contract.
5. Deep-research (web): chat-composer UX/accessibility + Lexical
   plugin/feature-flag architecture (delivered:
   `research/deep-research-lexical-chat-composer.md`).
6. Build + QA via the `claude-frontend-lane` skill + claude-in-chrome against the
   lobehub demo, the deployed `effect-lexical-chat`, and the trustgraph workbench.
7. **Attachments are bounded by default** (Attachment contract): the foundation
   composer ships capture UI + a typed upload-port callback; the cross-slice
   **send-on-payload** extension (`SendTurnRequest` + Anthropic vision) is an
   explicit, separately-gated step requiring confirmation before touching the
   `@beep/agents-*` slice. If it exceeds packet weight, the stubbed-send degrade is
   the recorded fallback (see Exception Ledger).
8. The feature-flag config is a typed UI config (not `effect/Schema`); see the
   Feature-flag config contract.

## Feature-flag config contract

The composer is configured by a plain **TypeScript** config object (UI config —
not `effect/Schema`), additive to the existing `EditorComposerProps` (which stays
unchanged). Exact field names are a P1 detail; the contract is:

- A `features` config selecting which plugins mount, e.g.
  `{ toolbar?: boolean; slash?: boolean; mentions?: boolean; attachments?: boolean;
  sendOn?: "enter" | "modifierEnter" }`. Omitted/false ⇒ plugin not mounted ⇒
  current minimal behavior. Default for the chat surface: all on, `sendOn:
  "enter"`.
- Product injection points are callback/data props, not baked-in items:
  `slashItems` (the `/` command list), `mentionSource` (async `@` query →
  options), and `onAttach` / upload-port callback. The foundation owns the menu
  **mechanism** (`LexicalTypeaheadMenuPlugin` + `LexicalMenu`); the app supplies
  the items.
- Node dependencies are registered up front: the composer registers the **union**
  of nodes required by the enabled features in `initialConfig.nodes` — do not
  register nodes conditionally at runtime (crashes on paste/restore per Lexical
  maintainers; deep-research finding 8).
- Public export from `@beep/editor` (a `ChatComposer` wrapper and/or a `features`
  prop on the composer); the bare `EditorComposer` remains for non-chat consumers.

## Attachment contract

- **Foundation (in scope, app-agnostic):** capture UI only — drag-drop + file
  picker + thumbnail/chip rendering and a typed **upload-port callback prop**
  (e.g. `onAttach(files: ReadonlyArray<File>) => …`). The editor never performs
  transport or persistence itself.
- **Attachment value shape (app-local TS type for v1):** `{ id; filename;
  mimeType; size; data }` where `data` is an in-memory blob/data-URL ref. MIME
  allowlist: images for vision (`image/png`, `image/jpeg`, `image/webp`,
  `image/gif`) + generic files; enforce a max-size cap (P1 default, e.g. 10 MB).
- **Send transport (cross-slice, GATED):** sending attachments to the model
  requires extending `SendTurnRequest` (currently `content: Document` only) with an
  `attachments` field and mapping images → Anthropic image content blocks. This is
  **schema-first** and touches `@beep/agents-domain`/`-use-cases`/`-client`/
  `-server` + `@beep/anthropic`. It must be **confirmed before starting** (Stop
  Condition) — never done implicitly.
- **v1 default = bounded:** capture UI + typed upload port wired; send-on-payload
  is the gated extension above, with the **stubbed-send degrade** (Exception
  Ledger) as the recorded fallback if the cross-slice work exceeds packet weight.

## Character & token count

- v1 ships an **exact character count** that updates as the user types
  (deterministic, testable).
- A **token estimate** is optional and clearly labeled approximate (e.g. "~N
  tokens"); if shown, derive it from `@beep/nlp` tokenization
  (`packages/foundation/capability/nlp`, `Tokenization`) — do not hand-roll a
  counter. If a cheap count is unavailable, token display is deferred (not a v1
  blocker).

## Acceptance Criteria

- [x] App launches following the OS theme (`system` default) with a persisted
      toggle switching green-dark ↔ green/parchment-light; both modes apply across
      sidebar, thread, message views, and composer.
- [x] Green radial-glow background rendered via the existing `@beep/ui`
      `OrbBackground tone="green"`.
- [x] `@beep/editor` exposes a typed (TypeScript, not `effect/Schema`)
      feature-flag config toggling toolbar, slash, mentions, attachments, and
      send-key behavior; the bare `EditorComposer` and existing stories/consumers
      are unchanged (additive only).
- [x] Chat composer shows a fixed formatting toolbar (bold/italic/lists/quote/
      link/code), a working `/` menu (formatting/insert items), `@` mention
      typeahead (ephemeral, app-injected source), attachment capture (drag-drop +
      picker + thumbnail), a live exact **character count**, and send/stop states.
- [x] Slash and mention menus meet the combobox a11y contract: the editor input
      exposes `role=combobox` + `aria-controls`, the popup is `role=listbox` with
      `role=option` items, the active option is tracked via `aria-activedescendant`
      on the input (DOM focus stays in the editor), and Down/Up move the active
      option, Enter selects, Escape closes + returns focus.
- [x] Plain Enter sends (configurable); a modifier (Shift/Cmd/Ctrl+Enter) inserts
      a newline; Enter-to-send is **suppressed during IME composition**
      (`event.isComposing`); existing draft autosave + edit-as-branch preserved.
- [x] Placeholder shows only on the empty state and the cursor aligns with the
      placeholder text (bug fixed); a Storybook regression story covers it.
- [x] Attachments: capture UI (drag-drop + picker + thumbnail) + a typed
      upload-port callback are wired per the Attachment contract. Send-on-payload
      (`SendTurnRequest` + Anthropic vision) is implemented ONLY if confirmed; else
      the stubbed-send degrade is applied and recorded in the Exception Ledger.
      (Shipped via the degrade path: send transport remains stubbed — the ledger
      entry stands; the agents slice carries no attachment payload as of
      2026-07-31.)
- [x] Storybook stories cover the configurable composer; the app runs and passes
      claude-in-chrome visual QA in both modes.
- [x] No `@lobehub/editor` dependency added; `@beep/ui` defaults and
      `@beep/lexical-schema` node vocabulary unchanged.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/chat-input-and-theming/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/chat-input-and-theming/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/chat-input-and-theming` | Passes |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes (closeout) |
| Affected packages typecheck | `bun run check` on `@beep/editor`, `@beep/ui`, app | Passes |
| Composer stories | Storybook EditorComposer/ChatComposer + placeholder regression | Render + interact |
| App + theme QA | Run app; claude-in-chrome QA in light + dark | Both modes correct |
| Repo quality gate | `bun run beep yeet verify` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The attachment **send-on-payload** extension (`SendTurnRequest` / `@beep/agents-*`
  / Anthropic vision) is reached — **confirm before starting**; never modify the
  agents slice implicitly. If it cannot be done within packet weight, apply the
  stubbed-send degrade and continue, or stop and report.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Attachment send transport may be stubbed | Lane B attachments | packet owner | Extending `SendTurnRequest` across `@beep/agents-*` + `@beep/anthropic` vision may exceed packet weight | Replaced by full turn-payload + vision wiring, or split into a dedicated follow-up packet |
