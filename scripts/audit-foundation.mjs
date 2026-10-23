import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.ATLAS_AUDIT_URL || 'http://127.0.0.1:4176/';
const out = resolve(process.env.ATLAS_AUDIT_OUT || process.env.TMPDIR || '.', 'foundation');
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]));
const viewports = [[1920, 1080], [1366, 768], [1440, 850], [390, 844]];
const results = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

function measureMap() {
  const stage = document.querySelector('[data-atlas-work]').getBoundingClientRect();
  const cards = [...document.querySelectorAll('.atlas-card')];
  const first = cards[0], box = first.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  const rgb = text => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = text;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(x => x / 255);
  };
  const luminance = color => color.reduce((sum, x, i) => sum + [0.2126, 0.7152, 0.0722][i] * (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), 0);
  const bg = rgb(getComputedStyle(document.querySelector('.atlas-canvas')).backgroundColor);
  const wire = document.querySelector('[data-atlas-wires] path.dim');
  const style = getComputedStyle(wire);
  const fg = rgb(style.stroke).map((x, i) => x * Number(style.opacity) + bg[i] * (1 - Number(style.opacity)));
  const contrast = (Math.max(luminance(fg), luminance(bg)) + 0.05) / (Math.min(luminance(fg), luminance(bg)) + 0.05);
  const fonts = ['.atlas-card-status', '.atlas-card-owner', '.atlas-rail-count', '.atlas-news p'].map(selector => ({ selector, pixels: parseFloat(getComputedStyle(document.querySelector(selector)).fontSize) }));
  return {
    nodes: cards.length,
    fullyInside: cards.filter(el => {
      const r = el.getBoundingClientRect();
      return r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1;
    }).length,
    firstClickable: first.contains(hit),
    stagePercent: stage.height / innerHeight * 100,
    stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
    zoom: document.querySelector('[data-atlas-where]').textContent,
    overflow: document.documentElement.scrollWidth > innerWidth,
    toolbarControls: document.querySelectorAll('.atlas-canvas .atlas-toolbar-bar button').length,
    icons: document.querySelectorAll('.atlas-rail-mark svg').length,
    contrast, fonts,
  };
}

try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
    // Los encabezados reales del proyecto se aplican también al servidor estático local.
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== new URL(base).origin) return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
    });
    await context.addInitScript(() => {
      localStorage.setItem('rr-atlas-tour-v1', '1');
      window.atlasPolicyViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.atlasPolicyViolations.push({ directive: event.violatedDirective, blocked: event.blockedURI }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const row = { width, height, errors, status: 'pending' };
    results.push(row);
    try {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForSelector('.atlas-card');
      await page.waitForTimeout(350);
      row.initial = await page.evaluate(measureMap);
      await page.screenshot({ path: `${out}/${width}x${height}-mapa.png` });
      assert.equal(row.initial.overflow, false, 'Desbordamiento horizontal');
      assert.equal(row.initial.firstClickable, true, 'Primera tarjeta tapada');
      assert.equal(row.initial.toolbarControls, 5, 'Se agregaron controles permanentes');
      assert.equal(row.initial.icons, 10, 'Faltan iconos del menú');
      assert.ok(row.initial.fonts.every(font => font.pixels >= 12), 'Texto nuevo bajo 12 px');
      assert.ok(row.initial.contrast >= 3, 'Conexiones bajo contraste 3:1');
      if (width >= 761) assert.equal(row.initial.fullyInside, row.initial.nodes, 'Encuadre incompleto');
      if (height === 850) assert.ok(row.initial.stagePercent >= 75, 'Lienzo bajo 75% a 850 px');
      // Clic real: no force, evaluate(click), ni omitir la comprobación de impacto.
      await page.locator('.atlas-card').first().click();
      assert.ok(await page.locator('#atlas-app.is-detail-open').count(), 'No abre el inspector');
      await page.keyboard.press('Escape');
      await page.keyboard.press('\\');
      assert.ok(await page.locator('#atlas-app.is-focused').count(), 'No abre el enfoque');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#atlas-app.is-focused').count(), 0, 'No sale del enfoque');
      await page.locator('[data-action="locate"]').click();
      await page.waitForTimeout(350);
      row.located = await page.evaluate(measureMap);
      assert.ok(row.located.firstClickable, 'Localizar selección no la hace alcanzable');
      await page.locator('[data-action="toggle-settings"]').click();
      await page.locator('[data-action="toggle-theme"]').click();
      await page.locator('[data-action="toggle-settings"]').click();
      await page.waitForTimeout(250);
      row.light = await page.evaluate(measureMap);
      assert.ok(row.light.contrast >= 3, 'Conexiones sin contraste en tema claro');
      // Estos objetos no se montan: comprueba la política sin contactar a terceros.
      row.media = await page.evaluate(async () => {
        const { createMediaFrame } = await import('/src/ui/atlas-media.mjs');
        return ['embed', 'link', 'video', 'audio', 'image', 'pdf'].map(kind => {
          const frame = createMediaFrame({ id: `check-${kind}`, label: 'Ejemplo seguro', url: 'https://example.com/pagina', kind });
          return { kind, iframe: frame.tagName === 'IFRAME' || Boolean(frame.querySelector?.('iframe')), external: frame.tagName === 'A' || Boolean(frame.querySelector?.('a')) };
        });
      });
      assert.ok(row.media.every(item => !item.iframe && item.external), 'Tipo de medio elude la lista');
      const processSelector = width < 760 ? '.atlas-tabbar [data-atlas-section-target="procesos"]' : '.atlas-rail [data-atlas-section-target="procesos"]';
      await page.locator(processSelector).click();
      await page.waitForSelector('[data-process-id]');
      await page.locator('[data-process-id]').first().click();
      await page.waitForFunction(() => document.querySelector('[data-atlas-bpmn-status]')?.textContent.includes('Validación'));
      row.bpmn = { status: await page.locator('[data-atlas-bpmn-status]').innerText(), shapes: await page.locator('.djs-shape').count() };
      assert.ok(row.bpmn.shapes > 0, 'BPMN vacío con CSP');
      await page.screenshot({ path: `${out}/${width}x${height}-bpmn.png` });
      row.csp = await page.evaluate(() => window.atlasPolicyViolations);
      assert.deepEqual(row.csp, [], 'CSP bloquea la aplicación');
      assert.deepEqual(errors, [], 'Errores del navegador');
      row.status = 'passed';
    } catch (error) {
      row.status = 'failed';
      row.failure = error.message;
      await page.screenshot({ path: `${out}/${width}x${height}-fallo.png` }).catch(() => {});
    } finally {
      await context.close();
      await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
    }
    console.log(`${width}x${height}: ${row.status}${row.failure ? ` - ${row.failure}` : ''}`);
  }
} finally { await browser.close(); }
console.log(`Informe: ${out}/report.json`);
if (results.some(row => row.status !== 'passed')) process.exitCode = 1;
