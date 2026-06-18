import { GoogleGenAI } from "@google/genai"
import type { z } from "zod"

export type ModelTier = "fast" | "frontier"

export type ModelRouterConfig = {
  fastModel?: string
  frontierModel?: string
  apiKey?: string
  vertexProject?: string
  vertexLocation?: string
  useVertex?: boolean
}

const DEFAULT_FAST = "gemini-2.5-flash"
const DEFAULT_FRONTIER = "gemini-2.5-pro"

export class ModelRouter {
  private readonly client: GoogleGenAI
  private readonly fastModel: string
  private readonly frontierModel: string

  constructor(config: ModelRouterConfig = {}) {
    const useVertex =
      config.useVertex ??
      process.env.GOOGLE_GENAI_USE_VERTEXAI === "true"

    if (useVertex) {
      const project =
        config.vertexProject ?? process.env.GOOGLE_CLOUD_PROJECT
      const location =
        config.vertexLocation ??
        process.env.GOOGLE_CLOUD_LOCATION ??
        "us-central1"
      if (!project) {
        throw new Error("GOOGLE_CLOUD_PROJECT required for Vertex AI")
      }
      this.client = new GoogleGenAI({ vertexai: true, project, location })
    } else {
      const key = config.apiKey ?? process.env.GEMINI_API_KEY
      if (!key) {
        throw new Error("GEMINI_API_KEY required for Google AI Studio")
      }
      this.client = new GoogleGenAI({ apiKey: key })
    }

    this.fastModel =
      config.fastModel ?? process.env.AGENT_LLM_MODEL ?? DEFAULT_FAST
    this.frontierModel =
      config.frontierModel ?? process.env.GEMINI_PRO_MODEL ?? DEFAULT_FRONTIER
  }

  resolveModel(tier: ModelTier): string {
    return tier === "fast" ? this.fastModel : this.frontierModel
  }

  async structuredOutput<T extends z.ZodType>(
    schema: T,
    prompt: string,
    options: { tier?: ModelTier; systemInstruction?: string } = {}
  ): Promise<z.infer<T>> {
    const tier = options.tier ?? "fast"
    const model = this.resolveModel(tier)

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: "application/json"
      }
    })

    const text = response.text
    if (!text) {
      throw new Error(`Empty response from ${model}`)
    }

    const parsed = JSON.parse(text)
    return schema.parse(parsed)
  }
}
