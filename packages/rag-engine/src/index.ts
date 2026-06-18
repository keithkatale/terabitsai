import fs from "fs"
import path from "path"

export interface RAGChunk {
  filePath: string;
  fileName: string;
  category: string; // e.g., 'concepts', 'markets', 'agents'
  title: string;
  content: string;
  score?: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "for", 
  "of", "in", "on", "at", "by", "with", "from", "it", "its", "they", "them", 
  "we", "you", "your", "my", "our", "this", "that", "these", "those"
]);

/**
 * Tokenizes text and removes stopwords.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

export class RAGEngine {
  private chunks: RAGChunk[] = [];
  private kbRoot: string;

  constructor(kbRoot: string) {
    this.kbRoot = kbRoot;
    this.indexBase();
  }

  /**
   * Reads, parses, and indexes the entire knowledge base recursively.
   */
  public indexBase(): void {
    try {
      this.chunks = [];
      if (!fs.existsSync(this.kbRoot)) {
        return;
      }
      this.indexDir(this.kbRoot);
    } catch (err) {
      console.error("Error indexing knowledge base:", err);
    }
  }

  private indexDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.indexDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const relPath = path.relative(this.kbRoot, fullPath);
        const segments = relPath.split(path.sep);
        const category = segments.length > 1 ? segments[0] : "general";

        if (ext === ".md") {
          const text = fs.readFileSync(fullPath, "utf8");
          this.parseMarkdown(relPath, entry.name, category, text);
        } else if (ext === ".json") {
          // Index key-value pairs or short entries from JSON files
          try {
            const raw = fs.readFileSync(fullPath, "utf8");
            const data = JSON.parse(raw);
            this.parseJSON(relPath, entry.name, category, data);
          } catch {
            // skip corrupted json
          }
        }
      }
    }
  }

  private parseMarkdown(relPath: string, fileName: string, category: string, text: string): void {
    // Split by markdown headers (## or ###) to form chunks
    const sections = text.split(/(?=^##+ )/m);

    for (const sec of sections) {
      const trimmed = sec.trim();
      if (!trimmed) continue;

      // Extract section title from the first line (e.g. "## 1. Core Structural Elements")
      const firstLine = trimmed.split("\n")[0];
      const title = firstLine.replace(/^##+\s*/, "").trim() || fileName;

      this.chunks.push({
        filePath: relPath,
        fileName,
        category,
        title,
        content: trimmed
      });
    }
  }

  private parseJSON(relPath: string, fileName: string, category: string, data: any): void {
    // Convert JSON records to clean text chunks
    const stringifyData = (obj: any, prefix = ""): string => {
      let out = "";
      if (typeof obj === "object" && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "object") {
            out += stringifyData(v, `${prefix}${k} > `);
          } else {
            out += `${prefix}${k}: ${v}\n`;
          }
        }
      } else {
        out += `${prefix}: ${obj}\n`;
      }
      return out;
    };

    if (data && typeof data === "object") {
      // Create sub-chunks for main topics in the JSON to keep chunk sizes reasonable
      for (const [sectionKey, sectionVal] of Object.entries(data)) {
        this.chunks.push({
          filePath: relPath,
          fileName,
          category,
          title: `${fileName} - ${sectionKey}`,
          content: `${sectionKey}:\n${stringifyData(sectionVal)}`
        });
      }
    }
  }

  /**
   * Queries the RAG index using TF-IDF style keyword-overlap scoring.
   */
  public query(queryText: string, maxResults = 5, categoryFilter?: string): RAGChunk[] {
    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) {
      return this.chunks.slice(0, maxResults);
    }

    const scored = this.chunks
      .filter(chunk => !categoryFilter || chunk.category === categoryFilter)
      .map(chunk => {
        const titleTokens = tokenize(chunk.title);
        const contentTokens = tokenize(chunk.content);

        let score = 0;

        for (const token of queryTokens) {
          // High weight if matched in section title
          const titleMatches = titleTokens.filter(t => t === token).length;
          score += titleMatches * 10.0;

          // Standard weight if matched in content
          const contentMatches = contentTokens.filter(t => t === token).length;
          score += contentMatches * 1.0;
        }

        // Apply a small penalty for extremely long sections to avoid bias
        const lengthPenalty = Math.max(1, Math.log10(chunk.content.length));
        const finalScore = score / lengthPenalty;

        return { ...chunk, score: finalScore };
      })
      .filter(chunk => (chunk.score || 0) > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored.slice(0, maxResults);
  }

  /**
   * Gets all loaded chunks.
   */
  public getAllChunks(): RAGChunk[] {
    return this.chunks;
  }
}
