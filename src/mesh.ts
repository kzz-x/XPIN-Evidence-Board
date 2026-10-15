import * as T from "three";
export function physical<
  G extends T.BufferGeometry,
  M extends T.Material | T.Material[],
>(geometry: G, material: M) {
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
