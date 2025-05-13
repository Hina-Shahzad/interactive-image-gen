import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
    let isMounted = true;
    const handler = setTimeout(() => {
        if (isMounted) setDebouncedValue(value);
    }, delay);
    return () => {
        clearTimeout(handler);
        isMounted = false;
    };
}, [value, delay]);


    return debouncedValue;
}

export default useDebounce;