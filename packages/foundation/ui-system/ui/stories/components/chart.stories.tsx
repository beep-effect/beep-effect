import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@beep/ui/components/chart";
import { A, Str } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import {
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LineChart,
  PieChart,
  Area as RechartsArea,
  Line as RechartsLine,
  Pie as RechartsPie,
  Sector,
  XAxis,
} from "recharts";
import { expect, within } from "storybook/test";
import type { ChartConfig } from "@beep/ui/components/chart";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PieSectorShapeProps } from "recharts";

/**
 * `ChartContainer` is the responsive root of the chart system, built on Recharts. It
 * provides the chart config context and injects per-series theme CSS variables
 * (`--color-<key>`) consumed by the underlying Recharts primitives. Compose it with
 * Recharts components (`BarChart`, `LineChart`, `AreaChart`, `PieChart`, axes, grids)
 * and the themed helpers `ChartTooltip` + `ChartTooltipContent` and `ChartLegend` +
 * `ChartLegendContent` to build a complete chart.
 *
 * The `config` prop maps each data series key to a `label`, optional `icon`, and a
 * `color` (or per-theme colors). Series fills then reference `var(--color-<key>)`.
 *
 * Imported from `@beep/ui/components/chart`.
 */
const chartData = [
  { desktop: 186, mobile: 80, month: "January" },
  { desktop: 305, mobile: 200, month: "February" },
  { desktop: 237, mobile: 120, month: "March" },
  { desktop: 73, mobile: 190, month: "April" },
  { desktop: 209, mobile: 130, month: "May" },
  { desktop: 214, mobile: 140, month: "June" },
] as const;

const chartConfig = {
  desktop: { color: "#2563eb", label: "Desktop" },
  mobile: { color: "#60a5fa", label: "Mobile" },
} satisfies ChartConfig;

const browserData = [
  { browser: "chrome", fill: "#2563eb", visitors: 275 },
  { browser: "safari", fill: "#60a5fa", visitors: 200 },
  { browser: "firefox", fill: "#93c5fd", visitors: 187 },
  { browser: "edge", fill: "#1d4ed8", visitors: 173 },
] as const;

const fallbackPieFill = "var(--color-chrome)";
const pieSectorFill = (index: number): string =>
  pipe(
    A.get(browserData, index),
    O.map((entry) => entry.fill),
    O.getOrElse(() => fallbackPieFill)
  );

const renderPieSector = (props: PieSectorShapeProps) => {
  const cornerRadiusProps = props.cornerRadius === undefined ? {} : { cornerRadius: props.cornerRadius };

  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={props.outerRadius}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      {...cornerRadiusProps}
      fill={pieSectorFill(props.index)}
    />
  );
};

const pieConfig = {
  chrome: { color: "#2563eb", label: "Chrome" },
  edge: { color: "#1d4ed8", label: "Edge" },
  firefox: { color: "#93c5fd", label: "Firefox" },
  safari: { color: "#60a5fa", label: "Safari" },
  visitors: { label: "Visitors" },
} satisfies ChartConfig;

const monthTickFormatter = (value: string): string => Str.slice(0, 3)(value);

// `ChartContainer` requires a single Recharts `children` element, so the story args type
// treats `children` as required. Every story supplies its own composition through `render`,
// so this default only satisfies the type and is never the rendered output.
const defaultChartChildren = (
  <BarChart accessibilityLayer data={[...chartData]}>
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
    <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} isAnimationActive={false} />
  </BarChart>
);

