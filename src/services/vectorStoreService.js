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
      console.log('Qdrant client:', this.qdrantClient);

      // Debug the available methods
      console.log('Qdrant client methods:', Object.keys(this.qdrantClient));

      // Check if collection exists - try listCollections first
      let collections;
      try {
        collections = await this.qdrantClient.listCollections();
        console.log('listCollections result:', collections);
      } catch (e) {
        console.log('listCollections failed, trying getCollections');
        collections = await this.qdrantClient.getCollections();
        console.log('getCollections result:', collections);
      }

      // Handle different response structures
      let collectionsList = [];
      if (collections && collections.collections) {
        collectionsList = collections.collections;
      } else if (collections && collections.result && collections.result.collections) {
        collectionsList = collections.result.collections;
      }

      console.log('Collections list:', collectionsList);
      const collectionExists = collectionsList.some((col) => col.name === COLLECTION_NAME);

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

      // Upsert points to Qdrant - try to log the request first
      console.log('Number of nodes to upload:', nodes.length);
      console.log('Sample embedding length:', points[0]?.vector?.length);
      console.log('Sample payload:', points[0]?.payload);

      // Format the points array correctly for Qdrant
      const formattedPoints = points.map((point, index) => {
        // Use simple integer IDs
        const pointId = Date.now() + index;

        console.log(`Point ${index}:`, {
          id: pointId,
          vectorLength: point.vector.length,
          payloadKeys: Object.keys(point.payload),
        });

        return {
          id: pointId,
          vector: point.vector,
          payload: point.payload,
        };
      });

      console.log('Formatted points for upload:', formattedPoints);

      // Try a simpler upsert approach
      try {
        const result = await this.qdrantClient.upsert(COLLECTION_NAME, {
          points: formattedPoints,
        });
        console.log('Upsert result:', result);
      } catch (upsertError) {
        console.error('Upsert error details:', upsertError);

        // Try alternative approach - upload one point at a time
        console.log('Trying to upload points one by one...');
        for (let i = 0; i < formattedPoints.length; i++) {
          const singlePoint = formattedPoints[i];
          try {
            await this.qdrantClient.upsert(COLLECTION_NAME, {
              points: [singlePoint],
            });
            console.log(`Successfully uploaded point ${i}`);
          } catch (singleError) {
            console.error(`Error uploading point ${i}:`, singleError);
            console.error('Point data:', singlePoint);
            throw singleError;
          }
        }
      }

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
      await this.qdrantClient.delete(COLLECTION_NAME, {
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

      // Log search parameters
      console.log('Search query embedding:', queryEmbedding);
      console.log('Search parameters:', {
        collection: COLLECTION_NAME,
        vector: queryEmbedding,
        limit: topK,
        score_threshold: similarityThreshold,
      });

      // Search in Qdrant
      const searchResult = await this.qdrantClient.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: topK,
        score_threshold: similarityThreshold,
        with_payload: true, // Ensure payload is returned
      });

      console.log('Search result:', searchResult);

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
