import { NextRequest, NextResponse } from "next/server";
import { getCertificate } from "@/lib/store";

export const runtime = "nodejs";

// Public certificate lookup for the shareable certificate page.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ certId: string }> }) {
  try {
    const { certId } = await ctx.params;
    const certificate = getCertificate(certId);
    if (!certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    return NextResponse.json({ certificate });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
