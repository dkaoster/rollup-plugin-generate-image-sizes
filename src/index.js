import { promises as fs } from 'fs';
import globby from 'globby';
import sharp from 'sharp';

/**
 * Generate different image sizes on all images found within a directory,
 * based on the configuration given.
 */

export default (options = {}) => {
  // Load options
  const {
    hook = 'renderStart',
    quality = 65,
    dir = '.',
    inputFormats = ['jpg', 'jpeg', 'png'],
    outputFormats = ['jpg'],
    sizes = [1400, 1024, 640, 320],
  } = options;

  return {
    name: 'generate-image-sizes',
    // Runs on the hook specified, otherwise the renderStart hook.
    // First, get all the image files in the given directory
    [hook]: () => {
      if (!inputFormats) return Promise.resolve();
      return globby(`${dir}/**/!(*@*|*#*).{${inputFormats.join(',')}`)
        .then((images) => Promise.allSettled(
        // Map them into sharp objects
          images.map((image) => {
            const sharpObj = sharp(image);

            // generate the output path
            const imagePathSplit = image.split('.');
            const imagePathPre = imagePathSplit.slice(0, -1).join('.');
            const imagePathPost = imagePathSplit[imagePathSplit.length - 1];

            // Save a jpg copy of this image if we don't have one already
            if (imagePathPost !== 'jpg') {
              sharpObj.jpeg({ quality }).toFile(`${imagePathPre}.jpg`);
            }

            // Read the sharp metadata because we don't want to do stupid
            // things like scale up (pointless)
            return sharpObj.metadata()
              .then((metadata) => Promise.allSettled(
                sizes.map((scaleWidth) => {
                  const jpgOut = `${imagePathPre}@${scaleWidth}w.jpg`;
                  const webpOut = `${imagePathPre}@${scaleWidth}w.webp`;

                  // Output webp
                  sharpObj
                    .resize(scaleWidth)
                    .webp({ quality })
                    .toFile(webpOut);

                  // If the width we want to scale to is larger than the original
                  // width, we return a relative symlink to the original file.
                  if (scaleWidth > metadata.width && imagePathPost === 'jpg') {
                    const imagePath = image.split('/');
                    const relativePath = `./${imagePath[imagePath.length - 1]}`;
                    return fs.symlink(relativePath, jpgOut);
                  }

                  // Output this image
                  return sharpObj
                    .resize(scaleWidth)
                    .jpeg({ quality })
                    .toFile(jpgOut);
                }).filter((p) => !!p),
              ));
          }),
        ));
    },
  };
};
