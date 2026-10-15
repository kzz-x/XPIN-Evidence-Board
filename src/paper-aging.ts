import type { Item } from "./model";
import { wearParameters } from "./paper-profile";
/** Pigment / abrasions only. Lighting and contact shadows always come from geometry. */
export function agePaper(
  g: CanvasRenderingContext2D,
  o: Item,
  w: number,
  h: number,
) {
  const { wear, stains, seed } = wearParameters(o);
  if (wear === 0) return;
  let state = seed;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  g.save();
  for (const [x0, y0, x1, y1] of [
    [0, 0, w * 0.07, 0],
    [w, 0, w * 0.93, 0],
    [0, 0, 0, h * 0.07],
    [0, h, 0, h * 0.93],
  ]) {
    const gradient = g.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, `rgba(112,71,28,${wear * 0.16})`);
    gradient.addColorStop(1, "rgba(112,71,28,0)");
    g.fillStyle = gradient;
    g.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 5; i++) {
    const x = (0.08 + rand() * 0.84) * w,
      y = (i % 2 ? 0.7 + rand() * 0.25 : rand() * 0.18) * h,
      rx = w * (0.035 + rand() * 0.075),
      ry = rx * (0.3 + rand() * 0.5);
    g.save();
    g.translate(x, y);
    g.rotate((rand() - 0.5) * 0.8);
    g.scale(1, ry / rx);
    const gradient = g.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    gradient.addColorStop(0, `rgba(111,74,31,${stains * wear * 0.55})`);
    gradient.addColorStop(0.72, `rgba(137,94,46,${stains * wear * 0.25})`);
    gradient.addColorStop(1, "rgba(137,94,46,0)");
    g.fillStyle = gradient;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  // Tiny edge fibers and nicks, aligned with the actual irregular contour.
  for (let i = 0; i < Math.round(500 * wear); i++) {
    const side = i % 4,
      t = rand(),
      d = 1 + rand() * 6;
    g.strokeStyle = `rgba(${i % 3 ? "238,224,193" : "107,83,48"},${0.03 + wear * 0.12})`;
    g.lineWidth = 0.3 + rand() * 0.5;
    g.beginPath();
    if (side < 2) {
      const x = side ? w - 1 : 1,
        y = t * h;
      g.moveTo(x, y);
      g.lineTo(x + (side ? -d : d), y + (rand() - 0.5) * d);
    } else {
      const x = t * w,
        y = side === 2 ? 1 : h - 1;
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * d, y + (side === 2 ? d : -d));
    }
    g.stroke();
  }
  g.restore();
}
