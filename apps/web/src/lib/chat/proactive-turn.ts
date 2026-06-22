import { randomUUID } from "crypto";
import { Type } from "@google/genai";
import { getAgentGeminiModelId, getVertexGeminiClient, isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchAssetChartData } from "@/lib/chat/market-data-tool";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import { executeBrokerAction } from "@/lib/chat/tools/broker-action-tool";
import { manageUserGoals, type ManageGoalArgs } from "@/lib/chat/tools/goal-tool";
import {
  appendConversationMessagesAdmin,
  buildGoalMissionPrompt,
  buildSessionContextPrompt,
  getSessionContext,
  type TradingMode,
} from "@/lib/chat/conversation-persistence";
import { extractToolGenui } from "@/lib/chat/stream-types";

const manageGoalsDeclaration = {
  name: "manage_goals",
  description: "Manage user balance goals",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: { type: Type.STRING },
      goal_id: { type: Type.STRING },
    },
    required: ["operation"],
  },
};

const getAccountStateDeclaration = {
  name: "get_account_state",
  description: "Get account balance and positions",
  parameters: {
    type: Type.OBJECT,
    properties: {
      include_positions: { type: Type.BOOLEAN },
      include_performance: { type: Type.BOOLEAN },
    },
  },
};

const getAssetMarketDataDeclaration = {
  name: "get_asset_market_data",
  description: "Fetch live quote and chart data",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
      range: { type: Type.STRING },
    },
  },
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { userId: string; mode: TradingMode; conversationId: string },
): Promise<unknown> {
  if (name === "get_account_state") {
    return fetchAccountState(ctx.userId, ctx.mode, {
      include_positions: args.include_positions as boolean | undefined,
      include_performance: args.include_performance as boolean | undefined,
    });
  }
  if (name === "manage_goals") {
    return manageUserGoals(ctx.userId, ctx.mode, {
      operation: args.operation as ManageGoalArgs["operation"],
      goal_id: args.goal_id as string | undefined,
    });
  }
  if (name === "get_asset_market_data") {
    return fetchAssetChartData({
      symbol: args.symbol as string | undefined,
      range: (args.range as string | undefined) ?? "1M",
      variant: "area",
    });
  }
  if (name === "broker_action") {
    return executeBrokerAction(ctx.userId, ctx.mode, {
      action: args.action as "get_positions",
      conversation_id: ctx.conversationId,
    });
  }
  return { success: false, error: `Unknown tool: ${name}` };
}

export async function runProactiveChatTurn(params: {
  userId: string;
  mode: TradingMode;
  conversationId: string;
  directive: string;
  cycleId: string;
  narration: string;
}): Promise<{ messageId: string; text: string }> {
  const wakeMessage = `[Orchestrator cycle ${params.cycleId.slice(0, 8)}] Act on this directive without asking permission. Report what you did and the next step.\n\nDirective: ${params.directive}\n\nTrading cycle narration: ${params.narration}`;

  const sessionCtx = await getSessionContext(params.userId, params.mode);
  const memoryContext = buildSessionContextPrompt(sessionCtx);
  const goalMission = buildGoalMissionPrompt(sessionCtx);

  const systemInstruction = `${goalMission}${memoryContext}

ORCHESTRATOR WAKE PROTOCOL:
- This is an internal orchestrator wake-up, NOT a user message.
- Do NOT ask "would you like me to…" — you LEAD. Execute the directive.
- Call get_account_state and manage_goals(check_progress) when reporting portfolio state.
- Use tools as needed. Be concise but substantive (2-4 short paragraphs max).
- If directive includes subagent research, synthesize it into your reply.`;

  const systemMsgId = randomUUID();
  await appendConversationMessagesAdmin(params.conversationId, params.userId, [
    {
      id: systemMsgId,
      role: "system",
      parts: [{ type: "text", text: wakeMessage }],
    },
  ]);

  let assistantText = "";
  let genuiPayload: unknown = null;

  if (isGeminiRuntimeConfigured()) {
    try {
      const ai = getVertexGeminiClient();
      const model = getAgentGeminiModelId();
      const contents: any[] = [
        { role: "user", parts: [{ text: wakeMessage }] },
      ];

      const toolConfig = {
        systemInstruction,
        temperature: 0.35,
        maxOutputTokens: 4096,
        tools: [
          {
            functionDeclarations: [
              getAccountStateDeclaration,
              manageGoalsDeclaration,
              getAssetMarketDataDeclaration,
            ],
          },
        ],
      };

      for (let loop = 0; loop < 4; loop++) {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: toolConfig,
        });

        const parts = res.candidates?.[0]?.content?.parts ?? [];
        const textParts = parts.filter((p) => p.text && !p.functionCall);
        for (const p of textParts) {
          if (p.text) assistantText += p.text;
        }

        const functionCalls = parts.filter((p) => p.functionCall);
        if (functionCalls.length === 0) break;

        contents.push({ role: "model", parts });

        const toolResponseParts: any[] = [];
        for (const callPart of functionCalls) {
          const call = callPart.functionCall;
          if (!call?.name) continue;
          const args = (call.args ?? {}) as Record<string, unknown>;
          const toolResult = await executeTool(call.name, args, {
            userId: params.userId,
            mode: params.mode,
            conversationId: params.conversationId,
          });
          const g = extractToolGenui(toolResult);
          if (g) genuiPayload = g;
          toolResponseParts.push({
            functionResponse: { name: call.name, response: toolResult },
          });
        }
        contents.push({ role: "user", parts: toolResponseParts });
      }
    } catch {
      assistantText = "";
    }
  }

  if (!assistantText.trim()) {
    const account = await fetchAccountState(params.userId, params.mode, {
      include_positions: true,
    });
    assistantText = await generateVertexTextCompletion({
      systemInstruction,
      userPrompt: `${wakeMessage}\n\nAccount snapshot: ${JSON.stringify(account.balance)}\nPositions: ${account.positions?.length ?? 0}`,
      temperature: 0.3,
      maxTokens: 1200,
    });
  }

  const assistantId = randomUUID();
  const parts: Array<{ type: string; text?: string; payload?: unknown }> = [
    { type: "text", text: assistantText.trim() },
  ];
  if (genuiPayload) {
    parts.push({ type: "genui", payload: genuiPayload });
  }

  await appendConversationMessagesAdmin(params.conversationId, params.userId, [
    {
      id: assistantId,
      role: "assistant",
      parts,
    },
  ]);

  return { messageId: assistantId, text: assistantText.trim() };
}
