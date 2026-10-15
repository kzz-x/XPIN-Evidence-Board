import * as T from "three";

const bases = new WeakMap<
  T.Material,
  { opacity: number; transparent: boolean }
>();
const depths = new WeakMap<T.Material, T.MeshDepthMaterial>();
/** A separate depth per surface preserves cutouts and dissolves shadows/DOF with the image. */
export function depthFor(material: T.Material) {
  const surface = material as T.MeshStandardMaterial;
  let depth = depths.get(material);
  if (!depth) {
    depth = new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking,
      blending: T.NoBlending,
    });
    depths.set(material, depth);
    material.addEventListener("dispose", () => depth!.dispose());
  }
  depth.map = surface.map ?? null;
  depth.alphaMap = surface.alphaMap ?? null;
  depth.alphaTest = material.alphaTest;
  depth.side = material.side;
  depth.opacity = material.opacity;
  const hash = material.opacity < 1;
  if (depth.alphaHash !== hash) {
    depth.alphaHash = hash;
    depth.needsUpdate = true;
  }
  return depth;
}
export function fadeGroup(
  group: T.Group,
  opacity: number,
  sharedMetal: T.Material,
) {
  if (!group.userData.fadeReady) {
    // Pin shafts share the library metal. Other groups must never inherit this fade.
    let metal: T.Material | undefined;
    group.traverse((n) => {
      if (!(n instanceof T.Mesh)) return;
      const own = (m: T.Material) =>
        m === sharedMetal ? (metal ??= m.clone()) : m;
      n.material = Array.isArray(n.material)
        ? n.material.map(own)
        : own(n.material);
    });
    group.userData.fadeReady = true;
  }
  group.userData.opacity = opacity;
  group.traverse((n) => {
    if (!(n instanceof T.Mesh)) return;
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      let base = bases.get(m);
      if (!base) {
        base = { opacity: m.opacity, transparent: m.transparent };
        bases.set(m, base);
      }
      const transparent = base.transparent || opacity < 1;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = base.opacity * opacity;
      depthFor(m);
    }
    n.customDepthMaterial = depthFor(
      Array.isArray(n.material) ? n.material[0] : n.material,
    );
  });
}
