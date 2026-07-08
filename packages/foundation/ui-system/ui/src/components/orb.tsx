"use client";

import { A } from "@beep/utils";
import { useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Function as F } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type React from "react";

/**
 * Agent state type.
 *
 * @example
 * ```ts
 * import type { AgentState } from "@beep/ui/components/orb"
 *
 * const describe = (state: AgentState): string => state ?? "idle"
 *
 * console.log(describe("thinking"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AgentState = null | "thinking" | "listening" | "talking";

type OrbProps = {
  readonly colors?: undefined | [string, string];
  readonly colorsRef?: undefined | React.RefObject<[string, string]>;
  readonly resizeDebounce?: undefined | number;
  readonly seed?: undefined | number;
  readonly agentState?: undefined | AgentState;
  readonly volumeMode?: undefined | "auto" | "manual";
  readonly manualInput?: undefined | number;
  readonly manualOutput?: undefined | number;
  readonly inputVolumeRef?: undefined | React.RefObject<number>;
  readonly outputVolumeRef?: undefined | React.RefObject<number>;
  readonly getInputVolume?: undefined | (() => number);
  readonly getOutputVolume?: undefined | (() => number);
  readonly className?: undefined | string;
};

const randomUint32 = (): number => {
  const values = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(values);
  return values[0] ?? 0;
};

type OrbUniforms = {
  readonly uAnimation: THREE.Uniform<number>;
  readonly uColor1: THREE.Uniform<THREE.Color>;
  readonly uColor2: THREE.Uniform<THREE.Color>;
  readonly uInverted: THREE.Uniform<number>;
  readonly uInputVolume: THREE.Uniform<number>;
  readonly uOffsets: { value: Float32Array };
  readonly uOpacity: THREE.Uniform<number>;
  readonly uOutputVolume: THREE.Uniform<number>;
  readonly uPerlinTexture: THREE.Uniform<THREE.Texture>;
  readonly uTime: THREE.Uniform<number>;
};

/**
 * Orb component.
 *
 * @example
 * ```tsx
 * import { Orb } from "@beep/ui/components/orb"
 *
 * console.log(Orb)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Orb({
  colors = ["#CADCFC", "#A0B9D1"],
  colorsRef,
  resizeDebounce = 100,
  seed,
  agentState = null,
  volumeMode = "auto",
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas
        resize={{ debounce: resizeDebounce }}
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
        }}
      >
        <Scene
          colors={colors}
          colorsRef={colorsRef}
          seed={seed}
          agentState={agentState}
          volumeMode={volumeMode}
          manualInput={manualInput}
          manualOutput={manualOutput}
          inputVolumeRef={inputVolumeRef}
          outputVolumeRef={outputVolumeRef}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
        />
      </Canvas>
    </div>
  );
}

function Scene({
  colors,
  colorsRef,
  seed,
  agentState,
  volumeMode,
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
}: {
  readonly colors: [string, string];
  readonly colorsRef?: undefined | React.RefObject<[string, string]>;
  readonly seed?: undefined | number;
  readonly agentState: AgentState;
  readonly volumeMode: "auto" | "manual";
  readonly manualInput?: undefined | number;
  readonly manualOutput?: undefined | number;
  readonly inputVolumeRef?: undefined | React.RefObject<number>;
  readonly outputVolumeRef?: undefined | React.RefObject<number>;
  readonly getInputVolume?: undefined | (() => number);
  readonly getOutputVolume?: undefined | (() => number);
}) {
  const { gl } = useThree();
  const circleRef = useRef<THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>>(null);
  const initialColorsRef = useRef<[string, string]>(colors);
  const targetColor1Ref = useRef(new THREE.Color(colors[0]));
  const targetColor2Ref = useRef(new THREE.Color(colors[1]));
  const animSpeedRef = useRef(0.1);
  const perlinNoiseTexture = useTexture("https://storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png");

  const agentRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInRef = useRef<number>(manualInput ?? 0);
  const manualOutRef = useRef<number>(manualOutput ?? 0);
  const curInRef = useRef(0);
  const curOutRef = useRef(0);
  const randomSeedRef = useRef(seed ?? randomUint32());
  const offsetsRef = useRef<Float32Array | null>(null);
  const uniformsRef = useRef<OrbUniforms | null>(null);

  useEffect(() => {
    agentRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    modeRef.current = volumeMode;
  }, [volumeMode]);

  useEffect(() => {
    manualInRef.current = clamp01(manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0);
  }, [manualInput, inputVolumeRef, getInputVolume]);

  useEffect(() => {
    manualOutRef.current = clamp01(manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0);
  }, [manualOutput, outputVolumeRef, getOutputVolume]);

  if (seed !== undefined && randomSeedRef.current !== seed) {
    randomSeedRef.current = seed;
    offsetsRef.current = null;
    uniformsRef.current = null;
  }

  if (offsetsRef.current === null) {
    const random = splitmix32(randomSeedRef.current);
    offsetsRef.current = new Float32Array(A.makeBy(7, () => random() * Math.PI * 2));
  }

  useEffect(() => {
    targetColor1Ref.current = new THREE.Color(colors[0]);
    targetColor2Ref.current = new THREE.Color(colors[1]);
  }, [colors]);

  useEffect(() => {
    const apply = () => {
      if (circleRef.current === null) return;
      const isDark = document.documentElement.classList.contains("dark");
      const invertedUniform = circleRef.current.material.uniforms.uInverted;
      if (P.isNotNullish(invertedUniform)) {
        invertedUniform.value = isDark ? 1 : 0;
      }
      return;
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, A.empty());

  useFrame((_, delta: number) => {
    const mat = circleRef.current?.material;
    if (mat === undefined) return;
    const live = colorsRef?.current;
    const liveOpt = F.pipe(
      live,
      O.fromNullishOr,
      O.flatMap((live) =>
        O.all({
          targetColor1: A.head(live),
          targetColor2: A.get(1)(live),
        })
      )
    );

    if (O.isSome(liveOpt)) {
      const { targetColor1, targetColor2 } = liveOpt.value;
      targetColor1Ref.current.set(targetColor1);
      targetColor2Ref.current.set(targetColor2);
    }

    const u = mat.uniforms;

    if (P.isNotNullish(u.uTime)) {
      u.uTime.value += delta * 0.5;
    }

    if (P.isNotNullish(u.uOpacity) && u.uOpacity.value < 1) {
      u.uOpacity.value = Math.min(1, u.uOpacity.value + delta * 2);
    }

    let targetIn = 0;
    let targetOut = 0.3;
    if (modeRef.current === "manual") {
      targetIn = clamp01(manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0);
      targetOut = clamp01(manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0);
    } else {
      const uTime = u.uTime;
      if (P.isNotNullish(uTime)) {
        const t = uTime.value * 2;
        if (agentRef.current === null) {
          targetIn = 0;
          targetOut = 0.3;
        } else if (agentRef.current === "listening") {
          targetIn = clamp01(0.55 + Math.sin(t * 3.2) * 0.35);
          targetOut = 0.45;
        } else if (agentRef.current === "talking") {
          targetIn = clamp01(0.65 + Math.sin(t * 4.8) * 0.22);
          targetOut = clamp01(0.75 + Math.sin(t * 3.6) * 0.22);
        } else {
          const base = 0.38 + 0.07 * Math.sin(t * 0.7);
          const wander = 0.05 * Math.sin(t * 2.1) * Math.sin(t * 0.37 + 1.2);
          targetIn = clamp01(base + wander);
          targetOut = clamp01(0.48 + 0.12 * Math.sin(t * 1.05 + 0.6));
        }
      }
    }

    curInRef.current += (targetIn - curInRef.current) * 0.2;
    curOutRef.current += (targetOut - curOutRef.current) * 0.2;

    const targetSpeed = 0.1 + (1 - (curOutRef.current - 1) ** 2) * 0.9;
    animSpeedRef.current += (targetSpeed - animSpeedRef.current) * 0.12;

    if (P.isNotNullish(u.uAnimation)) {
      u.uAnimation.value += delta * animSpeedRef.current;
    }
    if (P.isNotNullish(u.uInputVolume)) {
      u.uInputVolume.value = curInRef.current;
    }
    if (P.isNotNullish(u.uOutputVolume)) {
      u.uOutputVolume.value = curOutRef.current;
    }
    if (P.isNotNullish(u.uColor1)) {
      u.uColor1.value.lerp(targetColor1Ref.current, 0.08);
    }
    if (P.isNotNullish(u.uColor2)) {
      u.uColor2.value.lerp(targetColor2Ref.current, 0.08);
    }
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.setTimeout(() => void gl.forceContextRestore(), 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost, false);
  }, [gl]);

  perlinNoiseTexture.wrapS = THREE.RepeatWrapping;
  perlinNoiseTexture.wrapT = THREE.RepeatWrapping;

  if (uniformsRef.current === null) {
    const isDark =
      P.isNotUndefined(globalThis.document) && globalThis.document.documentElement.classList.contains("dark");
    uniformsRef.current = {
      uColor1: new THREE.Uniform(new THREE.Color(initialColorsRef.current[0])),
      uColor2: new THREE.Uniform(new THREE.Color(initialColorsRef.current[1])),
      uOffsets: { value: offsetsRef.current },
      uPerlinTexture: new THREE.Uniform(perlinNoiseTexture),
      uTime: new THREE.Uniform(0),
      uAnimation: new THREE.Uniform(0.1),
      uInverted: new THREE.Uniform(isDark ? 1 : 0),
      uInputVolume: new THREE.Uniform(0),
      uOutputVolume: new THREE.Uniform(0),
      uOpacity: new THREE.Uniform(0),
    };
  } else {
    uniformsRef.current.uOffsets.value = offsetsRef.current;
    uniformsRef.current.uPerlinTexture.value = perlinNoiseTexture;
  }

  const uniforms = uniformsRef.current;

  return (
    <mesh ref={circleRef}>
      <circleGeometry args={[3.5, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        transparent={true}
      />
    </mesh>
  );
}

function splitmix32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let _t = a ^ (a >>> 16);
    _t = Math.imul(_t, 0x21f0aaad);
    _t ^= _t >>> 15;
    _t = Math.imul(_t, 0x735a2d97);
    return ((_t ^= _t >>> 15) >>> 0) / 4294967296;
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAnimation;
uniform float uInverted;
uniform float uOffsets[7];
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uInputVolume;
uniform float uOutputVolume;
uniform float uOpacity;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

const float PI = 3.14159265358979323846;

// Draw a single oval with soft edges and calculate its gradient color
bool drawOval(vec2 polarUv, vec2 polarCenter, float a, float b, bool reverseGradient, float softness, out vec4 color) {
    vec2 p = polarUv - polarCenter;
    float oval = (p.x * p.x) / (a * a) + (p.y * p.y) / (b * b);

    float edge = smoothstep(1.0, 1.0 - softness, oval);

    if (edge > 0.0) {
        float gradient = reverseGradient ? (1.0 - (p.x / a + 1.0) / 2.0) : ((p.x / a + 1.0) / 2.0);
        // Flatten gradient toward middle value for more uniform appearance
        gradient = mix(0.5, gradient, 0.1);
        color = vec4(vec3(gradient), 0.85 * edge);
        return true;
    }
    return false;
}

// Map grayscale value to a 4-color ramp (color1, color2, color3, color4)
vec3 colorRamp(float grayscale, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {
    if (grayscale < 0.33) {
        return mix(color1, color2, grayscale * 3.0);
    } else if (grayscale < 0.66) {
        return mix(color2, color3, (grayscale - 0.33) * 3.0);
    } else {
        return mix(color3, color4, (grayscale - 0.66) * 3.0);
    }
}

vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// 2D noise for the ring
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    float n = mix(
        mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
        u.y
    );

    return 0.5 + 0.5 * n;
}

float sharpRing(vec3 decomposed, float time) {
    float ringStart = 1.0;
    float ringWidth = 0.3;
    float noiseScale = 5.0;

    float noise = mix(
        noise2D(vec2(decomposed.x, time) * noiseScale),
        noise2D(vec2(decomposed.y, time) * noiseScale),
        decomposed.z
    );

    noise = (noise - 0.5) * 2.5;

    return ringStart + noise * ringWidth * 1.5;
}

float smoothRing(vec3 decomposed, float time) {
    float ringStart = 0.9;
    float ringWidth = 0.2;
    float noiseScale = 6.0;

    float noise = mix(
        noise2D(vec2(decomposed.x, time) * noiseScale),
        noise2D(vec2(decomposed.y, time) * noiseScale),
        decomposed.z
    );

    noise = (noise - 0.5) * 5.0;

    return ringStart + noise * ringWidth;
}

float flow(vec3 decomposed, float time) {
    return mix(
        texture(uPerlinTexture, vec2(time, decomposed.x / 2.0)).r,
        texture(uPerlinTexture, vec2(time, decomposed.y / 2.0)).r,
        decomposed.z
    );
}

void main() {
    // Normalize vUv to be centered around (0.0, 0.0)
    vec2 uv = vUv * 2.0 - 1.0;

    // Convert uv to polar coordinates
    float radius = length(uv);
    float theta = atan(uv.y, uv.x);
    if (theta < 0.0) theta += 2.0 * PI; // Normalize theta to [0, 2*PI]

    // Decomposed angle is used for sampling noise textures without seams:
    // float noise = mix(sample(decomposed.x), sample(decomposed.y), decomposed.z);
    vec3 decomposed = vec3(
        // angle in the range [0, 1]
        theta / (2.0 * PI),
        // angle offset by 180 degrees in the range [1, 2]
        mod(theta / (2.0 * PI) + 0.5, 1.0) + 1.0,
        // mixing factor between two noises
        abs(theta / PI - 1.0)
    );

    // Add noise to the angle for a flow-like distortion (reduced for flatter look)
    float noise = flow(decomposed, radius * 0.03 - uAnimation * 0.2) - 0.5;
    theta += noise * mix(0.08, 0.25, uOutputVolume);

    // Initialize the base color to white
    vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

    // Original parameters for the ovals in polar coordinates
    float originalCenters[7] = float[7](0.0, 0.5 * PI, 1.0 * PI, 1.5 * PI, 2.0 * PI, 2.5 * PI, 3.0 * PI);

    // Parameters for the animated centers in polar coordinates
    float centers[7];
    for (int i = 0; i < 7; i++) {
        centers[i] = originalCenters[i] + 0.5 * sin(uTime / 20.0 + uOffsets[i]);
    }

    float a, b;
    vec4 ovalColor;

    // Check if the pixel is inside any of the ovals
    for (int i = 0; i < 7; i++) {
        float noise = texture(uPerlinTexture, vec2(mod(centers[i] + uTime * 0.05, 1.0), 0.5)).r;
        a = 0.5 + noise * 0.3; // Increased for more coverage
        b = noise * mix(3.5, 2.5, uInputVolume); // Increased height for fuller appearance
        bool reverseGradient = (i % 2 == 1); // Reverse gradient for every second oval

        // Calculate the distance in polar coordinates
        float distTheta = min(
            abs(theta - centers[i]),
            min(
                abs(theta + 2.0 * PI - centers[i]),
                abs(theta - 2.0 * PI - centers[i])
            )
        );
        float distRadius = radius;

        float softness = 0.6; // Increased softness for flatter, less pronounced edges

        // Check if the pixel is inside the oval in polar coordinates
        if (drawOval(vec2(distTheta, distRadius), vec2(0.0, 0.0), a, b, reverseGradient, softness, ovalColor)) {
            // Blend the oval color with the existing color
            color.rgb = mix(color.rgb, ovalColor.rgb, ovalColor.a);
            color.a = max(color.a, ovalColor.a); // Max alpha
        }
    }
    
    // Calculate both noisy rings
    float ringRadius1 = sharpRing(decomposed, uTime * 0.1);
    float ringRadius2 = smoothRing(decomposed, uTime * 0.1);
    
    // Adjust rings based on input volume (reduced for flatter appearance)
    float inputRadius1 = radius + uInputVolume * 0.2;
    float inputRadius2 = radius + uInputVolume * 0.15;
    float opacity1 = mix(0.2, 0.6, uInputVolume);
    float opacity2 = mix(0.15, 0.45, uInputVolume);

    // Blend both rings
    float ringAlpha1 = (inputRadius2 >= ringRadius1) ? opacity1 : 0.0;
    float ringAlpha2 = smoothstep(ringRadius2 - 0.05, ringRadius2 + 0.05, inputRadius1) * opacity2;
    
    float totalRingAlpha = max(ringAlpha1, ringAlpha2);
    
    // Apply screen blend mode for combined rings
    vec3 ringColor = vec3(1.0); // White ring color
    color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - ringColor * totalRingAlpha);

    // Define colours to ramp against greyscale (could increase the amount of colours in the ramp)
    vec3 color1 = vec3(0.0, 0.0, 0.0); // Black
    vec3 color2 = uColor1; // Darker Color
    vec3 color3 = uColor2; // Lighter Color
    vec3 color4 = vec3(1.0, 1.0, 1.0); // White

    // Convert grayscale color to the color ramp
    float luminance = mix(color.r, 1.0 - color.r, uInverted);
    color.rgb = colorRamp(luminance, color1, color2, color3, color4); // Apply the color ramp

    // Apply fade-in opacity
    color.a *= uOpacity;

    gl_FragColor = color;
}
`;
