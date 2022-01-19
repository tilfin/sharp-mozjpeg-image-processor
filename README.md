# sharp-mozjpeg-image-processor

[![npm version](https://img.shields.io/npm/v/sharp-mozjpeg-image-processor.svg)](https://npmjs.org/package/sharp-mozjpeg-image-processor)
[![Node](https://img.shields.io/node/v/dynamo-processor.svg)]()
[![Build & Test](https://github.com/tilfin/sharp-mozjpeg-image-processor/actions/workflows/ci.yml/badge.svg)](https://github.com/tilfin/sharp-mozjpeg-image-processor/actions/workflows/ci.yml)

Generates scaled (by sharp) and optimized (by mozjpeg) image files from a source image file

## Install

```
$ npm i -save sharp-mozjpeg-image-processor
```

## How to use

```js
const fs = require('fs')
const { ImageProcessor } = require('sharp-mozjpeg-image-processor')

const processor = new ImageProcessor()

const srcStream = fs.createReadStream('./source.jpg')
const imgInfos = [
  {
    kind: 'large',
    width: 1200,
    height: 1200,
  },
  {
    kind: 'small',
    width: 800,
    height: 800,
  },
  {
    kind: 'thumb',
    width: 400,
    height: 400,
    crop: true, // cover for example thumbnail
  }
]
const quality = 70 // default 80 for jpeg image quality

processor.execute(srcStream, imgInfos, quality)
.then(outImgInfos => {
  for (let outImgInfo of outImgInfos) {
    console.log(outImgInfo)
  }
})
```

```js
{
  kind: 'large',
  format: 'jpeg',
  width: 900,
  height: 1200,
  filePath: '/tmp/work897439499/optimized/large.jpg'
}
{
  kind: 'small',
  format: 'jpeg',
  width: 600,
  height: 800,
  filePath: '/tmp/work897439499/optimized/small.jpg'
}
{
  kind: 'thumb',
  format: 'jpeg',
  width: 400,
  height: 400,
  filePath: '/tmp/work897439499/optimized/thumb.jpg'
}
```
