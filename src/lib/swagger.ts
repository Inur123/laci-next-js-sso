import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api", // lokasi folder API
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Laci Digital API Documentation",
        version: "1.0.0",
        description:
          "Dokumentasi API lengkap untuk sistem Laci Digital (IPNU IPPNU)",
      },
      components: {
        securitySchemes: {
          apiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "authjs.session-token",
          },
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [],
    },
  });
  return spec;
};
