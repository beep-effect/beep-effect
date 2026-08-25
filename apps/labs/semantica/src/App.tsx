/**
 * Minimal web shell for the Semantica lab.
 *
 * **Details**
 *
 * The lab is headless-first: the proof surface is the `canary` CLI and the
 * tests, not this window. The shell exists only so the generated Tauri/Vite
 * scaffold builds; it must not grow (SPEC non-goals: no window/UI in M1).
 *
 * **Example** (Render the shell)
 *
 * ```tsx
 * import { App } from "@/App"
 *
 * const element = <App />
 * console.log(element.type === App) // true
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function App() {
  return (
    <main>
      <h1>@beep/semantica</h1>
      <p>Desktop shell ready.</p>
    </main>
  );
}
