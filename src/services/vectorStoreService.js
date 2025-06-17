import { Document, Settings, SimpleNodeParser } from 'llamaindex';
import { OpenAIEmbedding } from '@llamaindex/openai';

const EMBEDDING_CONFIG_KEY = 'embedding-config';
const COLLECTION_NAME = 'minio-documents';
const BUCKET_METADATA_KEY = 'bucket-metadata';

export class VectorStoreService {
  static embeddingModel = null;
  static qdrantClient = null;
  static initialized = false;

  static getEmbeddingConfig() {
    const stored = localStorage.getItem(EMBEDDING_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static saveEmbeddingConfig(config) {
    localStorage.setItem(EMBEDDING_CONFIG_KEY, JSON.stringify(config));
  }

  static getBucketMetadata(bucketName) {
    const key = `${BUCKET_METADATA_KEY}-${bucketName}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  }

  static saveBucketMetadata(bucketName, metadata) {
    const key = `${BUCKET_METADATA_KEY}-${bucketName}`;
    localStorage.setItem(key, JSON.stringify(metadata));
  }

  static async initialize(qdrantClient) {
    const config = this.getEmbeddingConfig();
    if (!config) {
      throw new Error('Embedding configuration not found');
    }

    if (!qdrantClient) {
      throw new Error('Qdrant client is required');
    }

    // Initialize embedding model
    const openAIConfig = {
      apiKey: config.apiKey,
      model: config.model,
      dangerouslyAllowBrowser: true, // Allow browser usage if needed
    };

    if (config.baseUrl) {
      openAIConfig.additionalSessionOptions = {
        baseURL: config.baseUrl,
        dangerouslyAllowBrowser: true, // Allow browser usage if needed
      };
    }

    this.embeddingModel = new OpenAIEmbedding(openAIConfig);
    Settings.embedModel = this.embeddingModel;

    this.qdrantClient = qdrantClient;

    // Initialize vector store
    try {
      // Check if collection exists
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.result.collections.some((col) => col.name === COLLECTION_NAME);

      if (!collectionExists) {
        // Create collection with proper vector size
        await this.qdrantClient.createCollection(COLLECTION_NAME, {
          vectors: {
            size: config.dimensions || 1536,
            distance: 'Cosine',
          },
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing vector store:', error);
      throw error;
    }
  }

  static async testEmbeddingConnection() {
    try {
      const config = this.getEmbeddingConfig();
      if (!config) {
        throw new Error('Embedding configuration not found');
      }

      // Initialize embedding model for testing
      const openAIConfig = {
        apiKey: config.apiKey,
        model: config.model,
        dangerouslyAllowBrowser: true, // Allow browser usage if needed
      };

      if (config.baseUrl) {
        openAIConfig.additionalSessionOptions = {
          baseURL: config.baseUrl,
          dangerouslyAllowBrowser: true, // Allow browser usage if needed
        };
      }

      const testEmbedding = new OpenAIEmbedding(openAIConfig);

      // Test by embedding a small text
      await testEmbedding.getTextEmbedding('test');

      return true;
    } catch (error) {
      console.error('Embedding connection test failed:', error);
      return false;
    }
  }

  static async embedAndStoreDocument(filePath, content, metadata = {}) {
    if (!this.initialized) {
      throw new Error('VectorStoreService not initialized. Call initialize() first.');
    }

    try {
      // Get bucket metadata
      const bucketName = metadata.bucketName || '';
      const bucketMetadata = this.getBucketMetadata(bucketName);

      // Merge metadata
      const fullMetadata = {
        ...bucketMetadata,
        ...metadata,
        file_path: filePath,
        bucket_name: bucketName,
        indexed_at: new Date().toISOString(),
      };

      // Create document
      const document = new Document({
        text: content,
        metadata: fullMetadata,
        id_: filePath, // Use file path as document ID for easy retrieval
      });

      // Parse document into nodes
      const nodeParser = new SimpleNodeParser({
        chunkSize: 512,
        chunkOverlap: 50,
      });

      const nodes = nodeParser.getNodesFromDocuments([document]);

      // Embed and store each node
      const vectors = [];
      const points = [];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const embedding = await this.embeddingModel.getTextEmbedding(node.text);

        vectors.push(embedding);
        points.push({
          id: `${filePath}_${i}`, // Unique ID for each chunk
          vector: embedding,
          payload: {
            ...fullMetadata,
            text: node.text,
            chunk_index: i,
            node_id: node.id_,
          },
        });
      }

      // Upsert points to Qdrant
      await this.qdrantClient.upsert(COLLECTION_NAME, {
        points,
      });

      return {
        success: true,
        nodeCount: nodes.length,
      };
    } catch (error) {
      console.error('Error embedding document:', error);
      throw error;
    }
  }

  static async deleteDocument(filePath) {
    if (!this.qdrantClient) {
      throw new Error('VectorStoreService not initialized. Call initialize() first.');
    }

    try {
      // Delete all points with matching file_path
      await this.qdrantClient.deletePoints(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: 'file_path',
              match: { value: filePath },
            },
          ],
        },
      });

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  static async search(query, similarityThreshold = 0.5, topK = 10) {
    if (!this.initialized) {
      throw new Error('VectorStoreService not initialized. Call initialize() first.');
    }

    try {
      // Get query embedding
      const queryEmbedding = await this.embeddingModel.getTextEmbedding(query);

      // Search in Qdrant
      const searchResult = await this.qdrantClient.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: topK,
        score_threshold: similarityThreshold,
      });

      // Format results
      const results = searchResult.result.map((point) => ({
        text: point.payload.text,
        score: point.score,
        metadata: {
          file_path: point.payload.file_path,
          chunk_index: point.payload.chunk_index,
          ...point.payload,
        },
      }));

      return results;
    } catch (error) {
      console.error('Error searching:', error);
      throw error;
    }
  }

  static async syncBucketFile(filePath, action, content = null, metadata = {}) {
    try {
      if (action === 'delete') {
        await this.deleteDocument(filePath);
      } else if (action === 'upload' && content) {
        // Delete existing document if it exists (for updates)
        await this.deleteDocument(filePath);
        // Embed and store new content
        await this.embedAndStoreDocument(filePath, content, metadata);
      }
      return true;
    } catch (error) {
      console.error('Error syncing bucket file:', error);
      throw error;
    }
  }
}
