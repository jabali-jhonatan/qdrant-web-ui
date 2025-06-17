import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Breadcrumbs,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
} from '@mui/material';
import {
  Folder,
  InsertDriveFile,
  Delete,
  Refresh,
  CloudUpload,
  NavigateNext,
  Add,
  Remove,
} from '@mui/icons-material';
import PropTypes from 'prop-types';
import { MinIOService } from '../../services/minioService';
import { VectorStoreService } from '../../services/vectorStoreService';
import { useDropzone } from 'react-dropzone';

const BucketVisualization = ({ contents, onRefresh, loading }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [metadata, setMetadata] = useState([{ key: '', value: '' }]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Load bucket metadata from localStorage
    const config = MinIOService.getConfig();
    if (config && config.bucketName) {
      const savedMetadata = VectorStoreService.getBucketMetadata(config.bucketName);
      if (savedMetadata && Object.keys(savedMetadata).length > 0) {
        const metadataArray = Object.entries(savedMetadata).map(([key, value]) => ({ key, value }));
        setMetadata(metadataArray);
      }
    }
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    const config = MinIOService.getConfig();
    const bucketMetadata = metadata.reduce((acc, item) => {
      if (item.key) acc[item.key] = item.value;
      return acc;
    }, {});

    try {
      for (const file of acceptedFiles) {
        if (MinIOService.isTextFile(file.name)) {
          const content = await file.text();
          const key = currentPath ? `${currentPath}/${file.name}` : file.name;

          // Upload to MinIO
          await MinIOService.uploadObject(key, content);

          // Sync with vector store
          await VectorStoreService.syncBucketFile(key, 'upload', content, {
            bucketName: config.bucketName,
            ...bucketMetadata,
          });
        } else {
          console.warn(`Skipping non-text file: ${file.name}`);
        }
      }

      // Refresh the file list
      onRefresh();
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploading(false);
    }
  }, [currentPath, metadata, onRefresh]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
    },
    noClick: true,
  });

  const handleNavigate = (path) => {
    setCurrentPath(path);
    onRefresh();
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
      try {
        await MinIOService.deleteObject(item.key);
        await VectorStoreService.syncBucketFile(item.key, 'delete');
        onRefresh();
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
  };

  const handleMetadataAdd = () => {
    setMetadata([...metadata, { key: '', value: '' }]);
  };

  const handleMetadataRemove = (index) => {
    setMetadata(metadata.filter((_, i) => i !== index));
  };

  const handleMetadataChange = (index, field, value) => {
    const newMetadata = [...metadata];
    newMetadata[index][field] = value;
    setMetadata(newMetadata);
  };

  const handleMetadataSave = () => {
    const config = MinIOService.getConfig();
    if (config && config.bucketName) {
      const metadataObject = metadata.reduce((acc, item) => {
        if (item.key) acc[item.key] = item.value;
        return acc;
      }, {});
      VectorStoreService.saveBucketMetadata(config.bucketName, metadataObject);
    }
    setMetadataDialogOpen(false);
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  const filteredContents = contents.filter((item) => {
    const itemPath = item.key.startsWith(currentPath)
      ? item.key.slice(currentPath.length).replace(/^\//, '')
      : item.key;
    const depth = itemPath.split('/').filter(Boolean).length;
    return currentPath ? item.key.startsWith(currentPath + '/') && depth === 1 : depth === 1;
  });

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Bucket Explorer</Typography>
          <Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setMetadataDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Metadata
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => handleNavigate('')}
            underline="hover"
          >
            Root
          </Link>
          {pathParts.map((part, index) => {
            const path = pathParts.slice(0, index + 1).join('/');
            return (
              <Link
                key={path}
                component="button"
                variant="body1"
                onClick={() => handleNavigate(path)}
                underline="hover"
              >
                {part}
              </Link>
            );
          })}
        </Breadcrumbs>

        {metadata.filter(m => m.key).length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
            {metadata.filter(m => m.key).map((item, index) => (
              <Chip
                key={index}
                label={`${item.key}: ${item.value}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
        )}
      </Paper>

      <Paper
        {...getRootProps()}
        sx={{
          p: 2,
          backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          border: isDragActive ? '2px dashed' : '1px solid',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          transition: 'all 0.3s',
        }}
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CloudUpload sx={{ mr: 2, fontSize: 48, color: 'primary.main' }} />
            <Typography variant="h6" color="primary">
              Drop files here to upload
            </Typography>
          </Box>
        )}

        {loading || uploading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {filteredContents.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary={
                    <Typography color="text.secondary" align="center">
                      No files or folders. Drag and drop text files here to upload.
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              filteredContents.map((item) => (
                <ListItem
                  key={item.key}
                  button={item.type === 'folder'}
                  onClick={() => item.type === 'folder' && handleNavigate(item.key)}
                >
                  <ListItemIcon>
                    {item.type === 'folder' ? (
                      <Folder color="primary" />
                    ) : (
                      <InsertDriveFile color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={
                      item.type === 'file'
                        ? `${(item.size / 1024).toFixed(2)} KB • ${new Date(
                            item.lastModified
                          ).toLocaleString()}`
                        : null
                    }
                  />
                  {item.type === 'file' && (
                    <ListItemSecondaryAction>
                      <Tooltip title="Delete">
                        <IconButton edge="end" onClick={() => handleDelete(item)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))
            )}
          </List>
        )}
      </Paper>

      <Dialog open={metadataDialogOpen} onClose={() => setMetadataDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bucket Metadata</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Set metadata that will be applied to all files uploaded to this bucket.
          </Typography>
          {metadata.map((item, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="Key"
                value={item.key}
                onChange={(e) => handleMetadataChange(index, 'key', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Value"
                value={item.value}
                onChange={(e) => handleMetadataChange(index, 'value', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <IconButton onClick={() => handleMetadataRemove(index)} disabled={metadata.length === 1}>
                <Remove />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<Add />} onClick={handleMetadataAdd} sx={{ mt: 1 }}>
            Add Field
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetadataDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleMetadataSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

BucketVisualization.propTypes = {
  contents: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['file', 'folder']).isRequired,
      size: PropTypes.number,
      lastModified: PropTypes.instanceOf(Date),
    })
  ).isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

BucketVisualization.defaultProps = {
  loading: false,
};

export default BucketVisualization;
