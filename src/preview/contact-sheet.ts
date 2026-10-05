import type { KitDefinition, KitType } from "../core/kit.js";
import { resolveParams } from "../patterns/params.js";
import { getPatternTemplate } from "../patterns/registry.js";

export interface PreviewKit {
  kitType: KitType;
  png: Buffer;
  details: string[];
}

export interface PreviewSection {
  title: string;
  kits: PreviewKit[];
}

const STYLE = [
  "body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:#f4f4f5;color:#18181b}",
  "h1{margin:0 0 24px;font-size:22px}h2{margin:0 0 12px;font-size:17px}section{margin-bottom:32px}",
  ".kits{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}",
  "figure{margin:0;padding:12px;background:#fff;border-radius:8px}img{display:block;width:100%;height:auto}",
  "figcaption{margin-top:8px;font-size:13px;line-height:1.5}strong{text-transform:capitalize}",
].join("");

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

export function kitDetails(kit: KitDefinition): string[] {
  const template = getPatternTemplate(kit.pattern.id);
  const params = Object.entries(resolveParams(template, kit.pattern.params))
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
  const lines = [[template.id, template.category, params].filter((part) => part !== "").join(" · ")];
  if (kit.generatedWith) lines.push(`seed ${kit.generatedWith.seed}`);
  if (kit.sponsor) lines.push(`sponsor ${kit.sponsor.id}`);
  if (kit.manufacturer) lines.push(`manufacturer ${kit.manufacturer.id}`);
  return lines;
}

// PNG embutido em base64: o arquivo é autossuficiente e os ids fixos de clipPath do SVG 2D nunca se repetem na página.
function kitHtml(kit: PreviewKit): string {
  const details = kit.details.map((line) => `<br>${escapeHtml(line)}`).join("");
  return `<figure><img src="data:image/png;base64,${kit.png.toString("base64")}" alt="${kit.kitType}"><figcaption><strong>${kit.kitType}</strong>${details}</figcaption></figure>`;
}

function sectionHtml(section: PreviewSection): string {
  return `<section><h2>${escapeHtml(section.title)}</h2><div class="kits">${section.kits.map(kitHtml).join("")}</div></section>`;
}

export function buildContactSheetHtml(title: string, sections: readonly PreviewSection[]): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    `<head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head>`,
    `<body><h1>${escapeHtml(title)}</h1>`,
    ...sections.map(sectionHtml),
    "</body></html>",
    "",
  ].join("\n");
}
