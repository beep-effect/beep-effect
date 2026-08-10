/**
 * Sidebar primitive: a collapsible application sidebar with responsive mobile behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Str } from "@beep/utils";
import { make as makeScopedAtom, useAtom, useAtomMount, useAtomValue } from "@effect/atom-react";
import { ListIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import * as P from "effect/Predicate";
import { Atom } from "effect/unstable/reactivity";
import * as React from "react";
import { mediaQueryAtom } from "../internal/react-atoms.ts";
import { cn } from "../lib/index.ts";
import { requireReactContext } from "../lib/react-invariant.ts";
import { Button } from "./button";
import { Input } from "./input";
import { Separator } from "./separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import type { VariantProps } from "class-variance-authority";

const SIDEBAR_STORAGE_KEY = "sidebar_state";
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

const randomIntBelow = (maxExclusive: number): number => {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(values);
  return (values[0] ?? 0) % maxExclusive;
};

type SidebarContextValue = {
  readonly state: "expanded" | "collapsed";
  readonly open: boolean;
  readonly setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  readonly openMobile: boolean;
  readonly setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void;
  readonly isMobile: boolean;
  readonly toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

type SidebarState = {
  readonly open: boolean;
  readonly openMobile: boolean;
};

const SidebarScope = makeScopedAtom((defaultOpen: boolean) =>
  Atom.make<SidebarState>({
    open: defaultOpen,
    openMobile: false,
  })
);

const SidebarMenuSkeletonScope = makeScopedAtom(() => Atom.make(`${randomIntBelow(40) + 50}%`));

const sidebarStorageHydrationAtom = Atom.family((stateAtom: Atom.Writable<SidebarState, SidebarState>) =>
  Atom.make((get) => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (P.isNotNull(stored)) {
        get.set(stateAtom, { ...get.once(stateAtom), open: stored === "true" });
      }
    } catch {
      // localStorage may be unavailable
    }
  })
);

/**
 * Use sidebar hook.
 *
 * **Example** (Import useSidebar hook)
 *
 * ```tsx
 * import { useSidebar } from "@beep/ui/components/sidebar"
 *
 * console.log(useSidebar)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
function useSidebar() {
  const context = React.useContext(SidebarContext);
  return requireReactContext(context, { message: "useSidebar must be used within a SidebarProvider." });
}

interface SidebarProviderProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly defaultOpen?: undefined | boolean;
  readonly onOpenChange?: undefined | ((open: boolean) => void);
  readonly open?: undefined | boolean;
}

/**
 * Sidebar provider export.
 *
 * **Example** (Import SidebarProvider export)
 *
 * ```tsx
 * import { SidebarProvider } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarProvider)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
function SidebarProvider({ defaultOpen = true, ...props }: SidebarProviderProps) {
  return (
    <SidebarScope.Provider value={defaultOpen}>
      <SidebarProviderInner {...props} />
    </SidebarScope.Provider>
  );
}

function SidebarProviderInner({
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const stateAtom = SidebarScope.use();
  const [sidebarState, setSidebarState] = useAtom(stateAtom);
  const isMobile = useAtomValue(mediaQueryAtom("(max-width: 768px)"));
  const open = openProp ?? sidebarState.open;
  const openMobile = sidebarState.openMobile;

  const storageHydrationAtom = sidebarStorageHydrationAtom(stateAtom);
  useAtomMount(storageHydrationAtom);

  const setOpenMobile = (value: boolean | ((value: boolean) => boolean)) => {
    setSidebarState((state) => ({
      ...state,
      openMobile: P.isFunction(value) ? value(state.openMobile) : value,
    }));
  };

  const setOpen = (value: boolean | ((value: boolean) => boolean)) => {
    if (setOpenProp !== undefined) {
      const openState = P.isFunction(value) ? value(open) : value;
      setOpenProp(openState);
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(openState));
      } catch {
        // localStorage may be unavailable in some contexts
      }
    } else {
      setSidebarState((state) => {
        const openState = P.isFunction(value) ? value(state.open) : value;
        try {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(openState));
        } catch {
          // localStorage may be unavailable in some contexts
        }
        return { ...state, open: openState };
      });
    }
  };

  const toggleSidebar = () => (isMobile ? setOpenMobile((current) => !current) : setOpen((current) => !current));

  useAtomMount(
    Atom.make((get) => {
      if (typeof window === "undefined") {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          toggleSidebar();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      get.addFinalizer(() => window.removeEventListener("keydown", handleKeyDown));
    })
  );

  const state = open ? "expanded" : "collapsed";

  const contextValue: SidebarContextValue = {
    state,
    open,
    setOpen,
    isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper text-sidebar-foreground has-data-[variant=inset]:bg-sidebar has-data-[variant=floating]:bg-sidebar flex min-h-svh w-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

interface SidebarProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly collapsible?: undefined | "offcanvas" | "icon" | "none";
  readonly fixed?: undefined | boolean;
  readonly side?: undefined | "left" | "right";
  readonly variant?: undefined | "sidebar" | "floating" | "inset";
}

/**
 * Sidebar component.
 *
 * **Example** (Import Sidebar component)
 *
 * ```tsx
 * import { Sidebar } from "@beep/ui/components/sidebar"
 *
 * console.log(Sidebar)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  fixed = true,
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn("bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col", className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            data-slot="sidebar-backdrop"
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <div
          data-slot="sidebar"
          data-mobile="true"
          data-state={openMobile ? "open" : "closed"}
          className={cn(
            "bg-sidebar text-sidebar-foreground fixed inset-y-0 z-50 flex h-svh w-(--sidebar-width) flex-col transition-transform duration-200 ease-in-out",
            side === "left"
              ? "left-0 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
              : "right-0 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
            className
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          {...props}
        >
          {children}
        </div>
      </>
    );
  }

  // Non-fixed (relative) positioning for embedded sidebars
  if (!fixed) {
    return (
      <div
        data-slot="sidebar-container"
        className={cn("group peer text-sidebar-foreground hidden overflow-hidden md:flex", className)}
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : Str.empty}
        data-variant={variant}
        data-side={side}
      >
        <div
          data-slot="sidebar"
          className={cn(
            "relative h-full w-(--sidebar-width) shrink-0 transition-[width] duration-200 ease-linear md:flex",
            "group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:overflow-hidden",
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
            variant === "floating" || variant === "inset" ? "p-2" : Str.empty
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className={cn(
              "bg-sidebar flex h-full w-full flex-col overflow-hidden",
              variant === "floating"
                ? "border-sidebar-border rounded-lg border shadow-sm"
                : "border-r border-sidebar-border"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Fixed positioning (default behavior)
  return (
    <div
      data-slot="sidebar-container"
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : Str.empty}
      data-variant={variant}
      data-side={side}
    >
      {/* This handles the sidebar gap on desktop */}
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            "bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar trigger component.
 *
 * **Example** (Import SidebarTrigger component)
 *
 * ```tsx
 * import { SidebarTrigger } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarTrigger({ className, onClick, ...props }: React.ComponentPropsWithoutRef<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <ListIcon className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

/**
 * Sidebar rail component.
 *
 * **Example** (Import SidebarRail component)
 *
 * ```tsx
 * import { SidebarRail } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarRail)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarRail({ className, ...props }: React.ComponentPropsWithoutRef<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-slot="sidebar-rail"
      type="button"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "cursor-pointer",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar inset component.
 *
 * **Example** (Import SidebarInset component)
 *
 * ```tsx
 * import { SidebarInset } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarInset)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarInset({ className, ...props }: React.ComponentPropsWithoutRef<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-sidebar relative flex w-full min-w-0 flex-1 flex-col overflow-hidden",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar input component.
 *
 * **Example** (Import SidebarInput component)
 *
 * ```tsx
 * import { SidebarInput } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarInput)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      className={cn("bg-background h-8 w-full shadow-none focus-visible:ring-2", className)}
      {...props}
    />
  );
}

