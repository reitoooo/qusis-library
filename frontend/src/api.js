export const getApiUrl = (path) => {
  let baseUrl = import.meta.env.VITE_API_URL || '';
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  // Vercel本番環境（baseUrlがある場合）は、/api を取り除いて直接バックエンドのルートを叩くように修正
  if (baseUrl) {
    return `${baseUrl}${path.replace(/^\/api/, '')}`;
  }
  return `${baseUrl}${path}`;
};
