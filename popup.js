document.getElementById('open').addEventListener('click', () => chrome.runtime.openOptionsPage());
chrome.storage.local.get('settings', ({ settings }) => {
  if (settings?.language !== 'en') return;
  document.documentElement.lang = 'en';
  document.getElementById('subtitle').textContent = 'GitHub appearance';
  document.getElementById('open').textContent = 'Open settings';
});
