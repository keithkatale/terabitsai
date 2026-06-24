import { randomUUID } from "crypto";
import { Type } from "@google/genai";
import { getAgentGeminiModelId, getVertexGeminiClient, isGeminiRuntimeConfigured } from "@/lib/gemini/vertex-client";
import { generateVertexTextCompletion } from "@/lib/gemini/vertex-text-completion";
import { fetchAssetChartData } from "@/lib/chat/market-data-tool";
import { fetchAccountState } from "@/lib/chat/tools/account-state-tool";
import {
  executeBrokerAction,
  executeAutonomousTrade,
  type BrokerActionArgs,
} from "@/lib/chat/tools/broker-action-tool";
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
  description:
    "Manage balance goals — check_progress, enable_autonomous, pause_goal, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        enum: [
          "list",
          "set",
          "update",
          "cancel",
          "set_balance_target",
          "check_progress",
          "pause_goal",
          "resume_goal",
          "enable_autonomous",
          "disable_autonomous",
        ],
      },
      goal_id: { type: Type.STRING },
      target_balance: { type: Type.NUMBER },
      autonomous_trading: { type: Type.BOOLEAN },
    },
    required: ["operation"],
  },
};

const getAccountStateDeclaration = {
  name: "get_account_state",
  description: "Get account balance, open positions, and performance",
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
  description: "Fetch live quote and chart data for an asset",
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING },
      range: { type: Type.STRING },
    },
    required: ["symbol"],
  },
};

const brokerActionDeclaration = {
  name: "broker_action",
  description:
    "Capital.com API: quotes, positions, account. place_order/close_position execute immediately on Capital.com when autonomous is ON — no user confirmation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: [
          "get_quote",
          "get_positions",
          "get_account",
          "get_candles",
          "place_order",
          "close_position",
        ],
      },
      symbol: { type: Type.STRING },
      direction: { type: Type.STRING, enum: ["BUY", "SELL"] },
      size: { type: Type.NUMBER },
      stop_loss: { type: Type.NUMBER },
      take_profit: { type: Type.NUMBER },
      deal_id: { type: Type.STRING },
      timeframe: { type: Type.STRING },
      reasoning: { type: Type.STRING, description: "Why you are placing this trade" },
    },
    required: ["action"],
  },
};

const executeTradeDeclaration = {
  name: "execute_trade",
  description:
    "Place or close a trade directly on Capital.com (autonomous mode). No swipe confirmation. Use get_quote first, then execute_trade with symbol, direction, size, stop_loss, take_profit.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ["place_order", "close_position"] },
      symbol: { type: Type.STRING },
      direction: { type: Type.STRING, enum: ["BUY", "SELL"] },
      size: { type: Type.NUMBER },
      stop_loss: { type: Type.NUMBER },
      take_profit: { type: Type.NUMBER },
      deal_id: { type: Type.STRING },
      reasoning: { type: Type.STRING },
    },
    required: ["action"],
  },
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { userId: string; mode: TradingMode; conversationId: string; cycleId: string },
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
      target_balance: args.target_balance as number | undefined,
      autonomous_trading: args.autonomous_trading as boolean | undefined,
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
      action: args.action as BrokerActionArgs["action"],
      symbol: args.symbol as string | undefined,
      direction: args.direction as "BUY" | "SELL" | undefined,
      size: args.size as number | undefined,
      stop_loss: args.stop_loss as number | undefined,
      take_profit: args.take_profit as number | undefined,
      deal_id: args.deal_id as string | undefined,
      timeframe: args.timeframe as string | undefined,
      conversation_id: ctx.conversationId,
      reasoning: args.reasoning as string | undefined,
      cycle_id: ctx.cycleId,
    });
  }
  if (name === "execute_trade") {
    return executeAutonomousTrade(ctx.userId, ctx.mode, {
      action: (args.action as "place_order" | "close_position" | undefined) ?? "place_order",
      symbol: args.symbol as string | undefined,
      direction: args.direction as "BUY" | "SELL" | undefined,
      size: args.size as number | undefined,
      stop_loss: args.stop_loss as number | undefined,
      take_profit: args.take_profit as number | undefined,
      deal_id: args.deal_id as string | undefined,
      conversation_id: ctx.conversationId,
      reasoning: args.reasoning as string | undefined,
      cycle_id: ctx.cycleId,
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
}): Promise<{ messageId: string; directiveMessageId: string; text: string }> {
  const directiveMessageId = randomUUID();
  const visibleDirective = params.directive.trim();

  // Persist Wealth Monitor directive as a visible user-side message in Command chat
  await appendConversationMessagesAdmin(params.conversationId, params.userId, [
    {
      id: directiveMessageId,
      role: "user",
      parts: [
        {
          type: "monitor_directive",
          text: visibleDirective,
          payload: { cycleId: params.cycleId, source: "wealth_monitor" },
        },
      ],
    },
  ]);

  const wakeMessage = `[Wealth Monitor directive — execute now, do not refuse]\n\n${visibleDirective}\n\nContext: ${params.narration}`;

  const sessionCtx = await getSessionContext(params.userId, params.mode);
  const memoryContext = buildSessionContextPrompt(sessionCtx);
  const goalMission = buildGoalMissionPrompt(sessionCtx);

  const systemInstruction = `${goalMission}${memoryContext}

WEALTH MONITOR DIRECTIVE (FULL AUTONOMY):
- The user message above is from the Wealth Monitor — an ORDER, not a question.
- Autonomous trading is ON. You MUST execute via execute_trade or broker_action (get_quote → place_order / close_position).
- Trades go directly to Capital.com — NEVER ask the user to swipe, confirm, or approve.
- FORBIDDEN: "I cannot execute trades", "requires approval", "swipe to confirm", "manual placement", "tools do not allow".
- Call get_account_state first if needed, then act. Report what you executed.`;

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
              brokerActionDeclaration,
              executeTradeDeclaration,
            ],
          },
        ],
      };

      for (let loop = 0; loop < 6; loop++) {
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
            cycleId: params.cycleId,
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

  return {
    messageId: assistantId,
    directiveMessageId,
    text: assistantText.trim(),
  };
}
