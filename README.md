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
      size: [1400, 1024, 640, 320],
      hook: 'renderStart',
      quality: 65,
      inputFormat: ['jpg', 'jpeg', 'png'],
      outputFormat: ['jpg'],
      forceUpscale: false,
      skipExisting: true,
      maxParallel: 4,
    })
  ]
}
```

Note: All output files are named in the pattern `<original-filename>@<size>w.<file-extension>`. The plugin looks for the `@` symbol to determine which files have already been converted, which means that all files with the `@` will be ignored. Files with `#` are also ignored.

### Configuration
`dir` (required | `string` or `[string]`) the string or array of strings specifying the directory where the images we want to resize are.

`size` (default: [1400, 1024, 640, 320] | `int` or `[int]`) An integer or array of integers specifying the width in pixels of our output image.

`hook` (default: renderStart) [the rollup hook](https://rollupjs.org/guide/en/#build-hooks) that this plugin should use.

`quality` (default: 65 | `int`): The quality of output images, for image formats that have output quality controls.

`inputFormat` (default: ['jpg', 'jpeg', 'png'] | `string` or `[string]`): The file extensions of the images we care about. Must be a format supported by [jimp](https://github.com/oliver-moran/jimp#supported-image-types), or `match`, which matches the input format of the image.

`outputFormat` (default: 'jpg' | `string` or `[string]`): The file extensions of the images we want to output. Must be a format supported by [jimp](https://github.com/oliver-moran/jimp#supported-image-types) or `match`, which is used to match the input format.

`forceUpscale` (default: false | `boolean`): If the source image is larger, do we want to forcibly generate a scaled up version or whether we should just ignore it.

`skipExisting` (default: true | `boolean`): whether we should skip existing images that have already been resized. a false value means that images will be regenerated and overwritten every single time this script is run.

`maxParallel` (default: 4 | `int`): the max number of parallel images that can be processed concurrently.

## License
MIT
