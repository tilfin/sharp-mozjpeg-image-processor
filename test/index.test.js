const assert = require('assert').strict
const fs = require('fs')
const path = require('path')
const { ImageProcessor } = require('../lib')

const processor = new ImageProcessor()

async function generateScaledImages(filePath) {
  const srcStream = fs.createReadStream(filePath)
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
      crop: true,
    }
  ]
  const quality = 70

  const outImgInfos = await processor.execute(srcStream, imgInfos, quality)
  for (let outImgInfo of outImgInfos) {
    console.log(outImgInfo)
  }
}

assert.doesNotReject(async () => {
  const photoFilePath = path.join(__dirname, `test-photo.jpg`)
  const photoFilePath1 = path.join(__dirname, `test1.temp.jpg`)
  const photoFilePath2 = path.join(__dirname, `test2.temp.jpg`)
  fs.copyFileSync(photoFilePath, photoFilePath1)
  fs.copyFileSync(photoFilePath, photoFilePath2)

  await Promise.all([
    generateScaledImages(photoFilePath1),
    generateScaledImages(photoFilePath2),
  ])
})
