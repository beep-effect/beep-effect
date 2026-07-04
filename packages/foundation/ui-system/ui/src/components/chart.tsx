"use client";

import { cn } from "@beep/ui/lib/utils";
import { A, O, P, Str, Struct } from "@beep/utils";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type { TooltipValueType } from "recharts";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;
type TooltipNameType = number | string;

/**
 * Configuration describing each chart series' label, icon, and color or per-theme colors.
 *
 * @example
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
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> })
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (context === null) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

/**
 * Responsive chart wrapper that provides the chart config context and theme CSS variables.
 *
 * @example
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

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer initialDimension={initialDimension}>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// Conservative CSS identifier: only ASCII letters, digits, hyphen, underscore.
// Used to validate chart ids and config keys so they cannot break out of the
// surrounding selector/declaration when serialized into a raw <style> tag.
const CSS_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

// Characters that can terminate a CSS declaration, close a rule, open a comment,
// or break out of the <style> element. Any color/theme value containing one of
// these is rejected rather than serialized, preventing CSS rule breakout.
const CSS_VALUE_BREAKOUT_PATTERN = /[;{}<>\\]|\/\*|\*\//;

const isSafeCssIdentifier = (value: string): boolean => O.isSome(Str.match(CSS_IDENTIFIER_PATTERN)(value));

const isSafeCssColorValue = (value: string): boolean => O.isNone(Str.match(CSS_VALUE_BREAKOUT_PATTERN)(value));

// Strip everything that is not a safe CSS identifier character so the value can
// be embedded inside the quoted `[data-chart="..."]` attribute selector without
// allowing selector/rule breakout.
const sanitizeChartSelectorId = (id: string): string => Str.replace(/[^A-Za-z0-9_-]/g, "")(id);

/**
 * Injects per-theme CSS custom properties for a chart's configured series colors.
 *
 * @remarks
 * Chart ids, series keys, and color values are sanitized before they are
 * serialized into the generated style tag.
 *
 * @example
 * ```tsx
 * import { ChartStyle, type ChartConfig } from "@beep/ui/components/chart"
 *
 * const config = {
 *   revenue: { label: "Revenue", color: "hsl(210 90% 48%)" }
 * } satisfies ChartConfig
 *
 * export function StaticChartVariables() {
 *   return <ChartStyle id="revenue-chart" config={config} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const ChartStyle = ({ id, config }: { readonly id: string; readonly config: ChartConfig }) => {
  // Only keep entries whose key is a safe CSS identifier and that declare a
  // color/theme, so attacker-influenced config keys cannot break the rule body.
  const colorConfig = A.filter(
    Struct.entries(config),
    ([key, itemConfig]) => isSafeCssIdentifier(key) && (itemConfig.theme ?? itemConfig.color) !== undefined
  );

  if (colorConfig.length === 0) {
    return null;
  }

  const safeSelectorId = sanitizeChartSelectorId(id);

  return (
    <style
      // biome-ignore lint/security/noDangerouslySetInnerHtml: canonical shadcn ChartStyle pattern; id/keys/colors are sanitized (quoted+escaped selector, identifier-validated keys, breakout-rejected color values) before serialization
      dangerouslySetInnerHTML={{
        __html: A.join(
          A.map(
            Struct.entries(THEMES),
            ([theme, prefix]) => `
${prefix} [data-chart="${safeSelectorId}"] {
${A.join(
  A.map(colorConfig, ([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
    return color !== undefined && isSafeCssColorValue(color) ? `  --color-${key}: ${color};` : "";
  }),
  "\n"
)}
}
`
          ),
          "\n"
        ),
      }}
    />
  );
};

/**
 * Recharts tooltip primitive paired with {@link ChartTooltipContent}.
 *
 * @example
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

/**
 * Themed tooltip content for charts, rendering the active payload's label, indicator, and values.
 *
 * @example
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
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    readonly hideLabel?: boolean;
    readonly hideIndicator?: boolean;
    readonly indicator?: "line" | "dot" | "dashed";
    readonly nameKey?: string;
    readonly labelKey?: string;
  } & Omit<RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>, "accessibilityLayer">) {
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
          (item, index) => {
            const key = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color ?? item.payload?.fill ?? item.color;
            const ItemIcon = itemConfig?.icon;

            return (
              <div
                key={`${item.dataKey ?? item.name ?? index}`}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter !== undefined && item?.value !== undefined && item.name !== undefined ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {ItemIcon !== undefined ? (
                      <ItemIcon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          })}
                          style={
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
                      </div>
                      {item.value != null && (
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {P.isNumber(item.value)
                            ? item.value.toLocaleString()
                            : P.isString(item.value)
                              ? item.value
                              : A.join(
                                  A.map(item.value, (entry) => `${entry}`),
                                  ", "
                                )}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

/**
 * Recharts legend primitive paired with {@link ChartLegendContent}.
 *
 * @example
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
 * @example
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
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  readonly hideIcon?: boolean;
  readonly nameKey?: string;
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart();

  if ((payload?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
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
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
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
export { ChartContainer, ChartLegend, ChartLegendContent, ChartStyle, ChartTooltip, ChartTooltipContent };
