import { promises as fs } from 'fs';
import globby from 'globby';
import sharp from 'sharp';

/**
 * Generate different image sizes on all images found within a directory,
 * based on the configuration given.
 *
 * @param options
 * @returns {{buildEnd(): void, name: string}}
 */

export default (options) => ({
  name: 'generate-image-sizes',
  // Runs on renderStart hook.
  // First, get all the image files in the given directory
  renderStart: () => globby(`${options.dir}/**/!(*@*|*#*).{jpg,jpeg,png}`)
    .then((images) => Promise.allSettled(
      // Map them into sharp objects
      images.map((image) => {
        const sharpObj = sharp(image);

        // Read the sharp metadata because we don't want to do stupid
        // things like scale up (pointless)
        return sharpObj.metadata()
          .then((metadata) => Promise.allSettled(
            options.sizes.map((scaleWidth) => {
              // generate the output path
              const imagePathSplit = image.split('.');
              const imagePathPre = imagePathSplit.slice(0, -1).join('.');
              const imagePathPost = imagePathSplit[imagePathSplit.length - 1];
              const fileOut = `${imagePathPre}@${scaleWidth}w.${imagePathPost}`;

              // If the width we want to scale to is larger than the original
              // width, we return a relative symlink to the original file.
              if (scaleWidth > metadata.width) {
                const imagePath = image.split('/');
                const relativePath = `./${imagePath[imagePath.length - 1]}`;
                // TODO windows can't symlink
                return fs.symlink(relativePath, fileOut);
              }

              // Output this image
              return sharpObj.resize(scaleWidth).toFile(fileOut);
            }).filter((p) => !!p),
          ));
      }),
    )),
});
