import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { MinioSettings } from '../context/minio-context';

const getClient = (settings: MinioSettings) => {
  return new S3Client({
    region: settings.region,
    endpoint: `${settings.endpoint}:${settings.port}`,
    credentials: {
      accessKeyId: settings.accessKey,
      secretAccessKey: settings.secretKey,
    },
    forcePathStyle: true,
  });
};

export const listBucket = async (settings: MinioSettings) => {
  const client = getClient(settings);
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: settings.bucket })
  );
  return res.Contents || [];
};

export const uploadObject = async (settings: MinioSettings, Key: string, Body: Uint8Array) => {
  const client = getClient(settings);
  await client.send(
    new PutObjectCommand({ Bucket: settings.bucket, Key, Body })
  );
};

export const deleteObject = async (settings: MinioSettings, Key: string) => {
  const client = getClient(settings);
  await client.send(
    new DeleteObjectCommand({ Bucket: settings.bucket, Key })
  );
};

