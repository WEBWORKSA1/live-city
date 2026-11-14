/* Live.City page logic. Each page sets <body data-page="...">. */
(function () {
  'use strict';
  var L = window.LC, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var page = document.body.getAttribute('data-page');
  var OM = 'https://api.open-meteo.com/v1/forecast', AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  var USGS = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';

  // ---------- shared ----------
  function batchLive(cities) {
    var la = cities.map(function (c) { return c.la; }).join(','), lo = cities.map(function (c) { return c.lo; }).join(',');
    var w = L.fetchJSON(OM + '?latitude=' + la + '&longitude=' + lo + '&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m', 10);
    var a = L.fetchJSON(AQ + '?latitude=' + la + '&longitude=' + lo + '&current=us_aqi', 20).catch(function () { return null; });
    return Promise.all([w, a]).then(function (r) {
      var W = [].concat(r[0]), A = r[1] ? [].concat(r[1]) : [];
      var out = {};
      cities.forEach(function (c, i) {
        var cw = W[i] && W[i].current || {}, ca = A[i] && A[i].current || {};
        out[c.s] = { t: cw.temperature_2m, code: cw.weather_code, day: cw.is_day, wind: cw.wind_speed_10m, hum: cw.relative_humidity_2m, aqi: ca.us_aqi };
      });
      return out;
    }).catch(function () {
      return L.getSnapshot().then(function (s) { return s && s.cities || {}; });
    });
  }
  function card(c, d) {
    d = d || {};
    var w = L.wx(d.code, d.day), q = L.aqi(d.aqi), fav = L.favs().indexOf(c.s) > -1;
    return '<a class="card citycard" href="' + L.cityUrl(c.s) + '" data-slug="' + c.s + '"><div class="top"><div><h3>' + L.esc(c.n) + '</h3><div class="muted small">' + L.esc(c.c) + '</div></div><div style="text-align:right"><div class="temp">' + (d.t == null ? '<span class="skeleton">00°</span>' : L.tn(d.t)) + '</div><div style="font-size:1.4rem" title="' + w[1] + '">' + (d.code == null ? '' : w[0]) + '</div></div></div>' +
      '<div class="meta"><span>🕒 <b data-tz="' + c.tz + '">' + L.localTime(c.tz) + '</b></span>' + (d.aqi != null ? '<span class="badge ' + q.c + '">AQI ' + Math.round(d.aqi) + '</span>' : '') + (d.code != null ? '<span>' + w[1] + '</span>' : '') + '</div>' +
      '<button class="fav' + (fav ? ' on' : '') + '" data-fav="' + c.s + '" aria-label="Save city">★</button></a>';
  }
  function bindFavs(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-fav]'); if (!b) return;
      e.preventDefault(); var on = L.toggleFav(b.getAttribute('data-fav'));
      b.classList.toggle('on', on); L.toast(on ? 'Saved to your cities' : 'Removed from your cities');
    });
  }
  function tickClocks() { $$('[data-tz]').forEach(function (el) { el.textContent = L.localTime(el.getAttribute('data-tz'), el.hasAttribute('data-sec') ? { second: '2-digit' } : null); }); }
  setInterval(tickClocks, 1000);
  function loadLeaflet() {
    if (window.L_) return window.L_;
    window.L_ = new Promise(function (res, rej) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = function () { res(window.L); }; s.onerror = rej; document.head.appendChild(s);
    });
    return window.L_;
  }
  function baseMap(el, center, zoom) {
    return loadLeaflet().then(function (Lf) {
      var m = Lf.map(el, { scrollWheelZoom: false, worldCopyJump: true }).setView(center, zoom);
      Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(m);
      return { m: m, Lf: Lf };
    });
  }
  function ago(iso) {
    var d = typeof iso === 'number' ? iso : Date.parse(iso), m = Math.round((Date.now() - d) / 60000);
    if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; return Math.round(m / 1440) + ' d ago';
  }
  function gdelt(q, n, span) {
    var url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(q + ' sourcelang:english') + '&mode=ArtList&maxrecords=' + (n || 8) + '&timespan=' + (span || '3d') + '&sort=DateDesc&format=json';
    return L.fetchJSON(url, 30, 10000).then(function (j) { return (j && j.articles) || []; });
  }
  function newsHTML(arts) {
    if (!arts.length) return '<p class="muted">No fresh headlines right now — check back soon.</p>';
    return arts.map(function (a) {
      var s = a.seendate || '', d = s ? Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13)) : null;
      return '<a class="newsitem" href="' + L.esc(a.url) + '" target="_blank" rel="noopener nofollow">' + L.esc(a.title) + '<small>' + L.esc(a.domain) + (d ? ' · ' + ago(d) : '') + '</small></a>';
    }).join('');
  }
  function facades() {
    $$('.facade[data-yt]').forEach(function (f) {
      f.addEventListener('click', function () {
        if (f.querySelector('iframe')) return;
        f.innerHTML = '<iframe src="' + f.getAttribute('data-yt') + (f.getAttribute('data-yt').indexOf('?') > -1 ? '&' : '?') + 'autoplay=1&mute=1" title="Live video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      });
    });
  }
  function citySelect(sel, cities, val) {
    sel.innerHTML = cities.map(function (c) { return '<option value="' + c.s + '"' + (c.s === val ? ' selected' : '') + '>' + L.esc(c.n) + ', ' + L.esc(c.c) + '</option>'; }).join('');
  }
  var qs = new URLSearchParams(location.search);

  // ---------- HOME ----------
  function home() {
    L.bindSearch($('.hero-s'));
    L.getCities().then(function (cs) {
      var strip = $('#clocks');
      if (strip) strip.innerHTML = cs.filter(function (c) { return ['new-york', 'london', 'paris', 'dubai', 'mumbai', 'singapore', 'tokyo', 'sydney', 'toronto', 'sao-paulo', 'cape-town', 'los-angeles'].indexOf(c.s) > -1; })
        .map(function (c) { return '<a class="ck" href="' + L.cityUrl(c.s) + '"><b data-tz="' + c.tz + '">' + L.localTime(c.tz) + '</b><span>' + L.esc(c.n) + '</span></a>'; }).join('');
      var feat = cs.slice(0, 12), grid = $('#livegrid');
      grid.innerHTML = feat.map(function (c) { return card(c); }).join(''); bindFavs(grid);
      batchLive(cs).then(function (d) {
        grid.innerHTML = feat.map(function (c) { return card(c, d[c.s]); }).join('');
        var day = 0, hot = null, cold = null;
        cs.forEach(function (c) { var x = d[c.s]; if (!x || x.t == null) return; if (x.day) day++; if (!hot || x.t > d[hot.s].t) hot = c; if (!cold || x.t < d[cold.s].t) cold = c; });
        $('#st-day').textContent = day + ' / ' + cs.length;
        if (hot) { $('#st-hot').textContent = L.t(d[hot.s].t); $('#st-hot-n').textContent = 'Warmest now: ' + hot.n; }
        if (cold) { $('#st-cold').textContent = L.t(d[cold.s].t); $('#st-cold-n').textContent = 'Coolest now: ' + cold.n; }
      });
      var sel = $('#rel-to'); if (sel) { citySelect(sel, cs, 'lisbon'); }
    });
    L.fetchJSON(USGS + 'all_day.geojson', 10).then(function (j) { $('#st-q').textContent = j.metadata.count.toLocaleString(); }).catch(function () { $('#st-q').textContent = '—'; });
    var rf = $('#rel-quick'); if (rf) rf.addEventListener('submit', function (e) { e.preventDefault(); location.href = L.BASE + 'relocate.html?to=' + $('#rel-to').value; });
  }

  // ---------- CITIES ----------
  function cities() {
    var region = 'All', q = '', sort = 'name', favOnly = false, data = {}, all = [];
    var grid = $('#citygrid'); bindFavs(grid);
    function draw() {
      var f = L.favs();
      var list = all.filter(function (c) {
        return (region === 'All' || c.r === region) && (!q || (c.n + ' ' + c.c).toLowerCase().indexOf(q) > -1) && (!favOnly || f.indexOf(c.s) > -1);
      });
      list.sort(function (a, b) {
        if (sort === 'warm') return ((data[b.s] || {}).t || -99) - ((data[a.s] || {}).t || -99);
        if (sort === 'cool') return ((data[a.s] || {}).t || 99) - ((data[b.s] || {}).t || 99);
        if (sort === 'air') return ((data[a.s] || {}).aqi || 999) - ((data[b.s] || {}).aqi || 999);
        if (sort === 'time') return L.tzOffsetMin(b.tz) - L.tzOffsetMin(a.tz);
        return a.n.localeCompare(b.n);
      });
      grid.innerHTML = list.length ? list.map(function (c) { return card(c, data[c.s]); }).join('') : '<p class="muted">No cities match. Try another filter.</p>';
      $('#count').textContent = list.length + ' cities';
    }
    L.getCities().then(function (cs) {
      all = cs; draw();
      batchLive(cs).then(function (d) { data = d; draw(); if (mapObj) drawMap(); });
    });
    $('#regions').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $$('#regions .chip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
      if (b.dataset.r === 'fav') { favOnly = true; region = 'All'; } else { favOnly = false; region = b.dataset.r; }
      draw();
    });
    $('#filter').addEventListener('input', function () { q = this.value.trim().toLowerCase(); draw(); });
    $('#sort').addEventListener('change', function () { sort = this.value; draw(); });
    var mapObj = null, markers = [];
    function drawMap() {
      markers.forEach(function (m) { m.remove(); }); markers = [];
      all.forEach(function (c) {
        var d = data[c.s] || {};
        var m = mapObj.Lf.marker([c.la, c.lo]).addTo(mapObj.m).bindPopup('<b>' + L.esc(c.n) + '</b><br>' + (d.t != null ? L.t(d.t) + ' · ' + L.wx(d.code, d.day)[1] + '<br>' : '') + '<a href="' + L.cityUrl(c.s) + '">Open live dashboard →</a>');
        markers.push(m);
      });
    }
    $('#mapbtn').addEventListener('click', function () {
      var el = $('#citymap'); el.style.display = el.style.display === 'none' ? 'block' : 'none';
      if (!mapObj && el.style.display === 'block') baseMap(el, [25, 10], 2).then(function (o) { mapObj = o; drawMap(); }).catch(function () { el.innerHTML = '<p class="muted" style="padding:20px">Map unavailable right now.</p>'; });
    });
  }

  // ---------- CITY ----------
  function city() {
    var slug = qs.get('c') || document.body.getAttribute('data-slug') || 'new-york';
    L.getCities().then(function (cs) {
      var c = cs.filter(function (x) { return x.s === slug; })[0];
      if (!c) { $('#cityname').textContent = 'City not found'; $('#citydesc').innerHTML = 'Try the <a href="' + L.BASE + 'cities.html">city directory</a>.'; return; }
      document.title = c.n + ' Live — Time, Weather, Air Quality, News & Cams | Live.City';
      var md = $('meta[name=description]'); if (md) md.setAttribute('content', 'Live ' + c.n + ' dashboard: local time, current weather, 7-day forecast, air quality, sunrise and sunset, news, earthquakes and live cams. Moving to ' + c.n + '? Get a free relocation plan.');
      $$('[data-city]').forEach(function (el) { el.textContent = c.n; });
      $('#cityname').textContent = c.n;
      $('#citycountry').textContent = c.c + ' · ' + c.r;
      $('#cityclock').setAttribute('data-tz', c.tz); $('#cityclock').setAttribute('data-sec', '');
      $('#citydate').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: c.tz }).format(new Date());
      var off = L.tzOffsetMin(c.tz) - (-new Date().getTimezoneOffset()), sign = off >= 0 ? '+' : '−';
      $('#citydiff').textContent = off === 0 ? 'Same time as you' : sign + Math.floor(Math.abs(off) / 60) + 'h' + (Math.abs(off) % 60 ? ' ' + Math.abs(off) % 60 + 'm' : '') + ' from you';
      $('#citydesc').textContent = c.d;
      $('#cityhl').innerHTML = c.h.map(function (h) { return '<li>' + L.esc(h) + '</li>'; }).join('');
      $('#citybt').textContent = c.bt;
      $('#cityfacts').innerHTML = '<tr><th>Country</th><td>' + L.esc(c.c) + '</td></tr><tr><th>Time zone</th><td>' + L.esc(c.tz.replace(/_/g, ' ')) + '</td></tr><tr><th>Currency</th><td>' + L.esc(c.cur) + '</td></tr><tr><th>Languages</th><td>' + L.esc(c.lang) + '</td></tr><tr><th>Coordinates</th><td>' + c.la.toFixed(2) + ', ' + c.lo.toFixed(2) + '</td></tr>';
      $$('.rel-link').forEach(function (a) { a.href = L.BASE + 'relocate.html?to=' + c.s; });
      $$('.biz-link').forEach(function (a) { a.href = L.BASE + 'advertise.html?city=' + c.s + '#partner'; });
      var yq = encodeURIComponent(c.n + ' live cam');
      $('#camlinks').innerHTML = '<a class="btn red sm" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + yq + '&sp=EgJAAQ%253D%253D">▶ Live cams on YouTube</a> <a class="btn alt sm" target="_blank" rel="noopener" href="https://www.windy.com/webcams?' + c.la + ',' + c.lo + ',10">Windy webcams</a> <a class="btn alt sm" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(c.n + ' walking tour 4k') + '">Walking tours</a>';
      var fb = $('#favbtn'); fb.textContent = L.favs().indexOf(c.s) > -1 ? '★ Saved' : '☆ Save city';
      fb.onclick = function () { var on = L.toggleFav(c.s); fb.textContent = on ? '★ Saved' : '☆ Save city'; };
      $('#sharebtn').onclick = function () {
        var u = location.href;
        if (navigator.share) navigator.share({ title: document.title, url: u }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { L.toast('Link copied'); });
      };
      // weather
      L.fetchJSON(OM + '?latitude=' + c.la + '&longitude=' + c.lo + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,precipitation&hourly=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,daylight_duration&timezone=auto&forecast_days=7', 10).then(function (w) {
        var cu = w.current, x = L.wx(cu.weather_code, cu.is_day);
        $('#wxic').textContent = x[0]; $('#wxt').textContent = L.t(cu.temperature_2m); $('#wxd').textContent = x[1];
        $('#wxmore').innerHTML = 'Feels like ' + L.t(cu.apparent_temperature) + ' · Humidity ' + cu.relative_humidity_2m + '% · Wind ' + Math.round(cu.wind_speed_10m) + ' km/h';
        var dd = w.daily;
        $('#fc').innerHTML = dd.time.map(function (t, i) {
          var day = new Date(t + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
          return '<div>' + (i ? day : 'Today') + '<b>' + L.wx(dd.weather_code[i], 1)[0] + '</b>' + L.tn(dd.temperature_2m_max[i]) + ' <span class="muted">' + L.tn(dd.temperature_2m_min[i]) + '</span><br><span class="muted small">💧' + (dd.precipitation_probability_max[i] == null ? '–' : dd.precipitation_probability_max[i]) + '%</span></div>';
        }).join('');
        $('#sunr').textContent = (dd.sunrise[0] || '').slice(11); $('#suns').textContent = (dd.sunset[0] || '').slice(11);
        var dl = dd.daylight_duration[0]; $('#dayl').textContent = dl ? Math.floor(dl / 3600) + 'h ' + Math.round(dl % 3600 / 60) + 'm' : '–';
        $('#uv').textContent = dd.uv_index_max[0] == null ? '–' : dd.uv_index_max[0].toFixed(1);
        // 24h sparkline from now
        var nowIdx = 0, ht = w.hourly.time, cur = cu.time.slice(0, 13);
        for (var i = 0; i < ht.length; i++) if (ht[i].slice(0, 13) === cur) { nowIdx = i; break; }
        var pts = w.hourly.temperature_2m.slice(nowIdx, nowIdx + 24), mn = Math.min.apply(0, pts), mx = Math.max.apply(0, pts), rg = mx - mn || 1;
        var path = pts.map(function (v, i) { return (i ? 'L' : 'M') + (i * 300 / 23).toFixed(1) + ',' + (80 - (v - mn) / rg * 64).toFixed(1); }).join(' ');
        $('#spark').innerHTML = '<defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".45"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs><path d="' + path + ' L300,90 L0,90 Z" fill="url(#g)"/><path d="' + path + '" fill="none" stroke="#22d3ee" stroke-width="2.5"/>';
        $('#sparklbl').textContent = 'Next 24 hours: ' + L.t(mn) + ' to ' + L.t(mx);
        $('#upd').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }).catch(function () { $('#wxic').textContent = '🌐'; $('#wxd').textContent = 'Live weather temporarily unavailable.'; });
      // air
      L.fetchJSON(AQ + '?latitude=' + c.la + '&longitude=' + c.lo + '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide', 20).then(function (a) {
        var v = a.current.us_aqi, q = L.aqi(v);
        $('#aqiv').textContent = v == null ? '–' : Math.round(v); $('#aqil').className = 'badge ' + q.c; $('#aqil').textContent = q.l; $('#aqia').textContent = q.a;
        $('#aqip').innerHTML = 'PM2.5 <b>' + (a.current.pm2_5 == null ? '–' : a.current.pm2_5.toFixed(1)) + '</b> · PM10 <b>' + (a.current.pm10 == null ? '–' : a.current.pm10.toFixed(1)) + '</b> · O₃ <b>' + (a.current.ozone == null ? '–' : Math.round(a.current.ozone)) + '</b> · NO₂ <b>' + (a.current.nitrogen_dioxide == null ? '–' : Math.round(a.current.nitrogen_dioxide)) + '</b> <span class="muted">µg/m³</span>';
      }).catch(function () { $('#aqia').textContent = 'Air quality data unavailable right now.'; });
      // wikipedia
      L.fetchJSON('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.w), 720).then(function (wk) {
        $('#wiki').innerHTML = (wk.thumbnail ? '<img src="' + L.esc(wk.thumbnail.source) + '" alt="' + L.esc(c.n) + '" loading="lazy" style="float:right;max-width:160px;border-radius:12px;margin:0 0 10px 14px">' : '') + '<p>' + L.esc(wk.extract) + '</p><p class="small muted">Source: <a href="' + L.esc(wk.content_urls && wk.content_urls.desktop.page) + '" target="_blank" rel="noopener">Wikipedia</a>, CC BY-SA 4.0.</p>';
      }).catch(function () { $('#wiki').innerHTML = '<p class="muted">Overview unavailable right now.</p>'; });
      // news
      gdelt('"' + c.n + '"', 8, '3d').then(function (a) { $('#news').innerHTML = newsHTML(a); }).catch(function () { $('#news').innerHTML = '<p class="muted">News feed is busy — try again shortly. <a target="_blank" rel="noopener" href="https://news.google.com/search?q=' + encodeURIComponent(c.n) + '">Open Google News →</a></p>'; });
      // map + quakes
      baseMap($('#citymap'), [c.la, c.lo], 10).then(function (o) {
        o.Lf.marker([c.la, c.lo]).addTo(o.m).bindPopup(c.n);
        return L.fetchJSON(USGS + '2.5_week.geojson', 15).then(function (j) {
          var near = j.features.filter(function (f) { return L.hav(c.la, c.lo, f.geometry.coordinates[1], f.geometry.coordinates[0]) < 800; });
          $('#quakes').innerHTML = near.length ? '<b>' + near.length + '</b> earthquakes of magnitude 2.5+ within 800 km in the past 7 days. Strongest: M' + Math.max.apply(0, near.map(function (f) { return f.properties.mag; })).toFixed(1) + '.' : 'No earthquakes of magnitude 2.5+ within 800 km in the past 7 days.';
          near.forEach(function (f) { o.Lf.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { radius: 3 + f.properties.mag * 2, color: '#ff4d5e' }).addTo(o.m).bindPopup('M' + f.properties.mag + ' — ' + L.esc(f.properties.place)); });
        });
      }).catch(function () { $('#quakes').textContent = 'Seismic feed unavailable right now.'; });
      // nearby cities
      var near = cs.filter(function (x) { return x.s !== c.s; }).sort(function (a, b) { return L.hav(c.la, c.lo, a.la, a.lo) - L.hav(c.la, c.lo, b.la, b.lo); }).slice(0, 4);
      $('#nearby').innerHTML = near.map(function (x) { return card(x); }).join(''); bindFavs($('#nearby'));
      $('#cmp').href = L.BASE + 'compare.html?a=' + c.s + '&b=' + near[0].s;
    });
  }

  // ---------- LIVE ----------
  function live() {
    facades();
    L.getCities().then(function (cs) {
      var sorted = cs.slice().sort(function (a, b) { return L.tzOffsetMin(b.tz) - L.tzOffsetMin(a.tz); });
      $('#wall').innerHTML = sorted.map(function (c) { return '<a class="ck" href="' + L.cityUrl(c.s) + '"><b data-tz="' + c.tz + '">' + L.localTime(c.tz) + '</b><span>' + L.esc(c.n) + '</span></a>'; }).join('');
      baseMap($('#livemap'), [20, 15], 2).then(function (o) {
        batchLive(cs).then(function (d) {
          cs.forEach(function (c) {
            var x = d[c.s] || {}; if (x.t == null) return;
            var col = x.t > 30 ? '#f87171' : x.t > 20 ? '#fbbf24' : x.t > 10 ? '#34d399' : x.t > 0 ? '#22d3ee' : '#a78bfa';
            o.Lf.circleMarker([c.la, c.lo], { radius: 9, color: col, fillColor: col, fillOpacity: .8 }).addTo(o.m).bindTooltip(c.n + ' ' + L.t(x.t)).bindPopup('<b>' + L.esc(c.n) + '</b> ' + L.t(x.t) + '<br><a href="' + L.cityUrl(c.s) + '">Live dashboard →</a>');
          });
        });
        L.fetchJSON(USGS + '2.5_day.geojson', 10).then(function (j) {
          $('#qcount').textContent = j.features.length;
          j.features.forEach(function (f) { o.Lf.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { radius: 2 + f.properties.mag * 1.6, color: '#ff4d5e', weight: 1 }).addTo(o.m).bindPopup('M' + f.properties.mag + ' — ' + L.esc(f.properties.place) + '<br>' + ago(f.properties.time)); });
          $('#qlist').innerHTML = j.features.slice(0, 8).map(function (f) { return '<div class="newsitem"><b>M' + f.properties.mag.toFixed(1) + '</b> ' + L.esc(f.properties.place) + '<small>' + ago(f.properties.time) + '</small></div>'; }).join('') || '<p class="muted">No M2.5+ quakes in the last 24h.</p>';
        }).catch(function () { $('#qlist').innerHTML = '<p class="muted">Seismic feed unavailable.</p>'; });
        var iss = null;
        function issTick() {
          fetch('https://api.wheretheiss.at/v1/satellites/25544').then(function (r) { return r.json(); }).then(function (s) {
            var ll = [s.latitude, s.longitude];
            if (!iss) iss = o.Lf.marker(ll, { icon: o.Lf.divIcon({ html: '🛰️', className: '', iconSize: [24, 24] }) }).addTo(o.m).bindTooltip('International Space Station');
            else iss.setLatLng(ll);
            $('#iss').textContent = s.latitude.toFixed(1) + '°, ' + s.longitude.toFixed(1) + '° · ' + Math.round(s.velocity).toLocaleString() + ' km/h';
          }).catch(function () {});
        }
        issTick(); setInterval(issTick, 6000);
      }).catch(function () { $('#livemap').innerHTML = '<p class="muted" style="padding:20px">Map unavailable right now.</p>'; });
    });
    gdelt('(city OR mayor OR "city council" OR downtown)', 10, '1d').then(function (a) { $('#pulse').innerHTML = newsHTML(a); }).catch(function () { $('#pulse').innerHTML = '<p class="muted">News pulse is busy — refresh in a moment.</p>'; });
  }

  // ---------- COMPARE ----------
  function compare() {
    L.getCities().then(function (cs) {
      var A = $('#ca'), B = $('#cb');
      citySelect(A, cs, qs.get('a') || 'london'); citySelect(B, cs, qs.get('b') || 'lisbon');
      function run() {
        var a = cs.filter(function (x) { return x.s === A.value; })[0], b = cs.filter(function (x) { return x.s === B.value; })[0];
        history.replaceState(null, '', '?a=' + a.s + '&b=' + b.s);
        document.title = a.n + ' vs ' + b.n + ' — Live City Comparison | Live.City';
        var km = Math.round(L.hav(a.la, a.lo, b.la, b.lo)), diff = (L.tzOffsetMin(b.tz) - L.tzOffsetMin(a.tz)) / 60;
        $('#cmphead').innerHTML = '<div class="grid g3"><div class="card stat"><b>' + km.toLocaleString() + ' km</b><span>Great-circle distance (' + Math.round(km * 0.621).toLocaleString() + ' mi)</span></div><div class="card stat"><b>~' + (km / 820 + 0.6).toFixed(1) + ' h</b><span>Estimated non-stop flight time</span></div><div class="card stat"><b>' + (diff === 0 ? 'Same' : (diff > 0 ? '+' : '') + diff + ' h') + '</b><span>' + L.esc(b.n) + ' vs ' + L.esc(a.n) + ' clock</span></div></div>';
        var rows = [['Local time', 'time'], ['Now', 'now'], ['Feels like', 'feels'], ['Humidity', 'hum'], ['Air quality (US AQI)', 'aqi'], ['7-day avg high', 'hi'], ['7-day avg low', 'lo'], ['Rain chance (week max)', 'rain'], ['Daylight today', 'dl'], ['Sunrise / sunset', 'sun'], ['Currency', 'cur'], ['Languages', 'lang'], ['Best time to visit', 'bt']];
        var tbl = $('#cmptbl');
        tbl.innerHTML = '<tr><th></th><th><a href="' + L.cityUrl(a.s) + '">' + L.esc(a.n) + '</a></th><th><a href="' + L.cityUrl(b.s) + '">' + L.esc(b.n) + '</a></th></tr>' + rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td data-k="a-' + r[1] + '">…</td><td data-k="b-' + r[1] + '">…</td></tr>'; }).join('');
        [[a, 'a'], [b, 'b']].forEach(function (p) {
          var c = p[0], k = p[1], set = function (f, v) { var el = tbl.querySelector('[data-k="' + k + '-' + f + '"]'); if (el) el.innerHTML = v; };
          set('time', '<span data-tz="' + c.tz + '">' + L.localTime(c.tz) + '</span>'); set('cur', c.cur); set('lang', L.esc(c.lang)); set('bt', L.esc(c.bt));
          L.fetchJSON(OM + '?latitude=' + c.la + '&longitude=' + c.lo + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,daylight_duration&timezone=auto&forecast_days=7', 10).then(function (w) {
            var avg = function (arr) { return arr.reduce(function (s, v) { return s + v; }, 0) / arr.length; }, x = L.wx(w.current.weather_code, w.current.is_day);
            set('now', x[0] + ' ' + L.t(w.current.temperature_2m) + ' · ' + x[1]); set('feels', L.t(w.current.apparent_temperature)); set('hum', w.current.relative_humidity_2m + '%');
            set('hi', L.t(avg(w.daily.temperature_2m_max))); set('lo', L.t(avg(w.daily.temperature_2m_min)));
            set('rain', Math.max.apply(0, w.daily.precipitation_probability_max.map(function (v) { return v || 0; })) + '%');
            var dl = w.daily.daylight_duration[0]; set('dl', Math.floor(dl / 3600) + 'h ' + Math.round(dl % 3600 / 60) + 'm');
            set('sun', w.daily.sunrise[0].slice(11) + ' / ' + w.daily.sunset[0].slice(11));
          }).catch(function () { set('now', 'unavailable'); });
          L.fetchJSON(AQ + '?latitude=' + c.la + '&longitude=' + c.lo + '&current=us_aqi', 20).then(function (q) { var v = q.current.us_aqi, z = L.aqi(v); set('aqi', v == null ? '–' : Math.round(v) + ' <span class="badge ' + z.c + '">' + z.l + '</span>'); }).catch(function () { set('aqi', '–'); });
        });
        $('#cmprel').href = L.BASE + 'relocate.html?to=' + b.s + '&from=' + encodeURIComponent(a.n);
        $$('[data-cmp-b]').forEach(function (el) { el.textContent = b.n; });
      }
      A.onchange = B.onchange = run;
      $('#swap').onclick = function () { var t = A.value; A.value = B.value; B.value = t; run(); };
      run();
    });
  }

  // ---------- RELOCATE (lead gen) ----------
  function relocate() {
    var steps = $$('.step'), i = 0, bar = $('.progress i'), form = $('#relform');
    function show(n) {
      i = n; steps.forEach(function (s, k) { s.classList.toggle('on', k === n); });
      bar.style.width = ((n + 1) / steps.length * 100) + '%'; $('#stepn').textContent = 'Step ' + (n + 1) + ' of ' + steps.length;
      $('#prev').style.visibility = n ? 'visible' : 'hidden';
      $('#next').style.display = n === steps.length - 1 ? 'none' : ''; $('#send').style.display = n === steps.length - 1 ? '' : 'none';
    }
    function valid(n) {
      var ok = true;
      $$('input,select,textarea', steps[n]).forEach(function (el) { if (!el.checkValidity()) { ok = false; el.reportValidity(); } });
      if (ok && n === 2 && !$$('input[name="services"]:checked', steps[n]).length) { L.toast('Pick at least one service'); ok = false; }
      return ok;
    }
    window.lcRelValid = function () { return valid(i); };
    $('#next').onclick = function () { if (valid(i)) { show(i + 1); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    $('#prev').onclick = function () { show(Math.max(0, i - 1)); };
    form.addEventListener('lc:sent', function () { show(0); $('.relcard').innerHTML = '<div style="text-align:center;padding:30px 10px"><div style="font-size:3rem">✅</div><h2>Your relocation request is in.</h2><p class="lead" style="margin:0 auto">We\'re matching you with vetted local help. Expect a reply within 1–2 business days. Meanwhile, explore your new city live.</p><p><a class="btn" href="' + L.BASE + 'cities.html">Explore cities</a></p></div>'; });
    L.getCities().then(function (cs) {
      var sel = $('#to'); sel.innerHTML = '<option value="">Choose a city…</option>' + cs.map(function (c) { return '<option>' + L.esc(c.n) + ', ' + L.esc(c.c) + '</option>'; }).join('') + '<option>Other / not listed</option>';
      var to = qs.get('to'); if (to) { var c = cs.filter(function (x) { return x.s === to; })[0]; if (c) { sel.value = c.n + ', ' + c.c; $$('[data-to]').forEach(function (el) { el.textContent = c.n; }); } }
      if (qs.get('from')) $('#from').value = qs.get('from');
    });
    show(0);
  }

  // ---------- ADVERTISE prefill ----------
  function advertise() {
    var c = qs.get('city'); if (!c) return;
    L.getCities().then(function (cs) { var x = cs.filter(function (y) { return y.s === c; })[0]; if (x && $('#pcity')) $('#pcity').value = x.n; });
  }
  function support() {
    var p = L.CFG.pay, box = $('#paylinks'); if (!box) return;
    var h = ''; if (p.paypal) h += '<a class="btn" target="_blank" rel="noopener" href="' + p.paypal + '">Give with PayPal</a> '; if (p.bmc) h += '<a class="btn violet" target="_blank" rel="noopener" href="' + p.bmc + '">Buy us a coffee</a> '; if (p.stripe) h += '<a class="btn alt" target="_blank" rel="noopener" href="' + p.stripe + '">Card payment</a>';
    if (h) box.innerHTML = h;
    $$('[data-amt]').forEach(function (b) { b.addEventListener('click', function () { var f = $('#amount'); if (f) { f.value = b.getAttribute('data-amt'); $('#pledge').scrollIntoView({ behavior: 'smooth' }); } }); });
  }

  var R = { home: home, cities: cities, city: city, live: live, compare: compare, relocate: relocate, advertise: advertise, support: support };
  if (R[page]) R[page]();
  facades();
})();
