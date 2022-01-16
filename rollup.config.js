import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/main.ts',
  output: {
    file: './dist/rollup-plugin-generate-image-sizes.js',
    format: 'cjs',
    name: 'rollup-plugin-generate-image-sizes',
    exports: 'auto',
  },
  plugins: [
    typescript(),
  ],
};
