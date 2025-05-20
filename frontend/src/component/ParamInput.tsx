import { Slider, TextField, Box, Typography } from '@mui/material';
import type { ParamMetadata } from '../type';

const ParamInput = ({
    keyName,
    paramMeta,
    value,
    onChange,
    error
}: {
    keyName: string;
    paramMeta: ParamMetadata;
    value: number;
    onChange: (key: string, value: number) => void;
    error: string | null;
}) => {
    const min = paramMeta.min ?? 0;
    const max = paramMeta.max ?? 100;
    const widget = paramMeta.widget ?? 'floatbox';

    const label = paramMeta.name ?? keyName;

    const handleSliderChange = (_: any, newValue: number | number[]) => {
        if (typeof newValue === 'number') {
            onChange(keyName, newValue);
        }
    };

    if (widget === 'intslider' || widget === 'floatslider') {
        return (
            <Box sx={{ maxWidth: 300, marginBottom: 2 }}>
                <Typography gutterBottom>{label}</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2">{min}</Typography>
                    <Slider
                    value={value}
                    min={min}
                    max={max}
                    step={widget === 'intslider' ? 1 : (max - min) / 100}
                    onChange={handleSliderChange}
                    valueLabelDisplay="off"
                    sx={{ flexGrow: 1 }}
                />
                <Typography variant="body2">{max}</Typography>
                </Box>
            <TextField
                type="number"
                value={value}
                onChange={(e) => onChange(keyName, Number(e.target.value))}
                inputProps={{ min, max }}
                sx={{ mt: 1, width: '100px' }}
                error={!!error}
                helperText={error}
            />
            </Box>
        );
    }

    // Default to TextField
    return (
        <TextField
            label={label}
            type="number"
            value={value}
            onChange={(e) => onChange(keyName, Number(e.target.value))}
            fullWidth
            margin="dense"
            inputProps={{ min, max }}
            error={!!error}
            helperText={error}
            sx={{ maxWidth: '250px' }}
        />
    );
};
export default ParamInput;
