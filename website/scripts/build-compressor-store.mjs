import {cp, copyFile, mkdir, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const source = fileURLToPath(new URL('../compressors/', import.meta.url));
const shared = fileURLToPath(new URL('../dist/assets/alipay-checkout.mjs', import.meta.url));
const output = process.argv[2] && resolve(process.argv[2]);
if (!output) throw new Error('用法: node website/scripts/build-compressor-store.mjs <新目录>');
try {
  await stat(output);
  throw new Error('请指定一个尚未存在的输出目录');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(output, {recursive:true});
await cp(source, output, {recursive:true});
await copyFile(shared, join(output,'assets/alipay-checkout.mjs'));
console.log(output);
