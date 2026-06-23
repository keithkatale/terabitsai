# Integrating Skills with the Wealth Monitor

This guide explains how to integrate AI skills into the autonomous trading system's Wealth Monitor cycle.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WEALTH MONITOR CYCLE                      │
│                                                              │
│  1. Wake at scheduled time (next_wake_at)                   │
│  2. Load goal.md + context_summary                          │
│  3. Execute Skills (market analysis, risk checks)           │
│  4. Generate directive for Command AI                       │
│  5. Command AI executes trades via Capital.com              │
│  6. Monitor reviews execution results                       │
│  7. Schedule next wake                                      │
└─────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
┌──────────────────┐                    ┌──────────────────┐
│   SKILL LIBRARY  │                    │  CAPITAL.COM API │
│                  │                    │                  │
│ - Regime Detect  │                    │ - Place Orders   │
│ - Position Size  │                    │ - Close Positions│
│ - Heat Calc      │                    │ - Get Quotes     │
│ - Tech Analysis  │                    │ - Get Positions  │
└──────────────────┘                    └──────────────────┘
```

## Integration Steps

### Step 1: Register the Skill Execution Tool

Add a new AI tool declaration for skill execution in `apps/web/src/app/api/chat/route.ts`:

```typescript
// Add to tool declarations
const executeSkillDeclaration = {
  name: "execute_skill",
  description: `Execute a trading analysis skill to enhance decision-making.
  
Available skills:
- market-regime-detector: Classify market as uptrend/downtrend/ranging
- position-sizer: Calculate position size based on risk parameters
- portfolio-heat-calculator: Sum total risk across open positions
- multi-timeframe-analyzer: Analyze trend alignment across timeframes
- support-resistance-identifier: Find key price levels

Use this tool when you need specialized analysis beyond your base knowledge.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      skill_id: {
        type: Type.STRING,
        description: "ID of the skill to execute (e.g., 'market-regime-detector')"
      },
      inputs: {
        type: Type.OBJECT,
        description: "Skill-specific input parameters (see skill documentation)"
      }
    },
    required: ["skill_id", "inputs"]
  }
};
```

### Step 2: Create Skill Executor Module

Create `apps/web/src/lib/skills/executor.ts`:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

export interface SkillMetadata {
  id: string;
  name: string;
  category: string;
  status: 'production' | 'beta' | 'planned';
  autonomous: boolean;
  priority: number;
  description: string;
  integrations: {
    data_required: string[];
    knowledge_refs: string[];
  };
}

export interface SkillExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  execution_time_ms: number;
}

export class SkillExecutor {
  private skillsRegistry: Map<string, SkillMetadata> = new Map();
  private skillsPath: string;

  constructor(skillsPath: string = join(process.cwd(), '../../skills')) {
    this.skillsPath = skillsPath;
  }

  async loadRegistry(): Promise<void> {
    const registryPath = join(this.skillsPath, 'skills-index.yaml');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = YAML.parse(registryContent);

    for (const skill of registry.skills) {
      this.skillsRegistry.set(skill.id, skill);
    }
  }

  async executeSkill(skillId: string, inputs: any): Promise<SkillExecutionResult> {
    const startTime = Date.now();

    try {
      // Get skill metadata
      const metadata = this.skillsRegistry.get(skillId);
      if (!metadata) {
        return {
          success: false,
          error: `Skill not found: ${skillId}`,
          execution_time_ms: Date.now() - startTime
        };
      }

      // Check if skill is production-ready
      if (metadata.status !== 'production') {
        return {
          success: false,
          error: `Skill ${skillId} is in ${metadata.status} status`,
          execution_time_ms: Date.now() - startTime
        };
      }

      // Import and execute skill script
      const skillScript = await this.importSkillScript(skillId);
      const result = await skillScript.execute(inputs);

      return {
        success: true,
        data: result,
        execution_time_ms: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime
      };
    }
  }

