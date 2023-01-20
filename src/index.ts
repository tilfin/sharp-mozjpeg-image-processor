import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { mkdir } from 'fs/promises'

import { convertStreamToArrangedFile, convertToScaledFile } from './resizer'

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

/**
 * sharp-mozjpeg-image-processor
 * main class
 */
export class ImageProcessor {
  private tmpRootDir: string
  private log: LogFunction

  /**
   * @param tmpDir temporary directory
   * @param log Logging function
   */
  constructor(tmpDir?: string, log?: LogFunction) {
    this.tmpRootDir = tmpDir ?? os.tmpdir()
    this.log = log ?? ((ctx: any, msg: string) => {
      console.log(msg, JSON.stringify(ctx, null, 2))
    })
  }

  /**
   * execute generating image files from source file stream
   * 
   * @param fileStream source image file stream
   * @param imageInfos generating image file infos 
   * @param quality jpeg quality 0~100
   * @returns generated image file infos
   */
  async execute(fileStream: fs.ReadStream, imageInfos: ImageInfo[], quality = 80): Promise<OutImageInfo[]> {
    const tmpDir = path.join(this.tmpRootDir, 'work' + crypto.randomBytes(8).readUInt32LE(0))
    await mkdir(tmpDir)

    if (imageInfos.length === 0) {
      throw new Error('imageInfo requires at least 1 item')
    }

    const sortedImgInfos = imageInfos.sort((a, b) => (b.width * b.height - a.width * a.height))
    const maxImgInfo = sortedImgInfos.shift()!
    const maxImgFilePath = path.join(tmpDir, `${maxImgInfo.kind}.jpg`)
    const maxOutImgInfo = await this.generateArrangedFile(fileStream, maxImgFilePath, maxImgInfo)
    const results: OutImageInfo[] = [{
      kind: maxOutImgInfo.kind,
      format: 'jpeg',
      width: maxOutImgInfo.width,
      height: maxOutImgInfo.height,
      filePath: maxImgFilePath,
    }]

    // generating scaled and optimized images
    for (const imgInfo of sortedImgInfos) {
      const destFilePath = path.join(tmpDir, `${imgInfo.kind}.jpg`)
      const outImgInfo = await this.generateScaledFile(maxImgFilePath, destFilePath, imgInfo)
      results.push({
        kind: outImgInfo.kind,
        format: 'jpeg',
        width: outImgInfo.width,
        height: outImgInfo.height,
        filePath: destFilePath,
      })
    }

    return results
  }

  // convert file stream to maximum rotation arraged file
  private async generateArrangedFile(fileStream: fs.ReadStream, destFilePath: string, imgInfo: ImageInfo) {
    const outImgInfo = await convertStreamToArrangedFile(fileStream, destFilePath, imgInfo.width, imgInfo.height)
    const result = { ...outImgInfo, kind: imgInfo.kind, filePath: destFilePath }
    this.log(result, 'Generated maximum scaled image file')
    return result
  }

  private async generateScaledFile(srcFilePath: string, destFilePath: string, imgInfo: ImageInfo) {
    const outImgInfo = await convertToScaledFile(srcFilePath, destFilePath, imgInfo.crop ?? false, imgInfo.width, imgInfo.height)
    const result = { ...outImgInfo, kind: imgInfo.kind, filePath: destFilePath }
    this.log(result, 'Generated scaled image file from maximum scaled one')
    return result
  }
}
