export const validateApiKey = (request: Request) => {
  const apiKey = request.headers.get("x-api-key");
  const validKey = process.env.API_KEY || "laci-digital-secret-key-2026"; // Default fallback if not in env

  return apiKey === validKey;
};
