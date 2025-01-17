import fs from 'fs'
import { ImageProcessor } from 'sharp-mozjpeg-image-processor'

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
    crop: true,
  }
]
const quality = 70

processor.execute(srcStream, imgInfos, quality)
.then(outImgInfos => {
  for (let outImgInfo of outImgInfos) {
    console.log(outImgInfo)
  }
})
