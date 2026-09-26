/* ═══════════════════════════════════════════════════════════════════════
   harf.js — سلوك المكوّنات. بلا مكتبات، ويعمل بالسمات لا بالفئات.
   كل مكوّن يعمل بدون هذا الملف (حالة ساكنة صحيحة)، وهذا الملف يضيف التفاعل.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ── السمة: فاتح / داكن / النظام ─────────────────────────────────── */
  const THEME_KEY = "harf-theme";
  const store = {
    get() { try { return localStorage.getItem(THEME_KEY); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem(THEME_KEY, v) : localStorage.removeItem(THEME_KEY); } catch {} }
  };
  const saved = store.get();
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  function syncThemeButtons() {
    $$("[data-theme-toggle]").forEach(b => {
      b.setAttribute("aria-pressed", String(isDark()));
      const use = $("use", b);
      if (use) use.setAttribute("href", isDark() ? "#i-sun" : "#i-moon");
      const lbl = $("[data-theme-label]", b);
      if (lbl) lbl.textContent = isDark() ? "الوضع الفاتح" : "الوضع الداكن";
    });
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-theme-toggle]");
    if (!b) return;
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set(next);
    syncThemeButtons();
    document.dispatchEvent(new CustomEvent("harf:theme"));
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    syncThemeButtons(); document.dispatchEvent(new CustomEvent("harf:theme"));
  });

  /* ── المبدّل المقطعي: مؤشّر منزلق + aria-pressed ───────────────────── */
  function placeThumb(seg) {
    const on = $("[aria-pressed='true'],[aria-selected='true']", seg);
    const th = $(".segmented__thumb", seg);
    if (!on || !th) return;
    th.style.width = on.offsetWidth + "px";
    th.style.transform = `translateX(${on.offsetLeft}px)`;
  }
  function initSegmented(seg) {
    if (seg.dataset.ready) return;
    seg.dataset.ready = "1";
    const th = document.createElement("span");
    th.className = "segmented__thumb"; th.setAttribute("aria-hidden", "true");
    seg.prepend(th);
    const btns = $$("button", seg);
    const attr = seg.getAttribute("role") === "tablist" ? "aria-selected" : "aria-pressed";
    btns.forEach(b => b.addEventListener("click", () => {
      btns.forEach(x => x.setAttribute(attr, String(x === b)));
      placeThumb(seg);
      seg.dispatchEvent(new CustomEvent("harf:change", { detail: { value: b.value || b.textContent.trim() }, bubbles: true }));
    }));
    // التمهيد بعد تحميل الخط حتى لا يُقاس عرض خاطئ
    (document.fonts?.ready || Promise.resolve()).then(() => {
      th.style.transition = "none"; placeThumb(seg); th.offsetWidth; th.style.transition = "";
      seg.classList.add("is-ready");
    });
  }

  /* ── التبويبات: لوحة مفاتيح كاملة (أسهم، Home، End) ───────────────── */
  function initTabs(list) {
    if (list.dataset.ready) return;
    list.dataset.ready = "1";
    const tabs = $$("[role='tab']", list);
    const select = t => {
      tabs.forEach(x => {
        const on = x === t;
        x.setAttribute("aria-selected", String(on));
        x.tabIndex = on ? 0 : -1;
        const p = document.getElementById(x.getAttribute("aria-controls"));
        if (p) p.hidden = !on;
      });
      list.dispatchEvent(new CustomEvent("harf:tab", { detail: { id: t.getAttribute("aria-controls") }, bubbles: true }));
    };
    tabs.forEach(t => {
      t.tabIndex = t.getAttribute("aria-selected") === "true" ? 0 : -1;
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", e => {
        const i = tabs.indexOf(t);
        const rtl = getComputedStyle(list).direction === "rtl";
        const map = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1 };
        let n = null;
        if (e.key in map) n = (i + map[e.key] + tabs.length) % tabs.length;
        if (e.key === "Home") n = 0;
        if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); tabs[n].focus(); select(tabs[n]); }
      });
    });
  }

  /* ── القوائم المنسدلة ─────────────────────────────────────────────── */
  let openMenu = null;
  function closeMenu(focusBack) {
    if (!openMenu) return;
    const { btn, menu } = openMenu;
    menu.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    if (focusBack) btn.focus();
    openMenu = null;
  }
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-menu]");
    if (btn) {
      const menu = document.getElementById(btn.dataset.menu);
      const same = openMenu && openMenu.menu === menu;
      closeMenu(false);
      if (!same && menu) {
        menu.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        openMenu = { btn, menu };
        $("[role^='menuitem']:not([aria-disabled='true'])", menu)?.focus({ preventScroll: true });
      }
      return;
    }
    if (openMenu && !openMenu.menu.contains(e.target)) closeMenu(false);
    const item = e.target.closest("[role='menuitemradio']");
    if (item) {
      $$("[role='menuitemradio']", item.closest(".menu")).forEach(x => x.setAttribute("aria-checked", String(x === item)));
    }
  });
  document.addEventListener("keydown", e => {
    if (!openMenu) return;
    const items = $$("[role^='menuitem']:not([aria-disabled='true'])", openMenu.menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); }
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === "Tab") closeMenu(false);
  });

  /* ── المفاتيح ─────────────────────────────────────────────────────── */
  document.addEventListener("click", e => {
    const s = e.target.closest("button.switch[role='switch']");
    if (!s || s.disabled) return;
    s.setAttribute("aria-checked", String(s.getAttribute("aria-checked") !== "true"));
  });
  /* الأزرار القابلة للتبديل (المفضّلة، الشرائح) */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const on = t.getAttribute("aria-pressed") !== "true";
    t.setAttribute("aria-pressed", String(on));
    const use = $("use[data-on]", t);
    if (use) use.setAttribute("href", on ? use.dataset.on : use.dataset.off);
  });

  /* ── النوافذ: <dialog> أصلية — حبس التركيز و Esc مجاناً ─────────────── */
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-dialog-open]");
    if (o) { document.getElementById(o.dataset.dialogOpen)?.showModal(); return; }
    const c = e.target.closest("[data-dialog-close]");
    if (c) { c.closest("dialog")?.close(); return; }
    // النقر على الحاجب يغلق
    if (e.target instanceof HTMLDialogElement && e.target.classList.contains("dialog")) e.target.close();
  });

  /* ── الدُرج الجانبي ───────────────────────────────────────────────── */
  function setDrawer(open) {
    const d = $(".drawer"), s = $(".scrim"), b = $("[data-drawer]");
    if (!d) return;
    d.classList.toggle("is-open", open);
    s?.classList.toggle("is-open", open);
    b?.setAttribute("aria-expanded", String(open));
    d.inert = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $("a,button", d)?.focus(); else b?.focus();
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-drawer]")) setDrawer(true);
    else if (e.target.closest("[data-drawer-close]") || e.target.classList?.contains("scrim")) setDrawer(false);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $(".drawer.is-open")) setDrawer(false); });

  /* ── الإشعارات العائمة ────────────────────────────────────────────── */
  function toast(msg, { tone = "", icon = "i-check", action } = {}) {
    let region = $(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }
    const t = document.createElement("div");
    t.className = "toast" + (tone ? " toast--" + tone : "");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + icon); svg.append(use);
    const m = document.createElement("span");
    m.className = "toast__msg"; m.textContent = msg;   // textContent — لا innerHTML لنصّ متغيّر
    t.append(svg, m);
    if (action) {
      const b = document.createElement("button");
      b.className = "btn btn--ghost btn--sm"; b.type = "button"; b.textContent = action.label;
      b.addEventListener("click", () => { action.run?.(); dismiss(); });
      t.append(b);
    }
    region.append(t);
    const dismiss = () => { t.classList.add("is-leaving"); t.addEventListener("animationend", () => t.remove(), { once: true }); };
    setTimeout(dismiss, 4200);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-toast]");
    if (b) toast(b.dataset.toast, { tone: b.dataset.toastTone || "success", icon: b.dataset.toastIcon || "i-check" });
  });

  /* ── زر بحالة تحميل (عرض توضيحي) ──────────────────────────────────── */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-busy-demo]");
    if (!b) return;
    b.setAttribute("aria-busy", "true");
    setTimeout(() => b.removeAttribute("aria-busy"), 1600);
  });

  function init(root = document) {
    $$(".segmented", root).forEach(initSegmented);
    $$("[role='tablist']:not(.segmented)", root).forEach(initTabs);
    $$(".drawer", root).forEach(d => { d.inert = true; });
    syncThemeButtons();
  }
  addEventListener("resize", () => $$(".segmented").forEach(placeThumb));
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => init()) : init();

  window.Harf = Object.assign(window.Harf || {}, { init, toast, isDark });
})();
