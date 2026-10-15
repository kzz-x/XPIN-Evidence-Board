import { ShaderChunk } from "three";

let installed = false;
/** Deterministic disk PCF on real shadow depths. No screen-space or baked shadows. */
export function installShadowFilter() {
  if (installed) return;
  // Receiver-plane depth correction follows the PCF technique documented by Microsoft:
  // https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps
  let chunk = ShaderChunk.shadowmap_pars_fragment;
  chunk = chunk.replace(
    "float getShadow(",
    `float xpinShadowTap(sampler2D map, vec3 coord, vec2 offset, vec2 plane, vec2 size) {
    vec2 sampleUV=(floor((coord.xy+offset)*size)+0.5)/size;
    return texture2DCompare(map,sampleUV,coord.z+dot(plane,sampleUV-coord.xy));
  }
  float getShadow(`,
  );
  chunk = chunk.replace(
    "bool inFrustum =",
    `
  #if defined( SHADOWMAP_TYPE_PCF )
    vec3 dx=dFdx(shadowCoord.xyz), dy=dFdy(shadowCoord.xyz);
    float determinant=dx.x*dy.y-dx.y*dy.x;
    vec2 receiverPlane=abs(determinant)>1e-12 ? vec2(dx.z*dy.y-dx.y*dy.z,dx.x*dy.z-dx.z*dy.x)/determinant : vec2(0.0);
    receiverPlane=clamp(receiverPlane,vec2(-2.0),vec2(2.0));
  #endif
  bool inFrustum =`,
  );
  const begin = chunk.indexOf(
      "#if defined( SHADOWMAP_TYPE_PCF )",
      chunk.indexOf("if ( frustumTest )"),
    ),
    end = chunk.indexOf("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )", begin);
  if (begin < 0 || end < 0) throw Error("Unsupported Three.js shadow chunk");
  const taps = Array.from({ length: 32 }, (_, i) => {
    const radius = Math.sqrt((i + 0.5) / 32),
      angle = i * 2.399963229728653;
    const x = (radius * Math.cos(angle)).toFixed(7),
      y = (radius * Math.sin(angle)).toFixed(7);
    return `xpinShadowTap(shadowMap,shadowCoord.xyz,texelSize*shadowRadius*vec2(${x},${y}),receiverPlane,shadowMapSize)`;
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
