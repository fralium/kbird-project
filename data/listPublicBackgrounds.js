import fs from 'fs';
import path from 'path';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

/** 读取 public/background 里的图片。不分类，文件名即 id。 */
export function listPublicBackgrounds() {
  const dir = path.join(process.cwd(), 'public', 'background');
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return names
    .filter((name) => {
      if (!name || name.startsWith('.')) return false;
      return IMAGE_EXT.has(path.extname(name).toLowerCase());
    })
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => ({
      id: name,
      src: `/background/${encodeURIComponent(name)}`,
    }));
}