const meta = {
  args: {
    children: defaultChartChildren,
    className: "min-h-50 w-full max-w-xl",
    config: chartConfig,
    style: { height: 324, width: 576 },
  },
  argTypes: {
    children: {
      control: false,
      description: "A single Recharts chart element (e.g. `BarChart`, `LineChart`, `PieChart`).",
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the chart wrapper (e.g. sizing constraints).",
    },
    config: {
      control: false,
      description: "Maps each series key to its label, optional icon, and color (or per-theme colors).",
    },
    initialDimension: {
      control: false,
      description: "Starting width/height for the responsive container before layout is measured.",
      table: { defaultValue: { summary: "{ width: 320, height: 200 }" } },
    },
  },
  component: ChartContainer,
  tags: ["autodocs"],
  title: "Components/Data Display/Chart",
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical bar chart: two series rendered from `chartConfig`, each bar filled with
 * its `var(--color-<key>)` variable injected by the container.
 */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const chart = canvasElement.querySelector('[data-slot="chart"]');
    expect(chart).not.toBeNull();
    expect(chart).toHaveAttribute("data-chart");
  },
  render: (args) => (
    <ChartContainer {...args}>
      <BarChart accessibilityLayer data={[...chartData]}>
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  ),
};

/**
 * A bar chart with a labeled X axis and horizontal grid lines, the most common
 * dashboard configuration.
 */
export const BarWithAxis: Story = {
  render: (args) => (
    <ChartContainer {...args}>
      <BarChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  ),
};

/**
 * Adds the themed `ChartTooltip` with `ChartTooltipContent`, which reads the active
 * payload and renders each series' label, color indicator, and value on hover.
 */
export const WithTooltip: Story = {
  render: (args) => (
    <ChartContainer {...args}>
      <BarChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  ),
};

/**
 * Adds the themed `ChartLegend` with `ChartLegendContent`, which renders a swatch and
 * label for each configured series below the plot.
 */
export const WithLegend: Story = {
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const canvas = within(canvasElement);
        const desktop = yield* Effect.promise(() => canvas.findByText("Desktop"));
        expect(desktop).toBeVisible();
        const mobile = yield* Effect.promise(() => canvas.findByText("Mobile"));
        expect(mobile).toBeVisible();
      })
    ),
  render: (args) => (
    <ChartContainer {...args}>
      <BarChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  ),
};

/** A line chart driven by the same config, ideal for showing trends over time. */
export const Line: Story = {
  render: (args) => (
    <ChartContainer {...args}>
      <LineChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <RechartsLine
          dataKey="desktop"
          stroke="var(--color-desktop)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <RechartsLine
          dataKey="mobile"
          stroke="var(--color-mobile)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  ),
};

/** An area chart with stacked, semi-transparent fills for cumulative comparisons. */
export const Area: Story = {
  render: (args) => (
    <ChartContainer {...args}>
      <AreaChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <RechartsArea
          dataKey="mobile"
          type="natural"
          fill="var(--color-mobile)"
          fillOpacity={0.4}
          stroke="var(--color-mobile)"
          stackId="a"
          isAnimationActive={false}
        />
        <RechartsArea
          dataKey="desktop"
          type="natural"
          fill="var(--color-desktop)"
          fillOpacity={0.4}
          stroke="var(--color-desktop)"
          stackId="a"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  ),
};

/**
 * A pie chart where each slice references its own `fill` from the data, with a legend
 * mapping slices to their configured labels via `nameKey`.
 */
export const Pie: Story = {
  args: { className: "mx-auto", config: pieConfig, style: { height: 260, width: 260 } },
  play: ({ canvasElement }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const canvas = within(canvasElement);
        const chrome = yield* Effect.promise(() => canvas.findByText("Chrome"));
        expect(chrome).toBeVisible();
        const safari = yield* Effect.promise(() => canvas.findByText("Safari"));
        expect(safari).toBeVisible();
      })
    ),
  render: (args) => (
    <ChartContainer {...args}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="visitors" hideLabel />} />
        <RechartsPie
          data={[...browserData]}
          dataKey="visitors"
          nameKey="browser"
          shape={renderPieSector}
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent nameKey="browser" />} />
      </PieChart>
    </ChartContainer>
  ),
};

/**
 * The tooltip content supports three indicator styles. Here the `dashed` indicator is
 * paired with a single series, demonstrating the nested-label layout.
 */
export const DashedTooltip: Story = {
  render: (args) => (
    <ChartContainer {...args}>
      <BarChart accessibilityLayer data={[...chartData]}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={monthTickFormatter} />
        <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  ),
};
