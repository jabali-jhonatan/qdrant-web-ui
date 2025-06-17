import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Save } from '@mui/icons-material';
import PropTypes from 'prop-types';
import { MinIOService } from '../../services/minioService';
import { VectorStoreService } from '../../services/vectorStoreService';
import { useClient } from '../../context/client-context';

const MinIOSettings = ({ onConfigSaved }) => {
  const { client: qdrantClient } = useClient();
  const [showSecrets, setShowSecrets] = useState({
    secretKey: false,
    apiKey: false,
  });

  const [minioConfig, setMinioConfig] = useState({
    endPoint: '',
    port: 9000,
    useSSL: false,
    accessKey: '',
    secretKey: '',
    bucketName: '',
  });

  const [embeddingConfig, setEmbeddingConfig] = useState({
    apiKey: '',
    baseUrl: '',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
  });

  const [collectionConfig, setCollectionConfig] = useState({
    name: 'minio-documents',
  });

  const [testStatus, setTestStatus] = useState({
    minio: null,
    embedding: null,
    collection: null,
  });

  const [error, setError] = useState('');

  useEffect(() => {
    // Load saved configurations
    const savedMinioConfig = MinIOService.getConfig();
    const savedEmbeddingConfig = VectorStoreService.getEmbeddingConfig();
    const savedCollectionConfig = VectorStoreService.getCollectionConfig();

    if (savedMinioConfig) {
      setMinioConfig(savedMinioConfig);
    }

    if (savedEmbeddingConfig) {
      setEmbeddingConfig(savedEmbeddingConfig);
    }

    if (savedCollectionConfig) {
      setCollectionConfig(savedCollectionConfig);
    }
  }, []);

  const handleMinioChange = (field) => (event) => {
    setMinioConfig({
      ...minioConfig,
      [field]: field === 'port' ? parseInt(event.target.value) || 0 : event.target.value,
    });
  };

  const handleEmbeddingChange = (field) => (event) => {
    setEmbeddingConfig({
      ...embeddingConfig,
      [field]: field === 'dimensions' ? parseInt(event.target.value) || 0 : event.target.value,
    });
  };

  const handleCollectionChange = (field) => (event) => {
    setCollectionConfig({
      ...collectionConfig,
      [field]: event.target.value,
    });
  };

  const testMinioConnection = async () => {
    try {
      MinIOService.saveConfig(minioConfig);
      const result = await MinIOService.testConnection();
      setTestStatus({ ...testStatus, minio: result ? 'success' : 'error' });
    } catch (error) {
      setTestStatus({ ...testStatus, minio: 'error' });
      setError(`MinIO connection failed: ${error.message}`);
    }
  };

  const testEmbeddingConnection = async () => {
    try {
      VectorStoreService.saveEmbeddingConfig(embeddingConfig);
      const result = await VectorStoreService.testEmbeddingConnection();
      setTestStatus({ ...testStatus, embedding: result ? 'success' : 'error' });
    } catch (error) {
      setTestStatus({ ...testStatus, embedding: 'error' });
      setError(`Embedding connection failed: ${error.message}`);
    }
  };

  const handleSave = async () => {
    setError('');

    try {
      // Save configurations
      MinIOService.saveConfig(minioConfig);
      VectorStoreService.saveEmbeddingConfig(embeddingConfig);
      VectorStoreService.saveCollectionConfig(collectionConfig);

      // Initialize services
      await MinIOService.initialize();
      await VectorStoreService.initialize(qdrantClient);

      onConfigSaved();
    } catch (error) {
      setError(`Failed to save configuration: ${error.message}`);
    }
  };

  const toggleShowSecret = (field) => {
    setShowSecrets({
      ...showSecrets,
      [field]: !showSecrets[field],
    });
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          MinIO Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <TextField
              label="Endpoint"
              value={minioConfig.endPoint}
              onChange={handleMinioChange('endPoint')}
              fullWidth
              placeholder="localhost or minio.example.com"
              helperText="MinIO server endpoint without protocol"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Port"
              type="number"
              value={minioConfig.port}
              onChange={handleMinioChange('port')}
              fullWidth
              placeholder="9000"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Access Key"
              value={minioConfig.accessKey}
              onChange={handleMinioChange('accessKey')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Secret Key"
              type={showSecrets.secretKey ? 'text' : 'password'}
              value={minioConfig.secretKey}
              onChange={handleMinioChange('secretKey')}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => toggleShowSecret('secretKey')} edge="end">
                      {showSecrets.secretKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Bucket Name"
              value={minioConfig.bucketName}
              onChange={handleMinioChange('bucketName')}
              fullWidth
              placeholder="my-bucket"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              onClick={testMinioConnection}
              color={testStatus.minio === 'success' ? 'success' : testStatus.minio === 'error' ? 'error' : 'primary'}
            >
              Test MinIO Connection
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Embedding Model Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="API Key"
              type={showSecrets.apiKey ? 'text' : 'password'}
              value={embeddingConfig.apiKey}
              onChange={handleEmbeddingChange('apiKey')}
              fullWidth
              helperText="OpenAI API key or compatible service key"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => toggleShowSecret('apiKey')} edge="end">
                      {showSecrets.apiKey ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Base URL (Optional)"
              value={embeddingConfig.baseUrl}
              onChange={handleEmbeddingChange('baseUrl')}
              fullWidth
              placeholder="https://api.openai.com/v1"
              helperText="Leave empty for OpenAI, or enter custom endpoint (e.g., LiteLLM proxy)"
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              label="Model Name"
              value={embeddingConfig.model}
              onChange={handleEmbeddingChange('model')}
              fullWidth
              placeholder="text-embedding-ada-002"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Dimensions"
              type="number"
              value={embeddingConfig.dimensions}
              onChange={handleEmbeddingChange('dimensions')}
              fullWidth
              helperText="Vector dimensions for the model"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="outlined"
              onClick={testEmbeddingConnection}
              color={
                testStatus.embedding === 'success'
                  ? 'success'
                  : testStatus.embedding === 'error'
                  ? 'error'
                  : 'primary'
              }
            >
              Test Embedding Connection
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Qdrant Collection Configuration
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Collection Name"
              value={collectionConfig.name}
              onChange={handleCollectionChange('name')}
              fullWidth
              placeholder="minio-documents"
              helperText="Name of the Qdrant collection to store document vectors"
            />
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
          disabled={
            !minioConfig.endPoint ||
            !minioConfig.bucketName ||
            !embeddingConfig.apiKey ||
            !embeddingConfig.model ||
            !collectionConfig.name
          }
        >
          Save Configuration
        </Button>
      </Box>
    </Box>
  );
};

MinIOSettings.propTypes = {
  onConfigSaved: PropTypes.func.isRequired,
};

export default MinIOSettings;
