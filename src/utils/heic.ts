let scriptLoadingPromise: Promise<void> | null = null

declare global {
  interface Window {
    heic2any?: (options: {
      blob: Blob
      toType: string
      quality?: number
    }) => Promise<Blob | Blob[]> | Blob | Blob[]
  }
}

function isLoaded() {
  return typeof window !== "undefined" && typeof window.heic2any === "function"
}

async function loadScriptFrom(src: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function ensureHeic2AnyLoaded() {
  if (typeof window === "undefined") {
    throw new Error("HEIC conversion only runs in the browser")
  }

  if (isLoaded()) return
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = (async () => {
    const cdnSources = [
      "https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js",
      "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
    ]

    let lastError: unknown = null
    for (const src of cdnSources) {
      try {
        await loadScriptFrom(src)
        if (isLoaded()) return
      } catch (err) {
        lastError = err
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Unable to load HEIC converter")
  })()

  return scriptLoadingPromise
}

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]

export function isHeicFile(file: File) {
  return /\.(heic|heif)$/i.test(file.name) || /image\/(heic|heif)/i.test(file.type)
}

export async function isHeicFileByMagic(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const slice = file.slice(0, 12)
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (!(result instanceof ArrayBuffer) || result.byteLength < 12) {
        resolve(false)
        return
      }
      const bytes = new Uint8Array(result)
      const ftyp = String.fromCharCode(...bytes.subarray(4, 8))
      if (ftyp !== "ftyp") {
        resolve(false)
        return
      }
      const brand = String.fromCharCode(...bytes.subarray(8, 12))
      resolve(HEIC_BRANDS.includes(brand))
    }
    reader.onerror = () => resolve(false)
    reader.readAsArrayBuffer(slice)
  })
}

async function convertWithBrowser(file: File): Promise<File> {
  await ensureHeic2AnyLoaded()

  if (!window.heic2any) {
    throw new Error("HEIC converter unavailable in browser")
  }

  const converted = await window.heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  })

  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob) throw new Error("HEIC conversion returned empty output")

  const jpgName = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg"
  return new File([blob], jpgName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
}

async function convertWithServer(file: File): Promise<File> {
  const form = new FormData()
  form.append("file", file)

  const response = await fetch("/api/convert-image", {
    method: "POST",
    body: form,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Server HEIC conversion failed")
  }

  const convertedBlob = await response.blob()
  const jpgName = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg"

  return new File([convertedBlob], jpgName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  })
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    return await convertWithServer(file)
  } catch (serverError) {
    try {
      return await convertWithBrowser(file)
    } catch (browserError) {
      const serverMsg = serverError instanceof Error ? serverError.message : String(serverError)
      const browserMsg = browserError instanceof Error ? browserError.message : String(browserError)
      throw new Error(`HEIC conversion failed. Server: ${serverMsg}. Browser: ${browserMsg}`)
    }
  }
}
