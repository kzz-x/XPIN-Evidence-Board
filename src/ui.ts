export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const paths: Record<string, string> = {
  select: "M5 3l13 9-6 1-3 6z",
  move: "M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4",
  rotate: "M20 9a8 8 0 1 0 0 6M20 3v6h-6",
  scale: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l6 6M20 20l-6-6",
  photo: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8h.01",
  polaroid: "M4 3h16v18H4zM7 6h10v10H7z",
  film: "M3 5h18v14H3zM7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4",
  file: "M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h6",
  news: "M4 4h16v17H4zM7 7h10M7 11h4v4H7zM14 11h3M14 15h3M7 18h10",
  folder: "M3 6h7l2 2h9v12H3z",
  profile: "M4 3h16v18H4zM9 9a3 3 0 1 0 6 0a3 3 0 1 0-6 0M7 18c0-5 10-5 10 0",
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16",
  note: "M4 3h16v12l-6 6H4zM14 21v-6h6M7 8h9M7 12h6",
  label: "M3 8h18v8H3zM6 12h12",
  date: "M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h2M14 13h2M8 17h2",
  pin: "M8 3h8l-2 8 4 4H6l4-4zM12 15v7",
  clip: "M6 10h12v9H6zM8 10V5c0-5 8-5 8 0v5",
  tape: "M3 7h18l-2 3 2 4-2 3H3l2-4-2-3z",
  staple: "M15 6v11a4 4 0 0 1-8 0V6a3 3 0 0 1 6 0v10a1 1 0 0 1-2 0V7",
  stamp: "M9 3h6v8l5 3v5H4v-5l5-3zM3 22h18",
  rope: "M5 6c7-9 7 9 14 0M5 6c-6 8 4 7 4 12M9 18c5 9 6-7 11-3",
  mark: "M19 6c-7-6-19 4-13 12 8 8 21-5 13-10",
  light: "M9 3h6l5 9-8 5-8-5zM12 17v5M6 20l-3 2M18 20l3 2",
  camera: "M3 6h13v13H3zM16 10l5-3v11l-5-3",
  play: "M8 4l13 8-13 8z",
  pause: "M8 4v16M16 4v16",
  undo: "M8 5l-5 5 5 5M3 10h11c9 0 9 10 1 10",
  redo: "M16 5l5 5-5 5M21 10H10c-9 0-9 10-1 10",
  save: "M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8",
  export: "M12 3v12M7 10l5 5 5-5M4 15v6h16v-6",
  plus: "M12 4v16M4 12h16",
  eye: "M2 12c4-10 16-10 20 0-4 10-16 10-20 0zM8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
  trash: "M4 6h16M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  star: "M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  grid: "M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18",
  group: "M3 3h7v7H3zM14 14h7v7h-7zM16 3h5v7M3 16v5h7",
  focus:
    "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  close: "M5 5l14 14M19 5L5 19",
  volume: "M3 9h4l5-5v16l-5-5H3zM16 8c4 3 4 5 0 8",
  search: "M16 16l5 5M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
};
export const icon = (name: string) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.file}"/></svg>`;
export function button(label: string, action: string, ico = "", cls = "") {
  return `<button class="${cls}" data-action="${action}" title="${esc(label)}">${ico ? icon(ico) : ""}<span>${esc(label)}</span></button>`;
}
export function range(
  label: string,
  bind: string,
  value: number,
  min: number,
  max: number,
  step = 0.1,
  suffix = "",
) {
  return `<label class="field range"><span>${label}<output>${Number(value.toFixed(3))}${suffix}</output></span><div class="numeric-control"><input aria-label="${label}滑块" type="range" data-bind="${bind}" value="${value}" min="${min}" max="${max}" step="${step}"><input aria-label="${label}" type="number" data-bind="${bind}" value="${Number(value.toFixed(3))}" step="${step}"></div></label>`;
}
export function number(label: string, bind: string, value: number, step = 0.1) {
  const positive = /width|height|scale|duration|strength|Intensity|Angle/.test(
    bind,
  );
  const max = /Intensity/.test(bind)
    ? 1000
    : /Angle/.test(bind)
      ? 85
      : /width|height/.test(bind)
        ? 40
        : /duration|start/.test(bind)
          ? 60
          : 20;
  return range(label, bind, value, positive ? step : -max, max, step);
}

export function select(
  label: string,
  bind: string,
  value: string,
  options: [string, string][],
) {
  return `<label class="field"><span>${label}</span><select aria-label="${label}" data-bind="${bind}">${options.map(([v, n]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
}
export function check(label: string, bind: string, checked: boolean) {
  return `<label class="check"><input type="checkbox" aria-label="${label}" data-bind="${bind}" ${checked ? "checked" : ""}><span>${label}</span></label>`;
}
export function color(label: string, bind: string, value: string) {
  return `<label class="field color"><span>${label}</span><input type="color" aria-label="${label}" data-bind="${bind}" value="${value}"></label>`;
}
export function text(
  label: string,
  bind: string,
  value: string,
  multiline = false,
) {
  return `<label class="field"><span>${label}</span>${multiline ? `<textarea aria-label="${label}" data-bind="${bind}" rows="4">${esc(value)}</textarea>` : `<input aria-label="${label}" type="text" data-bind="${bind}" value="${esc(value)}">`}</label>`;
}
export const section = (label: string, html: string, open = false) =>
  `<details class="section" ${open ? "open" : ""}><summary>${esc(label)}</summary><div class="section-body">${html}</div></details>`;
