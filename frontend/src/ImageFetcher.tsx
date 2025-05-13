import { useState, useEffect } from 'react';
import { Grid, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';

const ImageFetcher = () => {
    const [params, setParams] = useState<{ [key: string]: number }>({});
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingImage, setIsFetchingImage] = useState(false);

    const fetchParams = async () => {
        try {
            const response = await fetch('http://localhost:5000/param');
            if (!response.ok) throw new Error('Failed to fetch parameters');
            const data = await response.json();
            setParams(data);
        } catch (err) {
            console.error(err);
            setError('Error fetching parameters');
        }
    };

    const fetchImage = async () => {
        if (isFetchingImage) return;
        setIsFetchingImage(true);

        try {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
            setLoading(true);

            const response = await fetch('http://localhost:5000/result.png');
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            setImageUrl(objectUrl);
        } catch (error) {
            console.error(error);
            setError('Failed to fetch image');
        } finally {
            setLoading(false);
            setIsFetchingImage(false);
        }
    };

    const updateParams = async () => {
        try {
            for (const [key, value] of Object.entries(params)) {
                const res = await fetch(`http://localhost:5000/param/${key}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [key]: value }),
                });
                if (!res.ok) throw new Error(`Failed to update ${key}`);
            }

            // Small delay to make sure image is updated on backend side
            await new Promise((resolve) => setTimeout(resolve, 500));
            fetchImage();
        } catch (err) {
            console.error('Update error:', err);
            setError('An error occurred while updating parameters');
        }
    };

    useEffect(() => {
        fetchParams();
        fetchImage();
    }, []);

    const handleParamChange = (key: string, value: number) => {
        setParams((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    return (
        <Grid container spacing={2} padding={2}>
            <Grid item xs={12} md={4}>
                <Paper elevation={3} style={{ padding: '20px' }}>
                    <Typography variant="h5" gutterBottom>
                        Dynamic Parameters
                    </Typography>
                    {Object.entries(params).map(([key, value]) => (
                        <TextField
                            key={key}
                            label={key}
                            type="number"
                            value={value}
                            onChange={(e) => handleParamChange(key, Number(e.target.value))}
                            fullWidth
                            margin="normal"
                        />
                    ))}
                    <Button variant="contained" color="primary" onClick={updateParams} fullWidth>
                        Update Image
                    </Button>
                    {error && <Alert severity="error" style={{ marginTop: '10px' }}>{error}</Alert>}
                </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
                <Paper elevation={3} style={{ padding: '20px', textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>
                        Image from Flask Backend
                    </Typography>
                    {loading ? (
                        <CircularProgress />
                    ) : (
                        imageUrl && <img src={imageUrl} alt="Generated from Flask" style={{ maxWidth: '100%', maxHeight: '500px' }} />
                    )}
                </Paper>
            </Grid>
        </Grid>
    );
};

export default ImageFetcher;
