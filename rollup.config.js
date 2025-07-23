import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const createPackageJson = (dir, type) => ({
  name: `create-package-json-${type}`,
  generateBundle() {
    const content = JSON.stringify({ type }, null, 2);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), content);
  },
});

const external = (id) => !id.startsWith('.') && !path.isAbsolute(id);

const plugins = (outDir) => [
  nodeResolve({
    preferBuiltins: true,
    exportConditions: ['node'],
  }),
  commonjs(),
  json(),
  typescript({
    tsconfig: 'src/tsconfig.json',
    compilerOptions: {
      module: 'ES2022',
      moduleResolution: 'node',
    },
    outDir,
  }),
  createPackageJson(outDir, outDir === 'esm' ? 'module' : 'commonjs'),
];

export default [
  {
    input: './src/index.ts',
    output: {
      dir: 'esm',
      format: 'esm',
    },
    external,
    plugins: plugins('esm'),
  },
  {
    input: './src/index.ts',
    output: {
      dir: 'cjs',
      format: 'cjs',
      exports: 'named',
    },
    external,
    plugins: plugins('cjs'),
  },
];
