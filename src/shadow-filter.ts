import { ShaderChunk } from "three";

let installed = false;
/** Deterministic disk PCF on real shadow depths. No screen-space or baked shadows. */
export function installShadowFilter() {
  if (installed) return;
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  const begin = chunk.indexOf("#if defined( SHADOWMAP_TYPE_PCF )"),
    end = chunk.indexOf("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )", begin);
  if (begin < 0 || end < 0) throw Error("Unsupported Three.js shadow chunk");
  const taps = Array.from({ length: 32 }, (_, i) => {
    const radius = Math.sqrt((i + 0.5) / 32),
      angle = i * 2.399963229728653;
    const x = (radius * Math.cos(angle)).toFixed(7),
      y = (radius * Math.sin(angle)).toFixed(7);
    return `texture2DCompare(shadowMap, shadowCoord.xy + texelSize * shadowRadius * vec2(${x}, ${y}), shadowCoord.z)`;
  });
  ShaderChunk.shadowmap_pars_fragment =
    chunk.slice(0, begin) +
    `#if defined( SHADOWMAP_TYPE_PCF )\nvec2 texelSize = vec2(1.0) / shadowMapSize;\nshadow = (${taps.join(" + ")}) / 32.0;\n` +
    chunk.slice(end);
  installed = true;
}

/** Keep the UI softness stable when the camera/frustum or output quality changes. */
export function shadowRadius(softness: number, texelWorld: number) {
  return Math.max(
    0.75,
    Math.min(32, (softness * 0.012) / Math.max(0.00001, texelWorld)),
  );
}
