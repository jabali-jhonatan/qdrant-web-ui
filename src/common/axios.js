import axios from 'axios';
import { getBaseURL } from './utils';
import { bigIntJSON } from './bigIntJSON';

function getQdrantBaseURL() {
  // Check for environment variable first (highest precedence)
  if (import.meta.env.VITE_QDRANT_BASE_URL) {
    return import.meta.env.VITE_QDRANT_BASE_URL;
  }

  // Fall back to existing logic
  if (import.meta.env.MODE === 'development') {
    return 'http://localhost:6333';
  } else {
    return getBaseURL();
  }
}

export const axiosInstance = axios.create({
  baseURL: getQdrantBaseURL(),
  transformRequest: [
    function (data, headers) {
      if (data instanceof FormData) {
        return data;
      }
      headers['Content-Type'] = 'application/json';
      headers['x-inference-proxy'] = 'true';
      return bigIntJSON.stringify(data);
    },
  ],
  transformResponse: [
    function (data) {
      return bigIntJSON.parse(data);
    },
  ],
});

export function setupAxios(axios, { apiKey }) {
  axios.defaults.baseURL = getQdrantBaseURL();
  if (apiKey) {
    axios.defaults.headers.common['api-key'] = apiKey;
  }
  axios.defaults.transformRequest = [
    function (data, headers) {
      if (data instanceof FormData) {
        return data;
      }
      headers['Content-Type'] = 'application/json';
      headers['x-inference-proxy'] = 'true';
      return bigIntJSON.stringify(data);
    },
  ];
  axios.defaults.transformResponse = [
    function (data) {
      return bigIntJSON.parse(data);
    },
  ];
}
