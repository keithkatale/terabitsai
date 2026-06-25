#!/usr/bin/env npx tsx
/**
 * Test script to verify Gemini configuration works with Vertex AI.
 * 
 * Run: npx tsx scripts/test-gemini.ts
 * 
 * Requires environment variables:
 * - GOOGLE_GENAI_USE_VERTEXAI=true
 * - GOOGLE_CLOUD_PROJECT=your-project-id
 * - GOOGLE_CLOUD_LOCATION=us-central1 (optional, default)
 * 
 * Or for Google AI Studio:
 * - GEMINI_API_KEY=your-api-key
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local first (higher priority), then .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function testGeminiConnection() {
  console.log("\n🔧 Testing Gemini Configuration\n");
  console.log("─".repeat(50));

  // Check environment
  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true" || 
                    process.env.USE_VERTEX_LLM === "true";
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.AGENT_LLM_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-05-20";

  console.log(`Mode: ${useVertex ? "Vertex AI" : "Google AI Studio"}`);
  console.log(`Model: ${model}`);
  
  if (useVertex) {
    console.log(`Project: ${project || "NOT SET"}`);
    console.log(`Location: ${location}`);
    if (!project) {
      console.error("\n❌ Error: GOOGLE_CLOUD_PROJECT is required for Vertex AI mode");
      process.exit(1);
    }
  } else {
    console.log(`API Key: ${apiKey ? "Set (" + apiKey.slice(0, 8) + "...)" : "NOT SET"}`);
    if (!apiKey) {
      console.error("\n❌ Error: GEMINI_API_KEY is required for Google AI Studio mode");
      process.exit(1);
    }
  }

  console.log("\n─".repeat(50));
  console.log("📡 Attempting to connect to Gemini...\n");

  try {
    const { GoogleGenAI } = await import("@google/genai");
    
    let ai: InstanceType<typeof GoogleGenAI>;
    
    if (useVertex) {
      ai = new GoogleGenAI({
        vertexai: true,
        project: project!,
        location,
      });
    } else {
      ai = new GoogleGenAI({ apiKey: apiKey! });
    }

    const testPrompt = "Say 'Hello from Gemini!' in exactly 5 words.";
    
    console.log(`Sending test prompt: "${testPrompt}"`);
    console.log("─".repeat(50));

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: testPrompt }] }],
      config: {
        temperature: 0.3,
        maxOutputTokens: 100,
      },
    });

    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => typeof p.text === "string")
      .map((p: { text?: string }) => p.text)
      .join("") || "";

    console.log(`\n✅ Response: "${text.trim()}"`);
    console.log("\n" + "─".repeat(50));
    console.log("🎉 Gemini connection successful!\n");

    // Test with tools if model supports them
    console.log("─".repeat(50));
    console.log("🔧 Testing tool calling capability...\n");

    const { Type } = await import("@google/genai");
    
    const toolResponse = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "What is 25 * 4?" }] }],
      config: {
        temperature: 0,
        maxOutputTokens: 200,
        tools: [
          {
            functionDeclarations: [
              {
                name: "calculate",
                description: "Perform a mathematical calculation",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    expression: { type: Type.STRING, description: "The math expression" },
                  },
                  required: ["expression"],
                },
              },
            ],
          },
        ],
      },
    });

    const toolParts = toolResponse.candidates?.[0]?.content?.parts || [];
    const hasFunctionCall = toolParts.some((p: { functionCall?: unknown }) => p.functionCall);
    const toolText = toolParts
      .filter((p: { text?: string }) => typeof p.text === "string")
      .map((p: { text?: string }) => p.text)
      .join("");

    if (hasFunctionCall) {
      console.log("✅ Tool calling works! Model attempted to call a function.");
    } else {
      console.log(`✅ Model responded directly: "${toolText.trim()}"`);
    }

    console.log("\n" + "═".repeat(50));
    console.log("✅ All Gemini tests passed!");
    console.log("═".repeat(50) + "\n");

  } catch (error) {
    console.error("\n❌ Error connecting to Gemini:");
    console.error(error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes("404")) {
      console.error("\n💡 Hint: The model might not be available in your region.");
      console.error("   Try: gemini-2.5-flash or gemini-2.0-flash");
    }
    
    if (error instanceof Error && error.message.includes("403")) {
      console.error("\n💡 Hint: Check your API permissions or quotas.");
    }

    process.exit(1);
  }
}

testGeminiConnection();
