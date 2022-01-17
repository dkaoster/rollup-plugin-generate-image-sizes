/* eslint-disable no-undef */

const { expect } = require('chai');
const fs = require('fs');
const globby = require('globby');
const {
  arrayify, generateCrops, processImage,
} = require('../dist/rollup-plugin-generate-image-sizes');

describe('Test arrayify', () => {
  const arrayifyTests = [
    { input: 0, expected: [0] },
    { input: 1, expected: [1] },
    { input: -1.2, expected: [-1.2] },
    { input: [1], expected: [1] },
    { input: [1, 'a'], expected: [1, 'a'] },
    { input: 'abc', expected: ['abc'] },
    { input: null, expected: [null] },
    { input: undefined, expected: [undefined] },
  ];

  arrayifyTests.forEach(({ input, expected }) => {
    it(`input ${input} should return ${JSON.stringify(expected)}`, () => {
      expect(arrayify(input)).deep.equal(expected);
    });
  });
});

describe('Test generateCrops', () => {
  let generatedFiles = [];

  const cleanFiles = (done) => {
    generatedFiles = [];
    globby('./test/**/*@*').then((images) => {
      images.forEach((image) => { fs.unlinkSync(image); });
      done();
    });
  };

  // Cleans the directory before and after each test
  beforeEach(cleanFiles);
  afterEach(cleanFiles);

  const addGeneratedFile = (...props) => { generatedFiles = [...generatedFiles, props]; };

  // Our different test cases
  const generateCropTests = [
    {
      label: 'forceUpscale = false',
      options: {
        image: './test/test-image.jpg',
        outputs: [{ scaleWidth: 400, format: 'jpg' }, { scaleWidth: 800, format: 'jpg' }],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile,
      },
      expected: () => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(true);
        expect(fs.existsSync('./test/test-image@400w.png')).to.equal(false);
        expect(fs.existsSync('./test/test-image@600w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(false);
        expect(generatedFiles.length).to.equal(1);
      },
    },
    {
      label: 'forceUpscale = true',
      options: {
        image: './test/test-image.jpg',
        outputs: [
          { scaleWidth: 400, format: 'jpg' },
          { scaleWidth: 600, format: 'jpg' },
          { scaleWidth: 800, format: 'jpg' },
        ],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: true,
        addGeneratedFile,
      },
      expected: () => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(true);
        expect(fs.existsSync('./test/test-image@400w.png')).to.equal(false);
        expect(fs.existsSync('./test/test-image@600w.jpg')).to.equal(true);
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(true);
        expect(generatedFiles.length).to.equal(3);
      },
    },
    {
      label: 'multi-format',
      options: {
        image: './test/test-image.jpg',
        outputs: [
          { scaleWidth: 400, format: 'jpg' },
          { scaleWidth: 400, format: 'png' },
        ],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: true,
        addGeneratedFile,
      },
      expected: () => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(true);
        expect(fs.existsSync('./test/test-image@400w.png')).to.equal(true);
        expect(fs.existsSync('./test/test-image@600w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(false);
        expect(generatedFiles.length).to.equal(2);
      },
    },
    {
      label: 'blank',
      options: {
        image: './test/test-image.jpg',
        outputs: [
          { scaleWidth: 800, format: 'jpg' },
          { scaleWidth: 800, format: 'png' },
        ],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile,
      },
      expected: () => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@400w.png')).to.equal(false);
        expect(fs.existsSync('./test/test-image@600w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(false);
        expect(generatedFiles.length).to.equal(0);
      },
    },
    {
      label: 'blank 2',
      options: {
        image: './test/test-image.jpg',
        outputs: [],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile,
      },
      expected: () => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@400w.png')).to.equal(false);
        expect(fs.existsSync('./test/test-image@600w.jpg')).to.equal(false);
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(false);
        expect(generatedFiles.length).to.equal(0);
      },
    },
  ];

  generateCropTests.forEach(({ label, options, expected }) => {
    it(label, async () => {
      await generateCrops(options)();
      expected();
    });
  });
});

describe('Test processImage', () => {
  let queueAddCalled = 0;
  let generatedFiles = [];

  const queue = { add: () => { queueAddCalled += 1; } };
  const addGeneratedFile = (...props) => { generatedFiles = [...generatedFiles, props]; };

  const cleanFiles = (done) => {
    generatedFiles = [];
    globby('./test/**/*@*').then((images) => {
      images.forEach((image) => { fs.unlinkSync(image); });
      done();
    });
  };

  beforeEach(() => {
    queueAddCalled = 0;
    generatedFiles = [];
  });

  afterEach(cleanFiles);

  const processImageTests = [
    {
      label: 'basic case',
      options: {
        queue,
        size: 400,
        skipExisting: true,
        outputFormat: 'jpg',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile,
      },
      imageProps: ['./test/test-image.jpg', 0, ['./test/test-image.jpg']],
      expected: () => {
        expect(queueAddCalled).to.equal(1);
        expect(generatedFiles.length).to.equal(0);
      },
    },
    {
      label: 'existing case',
      before: () => generateCrops({
        image: './test/test-image.jpg',
        outputs: [{ scaleWidth: 400, format: 'jpg' }],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile: () => {},
      })().then(() => {
        expect(fs.existsSync('./test/test-image@400w.jpg')).to.equal(true);
      }),
      options: {
        queue,
        size: 400,
        skipExisting: true,
        outputFormat: 'jpg',
        quality: 50,
        forceUpscale: false,
        addGeneratedFile,
      },
      imageProps: ['./test/test-image.jpg', 0, ['./test/test-image.jpg']],
      expected: () => {
        expect(queueAddCalled).to.equal(1);
        expect(generatedFiles.length).to.equal(1);
      },
    },
    {
      label: 'one existing one generated case',
      before: () => generateCrops({
        image: './test/test-image.jpg',
        outputs: [{ scaleWidth: 800, format: 'jpg' }],
        imagePathPre: './test/test-image',
        quality: 50,
        forceUpscale: true,
        addGeneratedFile: () => {},
      })().then(() => {
        expect(fs.existsSync('./test/test-image@800w.jpg')).to.equal(true);
      }),
      options: {
        queue,
        size: [400, 800],
        skipExisting: true,
        outputFormat: 'match',
        quality: 50,
        forceUpscale: true,
        addGeneratedFile,
      },
      imageProps: ['./test/test-image.jpg', 0, ['./test/test-image.jpg']],
      expected: () => {
        expect(queueAddCalled).to.equal(1);
        expect(generatedFiles).deep.equal([['./test/test-image.jpg', 800, 'jpg']]);
      },
    },
  ];

  processImageTests.forEach(({
    label,
    before,
    options,
    imageProps,
    expected,
  }) => {
    it(label, async () => {
      if (typeof before === 'function') await before();
      processImage(options)(...imageProps);
      expected();
    });
  });
});
