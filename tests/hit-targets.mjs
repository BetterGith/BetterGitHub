import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1345, height: 891 } });
  await page.goto('https://github.com/YarilaFox/CultOfTheLambTalk', { waitUntil: 'domcontentloaded' });
  await page.locator('a[aria-label^=".github/workflows"]').first().waitFor({ state: 'attached' });
  const result = await page.evaluate(() => {
    const probes = [[10, 400], [30, 400], [950, 400], [970, 400], [450, 250], [1050, 250], [400, 40], [200, 260], [60, 150]];
    const describe = element => element ? `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${element.className && typeof element.className === 'string' ? '.' + element.className.trim().replace(/\s+/g, '.') : ''}${element.dataset.testid ? '[data-testid=' + element.dataset.testid + ']' : ''}`.slice(0, 160) : null;
    const boxes = ['[data-testid="directory-content"]', '[class*="borderGrid__"]', '[data-testid="latest-commit"]', '[data-testid="repo-name-wrapper"]', '.Box', '[class*="Box__"]'].map(selector => ({ selector, rects: [...document.querySelectorAll(selector)].slice(0, 5).map(node => { const r = node.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; }) }));
    return { probes: probes.map(([x, y]) => {
      const target = document.elementFromPoint(x, y);
      const chain = [];
      for (let item = target; item && chain.length < 8; item = item.parentElement) chain.push(describe(item));
      return { x, y, chain };
    }), boxes };
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
