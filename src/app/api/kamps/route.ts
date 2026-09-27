import { NextResponse } from "next/server";
import { getKampsAnalysis } from "@/lib/kamps/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/kamps
 * Full KAMPS analysis: six-stage risk pipeline output, vehicle assessments,
 * and the aggregate alert feed. All underlying data is simulated.
 */
export async function GET() {
  try {
    const analysis = await getKampsAnalysis();
    return NextResponse.json(analysis, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("KAMPS engine failure:", e);
    return NextResponse.json(
      { error: "KAMPS analysis engine failure" },
      { status: 500 }
    );
  }
}
