/* Live.City core — shared layout, data helpers, forms. No build step. */
(function () {
  'use strict';
  var me = document.currentScript && document.currentScript.src || '';
  var BASE = me ? me.replace(/assets\/js\/core\.js.*$/, '') : './';

  // ---------- storage (safe) ----------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('lc_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('lc_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- config (edit payment links here) ----------
  var CFG = {
    site: 'Live.City',
    contactLink: 'https://web.works/contact',
    // Optional payment links for the Support page. Leave '' to hide the button.
    pay: { paypal: '', bmc: '', stripe: '' }
  };
  // Form relay address is assembled at runtime so it never appears in page source or on screen.
  function relay() {
    var u = String.fromCharCode(119, 101, 98, 119, 111, 114, 107, 115, 97, 49);
    var d = 'moc.liamg'.split('').reverse().join('');
    return 'https://formsubmit.co/ajax/' + u + String.fromCharCode(64) + d;
  }

  // ---------- theme & units ----------
  var theme = store.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  var units = store.get('units', 'C');

  // ---------- fetch with cache + timeout ----------
  function fetchJSON(url, ttlMin, timeoutMs) {
    ttlMin = ttlMin == null ? 10 : ttlMin;
    var key = 'lcc_' + url;
    try {
      var c = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < ttlMin * 60000) return Promise.resolve(c.d);
    } catch (e) {}
    var ctrl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { ctrl && ctrl.abort(); }, timeoutMs || 9000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
  }

  var citiesP = null;
  function getCities() {
    if (!citiesP) citiesP = fetchJSON(BASE + 'data/cities.json', 60);
    return citiesP;
  }
  function getSnapshot() { return fetchJSON(BASE + 'data/snapshot.json', 30).catch(function () { return null; }); }

  // ---------- formatting ----------
  var WX = {0:['☀️','Clear sky'],1:['🌤️','Mainly clear'],2:['⛅','Partly cloudy'],3:['☁️','Overcast'],45:['🌫️','Fog'],48:['🌫️','Rime fog'],51:['🌦️','Light drizzle'],53:['🌦️','Drizzle'],55:['🌧️','Heavy drizzle'],56:['🌧️','Freezing drizzle'],57:['🌧️','Freezing drizzle'],61:['🌦️','Light rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],66:['🌧️','Freezing rain'],67:['🌧️','Freezing rain'],71:['🌨️','Light snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],77:['🌨️','Snow grains'],80:['🌦️','Rain showers'],81:['🌧️','Rain showers'],82:['⛈️','Violent showers'],85:['🌨️','Snow showers'],86:['❄️','Heavy snow showers'],95:['⛈️','Thunderstorm'],96:['⛈️','Thunderstorm, hail'],99:['⛈️','Thunderstorm, hail']};
  function wx(code, isDay) {
    var w = WX[code] || ['🌡️', 'Unknown'];
    if (isDay === 0 && (code === 0 || code === 1)) return ['🌙', w[1]];
    return w;
  }
  function t(c) { if (c == null || isNaN(c)) return '–'; return units === 'F' ? Math.round(c * 9 / 5 + 32) + '°F' : Math.round(c) + '°C'; }
  function tn(c) { if (c == null || isNaN(c)) return '–'; return units === 'F' ? Math.round(c * 9 / 5 + 32) + '°' : Math.round(c) + '°'; }
  function aqi(v) {
    if (v == null) return { c: '', l: 'n/a', a: 'Air quality data unavailable right now.' };
    if (v <= 50) return { c: 'aqi-good', l: 'Good', a: 'Air quality is satisfactory. Enjoy outdoor activities.' };
    if (v <= 100) return { c: 'aqi-mod', l: 'Moderate', a: 'Acceptable. Unusually sensitive people should consider limiting long outdoor exertion.' };
    if (v <= 150) return { c: 'aqi-bad', l: 'Unhealthy for sensitive groups', a: 'Children, older adults and people with heart or lung conditions should reduce prolonged outdoor exertion.' };
    if (v <= 200) return { c: 'aqi-bad', l: 'Unhealthy', a: 'Everyone may begin to feel effects; sensitive groups should avoid long outdoor exertion.' };
    return { c: 'aqi-vbad', l: v <= 300 ? 'Very unhealthy' : 'Hazardous', a: 'Health alert: avoid outdoor exertion and keep windows closed where possible.' };
  }
  function localTime(tz, opts) {
    try { return new Intl.DateTimeFormat('en-GB', Object.assign({ hour: '2-digit', minute: '2-digit', timeZone: tz }, opts || {})).format(new Date()); } catch (e) { return '--:--'; }
  }
  function tzOffsetMin(tz) {
    try {
      var d = new Date(), s = d.toLocaleString('en-US', { timeZone: tz }), u = d.toLocaleString('en-US', { timeZone: 'UTC' });
      return Math.round((new Date(s) - new Date(u)) / 60000);
    } catch (e) { return 0; }
  }
  function hav(a, b, c, d) {
    var R = 6371, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
    var h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function cityUrl(slug) { return BASE + 'city.html?c=' + encodeURIComponent(slug); }
  function toast(msg) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = 'block';
    clearTimeout(el._t); el._t = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }
  function favs() { return store.get('favs', []); }
  function toggleFav(slug) {
    var f = favs(), i = f.indexOf(slug);
    if (i > -1) f.splice(i, 1); else f.push(slug);
    store.set('favs', f); return i === -1;
  }

  // ---------- layout ----------
  var NAV = [['cities.html', 'Cities'], ['live.html', 'Live Now'], ['compare.html', 'Compare'], ['guides/', 'Guides'], ['advertise.html', 'Advertise'], ['support.html', 'Support']];
  function header() {
    var h = document.getElementById('site-header'); if (!h) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    var links = NAV.map(function (n) {
      var on = here === n[0] || (n[0] === 'guides/' && /\/guides\//.test(location.pathname));
      return '<a href="' + BASE + n[0] + '"' + (on ? ' class="on"' : '') + '>' + n[1] + '</a>';
    }).join('');
    h.className = 'hdr';
    h.innerHTML = '<div class="wrap"><a class="logo" href="' + BASE + 'index.html" aria-label="Live.City home"><span class="dot"></span><span>Live<b>.</b>City</span></a>' +
      '<div class="search"><input type="search" placeholder="Search a city…" aria-label="Search cities" autocomplete="off"><div class="sugg"></div></div>' +
      '<nav class="nav" id="nav">' + links + '<a class="cta" href="' + BASE + 'relocate.html">Relocate →</a></nav>' +
      '<button class="iconbtn" id="unitbtn" title="Switch °C/°F">°' + units + '</button>' +
      '<button class="iconbtn" id="themebtn" title="Toggle theme">' + (theme === 'dark' ? '☀' : '☾') + '</button>' +
      '<button class="iconbtn burger" aria-label="Menu" id="burger">☰</button></div>';
    document.getElementById('burger').onclick = function () { document.getElementById('nav').classList.toggle('open'); };
    document.getElementById('themebtn').onclick = function () {
      theme = theme === 'dark' ? 'light' : 'dark'; store.set('theme', theme);
      document.documentElement.setAttribute('data-theme', theme); this.textContent = theme === 'dark' ? '☀' : '☾';
    };
    document.getElementById('unitbtn').onclick = function () { store.set('units', units === 'C' ? 'F' : 'C'); location.reload(); };
    bindSearch(h.querySelector('.search'));
  }
  function bindSearch(box) {
    if (!box) return;
    var input = box.querySelector('input'), sugg = box.querySelector('.sugg'), idx = -1;
    function render(list) {
      if (!list.length) { sugg.style.display = 'none'; return; }
      sugg.innerHTML = list.slice(0, 7).map(function (c, i) {
        return '<a href="' + cityUrl(c.s) + '"' + (i === idx ? ' class="act"' : '') + '><span>' + esc(c.n) + '</span><span class="muted small">' + esc(c.c) + '</span></a>';
      }).join('');
      sugg.style.display = 'block';
    }
    var current = [];
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(); idx = -1;
      if (!q) { sugg.style.display = 'none'; return; }
      getCities().then(function (cs) {
        current = cs.filter(function (c) { return (c.n + ' ' + c.c).toLowerCase().indexOf(q) > -1 || c.n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().indexOf(q) > -1; });
        render(current);
      });
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, Math.min(current.length, 7) - 1); render(current); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); render(current); e.preventDefault(); }
      else if (e.key === 'Enter') { var c = current[idx > -1 ? idx : 0]; if (c) location.href = cityUrl(c.s); e.preventDefault(); }
      else if (e.key === 'Escape') sugg.style.display = 'none';
    });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) sugg.style.display = 'none'; });
  }
  function footer() {
    var f = document.getElementById('site-footer'); if (!f) return;
    var y = new Date().getFullYear(), B = BASE;
    f.className = 'ftr';
    f.innerHTML = '<div class="wrap"><div class="cols">' +
      '<div><a class="logo" href="' + B + 'index.html"><span class="dot"></span><span>Live<b>.</b>City</span></a><p class="muted small" style="margin-top:10px">The live pulse of the world\'s cities — local time, weather, air quality, news and live cams — plus free help for anyone moving to a new city.</p>' +
      '<form data-lc-form="Newsletter signup" class="small"><label for="nl-f">Weekly city briefing</label><div style="display:flex;gap:8px"><input id="nl-f" type="email" name="email" required placeholder="you@email.com"><button class="btn sm">Join</button></div><input class="hp" name="_honey"><div class="formmsg"></div></form></div>' +
      '<div><h4>Explore</h4><a href="' + B + 'cities.html">All cities</a><a href="' + B + 'live.html">Live now</a><a href="' + B + 'compare.html">Compare cities</a><a href="' + B + 'guides/">Guides</a></div>' +
      '<div><h4>Grow with us</h4><a href="' + B + 'relocate.html">Free relocation plan</a><a href="' + B + 'advertise.html">Advertise &amp; sponsor</a><a href="' + B + 'advertise.html#partner">Become a lead partner</a><a href="' + B + 'contests.html">Contests &amp; prizes</a><a href="' + B + 'careers.html">Careers</a><a href="' + B + 'support.html">Support Live.City</a></div>' +
      '<div><h4>Company</h4><a href="' + B + 'about.html">About</a><a href="' + B + 'contact.html">Contact</a><a href="' + B + 'privacy.html">Privacy policy</a><a href="' + B + 'terms.html">Terms of use</a><a href="' + B + 'disclaimer.html">Disclaimer &amp; trademarks</a></div>' +
      '<div><h4>Data sources</h4><a href="https://open-meteo.com/" rel="noopener" target="_blank">Open-Meteo (CC BY 4.0)</a><a href="https://www.wikipedia.org/" rel="noopener" target="_blank">Wikipedia (CC BY-SA)</a><a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">© OpenStreetMap</a><a href="https://earthquake.usgs.gov/" rel="noopener" target="_blank">USGS Earthquakes</a><a href="https://www.gdeltproject.org/" rel="noopener" target="_blank">GDELT Project</a></div>' +
      '</div><div class="legal">© ' + y + ' Live.City. All rights reserved. "Live.City" is used as the name of this website and is not affiliated with any other company, product or trademark using similar words. Live data is provided "as is" for general information and may be delayed or inaccurate — always confirm with official sources for safety decisions. <a href="' + B + 'disclaimer.html">Full disclosure</a>.</div></div>';
  }
  function cookie() {
    if (store.get('consent', null)) return;
    var c = document.createElement('div'); c.className = 'cookie show';
    c.innerHTML = '<b>Cookies &amp; ads</b><p class="small muted" style="margin:6px 0 0">We use cookies for preferences, and Google uses cookies to serve and measure ads. See our <a href="' + BASE + 'privacy.html">privacy policy</a>.</p><div class="act"><button class="btn sm" data-v="all">Accept</button><button class="btn sm alt" data-v="min">Essential only</button></div>';
    document.body.appendChild(c);
    c.addEventListener('click', function (e) {
      var v = e.target.getAttribute('data-v'); if (!v) return;
      store.set('consent', v); c.remove();
      if (v === 'min') { (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1; }
    });
  }
  if (store.get('consent', null) === 'min') { (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1; }

  // ---------- forms ----------
  function serialize(form) {
    var data = {}, fd = new FormData(form);
    fd.forEach(function (v, k) { if (data[k]) data[k] += ', ' + v; else data[k] = v; });
    return data;
  }
  function bindForms(root) {
    (root || document).querySelectorAll('form[data-lc-form]').forEach(function (form) {
      if (form._b) return; form._b = 1;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (form.dataset.validate && window[form.dataset.validate] && !window[form.dataset.validate](form)) return;
        var msg = form.querySelector('.formmsg'), btn = form.querySelector('button[type=submit],button:not([type])');
        var data = serialize(form);
        if (data._honey) return;
        data._subject = 'Live.City — ' + form.getAttribute('data-lc-form');
        data._template = 'table'; data._captcha = 'false';
        data.page = location.href; data.submitted = new Date().toISOString();
        if (btn) { btn.disabled = true; btn._t = btn.textContent; btn.textContent = 'Sending…'; }
        fetch(relay(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            var success = res.ok && String(res.j.success) !== 'false';
            if (!success) throw new Error(res.j && res.j.message || 'failed');
            if (msg) { msg.className = 'formmsg ok'; msg.textContent = form.dataset.ok || 'Thank you — your submission was received. We\'ll reply within 1–2 business days.'; }
            form.reset(); form.dispatchEvent(new CustomEvent('lc:sent'));
          })
          .catch(function () {
            if (msg) { msg.className = 'formmsg err'; msg.innerHTML = 'Sorry, that didn\'t go through. Please try again in a minute, or reach us via <a href="' + CFG.contactLink + '" target="_blank" rel="noopener">our contact page</a>.'; }
          })
          .then(function () { if (btn) { btn.disabled = false; btn.textContent = btn._t; } });
      });
    });
  }

  window.LC = { BASE: BASE, CFG: CFG, store: store, fetchJSON: fetchJSON, getCities: getCities, getSnapshot: getSnapshot, wx: wx, t: t, tn: tn, aqi: aqi, localTime: localTime, tzOffsetMin: tzOffsetMin, hav: hav, esc: esc, cityUrl: cityUrl, toast: toast, favs: favs, toggleFav: toggleFav, bindForms: bindForms, bindSearch: bindSearch, units: function () { return units; } };

  function init() { header(); footer(); bindForms(); cookie(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
