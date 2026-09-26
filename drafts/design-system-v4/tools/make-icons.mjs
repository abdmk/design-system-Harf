// يبني src/icons.svg من ملفات Uicons (المجلد icons/ داخل icons.zip).
// الاستخدام:  unzip ../icons.zip -d /tmp/ic  &&  node tools/make-icons.mjs /tmp/ic/icons
// أضف اسم الأيقونة إلى REGULAR (خطّية) أو SOLID (ممتلئة للحالة النشطة) ثم أعد التشغيل.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2];
if (!src) { console.error("مرّر مسار مجلد الأيقونات"); process.exit(1); }

const REGULAR = `search bell heart download upload user settings check cross-small cross angle-small-down
 angle-small-left angle-small-right angle-small-up plus minus trash edit eye eye-crossed info exclamation
 interrogation lock shield-check star crown gem globe computer mobile calendar clock filter settings-sliders
 chart-histogram chart-pie stats shopping-cart credit-card receipt dollar magic-wand refresh share link copy
 menu-burger menu-dots moon sun sign-out sign-in folder file picture text letter-case layers palette
 cloud-upload envelope bookmark arrow-small-up arrow-small-down arrow-small-left time-fast time-past gift
 apps list document inbox cross-circle hourglass paper-plane pulse world home caret-down caret-up`.split(/\s+/).filter(Boolean);
const SOLID = `heart star bookmark bell home`.split(/\s+/).filter(Boolean);

function body(file) {
  const svg = readFileSync(file, "utf8");
  // نأخذ المسارات فقط، ونحذف ألوانها الثابتة و clipPath، فترث currentColor
  const paths = [...svg.matchAll(/<(path|circle|rect|ellipse|polygon)\b[^>]*\/>/g)]
    .map(m => m[0])
    .filter(t => !/fill="white"/.test(t) || !/width="24" height="24"/.test(t))
    .map(t => t.replace(/\s(fill|clip-path|fill-rule|clip-rule)="[^"]*"/g, (a, k) => (k === "fill-rule" || k === "clip-rule") ? a : ""));
  return paths.join("");
}

const out = [];
const miss = [];
for (const n of REGULAR) {
  const f = join(src, `fi-rr-${n}.svg`);
  existsSync(f) ? out.push(`<symbol id="i-${n}" viewBox="0 0 24 24">${body(f)}</symbol>`) : miss.push(n);
}
for (const n of SOLID) {
  const f = join(src, `fi-sr-${n}.svg`);
  existsSync(f) ? out.push(`<symbol id="i-${n}-fill" viewBox="0 0 24 24">${body(f)}</symbol>`) : miss.push(n + " (solid)");
}
// الشعار: يُقرأ من الملف القائم حتى لا يتغيّر رسمه
const logo = readFileSync(join(root, "src/logo-symbols.svg"), "utf8").trim();

writeFileSync(join(root, "src/icons.svg"),
`<!-- مولَّد بـ tools/make-icons.mjs — لا تعدّله يدوياً. Uicons by Flaticon: Regular Rounded + Solid Rounded -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
${out.join("\n")}
${logo}
</svg>
`);
console.log(`icons: ${out.length}` + (miss.length ? ` · missing: ${miss.join(", ")}` : ""));
