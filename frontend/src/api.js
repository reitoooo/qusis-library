export const getApiUrl = (path) => {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  // Vercel本番環境（baseUrlがある場合）は、/api を取り除いて直接バックエンドのルートを叩くように修正
  if (baseUrl) {
    return `${baseUrl}${path.replace(/^\/api/, '')}`;
  }
  return `${baseUrl}${path}`;
};
