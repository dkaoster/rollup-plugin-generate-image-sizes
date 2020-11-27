import globby from 'globby';
import sharp from 'sharp';

/**
 * Generate different image sizes on all images found within a directory,
 * based on the configuration given. Uses sharp as the image processing module.
 */

export default (options = {}) => {
  // Load options
  const {
    hook = 'renderStart', // rollup hook
    quality = 65, // image quality
    dir = null, // directory string or strings
    size = null, // image size or sizes
    inputFormat = ['jpg', 'jpeg', 'png'], // image input formats
    outputFormat = ['jpg'], // image output formats
    forceUpscale = false, // whether or not we should forcibly upscale
  } = options;

  return {
    name: 'generate-image-sizes',
    // Runs on the hook specified, otherwise the renderStart hook.
    // First, get all the image files in the given directory
    [hook]: () => {
      // If preconditions are not met, we just quit.
      if (
        !dir || dir.length === 0
        || !size
        || !inputFormat || inputFormat.length === 0
        || !outputFormat || outputFormat.length === 0
      ) { return Promise.resolve(); }

      return globby(
        // Finds all the images we want based on dir and inputFormat
        `{${Array.isArray(dir) ? dir.join(',') : dir}}/**/!(*@*|*#*).{${inputFormat.join(',')}}`,
      )
        .then((images) => Promise.allSettled(
          // Map them into sharp objects
          images.map((image) => {
            const sharpObj = sharp(image);

            // generate the output path
            const imagePathSplit = image.split('.');
            const imagePathPre = imagePathSplit.slice(0, -1).join('.');

            // Read the sharp metadata so we know what the input width is.
            return sharpObj.metadata()
              .then((metadata) => Promise.allSettled(
                (Array.isArray(size) ? size : [size]).map((scaleWidth) => {
                  // If the width we want to scale to is larger than the original
                  // width and forceUpscale is not set, we skip this.
                  if (scaleWidth > metadata.width && !forceUpscale) return Promise.resolve();

                  // Save all of the output images
                  return Promise.all(
                    (Array.isArray(outputFormat) ? outputFormat : [outputFormat])
                      .map((format) => sharpObj
                        .resize(scaleWidth)
                        .toFormat(format, { quality })
                        .toFile(`${imagePathPre}@${scaleWidth}w.${format}`)),
                  );
                }),
              ));
          }),
        ));
    },
  };
};
