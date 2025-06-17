import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tab, Tabs } from '@mui/material';
import { CloudSync } from '@mui/icons-material';
import MinIOSettings from '../components/MinIOSync/MinIOSettings';
import BucketVisualization from '../components/MinIOSync/BucketVisualization';
import SearchBar from '../components/MinIOSync/SearchBar';
import { MinIOService } from '../services/minioService';
import { VectorStoreService } from '../services/vectorStoreService';
import { useClient } from '../context/client-context';

const MinIOSync = () => {
  const { client: qdrantClient } = useClient();
  const [activeTab, setActiveTab] = useState(0);
  const [isConfigured, setIsConfigured] = useState(false);
  const [bucketContents, setBucketContents] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if MinIO and embedding settings are configured
    const minioConfig = MinIOService.getConfig();
    const embeddingConfig = VectorStoreService.getEmbeddingConfig();
    const configured = !!(minioConfig && embeddingConfig);
    setIsConfigured(configured);

    // Initialize services if configured
    if (configured && qdrantClient) {
      initializeServices();
    }
  }, [qdrantClient]);

  const initializeServices = async () => {
    try {
      await MinIOService.initialize();
      await VectorStoreService.initialize(qdrantClient);
      loadBucketContents();
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  };

  const handleConfigSaved = () => {
    setIsConfigured(true);
    loadBucketContents();
  };

  const loadBucketContents = async () => {
    setLoading(true);
    try {
      const contents = await MinIOService.listBucket();
      setBucketContents(contents);
    } catch (error) {
      console.error('Error loading bucket contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query, similarityThreshold, topK) => {
    try {
      const results = await VectorStoreService.search(query, similarityThreshold, topK);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CloudSync sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4">MinIO Bucket Synchronization</Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Settings" />
          <Tab label="Bucket Explorer" disabled={!isConfigured} />
          <Tab label="Search" disabled={!isConfigured} />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <MinIOSettings onConfigSaved={handleConfigSaved} />
      )}

      {activeTab === 1 && isConfigured && (
        <Box>
          <SearchBar onSearch={handleSearch} />
          <BucketVisualization
            contents={bucketContents}
            onRefresh={loadBucketContents}
            loading={loading}
          />
        </Box>
      )}

      {activeTab === 2 && isConfigured && (
        <Box>
          <SearchBar onSearch={handleSearch} showAdvanced />
          {searchResults.length > 0 && (
            <Paper sx={{ mt: 3, p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Search Results ({searchResults.length})
              </Typography>
              {searchResults.map((result, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Score: {result.score.toFixed(4)}
                  </Typography>
                  <Typography variant="body2">{result.text}</Typography>
                  {result.metadata && (
                    <Typography variant="caption" color="text.secondary">
                      File: {result.metadata.file_path}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MinIOSync;
