import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Collapse,
  Paper,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  OutlinedInput,
} from '@mui/material';
import { Search, Clear, ExpandMore, ExpandLess, Add, Remove } from '@mui/icons-material';
import PropTypes from 'prop-types';
import { MinIOService } from '../../services/minioService';
import { VectorStoreService } from '../../services/vectorStoreService';

const SearchBar = ({ onSearch, showAdvanced = false }) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [topK, setTopK] = useState(10);
  const [metadataFilters, setMetadataFilters] = useState([{ key: '', value: '' }]);

  useEffect(() => {
    // Load bucket metadata from localStorage to show as hints
    const config = MinIOService.getConfig();
    if (config && config.bucketName) {
      const savedMetadata = VectorStoreService.getBucketMetadata(config.bucketName);
      if (savedMetadata && Object.keys(savedMetadata).length > 0) {
        const metadataArray = Object.entries(savedMetadata).map(([key, value]) => ({ key, value }));
        setMetadataFilters(metadataArray);
      }
    }
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      // Filter out empty metadata entries
      const activeFilters = metadataFilters.filter(f => f.key && f.value);
      const metadataFilter = activeFilters.reduce((acc, filter) => {
        acc[filter.key] = filter.value;
        return acc;
      }, {});

      onSearch(query, similarityThreshold, topK, metadataFilter);
    }
  };

  const handleClear = () => {
    setQuery('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleMetadataAdd = () => {
    setMetadataFilters([...metadataFilters, { key: '', value: '' }]);
  };

  const handleMetadataRemove = (index) => {
    if (metadataFilters.length > 1) {
      setMetadataFilters(metadataFilters.filter((_, i) => i !== index));
    }
  };

  const handleMetadataChange = (index, field, value) => {
    const newFilters = [...metadataFilters];
    newFilters[index][field] = value;
    setMetadataFilters(newFilters);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Search documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: query && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClear}>
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={!query.trim()}
            sx={{ minWidth: 100 }}
          >
            Search
          </Button>
          {showAdvanced && (
            <IconButton
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{ ml: 1 }}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>

        {showAdvanced && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 3, p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Advanced Search Options
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Similarity Threshold: {similarityThreshold.toFixed(2)}
                </Typography>
                <Slider
                  value={similarityThreshold}
                  onChange={(e, value) => setSimilarityThreshold(value)}
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.5, label: '0.5' },
                    { value: 1, label: '1' },
                  ]}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Higher values return only more relevant results
                </Typography>
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel>Max Results</InputLabel>
                <OutlinedInput
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 10)}
                  label="Max Results"
                  inputProps={{ min: 1, max: 100 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Maximum number of results to return (1-100)
                </Typography>
              </FormControl>

              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" gutterBottom>
                  Metadata Filters
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Filter results by metadata fields (only documents matching all filters will be returned)
                </Typography>
                {metadataFilters.map((filter, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label="Key"
                      value={filter.key}
                      onChange={(e) => handleMetadataChange(index, 'key', e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Value"
                      value={filter.value}
                      onChange={(e) => handleMetadataChange(index, 'value', e.target.value)}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <IconButton
                      onClick={() => handleMetadataRemove(index)}
                      disabled={metadataFilters.length === 1}
                      size="small"
                    >
                      <Remove />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<Add />}
                  onClick={handleMetadataAdd}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Add Filter
                </Button>
              </Box>
            </Box>
          </Collapse>
        )}
      </Paper>
    </Box>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  showAdvanced: PropTypes.bool,
};

export default SearchBar;
