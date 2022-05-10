import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
const mkdirp = require('mkdirp')
// @ts-ignore
import { ImagePool } from '@squoosh/lib'

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

/**
 * https://github.com/GoogleChromeLabs/squoosh/tree/dev/libsquoosh
 * Important! Make sure to only create 1 ImagePool when performing parallel image processing.
 */
class ImagePoolManager {
  private pool: ImagePool | null = null
  private refCount: number = 0

  constructor(private workers: number) {}

  async retain(): Promise<ImagePool> {
    if (!this.pool) {
      this.pool = new ImagePool(this.workers)
    }
    this.refCount++
    return this.pool
  }

  async release(): Promise<void> {
    this.refCount--
    if (this.refCount === 0) {
      await this.pool.close()
      this.pool = null
    }
  }
}
const imagePoolManager = new ImagePoolManager(os.cpus().length)

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

    // generating scaled images
    for (const imgInfo of sortedImgInfos) {
      const destFilePath = path.join(tmpDir, `${imgInfo.kind}.jpg`)
      outImgInfos.push(await this.generateScaledFile(maxImgFilePath, destFilePath, imgInfo))
    }

    // optimizing and deleting source files and build results
    const imagePool = await imagePoolManager.retain()
    const results: OutImageInfo[] = []
    for (const outImgInfo of outImgInfos) {
      const pathParts = outImgInfo.filePath.split('/')
      pathParts.splice(pathParts.length - 1, 0, OPTIMIZED_DIR)
      const filePath = pathParts.join('/')

      await this.generateOptimizedFile(outImgInfo.filePath, filePath, imagePool, quality)
      fs.unlink(outImgInfo.filePath, () => {}) // not wait

      results.push({
        kind: outImgInfo.kind,
        format: 'jpeg',
        width: outImgInfo.width,
        height: outImgInfo.height,
        filePath,
      })
    }
    await imagePoolManager.release()
    this.log({}, 'Deleted scaled and unoptimized image files')

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

  private async generateOptimizedFile(srcFilePath: string, destFilePath: string, imagePool: ImagePool, quality: number) {
    const file = await fs.promises.readFile(srcFilePath)
    const image = imagePool.ingestImage(file)
    await image.encode({ mozjpeg: { quality }})
    const encodedImage = (await image.encodedWith.mozjpeg).binary
    await fs.promises.writeFile(destFilePath, encodedImage)
    this.log({ filePath: destFilePath }, 'Generated optimized image files')
  }
}
