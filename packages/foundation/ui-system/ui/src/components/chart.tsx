/**
 * Chart primitive: Recharts container wiring shared theme colors and tooltip/legend styling to a `ChartConfig`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { cn } from "@beep/ui/lib/utils";
import { A, O, P, R, Str, Struct } from "@beep/utils";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { requireReactContext } from "../lib/react-invariant.ts";
import type { TooltipValueType } from "recharts";

// The two color schemes a series may set a color for. The theme stylesheet sets
// `color-scheme` on `:root` and `.dark`, so `light-dark()` picks the matching one.
type ChartTheme = "light" | "dark";

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;
type TooltipNameType = number | string;
type ChartTooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    readonly hideLabel?: boolean;
    readonly hideIndicator?: boolean;
    readonly indicator?: "line" | "dot" | "dashed";
    readonly nameKey?: string;
    readonly labelKey?: string;
  } & Omit<RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>, "accessibilityLayer">;
type ChartTooltipPayloadItem = NonNullable<ChartTooltipContentProps["payload"]>[number];

/**
 * Configuration describing each chart series' label, icon, and color or per-theme colors.
 *
 * **Example** (Series labels and theme colors)
 *
 * ```tsx
 * import type { ChartConfig } from "@beep/ui/components/chart"
 *
 * const config = {
 *   revenue: { label: "Revenue", color: "var(--chart-1)" },
 *   expenses: {
 *     label: "Expenses",
 *     theme: { light: "var(--chart-2)", dark: "var(--chart-3)" }
 *   }
 * } satisfies ChartConfig
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<ChartTheme, string> })
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  return requireReactContext(context, { message: "useChart must be used within a <ChartContainer />" });
}

/**
 * Responsive chart wrapper that provides the chart config context and theme CSS variables.
 *
 * **Example** (Line chart with config context)
 *
 * ```tsx
 * import { ChartContainer, type ChartConfig } from "@beep/ui/components/chart"
 * import { Line, LineChart } from "recharts"
 *
 * const config = {
 *   revenue: { label: "Revenue", color: "var(--chart-1)" }
 * } satisfies ChartConfig
 *
 * export function RevenueChart() {
 *   return (
 *     <ChartContainer config={config}>
 *       <LineChart data={[{ month: "Jul", revenue: 4200 }]}>
 *         <Line dataKey="revenue" stroke="var(--color-revenue)" />
 *       </LineChart>
 *     </ChartContainer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  style,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<"div"> & {
  readonly config: ChartConfig;
  readonly children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  readonly initialDimension?: {
    readonly width: number;
    readonly height: number;
  };
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? Str.replace(/:/g, "")(uniqueId)}`;
  // The series colors are custom properties named after the config keys, so they cannot be a
  // literal style object. They ride on the container's props instead: present in the server
  // markup, and diffed by React when the config changes. No stylesheet is generated at runtime.
  const surfaceProps = chartSurfaceProps(config, style);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground dark:[&_.recharts-cartesian-axis-tick-value]:fill-foreground/60 [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 dark:[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-foreground/20 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden [&_.recharts-tooltip-wrapper]:transition-none!",
          className
        )}
        {...props}
        {...surfaceProps}
      >
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// Conservative CSS identifier: only ASCII letters, digits, hyphen, underscore.
// Config keys become custom property names, so anything else is skipped.
const CSS_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

const isSafeCssIdentifier = (value: string): boolean => O.isSome(Str.match(CSS_IDENTIFIER_PATTERN)(value));

/**
 * The `--color-<series>` custom properties a chart container sets for its config.
 *
 * **Details**
 *
 * A series with a single `color` maps to that color. A series with a per-theme
 * `theme` pair maps to `light-dark(light, dark)`, which resolves against the
 * `color-scheme` the theme stylesheet sets on `:root` and `.dark`. Series keys
 * that are not plain CSS identifiers are skipped.
 *
 * **Example** (Series color properties)
 *
 * ```tsx
 * import { chartColorProperties, type ChartConfig } from "@beep/ui/components/chart"
 *
 * const config = {
 *   revenue: { label: "Revenue", color: "var(--chart-1)" },
 *   expenses: { label: "Expenses", theme: { light: "var(--chart-2)", dark: "var(--chart-3)" } }
 * } satisfies ChartConfig
 *
 * console.log(chartColorProperties(config))
 * // [["--color-revenue", "var(--chart-1)"], ["--color-expenses", "light-dark(var(--chart-2), var(--chart-3))"]]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const chartColorProperties = (config: ChartConfig): ReadonlyArray<readonly [string, string]> =>
  A.flatMap(Struct.entries(config), ([key, itemConfig]): ReadonlyArray<readonly [string, string]> => {
    if (!isSafeCssIdentifier(key)) return [];
    if (itemConfig.theme !== undefined) {
      return [[`--color-${key}`, `light-dark(${itemConfig.theme.light}, ${itemConfig.theme.dark})`]];
    }
    return itemConfig.color === undefined ? [] : [[`--color-${key}`, itemConfig.color]];
  });

// The container's `style` prop: the series color properties first, then the caller's own style.
const chartSurfaceProps = (
  config: ChartConfig,
  style: React.CSSProperties | undefined
): { readonly style: React.CSSProperties } => ({
  style: { ...R.fromEntries(chartColorProperties(config)), ...style },
});

/**
 * Recharts tooltip primitive paired with {@link ChartTooltipContent}.
 *
 * **Example** (Bar chart with tooltip)
 *
 * ```tsx
 * import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@beep/ui/components/chart"
 * import { Bar, BarChart } from "recharts"
 *
 * const config = {
 *   cases: { label: "Cases", color: "var(--chart-1)" }
 * } satisfies ChartConfig
 *
 * export function CasesTooltipChart() {
 *   return (
 *     <ChartContainer config={config}>
 *       <BarChart data={[{ week: "W1", cases: 8 }]}>
 *         <ChartTooltip content={<ChartTooltipContent />} />
 *         <Bar dataKey="cases" fill="var(--color-cases)" />
 *       </BarChart>
 *     </ChartContainer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ChartTooltip = RechartsPrimitive.Tooltip;

function formatTooltipValue(value: TooltipValueType): React.ReactNode {
  if (P.isNumber(value)) return value.toLocaleString();
  if (P.isString(value)) return value;
  return A.join(
    A.map(value, (entry) => `${entry}`),
    ", "
  );
}

const tooltipIndicatorClasses = {
  dot: "h-2.5 w-2.5",
  line: "w-1",
  dashed: "w-0 border-indicator border-dashed bg-transparent",
} as const;

const tooltipIndicatorNestClass = (nestLabel: boolean, indicator: "line" | "dot" | "dashed") =>
  nestLabel && indicator === "dashed" ? "my-0.5" : undefined;

function ChartTooltipIndicatorMark({
  indicator,
  indicatorColor,
  nestLabel,
}: {
  readonly indicator: "line" | "dot" | "dashed";
  readonly indicatorColor: string | undefined;
  readonly nestLabel: boolean;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-xs border-(--color-border) bg-(--color-bg)",
        tooltipIndicatorClasses[indicator],
        tooltipIndicatorNestClass(nestLabel, indicator)
      )}
      style={
        {
          "--color-bg": indicatorColor,
          "--color-border": indicatorColor,
        } as React.CSSProperties
      }
    />
  );
}

function ChartTooltipIndicator({
  itemConfig,
  hideIndicator,
  indicator,
  indicatorColor,
  nestLabel,
}: {
  readonly itemConfig: ChartConfig[string] | undefined;
  readonly hideIndicator: boolean;
  readonly indicator: "line" | "dot" | "dashed";
  readonly indicatorColor: string | undefined;
  readonly nestLabel: boolean;
}) {
  const ItemIcon = itemConfig?.icon;
  if (ItemIcon !== undefined) return <ItemIcon />;
  if (hideIndicator) return null;
  return <ChartTooltipIndicatorMark indicator={indicator} indicatorColor={indicatorColor} nestLabel={nestLabel} />;
}

const formatTooltipItem = (
  formatter: ChartTooltipContentProps["formatter"],
  item: ChartTooltipPayloadItem,
  index: number
): O.Option<React.ReactNode> => {
  if (formatter === undefined || item.value === undefined || item.name === undefined) return O.none();
  return O.some(formatter(item.value, item.name, item, index, item.payload));
};

const tooltipItemKey = (nameKey: string | undefined, item: ChartTooltipPayloadItem): string =>
  `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;

const tooltipItemIndicatorColor = (color: string | undefined, item: ChartTooltipPayloadItem): string | undefined =>
  color ?? item.payload?.fill ?? item.color;

function ChartTooltipLabels({
  item,
  itemConfig,
  nestLabel,
  tooltipLabel,
}: {
  readonly item: ChartTooltipPayloadItem;
  readonly itemConfig: ChartConfig[string] | undefined;
  readonly nestLabel: boolean;
  readonly tooltipLabel: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      {nestLabel ? tooltipLabel : null}
      <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
    </div>
  );
}

function ChartTooltipValue({ item }: { readonly item: ChartTooltipPayloadItem }) {
  if (item.value == null) return null;
  return <span className="font-mono font-medium text-foreground tabular-nums">{formatTooltipValue(item.value)}</span>;
}

function ChartTooltipDefaultItem({
  item,
  itemConfig,
  indicatorColor,
  hideIndicator,
  indicator,
  nestLabel,
  tooltipLabel,
}: {
  readonly item: ChartTooltipPayloadItem;
  readonly itemConfig: ChartConfig[string] | undefined;
  readonly indicatorColor: string | undefined;
  readonly hideIndicator: boolean;
  readonly indicator: "line" | "dot" | "dashed";
  readonly nestLabel: boolean;
  readonly tooltipLabel: React.ReactNode;
}) {
  return (
    <>
      <ChartTooltipIndicator
        itemConfig={itemConfig}
        hideIndicator={hideIndicator}
        indicator={indicator}
        indicatorColor={indicatorColor}
        nestLabel={nestLabel}
      />
      <div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
        <ChartTooltipLabels item={item} itemConfig={itemConfig} nestLabel={nestLabel} tooltipLabel={tooltipLabel} />
        <ChartTooltipValue item={item} />
      </div>
    </>
  );
}

function ChartTooltipItem({
  item,
  index,
  config,
  formatter,
  color,
  hideIndicator,
  indicator,
  nameKey,
  nestLabel,
  tooltipLabel,
}: {
  readonly item: ChartTooltipPayloadItem;
  readonly index: number;
  readonly config: ChartConfig;
  readonly formatter: ChartTooltipContentProps["formatter"];
  readonly color: string | undefined;
  readonly hideIndicator: boolean;
  readonly indicator: "line" | "dot" | "dashed";
  readonly nameKey: string | undefined;
  readonly nestLabel: boolean;
  readonly tooltipLabel: React.ReactNode;
}) {
  const key = tooltipItemKey(nameKey, item);
  const itemConfig = getPayloadConfigFromPayload(config, item, key);
  const indicatorColor = tooltipItemIndicatorColor(color, item);
  const formatted = formatTooltipItem(formatter, item, index);

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
        indicator === "dot" && "items-center"
      )}
    >
      {O.getOrElse(formatted, () => (
        <ChartTooltipDefaultItem
          item={item}
          itemConfig={itemConfig}
          indicatorColor={indicatorColor}
          hideIndicator={hideIndicator}
          indicator={indicator}
          nestLabel={nestLabel}
          tooltipLabel={tooltipLabel}
        />
      ))}
    </div>
  );
}

/**
 * Themed tooltip content for charts, rendering the active payload's label, indicator, and values.
 *
 * **Example** (Tooltip with line indicator)
 *
 * ```tsx
 * import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@beep/ui/components/chart"
 * import { Line, LineChart } from "recharts"
 *
 * const config = {
 *   signed: { label: "Signed", color: "var(--chart-2)" }
 * } satisfies ChartConfig
 *
 * export function SignedTooltipChart() {
 *   return (
 *     <ChartContainer config={config}>
 *       <LineChart data={[{ month: "Jul", signed: 14 }]}>
 *         <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
 *         <Line dataKey="signed" stroke="var(--color-signed)" />
 *       </LineChart>
 *     </ChartContainer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  const tooltipLabel = (() => {
    if (hideLabel || (payload?.length ?? 0) === 0) {
      return null;
    }

    const [item] = payload ?? [];
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value = labelKey === undefined && P.isString(label) ? (config[label]?.label ?? label) : itemConfig?.label;

    if (labelFormatter !== undefined) {
      return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload ?? [])}</div>;
    }

    if (value === undefined || value === null) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  })();

  if (active !== true || (payload?.length ?? 0) === 0) {
    return null;
  }

  const items = payload ?? [];
  const nestLabel = items.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {A.map(
          A.filter(items, (item) => item.type !== "none"),
          (item, index) => (
            <ChartTooltipItem
              key={`${item.dataKey ?? item.name ?? index}`}
              item={item}
              index={index}
              config={config}
              formatter={formatter}
              color={color}
              hideIndicator={hideIndicator}
              indicator={indicator}
              nameKey={nameKey}
              nestLabel={nestLabel}
              tooltipLabel={tooltipLabel}
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * Recharts legend primitive paired with {@link ChartLegendContent}.
 *
 * **Example** (Area chart with legend)
 *
 * ```tsx
 * import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from "@beep/ui/components/chart"
 * import { Area, AreaChart } from "recharts"
 *
 * const config = {
 *   active: { label: "Active", color: "var(--chart-1)" }
 * } satisfies ChartConfig
 *
 * export function ActiveLegendChart() {
 *   return (
 *     <ChartContainer config={config}>
 *       <AreaChart data={[{ month: "Jul", active: 32 }]}>
 *         <ChartLegend content={<ChartLegendContent />} />
 *         <Area dataKey="active" fill="var(--color-active)" />
 *       </AreaChart>
 *     </ChartContainer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ChartLegend = RechartsPrimitive.Legend;

/**
 * Themed legend content for charts, rendering each series' icon or color swatch and label.
 *
 * **Example** (Legend without series icons)
 *
 * ```tsx
 * import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from "@beep/ui/components/chart"
 * import { Bar, BarChart } from "recharts"
 *
 * const config = {
 *   open: { label: "Open", color: "var(--chart-1)" },
 *   closed: { label: "Closed", color: "var(--chart-2)" }
 * } satisfies ChartConfig
 *
 * export function MatterLegendChart() {
 *   return (
 *     <ChartContainer config={config}>
 *       <BarChart data={[{ month: "Jul", open: 12, closed: 7 }]}>
 *         <ChartLegend content={<ChartLegendContent hideIcon />} />
 *         <Bar dataKey="open" fill="var(--color-open)" />
 *         <Bar dataKey="closed" fill="var(--color-closed)" />
 *       </BarChart>
 *     </ChartContainer>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  position = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  readonly hideIcon?: boolean;
  readonly nameKey?: string;
  readonly position?: RechartsPrimitive.DefaultLegendContentProps["verticalAlign"];
} & Omit<RechartsPrimitive.DefaultLegendContentProps, "verticalAlign">) {
  const { config } = useChart();

  if ((payload?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-center gap-4", position === "top" ? "pb-3" : "pt-3", className)}>
      {A.map(
        A.filter(payload ?? [], (item) => item.type !== "none"),
        (item, index) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          const LegendIcon = itemConfig?.icon;

          return (
            <div
              key={`${item.dataKey ?? index}`}
              className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}
            >
              {LegendIcon !== undefined && !hideIcon ? (
                <LegendIcon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-xs bg-(--color-bg)"
                  style={{ "--color-bg": item.color } as React.CSSProperties}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        }
      )}
    </div>
  );
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
  if (!P.isObject(payload)) {
    return undefined;
  }

  const payloadPayload = "payload" in payload && P.isObject(payload.payload) ? payload.payload : undefined;

  let configLabelKey: string = key;

  if (key in payload && P.isString(payload[key as keyof typeof payload])) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload !== undefined &&
    key in payloadPayload &&
    P.isString(payloadPayload[key as keyof typeof payloadPayload])
  ) {
    configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

/**
 * @category components
 * @since 0.0.0
 */
export { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, chartColorProperties };
