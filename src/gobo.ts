import * as T from "three";
import { seeded } from "./materials";
export function goboTexture(style: string, rotation = 0, scale = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 1024);
  g.translate(512, 512);
  g.rotate((rotation * Math.PI) / 180);
  g.scale(scale, scale);
  g.translate(-512, -512);
  g.fillStyle = "#fff";
  g.fillRect(80, 80, 864, 864);
  g.fillStyle = "#000";
  if (style === "window") {
    g.fillRect(485, 80, 54, 864);
    g.fillRect(80, 483, 864, 46);
  }
  if (style === "blinds")
    for (let y = 80; y < 950; y += 88) g.fillRect(40, y, 944, 32);
  if (style === "lattice")
    for (let x = 160; x < 950; x += 180) {
      g.fillRect(x, 40, 24, 944);
      g.fillRect(40, x, 944, 24);
    }
  if (style === "foliage") {
    const r = seeded(182);
    g.strokeStyle = "#000";
    g.lineWidth = 15;
    for (let i = 0; i < 220; i++) {
      const x = r() * 1024,
        y = r() * 1024;
      g.beginPath();
      g.ellipse(x, y, 12 + r() * 35, 8 + r() * 15, r() * 6, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-100, i * 190);
      g.bezierCurveTo(300, i * 130, 450, i * 180, 1100, i * 120);
      g.stroke();
    }
  }
  // Blur is light-source penumbra in the projected cookie; actual object occlusion uses ShadowMap.
  const out = document.createElement("canvas");
  out.width = out.height = 1024;
  const ctx = out.getContext("2d")!;
  ctx.filter = "blur(3px)";
  ctx.drawImage(c, 0, 0);
  const t = new T.CanvasTexture(out);
  t.colorSpace = T.NoColorSpace;
  return t;
}
