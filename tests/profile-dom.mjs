import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('https://github.com/YarilaFox', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const describe = node => node ? `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}.${typeof node.className === 'string' ? node.className.trim().replace(/\s+/g, '.') : ''}`.slice(0, 200) : null;
    const chain = node => { const output=[]; for (let item=node; item && output.length<7; item=item.parentElement) output.push({ node: describe(item), childCount: item.children.length, text: item.textContent.trim().slice(0, 80) }); return output; };
    const headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(node => /Pinned|YarilaFox\/README.md/i.test(node.textContent.trim()));
    const selectors = ['.pinned-item-list', '.pinned-item-list-item', '.profile-readme', '[data-testid="profile-readme"]', '#user-profile-frame', '.js-profile-editable-area', '.js-profile-readme', '.js-pinned-items-reorder-container'];
    const readme = document.querySelector('.profile-readme');
    const shared = readme?.parentElement;
    const sidebar = document.querySelector('.Layout-sidebar');
    return { headings: headings.map(node => ({ text: node.textContent.trim().slice(0,90), chain: chain(node) })), selectors: selectors.map(selector => ({ selector, matches: [...document.querySelectorAll(selector)].slice(0,3).map(chain) })), sharedChildren: shared ? [...shared.children].map((node, index) => { const r=node.getBoundingClientRect(); return { index, node:describe(node), text:node.textContent.trim().slice(0,100), rect:{x:r.x,y:r.y,w:r.width,h:r.height} }; }) : [], sidebarChildren: sidebar ? [...sidebar.children].map((node,index) => ({index,node:describe(node),children:[...node.children].map(describe),text:node.textContent.trim().slice(0,70)})) : [], sidebarHeadings: [...(sidebar?.querySelectorAll('h2,h3,h4')||[])].map(node => ({text:node.textContent.trim().slice(0,60),chain:chain(node)})) };
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
