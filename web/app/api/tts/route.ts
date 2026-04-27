import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text is required" }, { status: 400 });

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata("en-AU-NatashaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = await tts.toStream(text.slice(0, 5000));

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });

    const audioContent = Buffer.concat(chunks).toString("base64");
    return NextResponse.json({ audioContent });
  } catch (err) {
    console.error("[tts] Edge TTS error:", err);
    return NextResponse.json({ error: "TTS request failed" }, { status: 502 });
  }
}
