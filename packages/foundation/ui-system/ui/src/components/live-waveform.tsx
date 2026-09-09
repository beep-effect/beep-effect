/**
 * Live-waveform primitive: renders a real-time audio amplitude waveform.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { A } from "@beep/utils";
import * as P from "effect/Predicate";
import { useEffect, useRef } from "react";
import { cn } from "../lib/index.ts";
import type { HTMLAttributes } from "react";

/**
 * Live waveform props type.
 *
 * **Example** (Set active scrolling props)
 *
 * ```ts
 * import type { LiveWaveformProps } from "@beep/ui/components/live-waveform"
 *
 * const props: LiveWaveformProps = { active: true, mode: "scrolling" }
 *
 * console.log(props.mode)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LiveWaveformProps = HTMLAttributes<HTMLDivElement> & {
  readonly active?: undefined | boolean;
  readonly processing?: undefined | boolean;
  readonly deviceId?: undefined | string;
  readonly barWidth?: undefined | number;
  readonly barHeight?: undefined | number;
  readonly barGap?: undefined | number;
  readonly barRadius?: undefined | number;
  readonly barColor?: undefined | string;
  readonly fadeEdges?: undefined | boolean;
  readonly fadeWidth?: undefined | number;
  readonly height?: undefined | string | number;
  readonly sensitivity?: undefined | number;
  readonly smoothingTimeConstant?: undefined | number;
  readonly fftSize?: undefined | number;
  readonly historySize?: undefined | number;
  readonly updateRate?: undefined | number;
  readonly mode?: undefined | "scrolling" | "static";
  readonly onError?: undefined | ((error: Error) => void);
  readonly onStreamReady?: undefined | ((stream: MediaStream) => void);
  readonly onStreamEnd?: undefined | (() => void);
};

const waveformAriaLabel = (active: boolean, processing: boolean): string => {
  if (active) {
    return "Live audio waveform";
  }

  if (processing) {
    return "Processing audio";
  }

  return "Audio waveform idle";
};

const relevantFrequencyData = (data: Uint8Array): Uint8Array =>
  data.slice(Math.floor(data.length * 0.05), Math.floor(data.length * 0.4));

const staticBarsFromData = (
  data: Uint8Array,
  width: number,
  barWidth: number,
  barGap: number,
  sensitivity: number
): number[] => {
  const relevantData = relevantFrequencyData(data);
  const halfCount = Math.floor(Math.floor(width / (barWidth + barGap)) / 2);
  const valueAt = (index: number) =>
    Math.max(
      0.05,
      Math.min(1, ((relevantData[Math.floor((index / halfCount) * relevantData.length)] ?? 0) / 255) * sensitivity)
    );
  const leftHalf = A.makeBy(halfCount, (index) => valueAt(halfCount - 1 - index));
  return A.appendAll(leftHalf, A.makeBy(halfCount, valueAt));
};

const scrollingValueFromData = (data: Uint8Array, sensitivity: number): number => {
  const relevantData = relevantFrequencyData(data);
  let sum = 0;
  for (let index = 0; index < relevantData.length; index++) {
    sum += relevantData[index] ?? 0;
  }
  const average = (sum / relevantData.length / 255) * sensitivity;
  return Math.min(1, Math.max(0.05, average));
};

const blendedProcessingValue = (processingValue: number, previousValue: number, transitionProgress: number): number => {
  const blended = previousValue * (1 - transitionProgress) + processingValue * transitionProgress;
  return Math.max(0.05, Math.min(1, blended));
};

const staticProcessingBars = (
  barCount: number,
  time: number,
  previousBars: ReadonlyArray<number>,
  transitionProgress: number
): number[] => {
  const halfCount = Math.floor(barCount / 2);
  const rightHalf = A.makeBy(halfCount, (index) => {
    const normalizedPosition = index / halfCount;
    const centerWeight = 1 - normalizedPosition * 0.4;
    const combinedWave =
      Math.sin(time * 1.5 + normalizedPosition * 3) * 0.25 +
      Math.sin(time * 0.8 - normalizedPosition * 2) * 0.2 +
      Math.cos(time * 2 + normalizedPosition) * 0.15;
    const processingValue = (0.2 + combinedWave) * centerWeight;
    const previousValue = previousBars[Math.min(halfCount + index, A.length(previousBars) - 1)] ?? processingValue;
    return blendedProcessingValue(processingValue, previousValue, transitionProgress);
  });
  return A.appendAll(A.reverse(rightHalf), rightHalf);
};

const drawWaveformBar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  value: number,
  canvasHeight: number,
  barWidth: number,
  baseBarHeight: number,
  barRadius: number,
  color: string
) => {
  const barHeight = Math.max(baseBarHeight, value * canvasHeight * 0.8);
  const y = centerY - barHeight / 2;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.4 + value * 0.6;
  if (barRadius === 0) {
    ctx.fillRect(x, y, barWidth, barHeight);
    return;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, barHeight, barRadius);
  ctx.fill();
};

type BarLayout = {
  readonly dataIndex: (index: number, length: number) => number;
  readonly x: (index: number, step: number, width: number) => number;
};

const barLayouts: Record<"static" | "scrolling", BarLayout> = {
  static: {
    dataIndex: (index) => index,
    x: (index, step) => index * step,
  },
  scrolling: {
    dataIndex: (index, length) => length - 1 - index,
    x: (index, step, width) => width - (index + 1) * step,
  },
};

const renderBars = (
  ctx: CanvasRenderingContext2D,
  data: readonly number[],
  rect: DOMRect,
  barWidth: number,
  barGap: number,
  baseBarHeight: number,
  barRadius: number,
  color: string,
  mode: "static" | "scrolling"
) => {
  const step = barWidth + barGap;
  const barCount = Math.min(Math.floor(rect.width / step), A.length(data));
  const layout = barLayouts[mode];
  for (let index = 0; index < barCount; index++) {
    const dataIndex = layout.dataIndex(index, A.length(data));
    const x = layout.x(index, step, rect.width);
    drawWaveformBar(
      ctx,
      x,
      rect.height / 2,
      data[dataIndex] ?? 0.1,
      rect.height,
      barWidth,
      baseBarHeight,
      barRadius,
      color
    );
  }
};

const createEdgeGradient = (ctx: CanvasRenderingContext2D, width: number, fadeWidth: number): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  const fadePercent = Math.min(0.3, fadeWidth / width);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
  gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(255,255,255,1)");
  return gradient;
};

/**
 * Live waveform component.
 *
 * **Example** (Import LiveWaveform component)
 *
 * ```tsx
 * import { LiveWaveform } from "@beep/ui/components/live-waveform"
 *
 * console.log(LiveWaveform)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const LiveWaveform = ({
  active = false,
  processing = false,
  deviceId,
  barWidth = 3,
  barGap = 1,
  barRadius = 1.5,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  barHeight: baseBarHeight = 4,
  height = 64,
  sensitivity = 1,
  smoothingTimeConstant = 0.8,
  fftSize = 256,
  historySize = 60,
  updateRate = 30,
  mode = "static",
  onError,
  onStreamReady,
  onStreamEnd,
  className,
  ...props
}: LiveWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<number[]>(A.empty());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const processingAnimationRef = useRef<number | null>(null);
  const lastActiveDataRef = useRef<number[]>(A.empty());
  const transitionProgressRef = useRef(0);
  const staticBarsRef = useRef<number[]>(A.empty());
  const needsRedrawRef = useRef(true);
  const gradientCacheRef = useRef<CanvasGradient | null>(null);
  const lastWidthRef = useRef(0);
  const hasDeviceId = deviceId !== undefined && deviceId.length > 0;

  const heightStyle = P.isNumber(height) ? `${height}px` : height;

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas === null || container === null) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio ?? 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx !== null) {
        ctx.scale(dpr, dpr);
      }

      gradientCacheRef.current = null;
      lastWidthRef.current = rect.width;
      needsRedrawRef.current = true;
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (processing && !active) {
      let time = 0;
      transitionProgressRef.current = 0;

      const animateProcessing = () => {
        time += 0.03;
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + 0.02);

        const barCount = Math.floor((containerRef.current?.getBoundingClientRect().width ?? 200) / (barWidth + barGap));

        const processingData =
          mode === "static"
            ? staticProcessingBars(barCount, time, lastActiveDataRef.current, transitionProgressRef.current)
            : A.makeBy(barCount, (i) => {
                const normalizedPosition = (i - barCount / 2) / (barCount / 2);
                const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

                const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25;
                const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2;
                const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15;
                const combinedWave = wave1 + wave2 + wave3;
                const processingValue = (0.2 + combinedWave) * centerWeight;

                const lastDataIndex = Math.floor((i / barCount) * A.length(lastActiveDataRef.current));
                const previousValue = lastActiveDataRef.current[lastDataIndex] ?? processingValue;
                return blendedProcessingValue(processingValue, previousValue, transitionProgressRef.current);
              });

        if (mode === "static") {
          staticBarsRef.current = processingData;
        } else {
          historyRef.current = processingData;
        }

        needsRedrawRef.current = true;
        processingAnimationRef.current = requestAnimationFrame(animateProcessing);
      };

      animateProcessing();

      return () => {
        if (processingAnimationRef.current !== null) {
          cancelAnimationFrame(processingAnimationRef.current);
        }
      };
    }
    if (!active && !processing) {
      const hasData = mode === "static" ? A.length(staticBarsRef.current) > 0 : A.length(historyRef.current) > 0;

      if (hasData) {
        let fadeProgress = 0;
        const fadeToIdle = () => {
          fadeProgress += 0.03;
          if (fadeProgress < 1) {
            if (mode === "static") {
              staticBarsRef.current = A.map(staticBarsRef.current, (value) => value * (1 - fadeProgress));
            } else {
              historyRef.current = A.map(historyRef.current, (value) => value * (1 - fadeProgress));
            }
            needsRedrawRef.current = true;
            requestAnimationFrame(fadeToIdle);
          } else {
            if (mode === "static") {
              staticBarsRef.current = A.empty();
            } else {
              historyRef.current = A.empty();
            }
          }
        };
        fadeToIdle();
      }
    }
    return undefined;
  }, [processing, active, barWidth, barGap, mode]);

  // Handle microphone setup and teardown
  useEffect(() => {
    const stopMicrophoneStream = () => {
      if (streamRef.current === null) return;
      A.forEach(streamRef.current.getTracks(), (track) => track.stop());
      streamRef.current = null;
      onStreamEnd?.();
    };
    const closeAudioContext = () => {
      if (audioContextRef.current === null || audioContextRef.current.state === "closed") return;
      void audioContextRef.current.close();
      audioContextRef.current = null;
    };
    const cancelAudioAnimation = () => {
      if (animationRef.current === 0) return;
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    };
    const teardownMicrophone = () => {
      stopMicrophoneStream();
      closeAudioContext();
      cancelAudioAnimation();
    };

    if (!active) {
      teardownMicrophone();
      return;
    }

    const setupMicrophone = () =>
      navigator.mediaDevices
        .getUserMedia({
          audio: hasDeviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
        })
        .then((stream) => {
          streamRef.current = stream;
          onStreamReady?.(stream);

          const AudioContextConstructor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const audioContext = new AudioContextConstructor();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = fftSize;
          analyser.smoothingTimeConstant = smoothingTimeConstant;

          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          // Clear history when starting
          historyRef.current = A.empty();
        })
        .catch((error: unknown) => onError?.(error as Error));

    void setupMicrophone();

    return teardownMicrophone;
  }, [active, deviceId, fftSize, hasDeviceId, smoothingTimeConstant, onError, onStreamReady, onStreamEnd]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    let rafId = 0;

    const staticDataToRender = (): ReadonlyArray<number> =>
      processing || active || A.length(staticBarsRef.current) > 0 ? staticBarsRef.current : A.empty();

    const shouldApplyEdgeFade = (rect: DOMRect): boolean => fadeEdges && fadeWidth > 0 && rect.width > 0;

    const resolveBarColor = (): string => barColor ?? (getComputedStyle(canvas).color || "#000");

    const updateAudioData = (rect: DOMRect) => {
      if (analyserRef.current === null) return;
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(data);
      if (mode === "static") {
        const bars = staticBarsFromData(data, rect.width, barWidth, barGap, sensitivity);
        staticBarsRef.current = bars;
        lastActiveDataRef.current = bars;
      } else {
        historyRef.current = A.append(historyRef.current, scrollingValueFromData(data, sensitivity));
        lastActiveDataRef.current = A.copy(historyRef.current);
        if (A.length(historyRef.current) > historySize) historyRef.current = A.drop(historyRef.current, 1);
      }
      needsRedrawRef.current = true;
    };

    const renderWaveform = (rect: DOMRect, color: string) => {
      if (mode === "static") {
        renderBars(ctx, staticDataToRender(), rect, barWidth, barGap, baseBarHeight, barRadius, color, mode);
        return;
      }
      renderBars(ctx, historyRef.current, rect, barWidth, barGap, baseBarHeight, barRadius, color, mode);
    };

    const applyEdgeFade = (rect: DOMRect) => {
      if (!shouldApplyEdgeFade(rect)) return;
      if (gradientCacheRef.current === null || lastWidthRef.current !== rect.width) {
        gradientCacheRef.current = createEdgeGradient(ctx, rect.width, fadeWidth);
        lastWidthRef.current = rect.width;
      }
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = gradientCacheRef.current;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = "source-over";
    };

    const updateActiveAudio = (currentTime: number, rect: DOMRect) => {
      if (!active || currentTime - lastUpdateRef.current <= updateRate) return;
      lastUpdateRef.current = currentTime;
      updateAudioData(rect);
    };

    const animate = (currentTime: number) => {
      const rect = canvas.getBoundingClientRect();
      updateActiveAudio(currentTime, rect);

      if (!needsRedrawRef.current && !active) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      needsRedrawRef.current = active;
      ctx.clearRect(0, 0, rect.width, rect.height);
      renderWaveform(rect, resolveBarColor());
      applyEdgeFade(rect);
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [
    active,
    processing,
    sensitivity,
    updateRate,
    historySize,
    barWidth,
    baseBarHeight,
    barGap,
    barRadius,
    barColor,
    fadeEdges,
    fadeWidth,
    mode,
  ]);

  return (
    <div
      className={cn("relative h-full w-full", className)}
      ref={containerRef}
      style={{ height: heightStyle }}
      aria-label={waveformAriaLabel(active, processing)}
      role="img"
      {...props}
    >
      {!active && !processing && (
        <div className="border-muted-foreground/20 absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted" />
      )}
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
};
