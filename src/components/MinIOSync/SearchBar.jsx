import React, { useState } from 'react';
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
import { Search, Clear, ExpandMore, ExpandLess } from '@mui/icons-material';
import PropTypes from 'prop-types';

const SearchBar = ({ onSearch, showAdvanced = false }) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
  const [topK, setTopK] = useState(10);

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query, similarityThreshold, topK);
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

SearchBar.defaultProps = {
  showAdvanced: false,
};

export default SearchBar;
