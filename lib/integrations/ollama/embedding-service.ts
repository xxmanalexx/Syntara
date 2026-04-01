import { OllamaClient } from "./client";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const OLLAMA_EMBEDDINGS_MODEL =
  process.env["OLLAMA_EMBEDDINGS_MODEL"] ?? "nomic-embed-text:latest";

// ─── SimilarityResult ─────────────────────────────────────────────────────────

export interface SimilarityResult {
  id: string;
  score: number;
}

// ─── OllamaEmbeddingService ──────────────────────────────────────────────────

export class OllamaEmbeddingService {
  constructor(
    private readonly client: OllamaClient,
    private readonly model: string = OLLAMA_EMBEDDINGS_MODEL,
  ) {}

  /**
   * Encode a single text string into a dense vector embedding.
   */
  async encodeText(text: string): Promise<number[]> {
    const response = await this.client.embeddings({
      model: this.model,
      prompt: text,
    });
    return response.embedding;
  }

  /**
   * Encode a batch of texts into embeddings.
   * Processes sequentially to stay within rate limits.
   */
  async encodeBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const embedding = await this.encodeText(text);
      results.push(embedding);
    }

    return results;
  }

  /**
   * Compute the cosine similarity between two vectors.
   * Both vectors must have the same dimensionality.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(
        `Vector length mismatch: ${a.length} vs ${b.length}. Cannot compute cosine similarity.`,
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      // One or both vectors are zero vectors
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Find the most similar items in a corpus to a query embedding.
   * Returns results sorted by score descending.
   */
  findMostSimilar(
    queryEmbedding: number[],
    corpus: { id: string; embedding: number[] }[],
    limit = 10,
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const item of corpus) {
      if (item.embedding.length !== queryEmbedding.length) {
        console.warn(
          `[OllamaEmbeddingService] Skipping item "${item.id}" – embedding dimension mismatch ` +
            `(${item.embedding.length} vs ${queryEmbedding.length})`,
        );
        continue;
      }

      const score = this.cosineSimilarity(queryEmbedding, item.embedding);
      results.push({ id: item.id, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Compute pairwise cosine similarity between two texts using the Ollama API.
   */
  async similarityBetweenTexts(textA: string, textB: string): Promise<number> {
    const [embeddingA, embeddingB] = await Promise.all([
      this.encodeText(textA),
      this.encodeText(textB),
    ]);
    return this.cosineSimilarity(embeddingA, embeddingB);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const ollamaEmbeddingService = new OllamaEmbeddingService(new OllamaClient());
