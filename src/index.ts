import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
const mkdirp = require('mkdirp')
const imagemin = require('imagemin')
const imageminMozjpeg = require('imagemin-mozjpeg')

import { convertStreamToArrangedFile, convertToScaledFile } from './resizer'

const OPTIMIZED_DIR = 'optimized'

type LogFunction = (ctx: any, msg: string) => void

/**
 * Expected image file info
 */
export interface ImageInfo {
  kind: string
  width: number
  height: number
  crop?: boolean
}

/**
 * Generated image file info
 */
export interface OutImageInfo {
  kind: string
  format: 'jpeg'
  width: number
  height: number
  filePath: string
}

export class ImageProcessor {
  private tmpRootDir: string
  private log: LogFunction

  constructor(tmpDir?: string, log?: LogFunction) {
    this.tmpRootDir = tmpDir ?? os.tmpdir()
    this.log = log ?? ((ctx: any, msg: string) => {
      console.log(msg, JSON.stringify(ctx, null, 2))
    })
  }

  /**
   * ./tmp/workNNNNN/
   *    <here resized files>
   *    optimzed/
   *       <here optimized files>
   */
  async execute(fileStream: fs.ReadStream, imageInfos: ImageInfo[], quality = 80): Promise<OutImageInfo[]> {
    const tmpDir = path.join(this.tmpRootDir, 'work' + crypto.randomBytes(8).readUInt32LE(0))
    mkdirp.sync(`${tmpDir}/optimized`)

    if (imageInfos.length === 0) {
      throw new Error('imageInfo requires at least 1 item')
    }

    const sortedImgInfos = imageInfos.sort((a, b) => (b.width * b.height - a.width * a.height))
    const maxImgInfo = sortedImgInfos.shift()!
    const maxImgFilePath = path.join(tmpDir, `${maxImgInfo.kind}.jpg`)
    const maxOutImgInfo = await this.generateArrangedFile(fileStream, maxImgFilePath, maxImgInfo)
    const outImgInfos = [maxOutImgInfo]

    for (const imgInfo of sortedImgInfos) {
      const destFilePath = path.join(tmpDir, `${imgInfo.kind}.jpg`)
      outImgInfos.push(await this.generateScaledFile(maxImgFilePath, destFilePath, imgInfo))
    }

    await this.generateOptimizedFiles(tmpDir, path.join(tmpDir, OPTIMIZED_DIR), quality)

    // Deleting sized files and build results
    const results: OutImageInfo[] = []
    for (const outImgInfo of outImgInfos) {
      fs.unlink(outImgInfo.filePath, () => {}) // not wait

      const pathParts = outImgInfo.filePath.split('/')
      pathParts.splice(pathParts.length - 1, 0, OPTIMIZED_DIR)

      results.push({
        kind: outImgInfo.kind,
        format: 'jpeg',
        width: outImgInfo.width,
        height: outImgInfo.height,
        filePath: pathParts.join('/')
      })
    }
    this.log({}, 'Deleted scaled and unoptimized image files')

    return results
  }

  // convert file stream to maximum rotation arraged file
  async generateArrangedFile(fileStream: fs.ReadStream, destFilePath: string, imgInfo: ImageInfo) {
    const outImgInfo = await convertStreamToArrangedFile(fileStream, destFilePath, imgInfo.width, imgInfo.height)
    const result = { ...outImgInfo, kind: imgInfo.kind, filePath: destFilePath }
    this.log(result, 'Generated maximum scaled image file')
    return result
  }

  async generateScaledFile(srcFilePath: string, destFilePath: string, imgInfo: ImageInfo) {
    const outImgInfo = await convertToScaledFile(srcFilePath, destFilePath, imgInfo.crop ?? false, imgInfo.width, imgInfo.height)
    const result = { ...outImgInfo, kind: imgInfo.kind, filePath: destFilePath }
    this.log(result, 'Generated scaled image file from maximum scaled one')
    return result
  }

  async generateOptimizedFiles(srcDir: string, destDir: string, quality: number) {
    await imagemin([`${srcDir}/*.jpg`], {
      destination: destDir,
      plugins: [imageminMozjpeg({ quality })]
    })
    this.log({}, 'Generated optimized image files')
  }
}
