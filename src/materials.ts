import * as T from "three";
import type { Item, Settings } from "./model";
import corkColor from "./assets/Cork003_1K-JPG_Color-optimized.jpg?inline";
import corkNormal from "./assets/Cork003_1K-JPG_NormalGL-optimized.jpg?inline";
import corkRoughness from "./assets/Cork003_1K-JPG_Roughness-optimized.jpg?inline";
export const seeded = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function hash(s: string) {
  let v = 47;
  for (const c of s) v = (Math.imul(v, 31) + c.charCodeAt(0)) | 0;
  return v;
}
export function canvas(w = 1024, h = 1024) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  return { c, g };
}
export function texture(c: HTMLCanvasElement, color = true) {
  const t = new T.CanvasTexture(c);
  if (color) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function microTexture(
  type: "paper" | "cork" | "felt" | "wood" | "rope",
  size = 512,
) {
  const { c, g } = canvas(size, size),
    r = seeded(1583);
  g.fillStyle =
    type === "cork"
      ? "#a28760"
      : type === "felt"
        ? "#313734"
        : type === "wood"
          ? "#503d2c"
          : "#d4cbb4";
  g.fillRect(0, 0, size, size);
  if (type === "cork") {
    for (let i = 0; i < 13000; i++) {
      const x = r() * size,
        y = r() * size,
        k = 2 + r() * 5;
      const v = Math.floor(80 + r() * 90);
      g.fillStyle = `rgb(${v + 20},${v},${v - 30})`;
      g.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5;
        g.lineTo(
          x + Math.cos(a) * k * (0.6 + r()),
          y + Math.sin(a) * k * (0.6 + r()),
        );
      }
      g.closePath();
      g.fill();
    }
  } else if (type === "wood") {
    for (let i = 0; i < 2000; i++) {
      g.strokeStyle = `rgba(${120 + r() * 90},${85 + r() * 50},${45 + r() * 30},.09)`;
      g.beginPath();
      const y = r() * size;
      g.moveTo(0, y);
      g.bezierCurveTo(
        size / 3,
        y + r() * 6,
        size * 0.7,
        y - r() * 6,
        size,
        y + 1,
      );
      g.stroke();
    }
  } else {
    for (let i = 0; i < 35000; i++) {
      const v = Math.floor(70 + r() * 160);
      g.fillStyle = `rgba(${v},${v},${v},${type === "paper" ? ".11" : ".3"})`;
      const x = r() * size,
        y = r() * size;
      g.fillRect(x, y, type === "felt" ? 1 : r() * 4 + 1, 0.5 + r());
    }
    if (type === "rope") {
      g.strokeStyle = "#594536";
      g.lineWidth = 1.2;
      for (let i = -size; i < size * 2; i += 12) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + size, size);
        g.stroke();
      }
    }
  }
  return c;
}
export class Materials {
  paper = texture(microTexture("paper"), false);
  rope = texture(microTexture("rope"), false);
  boards = new Map<string, T.MeshStandardMaterial>();
  images = new Map<string, HTMLImageElement>();
  corkMaps?: T.Texture[];
  corkReady = Promise.all(
    [corkColor, corkNormal, corkRoughness].map((uri) =>
      new T.TextureLoader().loadAsync(uri),
    ),
  ).then((maps) => {
    maps.forEach((t, i) => {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(300, 225);
      t.anisotropy = 8;
      t.colorSpace = i === 0 ? T.SRGBColorSpace : T.NoColorSpace;
    });
    this.corkMaps = maps;
  });
  plastic = new T.MeshPhysicalMaterial({
    color: "#9f1722",
    roughness: 0.26,
    metalness: 0.04,
    clearcoat: 0.48,
    clearcoatRoughness: 0.22,
  });
  metal = new T.MeshStandardMaterial({
    color: "#a6aaa5",
    metalness: 0.95,
    roughness: 0.24,
  });
  constructor() {
    this.paper.wrapS = this.paper.wrapT = T.RepeatWrapping;
    this.paper.repeat.set(3, 3);
    this.rope.wrapS = this.rope.wrapT = T.RepeatWrapping;
    this.rope.repeat.set(16, 2);
  }
  async load(assets: Record<string, string>) {
    await this.corkReady;
    await Promise.all(
      Object.entries(assets).map(async ([id, url]) => {
        if (this.images.get(id)?.src === url) return;
        const im = new Image();
        im.src = url;
        try {
          await im.decode();
          this.images.set(id, im);
        } catch {
          this.images.delete(id);
        }
      }),
    );
  }
  board(kind: Settings["board"]) {
    if (this.boards.has(kind)) return this.boards.get(kind)!;
    if (kind === "cork" && this.corkMaps) {
      const m = new T.MeshStandardMaterial({
        map: this.corkMaps[0],
        normalMap: this.corkMaps[1],
        normalScale: new T.Vector2(0.48, 0.48),
        roughnessMap: this.corkMaps[2],
        roughness: 0.94,
        color: "#c5b5a2",
      });
      this.boards.set(kind, m);
      return m;
    }
    const type = kind === "grid" ? "felt" : kind;
    const c = microTexture(type);
    if (kind === "grid") {
      const g = c.getContext("2d")!;
      g.strokeStyle = "#87958144";
      g.lineWidth = 1;
      for (let i = 0; i < 512; i += 51.2) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 512);
        g.moveTo(0, i);
        g.lineTo(512, i);
        g.stroke();
      }
    }
    const map = texture(c);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(400, 300);
    const bump = map.clone();
    bump.colorSpace = T.NoColorSpace;
    const m = new T.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.015,
      roughness: 0.97,
      color:
        kind === "cork" ? "#b8a68a" : kind === "wood" ? "#bda48b" : "#8d9490",
    });
    this.boards.set(kind, m);
    return m;
  }
  content(o: Item) {
    const { c, g } = canvas(1024, Math.round((1024 * o.height) / o.width)),
      w = c.width,
      h = c.height,
      rand = seeded(hash(o.id));
    g.fillStyle = o.kind === "stamp" ? "rgba(0,0,0,0)" : o.color;
    g.fillRect(0, 0, w, h);
    if (["photo", "polaroid", "film", "profile"].includes(o.kind)) {
      const pad = o.kind === "film" ? 45 : 36,
        bottom = o.kind === "polaroid" ? 185 : 100,
        im = o.assetId ? this.images.get(o.assetId) : undefined;
      const x = pad,
        y = pad,
        iw = w - pad * 2,
        ih = h - pad - bottom;
      if (im) {
        const k = Math.max(iw / im.width, ih / im.height),
          sw = iw / k,
          sh = ih / k;
        g.save();
        g.filter = "grayscale(1) contrast(1.12) sepia(.16)";
        g.drawImage(
          im,
          (im.width - sw) / 2,
          (im.height - sh) / 2,
          sw,
          sh,
          x,
          y,
          iw,
          ih,
        );
        g.restore();
      } else {
        g.fillStyle = "#344544";
        g.fillRect(x, y, iw, ih);
        g.strokeStyle = "#7d8c7e";
        g.lineWidth = 2;
        for (let i = 0; i < 22; i++) {
          const bx = rand() * iw;
          g.strokeRect(
            x + bx,
            y + rand() * ih,
            30 + rand() * 90,
            70 + rand() * 200,
          );
        }
        g.fillStyle = "#c0b194";
        g.font = "22px Georgia";
        g.fillText("ARCHIVE / 添加本地影像", x + 35, y + ih / 2);
      }
      g.fillStyle = o.kind === "film" ? "#b6ac8d" : "#4d4638";
      g.font = `${o.kind === "polaroid" ? 31 : 25}px 'KaiTi', 'Microsoft YaHei', serif`;
      g.textAlign = "center";
      g.fillText(o.title, w / 2, h - bottom / 2 + 4, w - 65);
      g.textAlign = "left";
      if (o.kind === "film") {
        g.fillStyle = "#b4a98f";
        for (let x = 12; x < w; x += 53) {
          g.fillRect(x, 9, 24, 17);
          g.fillRect(x, h - 27, 24, 17);
        }
      }
    } else if (o.kind === "map") {
      g.fillStyle = "#b8b398";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#879680";
      g.lineWidth = 27;
      g.beginPath();
      g.moveTo(w * 0.7, -50);
      g.bezierCurveTo(w * 0.6, h * 0.4, w * 0.25, h * 0.5, w * 0.4, h + 50);
      g.stroke();
      for (let row = -2; row < 26; row++) {
        for (let col = -2; col < 25; col++) {
          const x = col * 47 + rand() * 6,
            y = row * 46 + rand() * 7;
          g.strokeStyle = "#665f4644";
          g.lineWidth = 1;
          g.strokeRect(x, y, 34, 30);
          g.fillStyle = rand() < 0.2 ? "#7a866b66" : "#9a957c55";
          g.fillRect(x + 3, y + 3, 28, 24);
        }
      }
      g.strokeStyle = "#efe3c5";
      g.lineWidth = 9;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(-40, (i * h) / 5);
        g.lineTo(w + 40, (i * h) / 5 + w * 0.15);
        g.stroke();
      }
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(w * 0.12, 0);
      g.lineTo(w * 0.82, h);
      g.stroke();
      g.fillStyle = "#4d5349";
      g.font = "15px monospace";
      for (let i = 0; i < 20; i++)
        g.fillText(
          ["NORTH DOCKS", "RIVER ST.", "SECTOR 04", "EAST END"][i % 4],
          rand() * w,
          rand() * h,
        );
      g.fillStyle = "#4d4735";
      g.font = "bold 31px Georgia";
      g.fillText("NORTH DISTRICT", 40, 63);
      g.font = "15px monospace";
      g.fillText(o.body, 40, h - 40);
      g.strokeStyle = "#3b473c";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(w - 80, 90);
      g.lineTo(w - 80, 160);
      g.moveTo(w - 100, 112);
      g.lineTo(w - 80, 90);
      g.lineTo(w - 60, 112);
      g.stroke();
    } else if (o.kind === "note") {
      g.fillStyle = "#695433";
      g.font = "22px monospace";
      g.fillText("FOLLOW THE EVIDENCE", 44, 70);
      g.fillStyle = "#3c382b";
      g.font = "56px 'KaiTi','Microsoft YaHei',serif";
      this.wrap(g, o.body, 45, 150, w - 85, 80, 7);
      g.strokeStyle = "#655531";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(w * 0.25, h * 0.8);
      g.quadraticCurveTo(w * 0.5, h * 0.77, w * 0.74, h * 0.8);
      g.stroke();
    } else if (o.kind === "label" || o.kind === "date") {
      g.fillStyle = "#2c332c";
      g.font = `bold ${o.kind === "date" ? 55 : 64}px monospace`;
      g.textAlign = "center";
      g.fillText(o.body || o.title, w / 2, h * 0.64, w - 90);
      g.textAlign = "left";
    } else if (o.kind === "stamp") {
      g.strokeStyle = o.color;
      g.lineWidth = 10;
      g.strokeRect(20, 30, w - 40, h - 60);
      g.lineWidth = 3;
      g.strokeRect(34, 44, w - 68, h - 88);
      g.fillStyle = o.color;
      g.font = "bold 95px Georgia";
      g.textAlign = "center";
      g.fillText(o.body, w / 2, h * 0.66, w - 100);
      g.textAlign = "left";
    } else if (o.kind === "folder") {
      g.strokeStyle = "#776341";
      g.lineWidth = 3;
      g.strokeRect(40, 120, w - 80, h - 170);
      g.fillStyle = "#4f4937";
      g.font = "27px monospace";
      g.fillText("EVIDENCE ARCHIVE", 80, 210);
      g.font = "bold 82px Georgia";
      g.fillText("047", 80, 335);
      g.font = "24px monospace";
      g.fillText(o.body, 80, h - 100);
      g.fillStyle = "#7d342f";
      g.save();
      g.translate(650, 350);
      g.rotate(-0.16);
      g.font = "bold 43px Georgia";
      g.fillText("CLASSIFIED", 0, 0);
      g.restore();
    } else {
      g.fillStyle = "#3e4138";
      g.font = o.kind === "news" ? "bold 57px Georgia" : "23px monospace";
      g.fillText(
        o.kind === "news" ? "THE MIDNIGHT POST" : "DEPARTMENT OF ARCHIVES",
        54,
        90,
        w - 105,
      );
      g.fillRect(54, 110, w - 108, 4);
      g.font = "18px monospace";
      g.fillStyle = "#875147";
      g.fillText("CASE 047  /  EVIDENCE RECORD", 54, 151);
      g.fillStyle = "#363b32";
      g.font = "bold 48px 'Microsoft YaHei',serif";
      this.wrap(g, o.title, 54, 234, w - 110, 63, 2);
      g.font = "25px 'Microsoft YaHei',serif";
      this.wrap(g, o.body, 54, 397, w - 110, 43, 11);
      if (o.kind === "news") {
        g.fillStyle = "#8b887455";
        g.fillRect(54, h * 0.67, w * 0.4, h * 0.2);
        g.font = "14px Georgia";
        g.fillStyle = "#4c4b3d";
        for (let i = 0; i < 12; i++)
          g.fillText(
            "ARCHIVAL REPORT / NORTH DISTRICT",
            w * 0.53,
            h * 0.7 + i * 22,
            w * 0.39,
          );
      } else {
        g.strokeStyle = "#766f5444";
        g.lineWidth = 1;
        for (let y = 700; y < h - 110; y += 35) {
          g.beginPath();
          g.moveTo(54, y);
          g.lineTo(w - 54, y);
          g.stroke();
        }
      }
      g.fillStyle = "#766f56";
      g.font = "18px monospace";
      g.fillText("XPIN / FICTIONAL DEMONSTRATION", 54, h - 55);
    }
    if (!["stamp", "tape", "clip", "staple"].includes(o.kind)) {
      for (let i = 0; i < 13000; i++) {
        g.fillStyle = i % 3 ? "rgba(60,43,22,.025)" : "rgba(255,252,236,.045)";
        g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1);
      }
      g.strokeStyle = "#75684935";
      g.lineWidth = 1;
      g.strokeRect(2, 2, w - 4, h - 4);
    }
    return texture(c);
  }
  wrap(
    g: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    line: number,
    limit: number,
  ) {
    let row = 0,
      part = "";
    for (const letter of text) {
      if (letter === "\n" || g.measureText(part + letter).width > width) {
        g.fillText(part, x, y + row * line);
        part = letter === "\n" ? "" : letter;
        if (++row >= limit) return;
      } else part += letter;
    }
    g.fillText(part, x, y + row * line);
  }
  paperMaterial(o: Item) {
    const map = this.content(o);
    const photographic = ["photo", "polaroid", "film", "profile"].includes(
      o.kind,
    );
    let roughnessMap: T.Texture | undefined,
      clearcoatMap: T.Texture | undefined;
    if (photographic) {
      const height = Math.round((1024 * o.height) / o.width),
        rough = canvas(1024, height),
        coat = canvas(1024, height);
      const pad = o.kind === "film" ? 45 : 36,
        bottom = o.kind === "polaroid" ? 185 : 100;
      rough.g.fillStyle = "#eeeeee";
      rough.g.fillRect(0, 0, 1024, height);
      rough.g.fillStyle = "#858585";
      rough.g.fillRect(pad, pad, 1024 - pad * 2, height - pad - bottom);
      coat.g.fillStyle = "#000000";
      coat.g.fillRect(0, 0, 1024, height);
      coat.g.fillStyle = "#ffffff";
      coat.g.fillRect(pad, pad, 1024 - pad * 2, height - pad - bottom);
      roughnessMap = texture(rough.c, false);
      clearcoatMap = texture(coat.c, false);
    }
    return new T.MeshPhysicalMaterial({
      map,
      color: "#ffffff",
      roughness: photographic ? 1 : 0.9,
      roughnessMap,
      bumpMap: this.paper,
      bumpScale: 0.009,
      clearcoat: ["photo", "polaroid"].includes(o.kind) ? 0.16 : 0,
      clearcoatMap,
      clearcoatRoughness: 0.55,
      side: T.DoubleSide,
      transparent: o.kind === "stamp",
      alphaTest: o.kind === "stamp" ? 0.05 : 0,
    });
  }
}
