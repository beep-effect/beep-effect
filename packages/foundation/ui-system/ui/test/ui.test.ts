import { VERSION } from "@beep/ui";
import { ChartContainer, ChartTooltipContent } from "@beep/ui/components/chart";
import { Input } from "@beep/ui/components/input";
import { Textarea } from "@beep/ui/components/textarea";
import { cn } from "@beep/ui/lib/utils";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const renderChartTooltip = (formatter?: () => React.ReactNode) =>
  renderToStaticMarkup(
    createElement(ChartContainer, {
      config: { desktop: { label: "Desktop" } },
      children: createElement(ChartTooltipContent, {
        active: true,
        hideLabel: true,
        payload: [{ name: "desktop", value: 123, payload: { desktop: 123 } }],
        ...(formatter === undefined ? {} : { formatter }),
      }),
    })
  );

describe("@beep/ui", () => {
  it("uses the default tooltip item only when no formatter is supplied", () => {
    const markup = renderChartTooltip();
    expect(markup).toContain("Desktop");
    expect(markup).toContain(">123</span>");
  });

  it.each([null, undefined])("preserves a formatter result of %s to suppress the tooltip item", (formatted) => {
    const markup = renderChartTooltip(() => formatted);
    expect(markup).not.toContain("Desktop");
    expect(markup).not.toContain(">123</span>");
  });

  it("preserves a zero-valued formatter result", () => {
    const markup = renderChartTooltip(() => 0);
    expect(markup).toContain(">0</div>");
    expect(markup).not.toContain("Desktop");
  });

  it("exports the package version constant", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it("merges tailwind classes with conflict resolution", () => {
    const optionalHiddenClass: false | string = false;

    expect(cn("px-2 py-1", "px-4", optionalHiddenClass, ["text-sm"])).toBe("py-1 px-4 text-sm");
  });

  it("renders input validation, form attributes, and caller styling", () => {
    const markup = renderToStaticMarkup(
      createElement(Input, {
        type: "email",
        name: "email",
        defaultValue: "person@example.com",
        "aria-invalid": true,
        disabled: true,
        className: "h-12",
        style: { width: 240 },
      })
    );

    expect(markup).toContain('data-slot="input"');
    expect(markup).toContain('type="email"');
    expect(markup).toContain('name="email"');
    expect(markup).toContain('value="person@example.com"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('style="width:240px"');
    expect(markup).toContain("h-12");
    expect(markup).not.toContain(" h-8 ");
  });

  it("renders an input when no inline style is supplied", () => {
    const markup = renderToStaticMarkup(createElement(Input, { name: "title", defaultValue: "Draft" }));

    expect(markup).toContain('name="title"');
    expect(markup).toContain('value="Draft"');
    expect(markup).not.toContain("style=");
  });

  it("renders textarea form attributes and escapes its initial content", () => {
    const markup = renderToStaticMarkup(
      createElement(Textarea, {
        name: "notes",
        rows: 4,
        defaultValue: "<draft> & notes",
        "aria-label": "Notes",
        disabled: true,
        className: "min-h-32",
      })
    );

    expect(markup).toContain('data-slot="textarea"');
    expect(markup).toContain('name="notes"');
    expect(markup).toContain('rows="4"');
    expect(markup).toContain('aria-label="Notes"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("&lt;draft&gt; &amp; notes</textarea>");
    expect(markup).toContain("min-h-32");
    expect(markup).not.toContain("min-h-16");
  });
});
