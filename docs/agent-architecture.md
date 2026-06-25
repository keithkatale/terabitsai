# Agent Architecture

## Overview
The Terabits Wealth Engine uses a hierarchical agent system with an orchestrator coordinating specialized sub-agents.

## Agent Loop Design

### Core Loop (`agent-loop.ts`)
- **Max iterations**: 15 (orchestrator), 12 (sub-agents)
- **Termination conditions**:
  - Final text successfully generated
  - Two consecutive empty turns (no tools, no text)
  - Max loops exceeded
- **Recovery pass**: If tools completed but no text generated, forces a final response

### Key Features
1. **Adaptive loop control**: Tracks consecutive empty turns to avoid infinite loops while allowing multiple iterations
2. **Prompt injection**: After empty turn, injects "Provide your complete analysis" to elicit response
3. **Forced recovery**: Recovery pass uses tool-free config to prevent further tool calls
4. **Fallback synthesis**: Last resort generates minimal acknowledgment if recovery fails

## Multi-Round Delegation

The orchestrator can call `spawn_subagents` **multiple times** in a single run:

```
User: "Analyze major forex pairs for day trading"

Orchestrator:
  1. spawn_subagents([EUR/USD tech, GBP/USD tech, USD/JPY tech])
  2. Reviews results → identifies EUR/USD has breaking news
  3. spawn_subagents([EUR/USD catalyst deep-dive])
  4. Synthesizes findings from both rounds
```

### When to Re-Delegate
- Initial results are thin or incomplete
- Agent reports reveal new questions or data gaps
- User request requires iterative refinement (e.g. "compare top 3" → first round ranks, second round compares)

### Limits
- 5 agents per `spawn_subagents` call
- No hard limit on number of calls per run
- Total constrained by orchestrator's 15-loop budget

## Sub-Agent Design

### System Prompt
Sub-agents receive:
1. Read-only tools (no trading, goals, scheduling, nested delegation)
2. Explicit "CRITICAL RESPONSE REQUIREMENTS" enforcing final markdown report
3. `inform_user()` for progress updates (shown as live trace)

### Response Requirements
- **Must** produce structured markdown report
- Never stop after only thinking or tools
- If data gathered, must present findings (no silent termination)

## Crash Prevention

### Historical Bug
Agents would complete all tool calls but fail to produce final response, terminating mid-execution.

### Root Cause
1. Loop terminated on first empty turn (no tools) even without reportText
2. MaxLoops too restrictive (5-6 iterations)
3. Buffered planning text emitted as `user_update` instead of final text
4. Recovery pass used same tool config, allowing more tool calls instead of forcing text

### Fix
1. Increased maxLoops: 15 (orchestrator), 12 (sub-agents)
2. Track `consecutiveEmptyTurns` — only break after 2 empty turns
3. Inject prompt after empty turn to elicit response
4. Recovery pass removes tools (`tools: []`) and uses stronger prompt
5. Last-resort fallback generates minimal acknowledgment

## Event Streams

### Orchestrator Events
- `reasoning`: Thinking blocks
- `text`: Final markdown response
- `user_update`: Progress updates via `inform_user()`
- `tool_start` / `tool_end`: Tool execution lifecycle

### Sub-Agent Events
- `subagent_start`: Initialization (id, prompt, label, color)
- `subagent_reasoning`: Thinking
- `subagent_text`: Report text
- `subagent_update`: Progress via `inform_user()`
- `subagent_tool_start` / `subagent_tool_end`: Tool lifecycle
- `subagent_end`: Completion (status: done/failed, report, duration)

## Best Practices

### Orchestrator
- Delegate only when depth/parallelism adds value
- Give sub-agents distinct, non-overlapping slices
- Re-delegate if results are incomplete (multi-round)
- Synthesize findings; don't paste raw JSON
- Acknowledge failed agents gracefully (state what's missing)

### Sub-Agents
- Call `inform_user()` for progress (updates live trace)
- Use tools to verify all claims
- Never fabricate data
- Always write final markdown report before terminating
- If tools fail, explicitly state what's missing

## Monitoring

### Live UI
- Orchestrator trace: Shows current reasoning or tool step
- Sub-agent widgets: Collapsible card with overlapping orbs
  - Lead agent (most recent trace) on top (rightmost)
  - Expand to see all agents
  - Click agent to open detail pane (prompt, CoT, response)

### Detail Pane
- Prompt: Full delegation instructions
- Chain of Thought: Reasoning steps + tool calls
- Response: Final markdown report
- Metadata: Duration, status, color scheme
