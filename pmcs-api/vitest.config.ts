import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    // Mirror wrangler's `Data` rule: `import x from './file.pdf'` yields an ArrayBuffer.
    name: 'pdf-as-arraybuffer',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('.pdf')) return null;
      const b64 = readFileSync(id).toString('base64');
      return `const b = Buffer.from(${JSON.stringify(b64)}, 'base64');
export default b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);`;
    },
  }],
  test: { include: ['test/**/*.test.ts', 'test/**/*.test.mjs'] },
});
