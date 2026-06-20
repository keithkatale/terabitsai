import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const ResponseSchema = z.object({
  requestId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerNote: z.string().optional(),
  decidedAt: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown
    const parsed = ResponseSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { HITLApprovalService } = await import("@quant/hitl")
    const { getRedisClient } = await import("@quant/memory")

    const redis = getRedisClient()
    const hitlService = new HITLApprovalService(redis)

    await hitlService.submitDecision(parsed.data)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
