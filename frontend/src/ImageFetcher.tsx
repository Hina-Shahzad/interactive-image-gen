import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import useDebounce from './Debounce';
import type { ParamMetadata, ParamResponse } from './type';

const ImageFetcher = () => {
    const [params, setParams] = useState<{ [key: string]: number }>({});
    const [paramsMetadata, setParamsMetadata] = useState<{ [key: string]: ParamMetadata }>({})
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [paramVersion, setParamVersion] = useState<number>(0);
    const [invalidParams, setInvalidParams] = useState<{ [key: string]: string | null }>({});

    const debouncedParams = useDebounce(params, 800);
    const prevDebouncedParams = useRef<{ [key: string]: number }>({});


    useEffect(() => {
        fetchParams().then((data) => {
            if (data) {
                fetchImage(0);
                //prevDebouncedParams.current = data;
            }
        });
    }, []);

    const fetchParams = useCallback(async () => {
        console.log("Fetch Params function is executed...");
        try {
            const response = await fetch('http://localhost:5000/param');
            if (!response.ok) throw new Error('Failed to fetch parameters');
            const data: ParamResponse = await response.json();
            console.log("data", data);
            const extractedMetadata = Object.fromEntries(
                Object.entries(data).map(([key, obj]) => [
                    key,
                    {
                        max: obj.max,
                        min: obj.min,
                        name: obj.name,
                        value: obj.value,
                        widget: obj.widget,
                    },
                ])
            );
            setParamsMetadata(extractedMetadata);

            const extractedParams = Object.fromEntries(
                Object.entries(data).map(([key, obj]) => [key, obj.value])
            );
            setParams(extractedParams);
            return extractedParams;
        } catch (err) {
            console.error(err);
            setError('Error fetching parameters');
            return null;
        }
    }, []);


    const fetchImage = useCallback(
        async (version: number) => {
            console.log("Fetch image function is executed");
            try {
                setLoading(true);
                if (imageUrl) {
                    URL.revokeObjectURL(imageUrl);
                }
                const response = await fetch(`http://localhost:5000/result.png?v=${version}`, { cache: 'no-store' });
                if (!response.ok) throw new Error('Failed to fetch image');
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                setImageUrl(objectUrl);
            } catch (error) {
                console.error(error);
                setError(error instanceof Error ? error.message : 'Unknown error occurred');
            } finally {
                setLoading(false);
            }
        },
        [imageUrl]
    );

    useEffect(() => {
        console.log("Live updates is executed when there is fetchParams and fetchImage");
        const sse = new EventSource('http://localhost:5000/param/live-updates');

        sse.onmessage = (event) => {
            console.log('Live update received:', event.data);
            try {
                const parsed = JSON.parse(event.data);
                console.log("parsed", parsed);
                if (parsed.event === 'param_updated') {
                    console.log('Param updated by SSE:', parsed);
                    fetchParams();
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
        console.log("Update all Params function is executed..");
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

    useEffect(() => {
        console.log("This USeEffect is for imageURL dependency ");
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    // Only trigger updateAllParams if debouncedParams actually changed
    useEffect(() => {
        console.log("This useEffect is calling when the Params are changed");
        const hasChanged = JSON.stringify(prevDebouncedParams.current) !== JSON.stringify(debouncedParams);
        const isEmpty = Object.keys(debouncedParams).length === 0;
        const hasInvalidParams = Object.values(invalidParams).some((error) => error !== null);

        if (!isEmpty && hasChanged && !hasInvalidParams) {
            prevDebouncedParams.current = debouncedParams;
            updateAllParams();
        }
    }, [debouncedParams, invalidParams]);

    const handleParamChange = useCallback((key: string, value: number) => {
        setParams(prev => {
            if (prev[key] === value) return prev;
            return { ...prev, [key]: value };
        });
        setError(null);
        if (
            paramsMetadata[key] &&
            (value < paramsMetadata[key].min || value > paramsMetadata[key].max)
        ) {
            setInvalidParams(prev => ({
                ...prev,
                [key]: `Value must be between ${paramsMetadata[key].min} and ${paramsMetadata[key].max}`,
            }));
        } else {
            setInvalidParams(prev => ({
                ...prev,
                [key]: null,
            }));
        }



    }, [paramsMetadata]);

    const isUpdateDisabled = useMemo(() => {
        return Object.values(invalidParams).some((error) => error !== null);
    }, [invalidParams]);

    const imageBlock = useMemo(() => {
        return loading ? (
            <CircularProgress />
        ) : (
            imageUrl && <img src={imageUrl} alt="Generated from Flask" style={{ maxWidth: '100%', maxHeight: '500px' }} />
        );
    }, [imageUrl, loading]);

    const validateValue = (key: string, value: number) => {
        const paramMeta = paramsMetadata[key];
        if (!paramMeta) return '';

        const { min, max } = paramMeta;
        let error = '';
        if (min !== undefined && value < min) {
            error = `${key} must be greater than or equal to ${min}`;
        } else if (max !== undefined && value > max) {
            error = `${key} must be less than or equal to ${max}`;
        }

        return error; 
    };

    const paramInputs = useMemo(() => (
        Object.entries(params).map(([key, value]) => {
            const error = validateValue(key, value);
            return (
                <TextField
                    key={key}
                    label={key}
                    type="number"
                    value={value}
                    onChange={(e) => handleParamChange(key, Number(e.target.value))}
                    fullWidth
                    margin="normal"
                    inputProps={{
                        min: paramsMetadata[key]?.min || 0,
                        max: paramsMetadata[key]?.max || Infinity,
                    }}
                    error={!!error}
                    helperText={error}
                />
            );
        })
    ), [params, handleParamChange, paramsMetadata]);

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
