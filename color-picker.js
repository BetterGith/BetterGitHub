(() => {
  'use strict';

  const attached = new WeakMap();
  const observedDialogs = new WeakSet();
  let active = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safeHex = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : null;

  function hexToHsl(hex) {
    const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
    const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
    let hue = 0;
    const light = (max + min) / 2;
    let saturation = 0;
    if (delta) {
      saturation = delta / (1 - Math.abs(2 * light - 1));
      switch (max) {
        case rgb[0]: hue = ((rgb[1] - rgb[2]) / delta) % 6; break;
        case rgb[1]: hue = (rgb[2] - rgb[0]) / delta + 2; break;
        default: hue = (rgb[0] - rgb[1]) / delta + 4;
      }
      hue = (hue * 60 + 360) % 360;
    }
    return [Math.round(hue), Math.round(saturation * 100), Math.round(light * 100)];
  }

  function hslToHex(hue, saturation, light) {
    const h = ((Number(hue) % 360) + 360) % 360;
    const s = clamp(Number(saturation), 0, 100) / 100;
    const l = clamp(Number(light), 0, 100) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - chroma / 2;
    const parts = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0]
      : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma]
      : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
    return `#${parts.map(part => Math.round((part + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  }

  function closePicker({ focus = false } = {}) {
    if (!active) return;
    const { popup, button, onOutside, onKey } = active;
    popup.remove();
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    button.setAttribute('aria-expanded', 'false');
    active = null;
    if (focus) button.focus();
  }

  function position(popup, button) {
    const rect = button.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const left = clamp(rect.left, 12, Math.max(12, window.innerWidth - width - 12));
    popup.style.width = `${width}px`;
    popup.style.left = `${left}px`;
    popup.style.top = `${rect.bottom + 8}px`;
    const height = popup.getBoundingClientRect().height;
    if (rect.bottom + 8 + height > window.innerHeight - 12) {
      popup.style.top = `${Math.max(12, rect.top - height - 8)}px`;
    }
  }

  function openPicker(source, button) {
    closePicker();
    const en = source.closest('dialog')?.dataset.bghLanguage === 'en';
    const ui = (ru, english) => en ? english : ru;
    const popup = document.createElement('div');
    popup.className = 'bgh-color-popover';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', `${source.closest('label')?.textContent.trim() || source.name} — ${ui('выбор цвета', 'color picker')}`);
    popup.innerHTML = '<div class="bgh-color-head"><strong>Выбрать цвет</strong><button type="button" class="bgh-color-close" aria-label="Закрыть выбор цвета">×</button></div><div class="bgh-color-preview"></div><label class="bgh-color-hex">HEX<input type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="HEX цвет"></label><label class="bgh-color-slider">Оттенок <output></output><input type="range" min="0" max="359" data-channel="hue"></label><label class="bgh-color-slider">Насыщенность <output></output><input type="range" min="0" max="100" data-channel="saturation"></label><label class="bgh-color-slider">Светлота <output></output><input type="range" min="0" max="100" data-channel="lightness"></label>';
    popup.querySelector('.bgh-color-head strong').textContent = ui('Выбрать цвет', 'Choose color');
    popup.querySelector('.bgh-color-close').setAttribute('aria-label', ui('Закрыть выбор цвета', 'Close color picker'));
    popup.querySelector('.bgh-color-hex input').setAttribute('aria-label', ui('HEX цвет', 'HEX color'));
    for (const [selector, ru, english] of [['hue', 'Оттенок', 'Hue'], ['saturation', 'Насыщенность', 'Saturation'], ['lightness', 'Светлота', 'Lightness']]) {
      popup.querySelector(`[data-channel="${selector}"]`).closest('label').firstChild.textContent = `${ui(ru, english)} `;
    }
    document.body.append(popup);
    const hexInput = popup.querySelector('.bgh-color-hex input');
    const preview = popup.querySelector('.bgh-color-preview');
    const sliders = [...popup.querySelectorAll('input[type="range"]')];

    function sync(value) {
      const color = safeHex(value) || '#000000';
      const hsl = hexToHsl(color);
      preview.style.backgroundColor = color;
      hexInput.value = color.toUpperCase();
      hexInput.setCustomValidity('');
      sliders.forEach((slider, index) => {
        slider.value = String(hsl[index]);
        slider.previousElementSibling.value = `${hsl[index]}${index ? '%' : '°'}`;
      });
      popup.style.setProperty('--bgh-picker-hue', String(hsl[0]));
    }

    function setColor(value, eventType = 'input', preserveHsl = false) {
      const color = safeHex(value);
      if (!color) return false;
      source.value = color;
      button.style.setProperty('--bgh-swatch', color);
      if (preserveHsl) {
        preview.style.backgroundColor = color;
        hexInput.value = color.toUpperCase();
        hexInput.setCustomValidity('');
        sliders.forEach((slider, index) => { slider.previousElementSibling.value = `${slider.value}${index ? '%' : '°'}`; });
        popup.style.setProperty('--bgh-picker-hue', sliders[0].value);
      } else sync(color);
      source.dispatchEvent(new Event(eventType, { bubbles: true }));
      return true;
    }

    sync(source.value);
    hexInput.addEventListener('input', () => {
      const color = safeHex(hexInput.value.trim());
      hexInput.setCustomValidity(color ? '' : ui('Введите цвет в формате #RRGGBB', 'Enter a color as #RRGGBB'));
      if (color) setColor(color);
    });
    hexInput.addEventListener('change', () => {
      if (safeHex(hexInput.value.trim())) setColor(hexInput.value.trim(), 'change');
      else sync(source.value);
    });
    hexInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (setColor(hexInput.value.trim(), 'change')) closePicker({ focus: true });
      }
    });
    sliders.forEach(slider => {
      const update = event => {
        const [hue, saturation, lightness] = sliders.map(item => Number(item.value));
        setColor(hslToHex(hue, saturation, lightness), event.type, true);
      };
      slider.addEventListener('input', update);
      slider.addEventListener('change', update);
    });
    popup.querySelector('.bgh-color-close').addEventListener('click', () => closePicker({ focus: true }));
    const onOutside = event => {
      if (!popup.contains(event.target) && !button.contains(event.target)) closePicker();
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker({ focus: true }); }
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    active = { popup, button, source, onOutside, onKey };
    button.setAttribute('aria-expanded', 'true');
    position(popup, button);
    hexInput.focus();
    hexInput.select();
  }

  function attach(root) {
    if (!root?.querySelectorAll) return;
    const form = root.matches?.('#bgh-form') ? root : root.querySelector('#bgh-form');
    if (!form) return;
    const dialog = form.closest('dialog');
    if (dialog && !observedDialogs.has(dialog)) {
      dialog.addEventListener('close', () => { if (active?.source && dialog.contains(active.source)) closePicker(); });
      observedDialogs.add(dialog);
    }
    for (const source of form.querySelectorAll('input[type="color"], input[data-bgh-color-source]')) {
      let button = attached.get(source);
      if (!button) {
        source.type = 'hidden';
        source.dataset.bghColorSource = 'yes';
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'bgh-color-swatch';
        button.setAttribute('aria-label', `${root.closest?.('dialog')?.dataset.bghLanguage === 'en' ? 'Choose color' : 'Выбрать цвет'}: ${source.closest('label')?.textContent.trim() || source.name}`);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', () => active?.button === button ? closePicker() : openPicker(source, button));
        source.addEventListener('input', () => {
          button.style.setProperty('--bgh-swatch', safeHex(source.value) || '#000000');
        });
        source.after(button);
        attached.set(source, button);
      }
      button.style.setProperty('--bgh-swatch', safeHex(source.value) || '#000000');
      button.setAttribute('aria-label', `${root.closest?.('dialog')?.dataset.bghLanguage === 'en' ? 'Choose color' : 'Выбрать цвет'}: ${source.closest('label')?.textContent.trim() || source.name}`);
    }
  }

  globalThis.BGHColorPicker = { attach };
})();
