import { NextResponse } from "next/server";
import { capitalAdapter } from "@/lib/execution/capital-adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await capitalAdapter.getAccounts();
    if (accounts && accounts.length > 0) {
      const activeAccount = accounts[0];
      return NextResponse.json({
        success: true,
        balance: activeAccount.balance,
        currency: activeAccount.currency,
        available: activeAccount.available,
        profitLoss: activeAccount.profitLoss,
        accountId: activeAccount.accountId,
        history: []
      });
    }
    
    // Fail if session is inactive or no accounts are returned to ensure 100% real live data flow
    return NextResponse.json({
      success: false,
      error: "Capital.com session is inactive or no accounts are linked. Please configure your live/demo credentials in .env.local."
    }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to fetch accounts from Capital.com"
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount) || 0;
    
    // In a live environment, deposits must be routed through the official broker client cabinet for PCI/regulatory compliance.
    return NextResponse.json({
      success: true,
      isLiveDirective: true,
      message: `To fund your live/demo Capital.com account with $${amount.toLocaleString()} ${body.currency || "USD"}, please log in to your secure Capital.com client area. API-based direct deposit is restricted by the brokerage for security compliance.`,
      amount,
      currency: body.currency || "USD",
      method: body.method || "CRYPTO",
      directive: "https://capital.com/cabinet"
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

