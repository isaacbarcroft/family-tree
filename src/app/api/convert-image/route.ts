import { NextResponse } from "next/server"
import convert from "heic-convert"

export const runtime = "nodejs"

const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]

function isHeicByNameOrType(name: string, type: string) {
  return /\.(heic|heif)$/i.test(name) || /image\/(heic|heif)/i.test(type)
}

function isHeicByMagic(buffer: Buffer) {
  if (buffer.length < 12) return false
  const ftyp = buffer.toString("ascii", 4, 8)
  if (ftyp !== "ftyp") return false
  const brand = buffer.toString("ascii", 8, 12)
  return HEIC_BRANDS.includes(brand)
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer())
    const isHeic =
      isHeicByNameOrType(file.name || "", file.type || "") ||
      isHeicByMagic(inputBuffer)

    if (!isHeic) {
      return new NextResponse(new Uint8Array(inputBuffer), {
        status: 200,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Cache-Control": "no-store",
        },
      })
    }

    const outputBuffer = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.88,
    })

    return new NextResponse(new Uint8Array(outputBuffer as Buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown conversion error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