/**
 * Sidebar header component.
 *
 * **Example** (Import SidebarHeader component)
 *
 * ```tsx
 * import { SidebarHeader } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 overflow-hidden p-2", className)} {...props} />
  );
}

/**
 * Sidebar footer component.
 *
 * **Example** (Import SidebarFooter component)
 *
 * ```tsx
 * import { SidebarFooter } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex shrink-0 flex-col gap-2 overflow-hidden p-2", className)}
      {...props}
    />
  );
}

/**
 * Sidebar separator component.
 *
 * **Example** (Import SidebarSeparator component)
 *
 * ```tsx
 * import { SidebarSeparator } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof Separator>) {
  return (
    <Separator data-slot="sidebar-separator" className={cn("bg-sidebar-border mx-2 w-auto", className)} {...props} />
  );
}

/**
 * Sidebar content component.
 *
 * **Example** (Import SidebarContent component)
 *
 * ```tsx
 * import { SidebarContent } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarContent({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar group component.
 *
 * **Example** (Import SidebarGroup component)
 *
 * ```tsx
 * import { SidebarGroup } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarGroup({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...props} />
  );
}

/**
 * Sidebar group label component.
 *
 * **Example** (Import SidebarGroupLabel component)
 *
 * ```tsx
 * import { SidebarGroupLabel } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarGroupLabel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarGroupLabel({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar group action component.
 *
 * **Example** (Import SidebarGroupAction component)
 *
 * ```tsx
 * import { SidebarGroupAction } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarGroupAction)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarGroupAction({ className, ...props }: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      data-slot="sidebar-group-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar group content component.
 *
 * **Example** (Import SidebarGroupContent component)
 *
 * ```tsx
 * import { SidebarGroupContent } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarGroupContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarGroupContent({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />;
}

/**
 * Sidebar menu component.
 *
 * **Example** (Import SidebarMenu component)
 *
 * ```tsx
 * import { SidebarMenu } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenu)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenu({ className, ...props }: React.ComponentPropsWithoutRef<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1", className)} {...props} />;
}

/**
 * Sidebar menu item component.
 *
 * **Example** (Import SidebarMenuItem component)
 *
 * ```tsx
 * import { SidebarMenuItem } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuItem({ className, ...props }: React.ComponentPropsWithoutRef<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden transition-[width,height,padding] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface SidebarMenuButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof sidebarMenuButtonVariants> {
  readonly isActive?: undefined | boolean;
  readonly tooltip?: undefined | string | React.ComponentPropsWithoutRef<typeof TooltipContent>;
}

/**
 * Sidebar menu button component.
 *
 * **Example** (Import SidebarMenuButton component)
 *
 * ```tsx
 * import { SidebarMenuButton } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuButton({
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { isMobile, state } = useSidebar();

  const button = (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (tooltip === undefined) {
    return button;
  }

  const tooltipProps = P.isString(tooltip) ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <TooltipTrigger render={button}>{/* render prop handles the trigger element */}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        className={cn(state === "expanded" || isMobile ? "hidden" : Str.empty)}
        {...tooltipProps}
      />
    </Tooltip>
  );
}

