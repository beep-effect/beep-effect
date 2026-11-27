import { Browser } from "@beep/playwright/Browser";
import { PlaywrightSpawner } from "@beep/playwright/PlaywrightSpawner";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { chromium, chromiumInstalled, launchOptions } from "./support/Chromium.ts";

describe.skipIf(!chromiumInstalled)("Locator", () => {
  layer(PlaywrightSpawner.layer(chromium, launchOptions), { timeout: "60 seconds" })((it) => {
    it.effect(
      "reads the text of a located element",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();
          yield* page.goto("data:text/html,<title>Blank</title>");

          const titleText = yield* page.locator("title").textContent();
          assert.strictEqual(titleText, "Blank");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "evaluate runs a function on the matched element",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.evaluate(() => {
            document.body.innerHTML = `<div id="test">Test</div>`;
          });

          const result = yield* page.locator("#test").evaluate((el) => {
            el.style.color = "red";
            return el.style.color;
          });

          assert.strictEqual(result, "red");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "waitFor resolves once a hidden element becomes visible",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();
          yield* page.setContent(`<button id="hidden-btn" style="display: none;">Hidden</button>`);

          const btn = page.locator("#hidden-btn");

          yield* page.evaluate(() => {
            requestAnimationFrame(() => {
              const el = document.getElementById("hidden-btn");
              if (el !== null) el.style.display = "block";
            });
          });

          yield* btn.waitFor({ state: "visible" });

          const isVisible = yield* btn.evaluate((el) => el.style.display === "block");
          assert.isTrue(isVisible);
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "waitForFunction resolves once the predicate holds on the element",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();
          yield* page.setContent('<div id="status">Pending</div>');

          const status = page.locator("#status");
          const result = yield* status.waitForFunction((element, expected) => {
            if (!element.hasAttribute("data-update-scheduled")) {
              element.setAttribute("data-update-scheduled", "true");
              queueMicrotask(() => {
                element.textContent = expected;
              });
              return false;
            }
            return element.textContent === expected;
          }, "Ready");

          assert.isUndefined(result);
          const finalText = yield* status.textContent();
          assert.strictEqual(finalText, "Ready");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "evaluate and evaluateHandle expose function arguments",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();
          yield* page.setContent('<div id="message">hello</div>');

          const message = page.locator("#message");
          const evaluated = yield* message.evaluate(
            (element, transform) => transform(element.textContent ?? "missing"),
            (value: string) => `evaluated:${value}`,
            { exposeFunctions: true }
          );
          assert.strictEqual(evaluated, "evaluated:hello");

          const handle = yield* message.evaluateHandle(
            (element, transform) => transform(element.textContent ?? "missing"),
            (value: string) => `handled:${value}`,
            { exposeFunctions: true }
          );
          const handled = yield* Effect.promise(() => handle.jsonValue());
          assert.strictEqual(handled, "handled:hello");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "kitchensink of queries, state checks and evaluation",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.evaluate(() => {
            document.body.innerHTML = `
          <div id="container">
            <button id="btn-1" class="btn" data-info="first">Button 1</button>
            <button id="btn-2" class="btn" data-info="second">Button 2</button>
            <input id="input-1" value="initial value" />
            <div id="html-content"><span>Hello</span></div>
            <label>
              Username
              <input type="text" id="username-input" value="john_doe" />
            </label>
            <input type="text" id="search-input" placeholder="Search..." />
            <img src="dummy.png" alt="A test image" id="test-image" />
            <span title="Hover me" id="test-title">Tooltip</span>
            <div data-testid="custom-test-id" id="test-id-element">Test ID Element</div>
            <input type="checkbox" id="checkbox-1" />
          </div>
        `;
          });

          const buttons = page.locator(".btn");
          const input = page.locator("#input-1");
          const htmlDiv = page.locator("#html-content");

          const btn1Text = yield* buttons.first().textContent();
          assert.strictEqual(btn1Text, "Button 1");
          const btn2InnerText = yield* buttons.nth(1).innerText();
          assert.strictEqual(btn2InnerText, "Button 2");
          const htmlContent = yield* htmlDiv.innerHTML();
          assert.strictEqual(htmlContent, "<span>Hello</span>");
          const allTexts = yield* buttons.allInnerTexts;
          assert.deepEqual(allTexts, ["Button 1", "Button 2"]);
          const allTextContents = yield* buttons.allTextContents;
          assert.deepEqual(allTextContents, ["Button 1", "Button 2"]);

          const box = yield* buttons.first().boundingBox();
          const boxValue = yield* Effect.fromOption(box);
          assert.isNumber(boxValue.x);

          const snapshot = yield* buttons.first().ariaSnapshot();
          assert.isString(snapshot);

          const desc = buttons.first().describe("first button").description();
          assert.deepStrictEqual(desc, O.some("first button"));

          const btnCount = yield* buttons.count;
          assert.strictEqual(btnCount, 2);
          const btn1Attr = yield* buttons.first().getAttribute("data-info");
          assert.strictEqual(btn1Attr, "first");

          const initialValue = yield* input.inputValue();
          assert.strictEqual(initialValue, "initial value");
          yield* input.fill("new value");
          const newValue = yield* input.inputValue();
          assert.strictEqual(newValue, "new value");

          yield* page.evaluate(() => {
            document.body.dataset.clicked = "false";
            document.getElementById("btn-1")?.addEventListener("click", () => {
              document.body.dataset.clicked = "true";
            });
          });
          yield* buttons.first().click();
          const isClicked = yield* page.evaluate(() => document.body.dataset.clicked);
          assert.strictEqual(isClicked, "true");

          const checkbox = page.locator("#checkbox-1");
          const readChecked = checkbox.evaluate((el) => el instanceof HTMLInputElement && el.checked);
          const isCheckedInitial = yield* readChecked;
          assert.isFalse(isCheckedInitial);
          yield* checkbox.check();
          const isCheckedAfter = yield* readChecked;
          assert.isTrue(isCheckedAfter);

          const firstId = yield* buttons.first().getAttribute("id");
          assert.strictEqual(firstId, "btn-1");
          const lastId = yield* buttons.last().getAttribute("id");
          assert.strictEqual(lastId, "btn-2");
          const nthId = yield* buttons.nth(1).getAttribute("id");
          assert.strictEqual(nthId, "btn-2");

          const spanHtml = yield* htmlDiv.locator("span").innerHTML();
          assert.strictEqual(spanHtml, "Hello");
          const nestedSpanHtml = yield* htmlDiv.locator(page.locator("span")).innerHTML();
          assert.strictEqual(nestedSpanHtml, "Hello");

          const container = page.locator("#container");
          const btnRoleText = yield* container.getByRole("button", { name: "Button 1" }).textContent();
          assert.strictEqual(btnRoleText, "Button 1");
          const btnTextAttr = yield* container.getByText("Button 2").getAttribute("data-info");
          assert.strictEqual(btnTextAttr, "second");
          const usernameValue = yield* container.getByLabel("Username").inputValue();
          assert.strictEqual(usernameValue, "john_doe");
          const searchInputId = yield* container.getByPlaceholder("Search...").getAttribute("id");
          assert.strictEqual(searchInputId, "search-input");
          const testImageId = yield* container.getByAltText("A test image").getAttribute("id");
          assert.strictEqual(testImageId, "test-image");
          const testTitleId = yield* container.getByTitle("Hover me").getAttribute("id");
          assert.strictEqual(testTitleId, "test-title");
          const testIdElementId = yield* container.getByTestId("custom-test-id").getAttribute("id");
          assert.strictEqual(testIdElementId, "test-id-element");

          yield* buttons.first().highlight();
          yield* buttons.first().hideHighlight;

          const screenshotBuffer = yield* buttons.first().screenshot();
          assert.isAbove(screenshotBuffer.length, 0);

          const str = buttons.first().toString();
          assert.isTrue(Str.includes("locator")(str));

          const states = yield* Effect.all(
            {
              checked: checkbox.isChecked(),
              visible: buttons.first().isVisible(),
              hidden: buttons.first().isHidden(),
              enabled: buttons.first().isEnabled(),
              disabled: buttons.first().isDisabled(),
              editable: input.isEditable(),
            },
            { concurrency: 1 }
          );
          assert.deepStrictEqual(states, {
            checked: true,
            visible: true,
            hidden: false,
            enabled: true,
            disabled: false,
            editable: true,
          });

          const evalResult = yield* buttons
            .first()
            .evaluate((el, arg) => el.getAttribute("data-info") + arg, "-suffix");
          assert.strictEqual(evalResult, "first-suffix");

          const evalAllRes = yield* buttons.evaluateAll(
            (els, prefix) => Array.from(els, (el) => prefix + el.id),
            "id:"
          );
          assert.deepEqual(evalAllRes, ["id:btn-1", "id:btn-2"]);

          const handle = yield* buttons.first().evaluateHandle((el) => el);
          const handleRes = yield* page.evaluate((el) => el.id, handle);
          assert.strictEqual(handleRes, "btn-1");

          const elHandleOption = yield* buttons.first().elementHandle();
          const elHandle = yield* Effect.fromOption(elHandleOption);
          const elHandleRes = yield* Effect.promise(() => elHandle.evaluate((el) => el.id));
          assert.strictEqual(elHandleRes, "btn-1");

          const handles = yield* buttons.elementHandles;
          assert.strictEqual(handles.length, 2);
          const firstHandle = yield* Effect.fromOption(A.head(handles));
          const firstHandleId = yield* Effect.promise(() =>
            firstHandle.evaluate((el) => (el instanceof Element ? el.id : null))
          );
          assert.strictEqual(firstHandleId, "btn-1");

          const useResult = yield* buttons.first().use((l) => l.evaluate((el) => el.id));
          assert.strictEqual(useResult, "btn-1");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "all, and, filter, or, page, frameLocator and contentFrame",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.evaluate(() => {
            document.body.innerHTML = `
        <div id="container">
          <button id="btn-1" class="btn test-and">Button 1</button>
          <button id="btn-2" class="btn">Button 2</button>
          <iframe id="test-iframe" name="test-iframe" srcdoc="<body><div id='in-frame'>In Frame</div></body>"></iframe>
        </div>
      `;
          });

          const buttons = page.locator(".btn");

          const allLocators = yield* buttons.all;
          assert.strictEqual(allLocators.length, 2);
          const firstLocator = yield* Effect.fromOption(A.head(allLocators));
          const firstId = yield* firstLocator.getAttribute("id");
          assert.strictEqual(firstId, "btn-1");

          const filteredId = yield* buttons.filter({ hasText: "Button 1" }).getAttribute("id");
          assert.strictEqual(filteredId, "btn-1");
          const andId = yield* buttons.and(page.locator(".test-and")).getAttribute("id");
          assert.strictEqual(andId, "btn-1");
          const orCount = yield* page.locator("#btn-1").or(page.locator("#btn-2")).count;
          assert.strictEqual(orCount, 2);

          assert.isDefined(buttons.page());

          const frameLoc = page.locator("#container").frameLocator("#test-iframe");
          const inFrameText = yield* frameLoc.locator("#in-frame").textContent();
          assert.strictEqual(inFrameText, "In Frame");

          const contentFrame = page.locator("#test-iframe").contentFrame();
          const contentFrameText = yield* contentFrame.locator("#in-frame").textContent();
          assert.strictEqual(contentFrameText, "In Frame");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );

    it.effect(
      "action methods",
      () =>
        Effect.gen(function* () {
          const browser = yield* Browser;
          const page = yield* browser.newPage();

          yield* page.setContent(`
          <div id="new-methods-container" style="padding-top: 2000px;">
            <input type="text" id="input-blur" />
            <input type="text" id="input-clear" value="clear me" />
            <button id="btn-dblclick">DblClick</button>
            <div id="div-event">Event</div>
            <div id="div-drag-source" style="width:50px;height:50px;background:red;">Source</div>
            <div id="div-drag-target" style="width:50px;height:50px;background:blue;">Target</div>
            <input type="text" id="input-focus" />
            <div id="div-hover">Hover</div>
            <input type="text" id="input-press" />
            <input type="text" id="input-press-seq" />
            <div id="div-scroll">Scroll</div>
            <select id="select-option">
              <option value="opt1">Opt 1</option>
              <option value="opt2">Opt 2</option>
            </select>
            <div id="div-select-text">Some text to select</div>
            <input type="checkbox" id="checkbox-checked" />
            <input type="file" id="input-file" />
            <input type="checkbox" id="checkbox-uncheck" checked />
          </div>
        `);

          const inputBlur = page.locator("#input-blur");
          const isFocused = inputBlur.evaluate((el) => document.activeElement === el);
          yield* inputBlur.focus();
          const focusedAfterFocus = yield* isFocused;
          assert.isTrue(focusedAfterFocus);
          yield* inputBlur.blur();
          const focusedAfterBlur = yield* isFocused;
          assert.isFalse(focusedAfterBlur);

          const inputClear = page.locator("#input-clear");
          yield* inputClear.clear();
          const clearedValue = yield* inputClear.inputValue();
          assert.strictEqual(clearedValue, "");

          const btnDblclick = page.locator("#btn-dblclick");
          yield* btnDblclick.evaluate((el) => {
            el.setAttribute("data-dblclicked", "false");
            el.addEventListener("dblclick", () => {
              el.setAttribute("data-dblclicked", "true");
            });
          });
          yield* btnDblclick.dblclick();
          const dblclicked = yield* btnDblclick.evaluate((el) => el.getAttribute("data-dblclicked"));
          assert.strictEqual(dblclicked, "true");

          const divEvent = page.locator("#div-event");
          yield* divEvent.evaluate((el) => {
            el.setAttribute("data-custom-event-fired", "false");
            el.addEventListener("my-event", () => {
              el.setAttribute("data-custom-event-fired", "true");
            });
          });
          yield* divEvent.dispatchEvent("my-event");
          const eventFired = yield* divEvent.evaluate((el) => el.getAttribute("data-custom-event-fired"));
          assert.strictEqual(eventFired, "true");

          yield* page.locator("#div-drag-source").dragTo(page.locator("#div-drag-target"));

          const divHover = page.locator("#div-hover");
          yield* divHover.evaluate((el) => {
            el.setAttribute("data-hovered", "false");
            el.addEventListener("mouseenter", () => {
              el.setAttribute("data-hovered", "true");
            });
          });
          yield* divHover.hover();
          const hovered = yield* divHover.evaluate((el) => el.getAttribute("data-hovered"));
          assert.strictEqual(hovered, "true");

          const inputPress = page.locator("#input-press");
          yield* inputPress.press("A");
          const pressedValue = yield* inputPress.inputValue();
          assert.strictEqual(pressedValue, "A");

          const inputPressSeq = page.locator("#input-press-seq");
          yield* inputPressSeq.pressSequentially("Hello");
          const sequenceValue = yield* inputPressSeq.inputValue();
          assert.strictEqual(sequenceValue, "Hello");

          const divScroll = page.locator("#div-scroll");
          yield* divScroll.scrollIntoViewIfNeeded();
          const isIntersecting = yield* divScroll.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
          });
          assert.isTrue(isIntersecting);

          const selectOpt = page.locator("#select-option");
          const selected = yield* selectOpt.selectOption("opt2");
          assert.deepStrictEqual(selected, ["opt2"]);
          const selectValue = yield* selectOpt.evaluate((el: HTMLSelectElement) => el.value);
          assert.strictEqual(selectValue, "opt2");

          yield* page.locator("#div-select-text").selectText();
          const selectedText = yield* page.evaluate(() => window.getSelection()?.toString());
          assert.strictEqual(selectedText, "Some text to select");

          const checkboxChecked = page.locator("#checkbox-checked");
          yield* checkboxChecked.setChecked(true);
          const isChecked = yield* checkboxChecked.isChecked();
          assert.isTrue(isChecked);

          yield* page.locator("#input-file").setInputFiles({
            name: "test.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("test"),
          });

          const checkboxUncheck = page.locator("#checkbox-uncheck");
          yield* checkboxUncheck.uncheck();
          const isUnchecked = yield* checkboxUncheck.isChecked();
          assert.isFalse(isUnchecked);

          const context = yield* browser.newContext({ hasTouch: true });
          const mobilePage = yield* context.newPage;
          yield* mobilePage.setContent('<button id="btn-tap">Tap</button>');
          const btnTap = mobilePage.locator("#btn-tap");
          yield* btnTap.evaluate((el) => {
            el.setAttribute("data-tapped", "false");
            el.addEventListener("click", () => {
              el.setAttribute("data-tapped", "true");
            });
          });
          yield* btnTap.tap();
          const tapped = yield* btnTap.evaluate((el) => el.getAttribute("data-tapped"));
          assert.strictEqual(tapped, "true");
        }).pipe(PlaywrightSpawner.withBrowser),
      30_000
    );
  });
});
