import * as T from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { BokehShader } from "three/addons/shaders/BokehShader.js";
import { depthFor } from "./fade";

/** Three.js BokehShader with per-surface depth instead of an opaque scene override.
 * Color, alpha-cutout, shadow and focal depth now share the same animation opacity. */
export class DepthOfFieldPass extends Pass {
  target = new T.WebGLRenderTarget(1, 1, {
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    type: T.HalfFloatType,
  });
  uniforms = T.UniformsUtils.clone(BokehShader.uniforms);
  materialBokeh: T.ShaderMaterial;
  quad: FullScreenQuad;
  constructor(
    public scene: T.Scene,
    public camera: T.PerspectiveCamera,
  ) {
    super();
    this.uniforms.tDepth.value = this.target.texture;
    this.materialBokeh = new T.ShaderMaterial({
      ...BokehShader,
      uniforms: this.uniforms,
    });
    this.quad = new FullScreenQuad(this.materialBokeh);
  }
  render(
    renderer: T.WebGLRenderer,
    write: T.WebGLRenderTarget,
    read: T.WebGLRenderTarget,
  ) {
    const swapped: [T.Mesh, T.Material | T.Material[]][] = [],
      color = renderer.getClearColor(new T.Color()),
      alpha = renderer.getClearAlpha(),
      autoClear = renderer.autoClear,
      shadowUpdate = renderer.shadowMap.autoUpdate;
    const background = this.scene.background,
      override = this.scene.overrideMaterial;
    try {
      this.scene.overrideMaterial = null;
      this.scene.background = null;
      this.scene.traverseVisible((n) => {
        if (!(n instanceof T.Mesh)) return;
        swapped.push([n, n.material]);
        n.material = Array.isArray(n.material)
          ? n.material.map(depthFor)
          : depthFor(n.material);
      });
      renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = false;
      renderer.setClearColor(0xffffff, 1);
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      for (const [mesh, material] of swapped) mesh.material = material;
      this.scene.background = background;
      this.scene.overrideMaterial = override;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      renderer.autoClear = autoClear;
      renderer.setClearColor(color, alpha);
    }
    this.uniforms.tColor.value = read.texture;
    this.uniforms.nearClip.value = this.camera.near;
    this.uniforms.farClip.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    renderer.clear();
    this.quad.render(renderer);
  }
  setSize(width: number, height: number) {
    this.target.setSize(width, height);
    this.uniforms.aspect.value = width / height;
  }
  dispose() {
    this.target.dispose();
    this.materialBokeh.dispose();
    this.quad.dispose();
  }
}
