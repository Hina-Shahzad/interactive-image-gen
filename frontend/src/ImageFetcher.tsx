import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, Button, CircularProgress, Alert, Box } from '@mui/material';
import useDebounce from './Debounce';
import type { ParamMetadata} from './type';
import ParamInput from './component/ParamInput';

const ImageFetcher = () => {
    const [params, setParams] = useState<{ [key: string]: number }>({});
    const [paramsMetadata, setParamsMetadata] = useState<{ [key: string]: ParamMetadata }>({})
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [paramVersion, setParamVersion] = useState<number>(0);
    const [paramOrder, setParamOrder] = useState<string[]>([]);


    const debouncedParams = useDebounce(params, 800);
    const prevDebouncedParams = useRef<{ [key: string]: number }>({});


    useEffect(() => {
        fetchParams().then((data) => {
            if (data) {
                prevDebouncedParams.current = data;
                // Fetch latest version from backend
                fetchVersion().then(version => {
                    setParamVersion(version);
                    fetchImage(version);
                });
            }
        });
    }, []);

    const fetchParams = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/param');
            if (!response.ok) throw new Error('Failed to fetch parameters');
            const json = await response.json();
            
            const data = json.params;
            const order = json.order;
            
            const extractedMetadata: { [key: string]: ParamMetadata } = {};
            const extractedParams: { [key: string]: number } = {};

            for (const key of order) {
            const obj = data[key];
            extractedMetadata[key] = {
                max: obj.max,
                min: obj.min,
                name: obj.name,
                value: obj.value,
                widget: obj.widget,
            };
            extractedParams[key] = obj.value;
        }
            setParamsMetadata(extractedMetadata);
            setParams(extractedParams);
            setParamOrder(order);
            return extractedParams;
        } catch (err) {
            console.error(err);
            setError('Error fetching parameters');
            return null;
        }
    }, []);

    const fetchVersion = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/param/version');
            if (!response.ok) throw new Error('Failed to fetch version');
            const data = await response.json();
            console.log("version", data.version);
            return data.version ?? 0;
        } catch (error) {
            console.error('Error fetching version:', error);
            return 0;
        }
    }, []);
    const fetchImage = useCallback(
        async (version: number) => {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:5000/result.png?v=${version}`, { cache: 'no-store' });
                if (!response.ok) throw new Error('Failed to fetch image');
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                setImageUrl(prevUrl => {
                    if (prevUrl) URL.revokeObjectURL(prevUrl);
                    return objectUrl;
                });
            } catch (error) {
                console.error(error);
                setError(error instanceof Error ? error.message : 'Unknown error occurred');
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        const sse = new EventSource('http://localhost:5000/param/live-updates');
        sse.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.event === 'param_updated') {
                    fetchParams();
                    setParamVersion(parsed.version);
                    fetchImage(parsed.version);
                }
            } catch (e) {
                console.error('Invalid SSE payload:', e);
            }
        };
        sse.onerror = (error) => {
            console.error('SSE connection error:', error);
            sse.close();
        };
        return () => {
            sse.close();
        };
    }, [fetchParams, fetchImage]);


    const updateAllParams = useCallback(async () => {
        setIsUpdating(true);
        setError(null);

        try {
            const results = await Promise.all(
                Object.entries(debouncedParams).map(([key, value]) =>
                    fetch(`http://localhost:5000/param/${key}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [key]: value }),
                    })
                )
            );

            if (results.every(res => res.ok)) {
                // Now fetch the backend version
                const versionRes = await fetch('http://localhost:5000/param/version');
                if (!versionRes.ok) throw new Error('Failed to fetch version');
                const versionData = await versionRes.json();

                if (typeof versionData.version === 'number') {
                    setParamVersion(versionData.version);
                    await fetchImage(versionData.version);
                } else {
                    throw new Error('Invalid version data from server');
                }
            } else {
                setError('Failed to update one or more parameters');
            }
        } catch (error) {
            console.error('Update error:', error);
            setError('An error occurred while updating parameters');
        } finally {
            setIsUpdating(false);
        }
    }, [debouncedParams, fetchImage]);

    // Only trigger updateAllParams if debouncedParams actually changed
    useEffect(() => {
        const hasChanged = JSON.stringify(prevDebouncedParams.current) !== JSON.stringify(debouncedParams);
        const isEmpty = Object.keys(debouncedParams).length === 0;

        if (!isEmpty && hasChanged) {
            prevDebouncedParams.current = debouncedParams;
            updateAllParams();
        }
    }, [debouncedParams]);

    const handleParamChange = useCallback((key: string, value: number) => {
        setParams(prev => {
            if (prev[key] === value) return prev;
            return { ...prev, [key]: value };
        });
        setError(null);
    }, []); 

    const isUpdateDisabled = useMemo(() => isUpdating, [isUpdating]);

    const imageBlock = useMemo(() => (
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
            {imageUrl && (
                <img src={imageUrl} alt="Generated from Flask" style={{ maxWidth: '100%', maxHeight: '500px' }} />
            )}
            {loading && (
                <Box sx={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    backgroundColor: 'rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                    padding: '5px',
                }}>
                    <CircularProgress size={24} />
                </Box>
            )}
        </Box>
    ), [imageUrl, loading]);

    const paramInputs = useMemo(() => (
    paramOrder.map((key) => (
        <ParamInput
            key={key}
            keyName={key}
            paramMeta={paramsMetadata[key]}
            value={params[key]}
            onChange={handleParamChange}
            error={null}
        />
    ))
), [paramOrder, params, paramsMetadata, handleParamChange]);

    return (
        <Grid container columns={12} columnSpacing={2} rowSpacing={2} padding={2}>
            <Grid sx={{ gridColumn: 'span 12', '@media (min-width: 960px)': { gridColumn: 'span 4' } }}>
                <Paper elevation={3} sx={{ padding: '20px' }}>
                    <Typography variant="h5" gutterBottom>
                        Update Parameters
                    </Typography>
                    {paramInputs}
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={updateAllParams}
                        disabled={isUpdating || isUpdateDisabled}
                        fullWidth
                        sx={{ marginTop: '10px' }}
                    >
                        {isUpdating ? 'Updating...' : 'Update Image'}
                    </Button>
                    {error && <Alert severity="error" sx={{ marginTop: '10px' }}>{error}</Alert>}
                </Paper>
            </Grid>

            <Grid sx={{ gridColumn: 'span 12', '@media (min-width: 960px)': { gridColumn: 'span 8' } }}>
                <Paper elevation={3} sx={{ padding: '20px', textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>
                        Image from Flask Backend
                    </Typography>
                    {imageBlock}
                </Paper>
            </Grid>
        </Grid>

    );
};

export default ImageFetcher;
