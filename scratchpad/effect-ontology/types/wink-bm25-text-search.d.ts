/**
 * Type definitions for wink-bm25-text-search
 * @module types/wink-bm25-text-search
 */

declare module "wink-bm25-text-search" {
  interface BM25Config {
    fldWeights?: Record<string, number>
    bm25Params?: {
      k1?: number
      b?: number
      k?: number
    }
  }

  type PrepTask = (text: string) => ReadonlyArray<string>

  interface BM25Engine {
    /**
     * Configure the BM25 engine with field weights and parameters
     */
    defineConfig(config: BM25Config): void

    /**
     * Define text preparation tasks (tokenization, stemming, etc.)
     */
    definePrepTasks(tasks: ReadonlyArray<PrepTask>): void

    /**
     * Add a document to the index
     * @param doc - Document object with field values
     * @param id - Unique document identifier
     */
    addDoc(doc: Record<string, string>, id: string): void

    /**
     * Consolidate the index after adding all documents
     * Must be called before searching
     */
    consolidate(): void

    /**
     * Search the index
     * @param query - Search query string
     * @param limit - Maximum number of results to return
     * @returns Array of [id, score] tuples
     */
    search(query: string, limit?: number): ReadonlyArray<[string, number]>
  }

  /**
   * Create a new BM25 search engine instance
   */
  function winkBM25(): BM25Engine

  export default winkBM25
}