  private async importSkillScript(skillId: string): Promise<any> {
    const metadata = this.skillsRegistry.get(skillId)!;
    const category = metadata.category;
    const scriptPath = join(
      this.skillsPath,
      category,
      skillId,
      'scripts',
      'execute.ts'
    );

    try {
      // Dynamic import of skill script
      const module = await import(scriptPath);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to load skill script for ${skillId}: ${error}`);
    }
  }

  getSkillMetadata(skillId: string): SkillMetadata | undefined {
    return this.skillsRegistry.get(skillId);
  }

  listSkills(filter?: { category?: string; autonomous?: boolean }): SkillMetadata[] {
    let skills = Array.from(this.skillsRegistry.values());

    if (filter?.category) {
      skills = skills.filter(s => s.category === filter.category);
    }

    if (filter?.autonomous !== undefined) {
      skills = skills.filter(s => s.autonomous === filter.autonomous);
    }

    return skills.sort((a, b) => a.priority - b.priority);
  }
}

// Singleton instance
let executorInstance: SkillExecutor | null = null;

export async function getSkillExecutor(): Promise<SkillExecutor> {
  if (!executorInstance) {
    executorInstance = new SkillExecutor();
    await executorInstance.loadRegistry();
  }
  return executorInstance;
}
```

### Step 3: Add Skill Execution to Wealth Monitor

Update `apps/web/src/lib/autonomous/wealth-monitor.ts`:

```typescript
import { getSkillExecutor } from '@/lib/skills/executor';

export async function runWealthMonitorCycle(goalId: string) {
  const executor = await getSkillExecutor();
  
  // Get autonomous skills for this cycle
  const autonomousSkills = executor.listSkills({ autonomous: true });
  
  const skillResults: Record<string, any> = {};
  
  // Execute priority skills
  for (const skillMetadata of autonomousSkills.slice(0, 5)) {  // Top 5 priority
    console.log(`[Monitor] Executing skill: ${skillMetadata.id}`);
    
    const result = await executor.executeSkill(skillMetadata.id, {
      goalId,
      userId: goal.user_id,
      // Skill-specific inputs
    });
    
    if (result.success) {
      skillResults[skillMetadata.id] = result.data;
      console.log(`[Monitor] ✓ ${skillMetadata.id} completed in ${result.execution_time_ms}ms`);
    } else {
      console.error(`[Monitor] ✗ ${skillMetadata.id} failed: ${result.error}`);
    }
  }
  
  // Use skill results in directive
  const directive = generateDirective(goal, skillResults);
  
  // Send to Command AI
  await sendDirectiveToCommand(directive, skillResults);
}

function generateDirective(goal: any, skillResults: Record<string, any>): string {
  const regime = skillResults['market-regime-detector'];
  const heat = skillResults['portfolio-heat-calculator'];
  
  return `
## Market Analysis

${regime ? `
**Market Regime:** ${regime.regime.toUpperCase()} (${regime.confidence}% confidence)
${regime.reasoning}

**Recommended Strategy:** ${regime.recommended_strategy}
` : ''}

${heat ? `
**Portfolio Heat:** ${heat.total_risk_pct.toFixed(1)}% of account
- Open positions: ${heat.num_positions}
- Available risk: ${(goal.max_risk_total_pct - heat.total_risk_pct).toFixed(1)}%
` : ''}

## Directive

Based on the above analysis, review current positions and identify new opportunities 
aligned with the ${regime?.regime || 'current'} regime.

${heat && heat.total_risk_pct > goal.max_risk_total_pct * 0.8 
  ? '⚠️ Portfolio heat is approaching limit. Prioritize risk reduction over new entries.' 
  : 'Risk capacity available for new trades if setups meet criteria.'}
`;
}
```

### Step 4: Wire Skills into Chat Tool Execution

Update `apps/web/src/app/api/chat/route.ts` tool execution block:

```typescript
// In the main request handler, add skill execution
if (name === "execute_skill") {
  const { skill_id, inputs } = fnArgs as { skill_id: string; inputs: any };
  
  const executor = await getSkillExecutor();
  const result = await executor.executeSkill(skill_id, {
    ...inputs,
    userId: session.user.id,
    goalId: activeGoalId
  });
  
  if (!result.success) {
    return new Response(
      JSON.stringify({
        role: "user",
        parts: [{
          text: `Skill execution failed: ${result.error}`
        }]
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Return skill output to AI
  return new Response(
    JSON.stringify({
      role: "user",
      parts: [{
        functionResponse: {
          name: "execute_skill",
          response: result.data
        }
      }]
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

### Step 5: Update AI System Prompt

Update the system instructions in `apps/web/src/lib/chat/conversation-persistence.ts`:

```typescript
const systemInstructions = `
...

## AVAILABLE SKILLS

You have access to specialized trading analysis skills via the \`execute_skill\` tool:

1. **market-regime-detector** — Classify current market (uptrend/downtrend/ranging)
   - Use at start of analysis or when user asks about market conditions
   - Inputs: { symbols: string[], timeframes: string[] }
   - Returns: { regime, confidence, reasoning, recommended_strategy }

2. **position-sizer** — Calculate risk-based position size
   - Use before placing any trade
   - Inputs: { symbol, entry_price, stop_loss, account_balance, max_risk_pct }
   - Returns: { units, margin_required, risk_dollars, risk_pct }

3. **portfolio-heat-calculator** — Sum total portfolio risk
   - Use before opening new positions
   - Inputs: { positions: Position[] }
   - Returns: { total_risk_pct, num_positions, risk_by_symbol }

4. **multi-timeframe-analyzer** — Analyze trend across timeframes
   - Use for timing entries
   - Inputs: { symbol, timeframes: string[] }
   - Returns: { alignment, strongest_timeframe, divergences }

5. **support-resistance-identifier** — Find key price levels
   - Use for stop placement and targets
   - Inputs: { symbol, timeframe, lookback }
   - Returns: { support_levels, resistance_levels, nearest_levels }

**When to use skills:**
- Market regime: Every analysis session, before strategy selection
- Position sizing: Every trade, before execution
- Portfolio heat: Before opening new positions
- Technical analysis: When timing entries or setting stops

**Skill execution is fast (<5s) and enhances your decision quality.**
`;
```

## Testing

### Unit Test: Skill Executor

```typescript
// apps/web/__tests__/skills/executor.test.ts
import { SkillExecutor } from '@/lib/skills/executor';

describe('SkillExecutor', () => {
  let executor: SkillExecutor;

  beforeAll(async () => {
    executor = new SkillExecutor();
    await executor.loadRegistry();
  });

  test('should load skills registry', () => {
    const skills = executor.listSkills();
    expect(skills.length).toBeGreaterThan(0);
  });

  test('should filter autonomous skills', () => {
    const autonomous = executor.listSkills({ autonomous: true });
    expect(autonomous.every(s => s.autonomous)).toBe(true);
  });

  test('should execute market-regime-detector', async () => {
    const result = await executor.executeSkill('market-regime-detector', {
      symbols: ['SPY', 'QQQ'],
      timeframes: ['1D']
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('regime');
    expect(result.data).toHaveProperty('confidence');
  });
});
```

### Integration Test: Wealth Monitor with Skills

```typescript
// apps/web/__tests__/autonomous/monitor-skills.test.ts
import { runWealthMonitorCycle } from '@/lib/autonomous/wealth-monitor';

describe('Wealth Monitor with Skills', () => {
  test('should execute autonomous skills during cycle', async () => {
    const goalId = 'test-goal-id';
    
    const result = await runWealthMonitorCycle(goalId);
    
    expect(result.skillResults).toHaveProperty('market-regime-detector');
    expect(result.skillResults).toHaveProperty('portfolio-heat-calculator');
    expect(result.directive).toContain('Market Regime:');
  });
});
```

## Performance Considerations

1. **Skill Execution Time:**
   - Target: < 5s per skill
   - Budget: Up to 30s for full monitor cycle (5-6 skills)

2. **Caching:**
   - Cache skill results for 1 hour (regime rarely changes intraday)
   - Invalidate cache on significant market moves

3. **Parallel Execution:**
   - Independent skills can run in parallel (e.g., regime + heat)
   - Use `Promise.all()` for concurrent execution

4. **Error Handling:**
   - Failed skills should not block monitor cycle
   - Fallback to default assumptions if critical skill fails

## Monitoring

Add logging for skill execution:

```typescript
// In wealth-monitor.ts
import { logSkillExecution } from '@/lib/observability';

const result = await executor.executeSkill(skillId, inputs);
logSkillExecution({
  skill_id: skillId,
  success: result.success,
  execution_time_ms: result.execution_time_ms,
  error: result.error,
  timestamp: new Date().toISOString()
});
```

## Next Steps

1. Implement `detect-regime.ts` with full Capital.com API integration
2. Create additional Phase 1 skills (position-sizer, portfolio-heat-calculator)
3. Add skill execution metrics to monitoring dashboard
4. Write comprehensive tests for all skills
5. Add skill result caching layer

---

**Related Documentation:**
- `skills/README.md` — Skill architecture overview
- `skills/skills-index.yaml` — Canonical skill registry
- `skills/market-regime/market-regime-detector/SKILL.md` — Example skill implementation
