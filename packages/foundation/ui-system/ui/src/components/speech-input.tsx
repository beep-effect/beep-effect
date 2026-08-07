/**
 * Speech-input primitive: a push-to-talk button that streams a live transcript preview.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { useScribe } from "@beep/ui/hooks/use-scribe";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { MicrophoneIcon, SquareIcon, XIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { motion } from "framer-motion";
import { createContext, forwardRef, useContext, useEffect, useRef } from "react";
import { cn } from "../lib/index.ts";
import { requireReactContext } from "../lib/react-invariant.ts";
import type { AudioFormat, CommitStrategy } from "@beep/ui/hooks/use-scribe";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const previewDisplayText = (transcript: string, partialTranscript: string, placeholder: string): string => {
  if (transcript !== "") {
    return transcript;
  }

  if (partialTranscript !== "") {
    return partialTranscript;
  }

  return placeholder;
};

const buttonVariants = cva("!px-0", {
  variants: {
    size: {
      default: "h-9 w-9",
      sm: "h-8 w-8",
      lg: "h-10 w-10",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

// Context for sharing state between compound components
interface SpeechInputContextValue {
  readonly cancel: () => void;
  readonly committedTranscripts: string[];
  readonly error: string | null;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly partialTranscript: string;
  readonly size: VariantProps<typeof buttonVariants>["size"];
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly transcript: string;
}

const SpeechInputContext = createContext<SpeechInputContextValue | null>(null);

/**
 * Use speech input hook.
 *
 * **Example** (Import useSpeechInput hook)
 *
 * ```tsx
 * import { useSpeechInput } from "@beep/ui/components/speech-input"
 *
 * console.log(useSpeechInput)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
function useSpeechInput() {
  const context = useContext(SpeechInputContext);
  return requireReactContext(context, { message: "SpeechInput compound components must be used within a SpeechInput" });
}

// Root component
interface SpeechInputEvent {
  readonly committedTranscripts: string[];
  readonly partialTranscript: string;
  readonly transcript: string;
}

interface SpeechInputProps {
  // Manual audio options
  readonly audioFormat?: undefined | AudioFormat;
  readonly baseUri?: undefined | string;
  readonly children: ReactNode;
  readonly className?: undefined | string;

  // VAD options
  readonly commitStrategy?: undefined | CommitStrategy;
  readonly getToken: () => Promise<string>;
  readonly languageCode?: undefined | string;

  // Microphone options (for automatic microphone mode)
  readonly microphone?:
    | undefined
    | {
        readonly deviceId?: undefined | string;
        readonly echoCancellation?: undefined | boolean;
        readonly noiseSuppression?: undefined | boolean;
        readonly autoGainControl?: undefined | boolean;
        readonly channelCount?: undefined | number;
      };
  readonly minSilenceDurationMs?: undefined | number;
  readonly minSpeechDurationMs?: undefined | number;

  // Connection options
  readonly modelId?: undefined | string;
  readonly onAuthError?: undefined | ((data: { readonly error: string }) => void);
  readonly onCancel?: undefined | ((event: SpeechInputEvent) => void);
  readonly onChange?: undefined | ((event: SpeechInputEvent) => void);

  // Error callbacks
  readonly onError?: undefined | ((error: Error | Event) => void);
  readonly onQuotaExceededError?: undefined | ((data: { readonly error: string }) => void);
  readonly onStart?: undefined | ((event: SpeechInputEvent) => void);
  readonly onStop?: undefined | ((event: SpeechInputEvent) => void);
  readonly sampleRate?: undefined | number;
  readonly size?: undefined | VariantProps<typeof buttonVariants>["size"];
  readonly vadSilenceThresholdSecs?: undefined | number;
  readonly vadThreshold?: undefined | number;
}

const buildTranscript = ({
  partialTranscript,
  committedTranscripts,
}: {
  readonly partialTranscript: string;
  readonly committedTranscripts: string[];
}): string => {
  const committed = Str.trim(A.join(committedTranscripts, " "));
  const partial = Str.trim(partialTranscript);

  if (committed !== "" && partial !== "") {
    return `${committed} ${partial}`;
  }
  return committed !== "" ? committed : partial;
};

const buildEvent = ({
  partialTranscript,
  committedTranscripts,
}: {
  readonly partialTranscript: string;
  readonly committedTranscripts: string[];
}): SpeechInputEvent => ({
  partialTranscript,
  committedTranscripts,
  transcript: buildTranscript({ partialTranscript, committedTranscripts }),
});

/**
 * Speech input component.
 *
 * **Example** (Import SpeechInput component)
 *
 * ```tsx
 * import { SpeechInput } from "@beep/ui/components/speech-input"
 *
 * console.log(SpeechInput)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const SpeechInput = forwardRef<HTMLDivElement, SpeechInputProps>(function SpeechInput(
  {
    children,
    getToken,
    onChange,
    onCancel,
    onStart,
    onStop,
    className,
    size = "default",
    modelId = "scribe_v2_realtime",
    baseUri,
    commitStrategy,
    vadSilenceThresholdSecs,
    vadThreshold,
    minSpeechDurationMs,
    minSilenceDurationMs,
    languageCode,
    microphone = {
      echoCancellation: true,
      noiseSuppression: true,
    },
    audioFormat,
    sampleRate,
    onError,
    onAuthError,
    onQuotaExceededError,
  },
  ref
) {
  const transcriptsRef = useRef({
    partialTranscript: "",
    committedTranscripts: A.empty<string>(),
  });
  const startRequestIdRef = useRef(0);

  const scribe = useScribe({
    modelId,
    baseUri,
    commitStrategy,
    vadSilenceThresholdSecs,
    vadThreshold,
    minSpeechDurationMs,
    minSilenceDurationMs,
    languageCode,
    audioFormat,
    sampleRate,
    microphone,
    onPartialTranscript: (data) => {
      transcriptsRef.current.partialTranscript = data.text;
      onChange?.(buildEvent(transcriptsRef.current));
    },
    onCommittedTranscript: (data) => {
      transcriptsRef.current.committedTranscripts = A.append(transcriptsRef.current.committedTranscripts, data.text);
      transcriptsRef.current.partialTranscript = "";
      onChange?.(buildEvent(transcriptsRef.current));
    },
    ...O.getSomesStruct({ onError: O.fromUndefinedOr(onError) }),
    onAuthError,
    onQuotaExceededError,
  });

  const isConnecting = scribe.status === "connecting";

  const start = (): Promise<void> => {
    const requestId = startRequestIdRef.current + 1;
    startRequestIdRef.current = requestId;

    transcriptsRef.current = {
      partialTranscript: Str.empty,
      committedTranscripts: A.empty(),
    };
    scribe.clearTranscripts();

    return getToken()
      .then((token) => {
        if (startRequestIdRef.current !== requestId) {
          return;
        }

        return scribe.connect({
          token,
        });
      })
      .then(() => {
        if (startRequestIdRef.current !== requestId) {
          scribe.disconnect();
          return;
        }
        onStart?.(buildEvent(transcriptsRef.current));
      })
      .catch(() => {
        // Error is handled by onError callback
      });
  };

  const stop = () => {
    startRequestIdRef.current += 1;
    scribe.disconnect();
    onStop?.(buildEvent(transcriptsRef.current));
  };

  const cancel = () => {
    startRequestIdRef.current += 1;
    const event = buildEvent(transcriptsRef.current);
    scribe.disconnect();
    scribe.clearTranscripts();
    transcriptsRef.current = {
      partialTranscript: Str.empty,
      committedTranscripts: A.empty(),
    };
    onCancel?.(event);
  };

  const contextValue: SpeechInputContextValue = {
    isConnected: scribe.isConnected,
    isConnecting,
    start,
    stop,
    cancel,
    error: scribe.error,
    size,
    ...buildEvent({
      partialTranscript: scribe.partialTranscript,
      committedTranscripts: A.map(scribe.committedTranscripts, (t) => t.text),
    }),
  };

  useEffect(
    () => () => {
      startRequestIdRef.current += 1;
      scribe.disconnect();
    },
    A.make(scribe.disconnect)
  );

  return (
    <SpeechInputContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn(
          "relative inline-flex items-center overflow-hidden rounded-lg border border-transparent transition-all duration-200",
          scribe.isConnected ? "bg-background dark:bg-muted border-input shadow-sm" : Str.empty,
          className
        )}
      >
        {children}
      </div>
    </SpeechInputContext.Provider>
  );
});

// Record button - toggles between mic icon and stop icon
type SpeechInputRecordButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "size">;

/**
 * Speech input record button component.
 *
 * **Example** (Import record button)
 *
 * ```tsx
 * import { SpeechInputRecordButton } from "@beep/ui/components/speech-input"
 *
 * console.log(SpeechInputRecordButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const SpeechInputRecordButton = forwardRef<HTMLButtonElement, SpeechInputRecordButtonProps>(
  function SpeechInputRecordButton({ className, onClick, variant = "ghost", disabled, ...props }, _ref) {
    const speechInput = useSpeechInput();

    return (
      <Button
        variant={variant}
        onClick={(e) => {
          if (speechInput.isConnected) {
            speechInput.stop();
          } else {
            void speechInput.start();
          }
          onClick?.(e);
        }}
        disabled={disabled ?? speechInput.isConnecting}
        className={cn(
          buttonVariants({ size: speechInput.size }),
          "relative flex flex-shrink-0 items-center justify-center transition-all",
          speechInput.isConnected && "scale-[80%]",
          className
        )}
        aria-label={speechInput.isConnected ? "Stop recording" : "Start recording"}
        {...props}
      >
        <div
          className={cn(
            "bg-primary absolute h-4 w-4 rounded-full transition-all duration-200",
            speechInput.isConnecting ? "scale-90 opacity-100" : "scale-[60%] opacity-0"
          )}
        />
        <SquareIcon
          className={cn(
            "text-destructive absolute h-4 w-4 fill-current transition-all duration-200",
            !speechInput.isConnecting && speechInput.isConnected ? "scale-100 opacity-100" : "scale-[60%] opacity-0"
          )}
        />
        <MicrophoneIcon
          className={cn(
            "absolute h-4 w-4 transition-all duration-200",
            !speechInput.isConnecting && !speechInput.isConnected ? "scale-100 opacity-100" : "scale-[60%] opacity-0"
          )}
        />
      </Button>
    );
  }
);

// Preview - shows the current transcript with partial
type SpeechInputPreviewProps = ComponentPropsWithoutRef<"div"> & {
  readonly placeholder?: undefined | string;
};

/**
 * Speech input preview component.
 *
 * **Example** (Import preview component)
 *
 * ```tsx
 * import { SpeechInputPreview } from "@beep/ui/components/speech-input"
 *
 * console.log(SpeechInputPreview)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const SpeechInputPreview = forwardRef<HTMLDivElement, SpeechInputPreviewProps>(function SpeechInputPreview(
  { className, placeholder = "Listening...", ...props },
  ref
) {
  const speechInput = useSpeechInput();

  const displayText = previewDisplayText(speechInput.transcript, speechInput.partialTranscript, placeholder);
  const showPlaceholder = Str.trim(speechInput.transcript) === "";

  return (
    <div
      ref={ref}
      // @ts-expect-error inert is not yet in React types
      inert={speechInput.isConnected ? undefined : Str.empty}
      className={cn(
        "relative flex h-8 flex-shrink-0 items-center overflow-hidden text-sm transition-[opacity,transform,width] duration-200 ease-out",
        showPlaceholder
          ? "text-muted-foreground italic"
          : "text-muted-foreground [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]",
        speechInput.isConnected ? "w-28 opacity-100" : "w-0 opacity-0",
        className
      )}
      title={displayText}
      aria-hidden={!speechInput.isConnected}
      {...props}
    >
      <motion.p
        key="text"
        layout="position"
        className={`absolute top-0 right-0 bottom-0 flex h-full min-w-full items-center px-0 whitespace-nowrap`}
      >
        {displayText}
      </motion.p>
    </div>
  );
});

// Cancel button
type SpeechInputCancelButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "size">;

/**
 * Speech input cancel button component.
 *
 * **Example** (Import cancel button)
 *
 * ```tsx
 * import { SpeechInputCancelButton } from "@beep/ui/components/speech-input"
 *
 * console.log(SpeechInputCancelButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const SpeechInputCancelButton = forwardRef<HTMLButtonElement, SpeechInputCancelButtonProps>(
  function SpeechInputCancelButton({ className, onClick, variant = "ghost", ...props }, ref) {
    const speechInput = useSpeechInput();

    return (
      <Button
        ref={ref}
        variant={variant}
        // @ts-expect-error inert is not yet in React types
        inert={speechInput.isConnected ? undefined : ""}
        onClick={(e) => {
          speechInput.cancel();
          onClick?.(e);
        }}
        className={cn(
          buttonVariants({ size: speechInput.size }),
          "flex-shrink-0 transition-[opacity,transform,width] duration-200 ease-out",
          speechInput.isConnected ? "scale-[80%] opacity-100" : "pointer-events-none w-0 scale-100 opacity-0",
          className
        )}
        aria-label="Cancel recording"
        {...props}
      >
        <XIcon className="h-3 w-3" />
      </Button>
    );
  }
);

/**
 * @category components
 * @since 0.0.0
 */
export { SpeechInput, SpeechInputCancelButton, SpeechInputPreview, SpeechInputRecordButton, useSpeechInput };
