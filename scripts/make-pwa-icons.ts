// Renders the PWA icon set from src/ui/img/logo.svg using headless Chromium.
// Usage: bun run icons
import puppeteer from "puppeteer";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "public/icons");

const svg = await Bun.file(join(ROOT, "src/ui/img/logo.svg")).text();
const pathData = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
if (!pathData) throw new Error("Could not read the logo path from src/ui/img/logo.svg");

const BRAND = "#2383e2";

type IconSpec = {
  file: string;
  size: number;
  radius: number;
  logoRatio: number;
  background: string;
};

const icons: IconSpec[] = [
  { file: "icon-192.png", size: 192, radius: 44, logoRatio: 0.62, background: BRAND },
  { file: "icon-512.png", size: 512, radius: 116, logoRatio: 0.62, background: BRAND },
  // Maskable icons must keep the logo inside the safe zone and bleed to the edges.
  { file: "icon-maskable-192.png", size: 192, radius: 0, logoRatio: 0.5, background: BRAND },
  { file: "icon-maskable-512.png", size: 512, radius: 0, logoRatio: 0.5, background: BRAND },
  // Safari applies its own mask, so this one is a full square.
  { file: "apple-touch-icon.png", size: 180, radius: 0, logoRatio: 0.62, background: BRAND },
];

const html = ({ size, radius, logoRatio, background }: IconSpec) => {
  const logo = Math.round(size * logoRatio);
  return `<!doctype html>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #icon {
    width: ${size}px; height: ${size}px;
    display: flex; align-items: center; justify-content: center;
    background: ${background}; border-radius: ${radius}px;
    overflow: hidden;
  }
  svg { width: ${logo}px; height: ${logo}px; fill: #fff; }
</style>
<div id="icon"><svg viewBox="64 64 512 512"><path d="${pathData}"/></svg></div>`;
};

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  for (const spec of icons) {
    await page.setViewport({ width: spec.size, height: spec.size, deviceScaleFactor: 1 });
    await page.setContent(html(spec), { waitUntil: "load" });
    const element = await page.$("#icon");
    if (!element) throw new Error(`Could not render ${spec.file}`);
    await element.screenshot({
      path: join(OUT, spec.file),
      omitBackground: true,
      type: "png",
    });
    console.log(`wrote public/icons/${spec.file}`);
  }
} finally {
  await browser.close();
}
