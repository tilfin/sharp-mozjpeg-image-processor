import fs from 'fs'
const sharp = require('sharp')
const promisedLifestream = require('promised-lifestream')

export interface OutFileInfo {
  format: 'jpeg'
  width: number
  height: number
  channels: number
  size: number
}

export async function convertStreamToArrangedFile(srcFileStream: fs.ReadStream, destFilePath: string, maxWidth: number, maxHeight: number): Promise<OutFileInfo> {
  let imgInfo: OutFileInfo | null = null

  const largeResizer = sharp()
                        .rotate()
                        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: false })
                        .on('info', (info: any) => { imgInfo = info })
                        .jpeg({ mozjpeg: true })
  const fileWriter = fs.createWriteStream(destFilePath, { encoding: undefined })

  await promisedLifestream([
    srcFileStream,
    largeResizer,
    fileWriter,
  ])

  return imgInfo!
}

export async function convertToScaledFile(srcFilePath: string, destFilePath: string, crop: boolean, maxWidth: number, maxHeight: number): Promise<OutFileInfo> {
  return sharp(srcFilePath)
    .resize({ width: maxWidth, height: maxHeight, fit: crop ? 'cover' : 'inside' })
    .jpeg({ mozjpeg: true })
    .toFile(destFilePath)
}
