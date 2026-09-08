/**
 * Post-build script: makes the Vite-generated CSS non-render-blocking.
 *
 * Vite injects `<link rel="stylesheet" href="/assets/index-[hash].css">` into
 * dist/index.html at build time. This is render-blocking by default.
 *
 * This script replaces it with the loadCSS pattern:
 *   <link rel="preload" as="style" onload="..."> + <noscript> fallback
 *
 * Result: the browser downloads CSS in parallel with rendering the inline
 * preloader (which has its own inline styles), saving ~450ms on first load.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, '../dist/index.html');

let html = readFileSync(htmlPath, 'utf-8');

// Match Vite's injected blocking CSS link (handles any hash in filename)
const blockingLinkRe = /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/g;

let transformed = false;

html = html.replace(blockingLinkRe, (_, href) => {
  transformed = true;
  // loadCSS non-blocking pattern - safe for all browsers
  return [
    `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
  ].join('\n    ');
});

if (!transformed) {
  // Fallback: also try without crossorigin attribute (older Vite versions)
  const altRe = /<link rel="stylesheet" href="(\/assets\/index-[^"]+\.css)">/g;
  html = html.replace(altRe, (_, href) => {
    transformed = true;
    return [
      `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
      `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
    ].join('\n    ');
  });
}

if (transformed) {
  writeFileSync(htmlPath, html, 'utf-8');
  console.log('✅ postbuild: CSS link made non-render-blocking.');
} else {
  console.warn('⚠️  postbuild: No blocking CSS link found in dist/index.html — pattern may have changed.');
}
