import fs from 'fs';
import globby from 'globby';
import jimp from 'jimp';
import Queue from 'promise-queue';

/**
 * Generate different image sizes on all images found within a directory,
 * based on the configuration given. Uses jimp as the image processing module.
 */

// A helper function for transform single items to array
const arrayify = (a) => (Array.isArray(a) ? [...a] : [a]);

export default (options = {}) => {
  // Load options
  const {
    hook = 'renderStart', // rollup hook
    quality = 65, // image quality
    dir = null, // directory string or strings
    size = [1400, 1024, 640, 320], // image size or sizes
    inputFormat = ['jpg', 'jpeg', 'png'], // image input formats
    outputFormat = ['jpg'], // image output formats
    forceUpscale = false, // whether or not we should forcibly upscale
    skipExisting = true, // whether we should skip existing images that have already been resized
    maxParallel = 4, // the max number of parallel images that can be processed concurrently
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

      // The sizes and formats that we will output to, arrayified.
      const sizes = arrayify(size);

      // Glob for the directories
      const dirGlob = arrayify(dir).length > 1 ? `{${arrayify(dir).join(',')}}` : arrayify(dir)[0];

      return new Promise((resolve) => {
        // Promise queue so that we only process maxParallel parallel files at a time
        const q = new Queue(maxParallel, Infinity, { onEmpty: () => resolve() });

        globby(
          // Finds all the images we want based on dir and inputFormat
          `${dirGlob}/**/*.{${inputFormat.join(',')}}`,
        )
          .then((images) => {
            // Map them into jimp objects
            images
              .filter((d) => d.indexOf('@') < 0 && d.indexOf('#') < 0)
              .forEach((image, index, imageArray) => {
                // generate the output path
                const imagePathSplit = image.split('.');
                const imagePathPre = imagePathSplit.slice(0, -1).join('.');
                const imageFormat = imagePathSplit[imagePathSplit.length - 1];

                // process image format options
                const formats = Array.from(new Set(
                  arrayify(outputFormat)
                  // If format is match, we match to the input format
                    .map((format) => (format === 'match' ? imageFormat : format))
                  // If format is jpeg, we map to jpg
                    .map((format) => (format === 'jpeg' ? 'jpg' : format)),
                ));

                // An array of objects that contain sizes and formats of all our outputs.
                let outputs = sizes.reduce(
                  (acc, scaleWidth) => [
                    ...acc,
                    ...formats.map((format) => ({ format, scaleWidth })),
                  ],
                  [],
                );

                // if skipExisting is set
                if (skipExisting) {
                  // Filter out images that already exist
                  outputs = outputs.filter(
                    ({ format, scaleWidth }) => !fs.existsSync(`${imagePathPre}@${scaleWidth}w.${format}`),
                  );

                  // if images already exist, we can skip this rest of this process
                  if (outputs.length === 0) {
                    // If every single file is skipped, we still need to resolve
                    // so that promise-queue doesn't sit around waiting forever.
                    if (index === imageArray.length - 1) q.add(() => Promise.resolve());
                    return;
                  }
                }

                // ////////////////////////////////////////////
                // Everything below is expensive, so short-circuit this as much as possible
                // load in the image
                q.add(() => jimp.read(image)
                  .then((jimpObj) => Promise.allSettled(
                    outputs
                    // Get only the sizes that we need to generate
                      .reduce((acc, val) => {
                        if (acc.indexOf(val.scaleWidth) < 0) return [...acc, val.scaleWidth];
                        return acc;
                      }, [])
                      .map((scaleWidth) => {
                        // If the width we want to scale to is larger than the original
                        // width and forceUpscale is not set, we skip this.
                        if (scaleWidth > jimpObj.bitmap.width && !forceUpscale) {
                          return Promise.resolve();
                        }

                        // Save all the output images
                        return Promise.all(
                          outputs
                          // only get the outputs of the current width
                            .filter((d) => d.scaleWidth === scaleWidth)
                            .map((d) => d.format)
                            .map((format) => jimpObj
                              .clone()
                              .resize(scaleWidth, jimp.AUTO)
                              .quality(quality)
                              .write(`${imagePathPre}@${scaleWidth}w.${format}`)),
                        );
                      }),
                  )));
              });
          });
      });
    },
  };
};
