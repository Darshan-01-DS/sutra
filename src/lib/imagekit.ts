// src/lib/imagekit.ts
import ImageKit from 'imagekit'

let instance: ImageKit | null = null

function getImageKit(): ImageKit {
  if (instance) return instance

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      'Missing ImageKit env vars. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT in .env.local'
    )
  }

  instance = new ImageKit({ publicKey, privateKey, urlEndpoint })
  return instance
}

export interface UploadResult {
  url: string
  fileId: string
  name: string
  size: number
  thumbnailUrl: string
}

export async function uploadToImageKit(
  fileBuffer: Buffer,
  fileName: string,
  folder = '/sutra'
): Promise<UploadResult> {
  const ik = getImageKit()

  const result = await ik.upload({
    file: fileBuffer,
    fileName,
    folder,
    useUniqueFileName: true,
  })

  return {
    url: result.url,
    fileId: result.fileId,
    name: result.name,
    size: result.size,
    thumbnailUrl: result.thumbnailUrl ?? result.url,
  }
}

export async function deleteFromImageKit(fileId: string): Promise<void> {
  try {
    const ik = getImageKit()
    await ik.deleteFile(fileId)
  } catch {
    // silently ignore deletion errors
  }
}
