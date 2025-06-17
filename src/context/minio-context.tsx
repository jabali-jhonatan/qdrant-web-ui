import React, { createContext, useContext, useEffect, useState } from 'react';

export interface MinioSettings {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  embedModel: string;
  embedApiKey: string;
  embedBaseUrl?: string;
  collection: string;
}

const DEFAULT_SETTINGS: MinioSettings = {
  endpoint: '',
  port: 9000,
  accessKey: '',
  secretKey: '',
  bucket: '',
  region: 'us-east-1',
  embedModel: 'text-embedding-ada-002',
  embedApiKey: '',
  embedBaseUrl: undefined,
  collection: 'documents',
};

const STORAGE_KEY = 'minio-settings';

interface MinioContextValue {
  settings: MinioSettings;
  setSettings: React.Dispatch<React.SetStateAction<MinioSettings>>;
}

const MinioContext = createContext<MinioContextValue | undefined>(undefined);

export const useMinio = (): MinioContextValue => {
  const ctx = useContext(MinioContext);
  if (!ctx) throw new Error('useMinio must be used within MinioProvider');
  return ctx;
};

export const MinioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<MinioSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return <MinioContext.Provider value={{ settings, setSettings }}>{children}</MinioContext.Provider>;
};

