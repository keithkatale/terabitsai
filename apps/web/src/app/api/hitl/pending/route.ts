import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { HITLApprovalService } = await import("@quant/hitl")
    const { getRedisClient } = await import("@quant/memory")

    const redis = getRedisClient()
    const hitlService = new HITLApprovalService(redis)
    const pending = await hitlService.listPending()

    return NextResponse.json(pending)
  } catch {
    return NextResponse.json([])
  }
}
