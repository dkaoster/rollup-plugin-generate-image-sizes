# rollup-generate-image-sizes

Useful for when you want to automatically resize images for use in a srcset / other responsive web design implementations.

## Installation

```
npm i -D rollup-generate-image-sizes
```

## Usage

```js 
// rollup.config.js
import genImageSizes from 'rollup-generate-image-sizes';

export default {
  plugins: [
    genImageSizes({
      dir: 'static',
      sizes: [1400, 1024, 640, 320],
    })
  ]
}
```

## License
MIT
