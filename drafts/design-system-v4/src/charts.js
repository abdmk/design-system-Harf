/* ═══════════════════════════════════════════════════════════════════════
   charts.js — رسوم SVG خفيفة بألوان النظام. بلا مكتبات.
   ───────────────────────────────────────────────────────────────────────
   · تُرسم بالبكسل الحقيقي لعرض الحاوية (ResizeObserver) — فالنصّ يبقى
     12px دائماً ولا يتضخّم كما يحدث مع viewBox المتمدّد.
   · المحور الزمني من اليسار إلى اليمين حتى في الواجهة العربية (عُرف الرسوم
     والأرقام اللاتينية)، ومحور القيم على اليسار.
   · كل رسم: role="img" + aria-label ملخّص + جدول مخفي للقارئ الآلي.
   الاستخدام:
     Harf.charts.bar(el, { labels, series:[{name, values, color}], format })
     Harf.charts.line(el, { labels, ticks, series:[{name, values, color, area}], format })
     Harf.charts.spark(el, values, color)
     Harf.charts.donut(el, { items:[{label, value, color}], unit })
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("en-US");
  const fmtDefault = v => nf.format(v);
  const compact = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 === 0 || v >= 10000 ? 0 : 1) + "k" : String(v);

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent?.append(n);
    return n;
  }
  // سلّم «جميل» للمحور: 0، 100، 200… بدل 97، 194
  function niceScale(max, count = 4) {
    if (max <= 0) return { max: 1, step: 1, ticks: [0, 1] };
    const raw = max / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(+v.toFixed(6));
    return { max: top, step, ticks };
  }
  function a11y(host, svg, label, rows) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    let t = host.querySelector(".sr-only[data-chart-table]");
    if (!t) { t = document.createElement("table"); t.className = "sr-only"; t.dataset.chartTable = ""; host.append(t); }
    t.replaceChildren();
    rows.forEach(r => {
      const tr = document.createElement("tr");
      r.forEach((c, i) => { const td = document.createElement(i ? "td" : "th"); td.textContent = c; tr.append(td); });
      t.append(tr);
    });
  }
  function tip(host) {
    let t = host.querySelector(".chart-tip");
    if (!t) { t = document.createElement("div"); t.className = "chart-tip"; t.setAttribute("aria-hidden", "true"); host.append(t); }
    return {
      show(x, y, title, rows) {
        t.replaceChildren();
        const b = document.createElement("b"); b.textContent = title; t.append(b);
        rows.forEach(r => {
          const s = document.createElement("span");
          const i = document.createElement("i"); i.style.background = r.color;
          const n = document.createElement("span"); n.textContent = r.name;
          const v = document.createElement("em"); v.textContent = r.value;
          s.append(i, n, v); t.append(s);
        });
        t.classList.add("is-on");
        const w = t.offsetWidth, hw = host.clientWidth;
        const left = Math.min(Math.max(x - w / 2, 0), hw - w);
        t.style.transform = `translate(${left}px, ${Math.max(y - t.offsetHeight - 12, -8)}px)`;
      },
      hide() { t.classList.remove("is-on"); }
    };
  }
  // يعيد الرسم عند تغيّر العرض أو السمة
  function mount(host, draw) {
    host.classList.add("chart");
    let w = 0;
    const run = () => { const nw = host.clientWidth; if (nw) { w = nw; draw(w, host.clientHeight || 220); } };
    new ResizeObserver(() => { if (host.clientWidth !== w) run(); }).observe(host);
    document.addEventListener("harf:theme", run);
    run();
  }

  /* ── أعمدة (مجمّعة) ─────────────────────────────────────────────── */
  function bar(host, o) {
    const fmt = o.format || fmtDefault;
    mount(host, (W, H) => {
      host.querySelector("svg")?.remove();
      const pad = { t: 8, r: 4, b: 28, l: 44 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const all = o.series.flatMap(s => s.values);
      const sc = niceScale(Math.max(...all));
      const svg = el("svg", { width: W, height: H });
      const g = el("g", { class: "grid" }, svg);
      sc.ticks.forEach(v => {
        const y = pad.t + ih - (v / sc.max) * ih;
        el("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y }, g);
        el("text", { x: pad.l - 10, y: y + 4, "text-anchor": "end" }, svg).textContent = o.axisFormat ? o.axisFormat(v) : compact(v);
      });
      const n = o.labels.length, groupW = iw / n, k = o.series.length;
      const gap = Math.max(3, groupW * .08);
      const bw = Math.min(40, (groupW * .62 - gap * (k - 1)) / k);
      const tp = tip(host);
      o.labels.forEach((lab, i) => {
        const cx = pad.l + groupW * i + groupW / 2;
        const totalW = bw * k + gap * (k - 1);
        o.series.forEach((s, j) => {
          const v = s.values[i], h = Math.max(2, (v / sc.max) * ih);
          const x = cx - totalW / 2 + j * (bw + gap), y = pad.t + ih - h;
          const r = Math.min(6, bw / 2);
          // عمود بزوايا علوية مدوّرة فقط
          el("path", { class: "bar", d: `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z`,
            style: `fill:${(o.highlight === i && s.highlight) ? s.highlight : s.color}` }, svg);
        });
        el("text", { x: cx, y: H - 8, "text-anchor": "middle" }, svg).textContent = lab;
        const hit = el("rect", { class: "hit", x: pad.l + groupW * i, y: pad.t, width: groupW, height: ih }, svg);
        hit.addEventListener("pointerenter", () => {
          const top = pad.t + ih - (Math.max(...o.series.map(s => s.values[i])) / sc.max) * ih;
          tp.show(cx, top, lab, o.series.map(s => ({ name: s.name, color: s.color, value: fmt(s.values[i]) })));
        });
        hit.addEventListener("pointerleave", tp.hide);
      });
      host.prepend(svg);
      a11y(host, svg, o.label || "رسم أعمدة", [["", ...o.series.map(s => s.name)], ...o.labels.map((l, i) => [l, ...o.series.map(s => fmt(s.values[i]))])]);
    });
  }

  /* ── خطّ / مساحة ───────────────────────────────────────────────── */
  function smoothPath(pts) {
    // منحنى أحادي الاتجاه (monotone) — لا يتجاوز القيم الحقيقية
    if (pts.length < 2) return "";
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      d += `C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  }
  function line(host, o) {
    const fmt = o.format || fmtDefault;
    mount(host, (W, H) => {
      host.querySelector("svg")?.remove();
      const pad = { t: 10, r: 8, b: 28, l: 40 };
      const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      const n = o.series[0].values.length;
      const sc = niceScale(Math.max(...o.series.flatMap(s => s.values)));
      const X = i => pad.l + (i / (n - 1)) * iw, Y = v => pad.t + ih - (v / sc.max) * ih;
      const svg = el("svg", { width: W, height: H });
      const g = el("g", { class: "grid" }, svg);
      sc.ticks.forEach(v => {
        el("line", { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }, g);
        el("text", { x: pad.l - 10, y: Y(v) + 4, "text-anchor": "end" }, svg).textContent = compact(v);
      });
      (o.ticks || []).forEach(([i, lab]) => {
        el("text", { x: X(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, svg).textContent = lab;
      });
      const defs = el("defs", {}, svg);
      o.series.forEach((s, si) => {
        const pts = s.values.map((v, i) => [X(i), Y(v)]);
        const d = smoothPath(pts);
        if (s.area) {
          const id = `ga${Math.random().toString(36).slice(2, 8)}`;
          const lg = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
          el("stop", { offset: "0", style: `stop-color:${s.color};stop-opacity:.22` }, lg);
          el("stop", { offset: "1", style: `stop-color:${s.color};stop-opacity:0` }, lg);
          el("path", { d: `${d}L${X(n - 1)},${pad.t + ih}L${X(0)},${pad.t + ih}Z`, style: `fill:url(#${id})` }, svg);
        }
        el("path", { d, style: `fill:none;stroke:${s.color};stroke-width:${s.dashed ? 1.5 : 2};stroke-linecap:round;stroke-linejoin:round${s.dashed ? ";stroke-dasharray:4 4" : ""}` }, svg);
        if (s.markMax) {
          const mi = s.values.indexOf(Math.max(...s.values));
          el("circle", { class: "dot", cx: X(mi), cy: Y(s.values[mi]), r: 4, style: `fill:${s.color}` }, svg);
        }
      });
      // تحويم: خطّ رأسي + نقاط + تلميح
      const cursor = el("line", { class: "cursor", y1: pad.t, y2: pad.t + ih, x1: -10, x2: -10 }, svg);
      const dots = o.series.map(s => el("circle", { class: "dot", r: 4, cx: -10, cy: -10, style: `fill:${s.color}` }, svg));
      const hit = el("rect", { class: "hit", x: pad.l, y: 0, width: iw, height: H }, svg);
      const tp = tip(host);
      hit.addEventListener("pointermove", e => {
        const r = svg.getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (n - 1));
        if (i < 0 || i >= n) return;
        cursor.setAttribute("x1", X(i)); cursor.setAttribute("x2", X(i));
        dots.forEach((d, si) => { d.setAttribute("cx", X(i)); d.setAttribute("cy", Y(o.series[si].values[i])); });
        tp.show(X(i), Math.min(...o.series.map(s => Y(s.values[i]))), o.labels ? o.labels[i] : String(i + 1),
          o.series.map(s => ({ name: s.name, color: s.color, value: fmt(s.values[i]) })));
      });
      hit.addEventListener("pointerleave", () => { tp.hide(); cursor.setAttribute("x1", -10); cursor.setAttribute("x2", -10); dots.forEach(d => d.setAttribute("cx", -10)); });
      host.prepend(svg);
      a11y(host, svg, o.label || "رسم خطّي", [["", ...o.series.map(s => s.name)],
        ...o.series[0].values.map((_, i) => [o.labels ? o.labels[i] : String(i + 1), ...o.series.map(s => fmt(s.values[i]))])]);
    });
  }

  /* ── خطّ مصغّر (داخل بطاقة المؤشّر) ────────────────────────────── */
  function spark(host, values, color = "var(--viz-1)") {
    const draw = () => {
      host.replaceChildren();
      const W = host.clientWidth || 200, H = host.clientHeight || 52, p = 3;
      const max = Math.max(...values), min = Math.min(...values), rng = max - min || 1;
      const pts = values.map((v, i) => [p + (i / (values.length - 1)) * (W - 2 * p), p + (H - 2 * p) * (1 - (v - min) / rng)]);
      const svg = el("svg", { width: W, height: H, "aria-hidden": "true" });
      const id = `gs${Math.random().toString(36).slice(2, 8)}`;
      const lg = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, el("defs", {}, svg));
      el("stop", { offset: "0", style: `stop-color:${color};stop-opacity:.18` }, lg);
      el("stop", { offset: "1", style: `stop-color:${color};stop-opacity:0` }, lg);
      const d = smoothPath(pts);
      el("path", { d: `${d}L${pts.at(-1)[0]},${H}L${pts[0][0]},${H}Z`, style: `fill:url(#${id})` }, svg);
      el("path", { d, style: `fill:none;stroke:${color};stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round` }, svg);
      el("circle", { cx: pts.at(-1)[0], cy: pts.at(-1)[1], r: 3, style: `fill:${color}` }, svg);
      host.append(svg);
    };
    new ResizeObserver(draw).observe(host);
    draw();
  }

  /* ── كعكة ──────────────────────────────────────────────────────── */
  function donut(host, o) {
    const total = o.items.reduce((a, b) => a + b.value, 0);
    const R = 54, C = 2 * Math.PI * R, GAP = total ? 2 : 0;
    const ring = document.createElement("div"); ring.className = "donut__ring";
    const svg = el("svg", { viewBox: "0 0 136 136" }, ring);
    el("circle", { cx: 68, cy: 68, r: R, style: "stroke:var(--viz-muted)" }, svg);
    let off = 0;
    o.items.forEach(it => {
      const len = total ? (it.value / total) * C : 0;
      if (len > 0) el("circle", { cx: 68, cy: 68, r: R, style: `stroke:${it.color}`,
        "stroke-dasharray": `${Math.max(len - GAP, 0.5)} ${C}`, "stroke-dashoffset": -off, "stroke-linecap": "butt" }, svg);
      off += len;
    });
    const center = document.createElement("div"); center.className = "donut__center";
    const b = document.createElement("b"); b.textContent = nf.format(total);
    const s = document.createElement("span"); s.textContent = o.unit || "";
    center.append(b, s); ring.append(center);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", o.items.map(i => `${i.label}: ${nf.format(i.value)}`).join("، "));
    const ul = document.createElement("ul"); ul.className = "donut__list";
    o.items.forEach(it => {
      const li = document.createElement("li"); li.style.setProperty("--c", it.color);
      const i = document.createElement("i");
      const n = document.createElement("span"); n.textContent = it.label;
      const v = document.createElement("b"); v.textContent = nf.format(it.value);
      const p = document.createElement("em"); p.textContent = total ? Math.round((it.value / total) * 100) + "%" : "—";
      li.append(i, n, v, p); ul.append(li);
    });
    host.classList.add("donut");
    host.replaceChildren(ring, ul);
  }

  window.Harf = Object.assign(window.Harf || {}, { charts: { bar, line, spark, donut, niceScale } });
})();
