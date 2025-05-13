import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import useDebounce from './Debounce';

const ImageFetcher = () => {
    const [params, setParams] = useState<{ [key: string]: number }>({});
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [paramVersion, setParamVersion] = useState<number>(0);

    const debouncedParams = useDebounce(params, 800);
    const prevDebouncedParams = useRef<{ [key: string]: number }>({});

    const fetchParams = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/param');
            if (!response.ok) throw new Error('Failed to fetch parameters');
            const data = await response.json();
            setParams(data);
            return data;
        } catch (err) {
            console.error(err);
            setError('Error fetching parameters');
            return null;
        }
    }, []);


    const fetchImage = useCallback(
        async (version: number) => {
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


    useEffect(() => {
        fetchParams().then((data) => {
            if (data) {
                fetchImage(0);
            }
        });
    }, []);

    useEffect(() => {
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);



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

    const imageBlock = useMemo(() => {
        return loading ? (
            <CircularProgress />
        ) : (
            imageUrl && <img src={imageUrl} alt="Generated from Flask" style={{ maxWidth: '100%', maxHeight: '500px' }} />
        );
    }, [imageUrl, loading]);

    const paramInputs = useMemo(() => (
        Object.entries(params).map(([key, value]) => (
            <TextField
                key={key}
                label={key}
                type="number"
                value={value}
                onChange={(e) => handleParamChange(key, Number(e.target.value))}
                fullWidth
                margin="normal"
                inputProps={{
                    min: 0
                }}
            />
        ))
    ), [params, handleParamChange]);

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
                        disabled={isUpdating}
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
