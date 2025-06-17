import { Document, IngestionPipeline } from 'llamaindex';
import { MarkdownNodeParser } from '@llamaindex/node-parser';
import { OpenAIEmbedding } from '@llamaindex/openai';
import { QdrantVectorStore } from '@llamaindex/qdrant';
import { Settings } from 'llamaindex';

export interface PipelineConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  collection: string;
  embedModel: string;
  embedApiKey: string;
  embedBaseUrl?: string;
}

const getVectorStore = (config: PipelineConfig) => {
  return new QdrantVectorStore({
    collectionName: config.collection,
    url: config.qdrantUrl,
    apiKey: config.qdrantApiKey,
  });
};

export async function ingestText(content: string, metadata: Record<string, any>, config: PipelineConfig) {
  const embedModel = new OpenAIEmbedding({ model: config.embedModel, apiKey: config.embedApiKey, baseURL: config.embedBaseUrl });
  Settings.embedModel = embedModel;

  const vectorStore = getVectorStore(config);
  await vectorStore.initializeCollection(embedModel.dimensions || 1536);

  const pipeline = new IngestionPipeline({
    transformations: [new MarkdownNodeParser(), embedModel],
    vectorStore,
  });

  const doc = new Document({ text: content, metadata });
  const nodes = await pipeline.run({ documents: [doc] });
  return nodes.map((n) => n.id);
}

export async function deleteByRef(id: string, config: PipelineConfig) {
  const vectorStore = getVectorStore(config);
  await vectorStore.delete(id);
}

