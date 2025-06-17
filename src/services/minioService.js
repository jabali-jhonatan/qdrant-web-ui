import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const STORAGE_KEY = 'minio-config';

export class MinIOService {
  static client = null;
  static config = null;

  static getConfig() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  static saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    this.config = config;
  }

  static async initialize() {
    const config = this.getConfig();
    if (!config) {
      throw new Error('MinIO configuration not found');
    }

    this.client = new S3Client({
      endpoint: `http${config.useSSL ? 's' : ''}://${config.endPoint}:${config.port}`,
      region: 'us-east-1', // MinIO doesn't use regions, but AWS SDK requires it
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.config = config;
  }

  static async testConnection() {
    try {
      await this.initialize();
      const command = new HeadBucketCommand({ Bucket: this.config.bucketName });
      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('MinIO connection test failed:', error);
      return false;
    }
  }

  static async listBucket(prefix = '') {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucketName,
        Prefix: prefix,
      });

      const response = await this.client.send(command);

      const contents = response.Contents || [];
      const prefixes = response.CommonPrefixes || [];

      // Format the response
      const items = [];

      // Add folders
      prefixes.forEach((prefix) => {
        const folderName = prefix.Prefix.slice(0, -1); // Remove trailing slash
        const displayName = folderName.split('/').pop();
        items.push({
          key: prefix.Prefix,
          name: displayName,
          type: 'folder',
          size: 0,
          lastModified: null,
        });
      });

      // Add files
      contents.forEach((object) => {
        const displayName = object.Key.split('/').pop();
        if (displayName) {
          // Skip if it's just a folder marker
          items.push({
            key: object.Key,
            name: displayName,
            type: 'file',
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      });

      return items;
    } catch (error) {
      console.error('Error listing bucket:', error);
      throw error;
    }
  }

  static async getObject(key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      const bodyContents = await response.Body.transformToString();

      return {
        content: bodyContents,
        metadata: response.Metadata,
        contentType: response.ContentType,
      };
    } catch (error) {
      console.error('Error getting object:', error);
      throw error;
    }
  }

  static async downloadObject(key, filename) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const objectData = await this.getObject(key);

      // Create a blob and download it
      const blob = new Blob([objectData.content], {
        type: objectData.contentType || 'text/plain',
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || key.split('/').pop();

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error downloading object:', error);
      throw error;
    }
  }

  static async uploadObject(key, content, metadata = {}) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
        Body: content,
        Metadata: metadata,
        ContentType: this.getContentType(key),
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error uploading object:', error);
      throw error;
    }
  }

  static async deleteObject(key) {
    if (!this.client) {
      await this.initialize();
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting object:', error);
      throw error;
    }
  }

  static getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      txt: 'text/plain',
      md: 'text/markdown',
      markdown: 'text/markdown',
    };
    return mimeTypes[ext] || 'text/plain';
  }

  static isTextFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['txt', 'md', 'markdown'].includes(ext);
  }
}