/**
 * Sidebar menu action component.
 *
 * **Example** (Import SidebarMenuAction component)
 *
 * ```tsx
 * import { SidebarMenuAction } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuAction)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuAction({
  className,
  showOnHover = false,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  readonly showOnHover?: undefined | boolean;
}) {
  return (
    <button
      type="button"
      data-slot="sidebar-menu-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar menu badge component.
 *
 * **Example** (Import SidebarMenuBadge component)
 *
 * ```tsx
 * import { SidebarMenuBadge } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuBadge)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuBadge({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      className={cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar menu skeleton component.
 *
 * **Example** (Import SidebarMenuSkeleton component)
 *
 * ```tsx
 * import { SidebarMenuSkeleton } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuSkeleton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuSkeleton({
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  readonly showIcon?: undefined | boolean;
}) {
  return (
    <SidebarMenuSkeletonScope.Provider>
      <SidebarMenuSkeletonInner {...props} />
    </SidebarMenuSkeletonScope.Provider>
  );
}

function SidebarMenuSkeletonInner({
  className,
  showIcon = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  readonly showIcon?: undefined | boolean;
}) {
  const width = useAtomValue(SidebarMenuSkeletonScope.use());

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <div className="bg-sidebar-accent-foreground/10 size-4 shrink-0 rounded-md" />}
      <div
        className="bg-sidebar-accent-foreground/10 h-4 max-w-(--skeleton-width) flex-1 rounded-md"
        style={{ "--skeleton-width": width } as React.CSSProperties}
      />
    </div>
  );
}

/**
 * Sidebar menu sub component.
 *
 * **Example** (Import SidebarMenuSub component)
 *
 * ```tsx
 * import { SidebarMenuSub } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuSub)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuSub({ className, ...props }: React.ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sidebar menu sub item component.
 *
 * **Example** (Import SidebarMenuSubItem component)
 *
 * ```tsx
 * import { SidebarMenuSubItem } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuSubItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuSubItem({ className, ...props }: React.ComponentPropsWithoutRef<"li">) {
  return <li data-slot="sidebar-menu-sub-item" className={cn(className)} {...props} />;
}

/**
 * Sidebar menu sub button component.
 *
 * **Example** (Import SidebarMenuSubButton component)
 *
 * ```tsx
 * import { SidebarMenuSubButton } from "@beep/ui/components/sidebar"
 *
 * console.log(SidebarMenuSubButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SidebarMenuSubButton({
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"a"> & {
  readonly size?: undefined | "sm" | "md";
  readonly isActive?: undefined | boolean;
}) {
  return (
    <a
      data-slot="sidebar-menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
