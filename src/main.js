import fs from 'fs';
import globby from 'globby';
import jimp from 'jimp';
import Queue from 'promise-queue';

/**
 * A helper function for transform single items to array such that:
 * [a] => [a]
 * a => [a]
 * ...
 *
 * @param a
 */
export const arrayify = (a) => (Array.isArray(a) ? [...a] : [a]);

/**
 * Generates the crops for this image and saves it to disk.
 *
 * @param image
 * @param outputs
 * @param quality
 * @param forceUpscale
 * @param imagePathPre
 * @param addGeneratedFile
 */
export const generateCrops = ({
  image, outputs, imagePathPre, quality, forceUpscale, addGeneratedFile,
}) => () => jimp.read(image)
  .then((jimpObj) => Promise.allSettled(
    (outputs)
      // Get only the sizes that we need to generate
      .reduce((acc, val) => {
        if (acc.indexOf(val.scaleWidth) < 0) return [...acc, val.scaleWidth];
        return acc;
      }, [])
      .map((scaleWidth) => {
        // If the target width is larger than the original
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
            .map((format) => {
              // Add this file to the generated file list
              addGeneratedFile(image, scaleWidth, format);

              // Do the resize and save
              return jimpObj
                .clone()
                .resize(scaleWidth, jimp.AUTO)
                .quality(quality)
                .write(`${imagePathPre}@${scaleWidth}w.${format}`);
            }),
        );
      }),
  ));

/**
 * Processes this image, determining which crops and sizes we need to generate.
 *
 * @param queue
 * @param size
 * @param skipExisting
 * @param outputFormat
 * @param quality
 * @param forceUpscale
 * @param addGeneratedFile
 * @returns {(function(*, *, *): void)|*}
 */
export const processImage = ({
  queue, size, skipExisting, outputFormat, quality, forceUpscale, addGeneratedFile,
}) => (image, index, imageArray) => {
  const sizes = arrayify(size);

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

  // An array of objects that contains sizes and formats of all our outputs.
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
      ({ format, scaleWidth }) => {
        const cropExists = fs.existsSync(`${imagePathPre}@${scaleWidth}w.${format}`);
        // If this image crop already exists, we add it to the generated image list anyway
        if (cropExists) addGeneratedFile(image, scaleWidth, format);
        return !cropExists;
      },
    );

    // if images already exist, we can skip this rest of this process
    if (outputs.length === 0) {
      // If every single file is skipped, we still need to resolve
      // so that promise-queue doesn't sit around waiting forever.
      if (index === imageArray.length - 1) queue.add(() => Promise.resolve());
      return;
    }
  }

  // load in the image
  queue.add(generateCrops({
    image, outputs, imagePathPre, quality, forceUpscale, addGeneratedFile,
  }));
};

/**
 * Generate different image sizes on all images found within a directory,
 * based on the configuration given. Uses jimp as the image processing module.
 *
 * @param options
 * @returns {Promise<unknown>|Promise<void>|{name: string}}
 */
export default (options) => {
  // Load options
  const {
    hook = 'renderStart', // rollup hook
    quality = 65, // image quality
    dir = null, // directory string or strings
    size = [1400, 1024, 640, 320], // image size or sizes
    inputFormat = ['jpg', 'jpeg', 'png'], // image input formats
    outputFormat = ['jpg'], // image output formats
    forceUpscale = false, // whether we should forcibly upscale
    skipExisting = true, // whether we should skip existing images that have already been resized
    maxParallel = 4, // the max number of parallel images that can be processed concurrently
    outputManifest = null, // The path to output a manifest of all generated images
  } = options;

  return {
    name: 'generate-image-sizes',

    // Runs on the hook specified, otherwise the renderStart hook.
    // First, get all the image files in the given directory
    [hook]() {
      // If preconditions are not met, we just quit.
      if (
        !dir || dir.length === 0
        || !size
        || !inputFormat || inputFormat.length === 0
        || !outputFormat || outputFormat.length === 0
      ) { return Promise.resolve(); }

      // The sizes and formats that we will output to, arrayified.
      const inputFormats = arrayify(inputFormat);

      // Glob for the directories
      const dirGlob = arrayify(dir).length > 1 ? `{${arrayify(dir).join(',')}}` : arrayify(dir)[0];

      // An array that contains all the images we've generated (or already exist)
      let generatedFiles = [];
      const addGeneratedFile = (image, width, format) => {
        generatedFiles = [...generatedFiles, { image, width, format }];
      };

      return new Promise((resolve) => {
        // Promise queue so that we only process maxParallel parallel files at a time
        const q = new Queue(maxParallel, Infinity, {
          onEmpty: () => {
            if (outputManifest) fs.writeFileSync(outputManifest, JSON.stringify(generatedFiles));
            return resolve();
          },
        });

        // Finds all the images we want based on dir and inputFormat
        globby(`${dirGlob}/**/*.{${inputFormats.join(',')}}`)
          .then((images) => {
            // Map them into jimp objects
            images
              .filter((d) => d.indexOf('@') < 0 && d.indexOf('#') < 0)
              .forEach(processImage({
                queue: q, size, skipExisting, outputFormat, quality, forceUpscale, addGeneratedFile,
              }));
          });
      });
    },
  };
};
