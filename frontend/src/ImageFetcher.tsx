import { useState, useEffect } from 'react';
import { Grid, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';

// Custom hook for debouncing input values
const useDebounce = (value: any, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

const ImageFetcher = () => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [inline, setInline] = useState<number>(18);
    const [aperture, setAperture] = useState<number>(1000000);
    const [isFetchingImage, setIsFetchingImage] = useState(false);

    const debouncedInline = useDebounce(inline, 500);
    const debouncedAperture = useDebounce(aperture, 500);

    
    const fetchImage = async () => {
        if (isFetchingImage) return; 
        setIsFetchingImage(true);

        try {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }

            setLoading(true);

            const response = await fetch('http://127.0.0.1:5000/result.png');
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }

            const imageBlob = await response.blob();
            const imageObjectUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imageObjectUrl);
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setIsFetchingImage(false);
            setLoading(false);
        }
    };


    async function updateParams() {
        try {
            const resInline = await fetch(`http://localhost:5000/param/inline`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inline: debouncedInline }),
            });

            const resAperture = await fetch(`http://localhost:5000/param/aperture`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aperture: debouncedAperture }),
            });

            
            if (resInline.ok && resAperture.ok) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                fetchImage(); 
            } else {
                setError('Failed to update parameters');
            }
        } catch (err) {
            console.error(' Update error:', err);
            setError('An error occurred while updating parameters');
        }
    }

    useEffect(() => {
        fetchImage();
    }, []);

    return (
        <Grid container spacing={2} padding={2}>
            <Grid item xs={12} md={4}>
                <Paper elevation={3} style={{ padding: '20px' }}>
                    <Typography variant="h5" gutterBottom>
                        Update Parameters
                    </Typography>
                    <TextField
                        label="Inline"
                        type="number"
                        value={inline}
                        onChange={(e) => setInline(Number(e.target.value))}
                        fullWidth
                        margin="normal"
                    />
                    <TextField
                        label="Aperture"
                        type="number"
                        value={aperture}
                        onChange={(e) => setAperture(Number(e.target.value))}
                        fullWidth
                        margin="normal"
                    />
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
