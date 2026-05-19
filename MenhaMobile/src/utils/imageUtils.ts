export const resolveImageUrl = (path: string | null | undefined): string => {
    if (!path) return 'https://via.placeholder.com/300';
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    
    // It's a relative path in Supabase bucket
    return `https://wrjzdrhvrluamygexyvi.supabase.co/storage/v1/object/public/products/${path}`;
};

