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
 * @example
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

/**
 * Live waveform component.
 *
 * @example
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
            ? A.makeBy(barCount, (i) => {
                const halfCount = Math.floor(barCount / 2);
                const normalizedPosition = (i - halfCount) / halfCount;
                const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

                const wave1 = Math.sin(time * 1.5 + normalizedPosition * 3) * 0.25;
                const wave2 = Math.sin(time * 0.8 - normalizedPosition * 2) * 0.2;
                const wave3 = Math.cos(time * 2 + normalizedPosition) * 0.15;
                const combinedWave = wave1 + wave2 + wave3;
                const processingValue = (0.2 + combinedWave) * centerWeight;

                let finalValue = processingValue;
                if (A.length(lastActiveDataRef.current) > 0 && transitionProgressRef.current < 1) {
                  const lastDataIndex = Math.min(i, A.length(lastActiveDataRef.current) - 1);
                  const lastValue = lastActiveDataRef.current[lastDataIndex] ?? 0;
                  finalValue =
                    lastValue * (1 - transitionProgressRef.current) + processingValue * transitionProgressRef.current;
                }

                return Math.max(0.05, Math.min(1, finalValue));
              })
            : A.makeBy(barCount, (i) => {
                const normalizedPosition = (i - barCount / 2) / (barCount / 2);
                const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

                const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25;
                const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2;
                const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15;
                const combinedWave = wave1 + wave2 + wave3;
                const processingValue = (0.2 + combinedWave) * centerWeight;

                let finalValue = processingValue;
                if (A.length(lastActiveDataRef.current) > 0 && transitionProgressRef.current < 1) {
                  const lastDataIndex = Math.floor((i / barCount) * A.length(lastActiveDataRef.current));
                  const lastValue = lastActiveDataRef.current[lastDataIndex] ?? 0;
                  finalValue =
                    lastValue * (1 - transitionProgressRef.current) + processingValue * transitionProgressRef.current;
                }

                return Math.max(0.05, Math.min(1, finalValue));
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
    if (!active) {
      if (streamRef.current !== null) {
        A.forEach(streamRef.current.getTracks(), (track) => track.stop());
        streamRef.current = null;
        onStreamEnd?.();
      }
      if (audioContextRef.current !== null && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationRef.current !== 0) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
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

    return () => {
      if (streamRef.current !== null) {
        A.forEach(streamRef.current.getTracks(), (track) => track.stop());
        streamRef.current = null;
        onStreamEnd?.();
      }
      if (audioContextRef.current !== null && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationRef.current !== 0) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }, [active, deviceId, fftSize, hasDeviceId, smoothingTimeConstant, onError, onStreamReady, onStreamEnd]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    let rafId = 0;

    const animate = (currentTime: number) => {
      // Render waveform
      const rect = canvas.getBoundingClientRect();

      // Update audio data if active
      if (active && currentTime - lastUpdateRef.current > updateRate) {
        lastUpdateRef.current = currentTime;

        if (analyserRef.current !== null) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          if (mode === "static") {
            // For static mode, update bars in place
            const startFreq = Math.floor(dataArray.length * 0.05);
            const endFreq = Math.floor(dataArray.length * 0.4);
            const relevantData = dataArray.slice(startFreq, endFreq);

            const barCount = Math.floor(rect.width / (barWidth + barGap));
            const halfCount = Math.floor(barCount / 2);

            // Mirror the data for symmetric display
            // First half: indices from halfCount-1 down to 0
            const leftHalf = A.makeBy(halfCount, (idx) => {
              const i = halfCount - 1 - idx;
              const dataIndex = Math.floor((i / halfCount) * relevantData.length);
              const value = Math.min(1, ((relevantData[dataIndex] ?? 0) / 255) * sensitivity);
              return Math.max(0.05, value);
            });

            // Second half: indices from 0 to halfCount-1
            const rightHalf = A.makeBy(halfCount, (i) => {
              const dataIndex = Math.floor((i / halfCount) * relevantData.length);
              const value = Math.min(1, ((relevantData[dataIndex] ?? 0) / 255) * sensitivity);
              return Math.max(0.05, value);
            });

            const newBars = A.appendAll(leftHalf, rightHalf);
            staticBarsRef.current = newBars;
            lastActiveDataRef.current = newBars;
          } else {
            // Scrolling mode - original behavior
            let sum = 0;
            const startFreq = Math.floor(dataArray.length * 0.05);
            const endFreq = Math.floor(dataArray.length * 0.4);
            const relevantData = dataArray.slice(startFreq, endFreq);

            for (let i = 0; i < relevantData.length; i++) {
              sum += relevantData[i] ?? 0;
            }
            const average = (sum / relevantData.length / 255) * sensitivity;

            // Add to history
            historyRef.current = A.append(historyRef.current, Math.min(1, Math.max(0.05, average)));
            lastActiveDataRef.current = A.copy(historyRef.current);

            // Maintain history size
            if (A.length(historyRef.current) > historySize) {
              historyRef.current = A.drop(historyRef.current, 1);
            }
          }
          needsRedrawRef.current = true;
        }
      }

      // Only redraw if needed
      if (!needsRedrawRef.current && !active) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      needsRedrawRef.current = active;
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor ??
        (() => {
          const style = getComputedStyle(canvas);
          // Try to get the computed color value directly
          const color = style.color;
          return color.length > 0 ? color : "#000";
        })();

      const step = barWidth + barGap;
      const barCount = Math.floor(rect.width / step);
      const centerY = rect.height / 2;

      // Draw bars based on mode
      if (mode === "static") {
        // Static mode - bars in fixed positions
        const dataToRender =
          processing || active || A.length(staticBarsRef.current) > 0 ? staticBarsRef.current : A.empty();

        for (let i = 0; i < barCount && i < A.length(dataToRender); i++) {
          const value = dataToRender[i] ?? 0.1;
          const x = i * step;
          const barHeight = Math.max(baseBarHeight, value * rect.height * 0.8);
          const y = centerY - barHeight / 2;

          ctx.fillStyle = computedBarColor;
          ctx.globalAlpha = 0.4 + value * 0.6;

          if (barRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }
      } else {
        // Scrolling mode - original behavior
        for (let i = 0; i < barCount && i < A.length(historyRef.current); i++) {
          const dataIndex = A.length(historyRef.current) - 1 - i;
          const value = historyRef.current[dataIndex] ?? 0.1;
          const x = rect.width - (i + 1) * step;
          const barHeight = Math.max(baseBarHeight, value * rect.height * 0.8);
          const y = centerY - barHeight / 2;

          ctx.fillStyle = computedBarColor;
          ctx.globalAlpha = 0.4 + value * 0.6;

          if (barRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }
      }

      // Apply edge fading
      if (fadeEdges && fadeWidth > 0 && rect.width > 0) {
        // Cache gradient if width hasn't changed
        if (gradientCacheRef.current === null || lastWidthRef.current !== rect.width) {
          const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
          const fadePercent = Math.min(0.3, fadeWidth / rect.width);

          // destination-out: removes destination where source alpha is high
          // We want: fade edges out, keep center solid
          // Left edge: start opaque (1) = remove, fade to transparent (0) = keep
          gradient.addColorStop(0, "rgba(255,255,255,1)");
          gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
          // Center stays transparent = keep everything
          gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
          // Right edge: fade from transparent (0) = keep to opaque (1) = remove
          gradient.addColorStop(1, "rgba(255,255,255,1)");

          gradientCacheRef.current = gradient;
          lastWidthRef.current = rect.width;
        }

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradientCacheRef.current;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

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
