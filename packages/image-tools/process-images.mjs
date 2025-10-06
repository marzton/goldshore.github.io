import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const src="apps/web/public/images/raw", out="apps/web/public/images/optimized";
fs.mkdirSync(out,{recursive:true});
for(const f of fs.readdirSync(src)){
  if(!/\.(jpe?g|png)$/i.test(f)) continue;
  const base=path.parse(f).name, p=path.join(src,f);
  const img=sharp(p).modulate({brightness:.98,saturation:.92})
    .webp({quality:82,effort:4});
  await img.toFile(path.join(out,`${base}.webp`));
}
console.log("✓ images optimized");
