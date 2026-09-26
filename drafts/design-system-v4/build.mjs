// يبني نسخاً مستقلة من ملف واحد (خطوط + أيقونات + أنماط + سكربتات مضمَّنة)
// حتى تُفتح بنقرة مزدوجة أو تُرسل كملف واحد، كما كان النظام سابقاً.
//   node design-system/build.mjs
// المصدر يبقى مقسّماً في src/ — عدّل هناك دائماً، ثم أعد البناء.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const PAGES = [
  ["index.html", "dist/harf-design-system.html"],
  ["dashboard.html", "dist/harf-dashboard.html"],
];

const read = p => readFileSync(p, "utf8");

function inlineCss(file) {
  // الخطوط تُضمَّن woff2 كما هي — لا تحويل إلى TTF (أصغر بنحو 3 مرات)
  return read(file).replace(/url\("([^"]+\.woff2)"\)/g, (_, rel) => {
    const b64 = readFileSync(resolve(dirname(file), rel)).toString("base64");
    return `url(data:font/woff2;base64,${b64})`;
  });
}

mkdirSync(join(root, "dist"), { recursive: true });
for (const [src, out] of PAGES) {
  let html = read(join(root, src));
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${inlineCss(join(root, href))}\n</style>`);
  // </script> داخل سكربت مضمَّن يكسر الصفحة — نحميه
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, s) => `<script>\n${read(join(root, s)).replace(/<\/script/gi, "<\\/script")}\n</script>`);
  html = html.replace("<!-- @icons -->", read(join(root, "src/icons.svg")));
  const left = html.match(/<link rel="stylesheet"|<script src=|<!-- @icons -->/);
  if (left) throw new Error(`${src}: بقي مرجع لم يُضمَّن: ${left[0]}`);
  writeFileSync(join(root, out), html);
  console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
}
