const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");

const envPath = "/Users/KeithKatale/Documents/Quant/apps/web/.env.local";
let apiKey = process.env.GEMINI_API_KEY;
let useVertex = false;
let project = "";
let location = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      if (key === "GEMINI_API_KEY") apiKey = val;
      if (key === "GOOGLE_GENAI_USE_VERTEXAI" && (val === "true" || val === "1")) useVertex = true;
      if (key === "GOOGLE_CLOUD_PROJECT") project = val;
      if (key === "GOOGLE_CLOUD_LOCATION") location = val;
    }
  }
}

const ai = useVertex
  ? new GoogleGenAI({ vertexai: true, project, location })
  : new GoogleGenAI({ apiKey });

async function main() {
  const model = "gemini-2.5-flash-preview-05-20";
  console.log(`Starting stream with model: ${model}...`);
  try {
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: "Solve this logic riddle: A box has 3 red balls and 3 blue balls. If you pick 3 balls at random, what is the probability that they are all of the same color? Think step-by-step." }],
        },
      ],
      config: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    });

    let chunkIdx = 0;
    for await (const chunk of responseStream) {
      chunkIdx++;
      console.log(`\n--- Chunk ${chunkIdx} ---`);
      const candidate = chunk.candidates?.[0];
      const chunkParts = candidate?.content?.parts;
      if (candidate?.finishReason) {
        console.log(`Finish Reason: ${candidate.finishReason}`);
      }
      if (chunkParts) {
        console.log("Parts structure:");
        console.log(JSON.stringify(chunkParts, null, 2));
      } else {
        console.log("No parts in chunk");
      }
    }
  } catch (err) {
    console.error("Error during stream:", err);
  }
}

main();
