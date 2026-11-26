/* AutoParts VIN Safety — content script (MV3, no build step). */
(() => {
  'use strict';

  const APP_BASE = 'https://drifter1987.github.io/AutoParts-dc';
  const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
  const CHECK_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const TRANSLITERATION = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

  let currentVin = null;
  let host = null;
  let shadow = null;
  let requestToken = 0;

  function checkDigitValid(vin) {
    let total = 0;
    for (let index = 0; index < 17; index += 1) {
      const char = vin[index];
      const value = /[0-9]/.test(char) ? Number(char) : TRANSLITERATION[char];
      if (value === undefined) return false;
      total += value * CHECK_WEIGHTS[index];
    }
    const remainder = total % 11;
    return vin[8] === (remainder === 10 ? 'X' : String(remainder));
  }

  function validShape(value) {
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(value);
  }

  function candidatesFromText(text) {
    const matches = text.match(VIN_RE) || [];
    return [...new Set(matches.map(value => value.toUpperCase()))];
  }

  function visibleText() {
    const chunks = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      chunks.push(node.nodeValue);
      node = walker.nextNode();
      if (chunks.join(' ').length > 120000) break;
    }
    return chunks.join(' ');
  }

  function findVin() {
    const candidates = [];
    const params = new URLSearchParams(window.location.search);
    for (const key of ['vin', 'VIN', 'vehicleVin', 'vehicle_vin']) {
      const value = params.get(key);
      if (value) candidates.push(value.toUpperCase());
    }

    for (const element of document.querySelectorAll('[data-vin], [itemprop="vehicleIdentificationNumber"]')) {
      const value = element.getAttribute('data-vin') || element.textContent || '';
      candidates.push(value.trim().toUpperCase());
    }

    candidates.push(...candidatesFromText(visibleText()));
    const shaped = [...new Set(candidates)].filter(validShape);
    if (!shaped.length) return null;
    return shaped.find(checkDigitValid) || shaped[0];
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement('div');
    host.id = 'autoparts-vin-safety-host';
    host.style.cssText = 'position:fixed;z-index:2147483646;right:18px;bottom:18px;';
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = `
      :host { all: initial; }
      .ap-card { width: 320px; max-width: calc(100vw - 36px); max-height: 72vh; overflow: auto;
        background: #10151b; color: #e8edf2; border: 1px solid #34414d; border-radius: 12px;
        box-shadow: 0 18px 50px rgba(0,0,0,.45); font: 13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
      .ap-head { display:flex; justify-content:space-between; gap:10px; padding:12px 14px; border-bottom:1px solid #28333d; }
      .ap-brand { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#f0b429; }
      .ap-title { margin:2px 0 0; font-size:15px; font-weight:800; color:#fff; }
      .ap-x { border:0; background:none; color:#9aa7b3; font-size:20px; cursor:pointer; line-height:1; }
      .ap-body { padding: 12px 14px 14px; }
      .ap-vin { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; color:#f0b429; font-size:12px; letter-spacing:.06em; word-break:break-all; }
      .ap-muted { color:#9aa7b3; font-size:12px; }
      .ap-row { display:grid; grid-template-columns: 88px 1fr; gap:6px; padding:3px 0; }
      .ap-label { color:#7f8d99; font-size:11px; }
      .ap-value { color:#e8edf2; font-size:12px; }
      .ap-count { color:#f0b429; font-size:24px; font-weight:800; line-height:1.1; }
      .ap-link { display:inline-flex; gap:4px; color:#7fd4ff; text-decoration:underline; text-underline-offset:2px; font-size:12px; }
      .ap-actions { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
      .ap-primary { display:block; text-align:center; text-decoration:none; background:#f0b429; color:#10151b;
        font-weight:800; padding:8px 10px; border-radius:7px; }
      .ap-secondary { display:block; text-align:center; text-decoration:none; border:1px solid #3b4955; color:#dbe4eb;
        padding:7px 10px; border-radius:7px; }
      .ap-note { margin:10px 0 0; padding-top:9px; border-top:1px solid #28333d; color:#7f8d99; font-size:10.5px; }
      .ap-warn { margin:8px 0; padding:8px 10px; border:1px solid #5a4a1f; border-radius:7px; background:#241f10; color:#f0b429; font-size:11.5px; }
      .ap-badge { display:inline-block; padding:2px 7px; border:1px solid #34414d; border-radius:999px; color:#9aa7b3; font-size:10px; }
      .ap-loading { height:8px; width:60%; border-radius:999px; background:linear-gradient(90deg,#28333d,#3b4955,#28333d); }
    `;
    shadow.appendChild(style);
  }

  function renderShell(vin) {
    ensureHost();
    shadow.querySelector('.ap-card')?.remove();
    const card = el('section', 'ap-card');
    card.setAttribute('role', 'complementary');
    card.setAttribute('aria-label', 'AutoParts VIN safety');

    const head = el('div', 'ap-head');
    const titleWrap = el('div');
    titleWrap.appendChild(el('div', 'ap-brand', 'AutoParts'));
    titleWrap.appendChild(el('h2', 'ap-title', 'VIN safety check'));
    head.appendChild(titleWrap);
    const close = el('button', 'ap-x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close AutoParts panel');
    close.addEventListener('click', () => {
      host?.remove();
      host = null;
      shadow = null;
    });
    head.appendChild(close);
    card.appendChild(head);

    const body = el('div', 'ap-body');
    body.appendChild(el('div', 'ap-vin', vin));
    body.appendChild(el('div', 'ap-muted', 'Reading NHTSA vehicle data…'));
    body.appendChild(el('div', 'ap-loading'));
    body.appendChild(el('p', 'ap-note', 'Model-year recalls are not a VIN-specific open-recall determination. Confirm at NHTSA.'));
    card.appendChild(body);
    shadow.appendChild(card);
    return { card, body };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`NHTSA ${response.status}`);
    return response.json();
  }

  function value(decoded, key) {
    const candidate = decoded?.[key];
    return candidate && candidate !== 'Not Applicable' ? String(candidate) : '';
  }

  async function load(vin) {
    const token = ++requestToken;
    const { card, body } = renderShell(vin);
    try {
      const decodeUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
      const decode = await fetchJson(decodeUrl);
      if (token !== requestToken) return;
      const decoded = decode.Results?.[0] || {};
      const year = value(decoded, 'ModelYear');
      const make = value(decoded, 'Make');
      const model = value(decoded, 'Model');
      const vehicleLabel = [year, make, model].filter(Boolean).join(' ') || 'Decoded vehicle';

      let recalls = null;
      if (year && make && model) {
        const recallUrl = new URL('https://api.nhtsa.gov/recalls/recallsByVehicle');
        recallUrl.searchParams.set('make', make);
        recallUrl.searchParams.set('model', model);
        recallUrl.searchParams.set('modelYear', year);
        try {
          recalls = await fetchJson(recallUrl.toString());
        } catch {
          recalls = null;
        }
      }
      if (token !== requestToken) return;

      body.textContent = '';
      const title = el('div', 'ap-title', vehicleLabel);
      title.style.fontSize = '14px';
      body.appendChild(title);
      body.appendChild(el('div', 'ap-vin', vin));

      const details = el('div');
      details.style.marginTop = '8px';
      [
        ['Trim', value(decoded, 'Trim')],
        ['Engine', value(decoded, 'EngineModel') || value(decoded, 'DisplacementL')],
        ['Fuel', value(decoded, 'FuelTypePrimary')],
        ['Drive', value(decoded, 'DriveType')],
      ].forEach(([label, entry]) => {
        if (!entry) return;
        const row = el('div', 'ap-row');
        row.appendChild(el('span', 'ap-label', label));
        row.appendChild(el('span', 'ap-value', entry));
        details.appendChild(row);
      });
      body.appendChild(details);

      if (!checkDigitValid(vin)) {
        body.appendChild(el('div', 'ap-warn', 'The VIN check digit does not validate. Confirm the characters before relying on this decode.'));
      }

      const recallWrap = el('div');
      recallWrap.style.marginTop = '11px';
      recallWrap.appendChild(el('div', 'ap-label', 'Model-year recall campaigns'));
      if (recalls === null) {
        recallWrap.appendChild(el('div', 'ap-muted', 'Recall count unavailable. Use the NHTSA VIN check.'));
      } else {
        const count = Number(recalls.Count) || 0;
        recallWrap.appendChild(el('div', 'ap-count', String(count)));
        recallWrap.appendChild(el('div', 'ap-muted', count === 0 ? 'No campaigns returned for this model year.' : 'Campaigns returned for this model year.'));
        (recalls.results || []).slice(0, 3).forEach(item => {
          const note = el('div', 'ap-muted');
          note.style.marginTop = '5px';
          note.textContent = `${item.NHTSACampaignNumber || 'Campaign'} · ${item.Component || 'Safety recall'}`;
          recallWrap.appendChild(note);
        });
      }
      body.appendChild(recallWrap);

      const actions = el('div', 'ap-actions');
      const reportLink = el('a', 'ap-primary', 'Open full VIN safety report');
      reportLink.href = `${APP_BASE}/vin?vin=${encodeURIComponent(vin)}&report=1`;
      reportLink.target = '_blank';
      reportLink.rel = 'noreferrer';
      actions.appendChild(reportLink);

      const nhtsaLink = el('a', 'ap-secondary', 'Check this VIN at NHTSA');
      nhtsaLink.href = `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`;
      nhtsaLink.target = '_blank';
      nhtsaLink.rel = 'noreferrer';
      actions.appendChild(nhtsaLink);
      body.appendChild(actions);
      body.appendChild(el('p', 'ap-note', 'Model-year recalls are not a VIN-specific open-recall determination. Complaints and investigations stay model-level.'));
    } catch {
      if (token !== requestToken) return;
      body.textContent = '';
      body.appendChild(el('div', 'ap-title', 'VIN detected'));
      body.appendChild(el('div', 'ap-vin', vin));
      body.appendChild(el('p', 'ap-muted', 'NHTSA data could not be loaded. You can still open the VIN check directly.'));
      const actions = el('div', 'ap-actions');
      const reportLink = el('a', 'ap-primary', 'Open AutoParts VIN report');
      reportLink.href = `${APP_BASE}/vin?vin=${encodeURIComponent(vin)}&report=1`;
      reportLink.target = '_blank';
      reportLink.rel = 'noreferrer';
      actions.appendChild(reportLink);
      const nhtsaLink = el('a', 'ap-secondary', 'Check this VIN at NHTSA');
      nhtsaLink.href = `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`;
      nhtsaLink.target = '_blank';
      nhtsaLink.rel = 'noreferrer';
      actions.appendChild(nhtsaLink);
      body.appendChild(actions);
    }
    return card;
  }

  function scan() {
    const vin = findVin();
    if (!vin || vin === currentVin) return;
    currentVin = vin;
    void load(vin);
  }

  let scanTimer = null;
  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 500);
  }

  scan();
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('hashchange', scheduleScan);
})();
