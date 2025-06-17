import React, { useEffect, useState } from 'react';
import { Box, Button, Grid, TextField, Typography, List, ListItem, ListItemText } from '@mui/material';
import { useMinio } from '../context/minio-context';
import { listBucket, uploadObject, deleteObject } from '../minio/s3';
import { ingestText, deleteByRef } from '../minio/pipeline';

function SettingsForm() {
  const { settings, setSettings } = useMinio();
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((s) => ({ ...s, [name]: value }));
  };
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="h6">MinIO Settings</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField fullWidth label="Endpoint" name="endpoint" value={settings.endpoint} onChange={handleChange} />
        </Grid>
        <Grid item xs={3}>
          <TextField fullWidth label="Port" name="port" value={settings.port} onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Access Key" name="accessKey" value={settings.accessKey} onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Secret Key" name="secretKey" value={settings.secretKey} onChange={handleChange} type="password" />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Bucket" name="bucket" value={settings.bucket} onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Collection" name="collection" value={settings.collection} onChange={handleChange} />
        </Grid>
      </Grid>
      <Typography variant="h6" sx={{ mt: 2 }}>Embedding</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField fullWidth label="Model" name="embedModel" value={settings.embedModel} onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="API Key" name="embedApiKey" value={settings.embedApiKey} onChange={handleChange} />
        </Grid>
        <Grid item xs={6}>
          <TextField fullWidth label="Base URL" name="embedBaseUrl" value={settings.embedBaseUrl || ''} onChange={handleChange} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default function MinioSync() {
  const { settings } = useMinio();
  const [objects, setObjects] = useState([]);
  const [file, setFile] = useState(null);

  const loadObjects = async () => {
    try {
      const res = await listBucket(settings);
      setObjects(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (settings.bucket && settings.endpoint) {
      loadObjects();
    }
  }, [settings]);

  const handleUpload = async () => {
    if (!file) return;
    const array = await file.arrayBuffer();
    await uploadObject(settings, file.name, new Uint8Array(array));
    await ingestText(new TextDecoder().decode(array), { path: file.name, bucket: settings.bucket }, {
      qdrantUrl: settings.endpoint,
      qdrantApiKey: settings.accessKey,
      collection: settings.collection,
      embedModel: settings.embedModel,
      embedApiKey: settings.embedApiKey,
      embedBaseUrl: settings.embedBaseUrl,
    });
    setFile(null);
    loadObjects();
  };

  const handleDelete = async (key) => {
    await deleteObject(settings, key);
    await deleteByRef(key, {
      qdrantUrl: settings.endpoint,
      qdrantApiKey: settings.accessKey,
      collection: settings.collection,
      embedModel: settings.embedModel,
      embedApiKey: settings.embedApiKey,
      embedBaseUrl: settings.embedBaseUrl,
    });
    loadObjects();
  };

  return (
    <Box p={2}>
      <SettingsForm />
      <Box>
        <input type="file" accept=".txt,.md" onChange={(e) => setFile(e.target.files[0])} />
        <Button onClick={handleUpload} disabled={!file}>Upload</Button>
      </Box>
      <List>
        {objects.map((obj) => (
          <ListItem key={obj.Key} secondaryAction={<Button onClick={() => handleDelete(obj.Key)}>Delete</Button>}>
            <ListItemText primary={obj.Key} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

