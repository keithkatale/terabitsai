const DIM = 128;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Lightweight local embedding (hash bag-of-words) when Vertex is unavailable */
export function embedTextLocal(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  for (const token of tokenize(text)) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (h * 31 + token.charCodeAt(i)) >>> 0;
    }
    vec[h % DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export async function embedText(text: string): Promise<{ vector: number[]; dimensions: number }> {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";

  if (project && process.env.GOOGLE_GENAI_USE_VERTEXAI === "true") {
    try {
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/text-embedding-004:predict`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [{ content: text.slice(0, 8000) }]
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          predictions?: Array<{ embeddings?: { values?: number[] } }>;
        };
        const values = data.predictions?.[0]?.embeddings?.values;
        if (values?.length) {
          return { vector: values, dimensions: values.length };
        }
      }
    } catch {
      // fall through to local
    }
  }

  const vector = embedTextLocal(text);
  return { vector, dimensions: vector.length };
}
