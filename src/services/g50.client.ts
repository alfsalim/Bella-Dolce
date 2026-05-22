// Thin HTTP client — all G50 business logic stays in g50-service
import config from '../../app.config';
const G50_BASE_URL = config.G50_SERVICE_URL;
const G50_API_KEY  = process.env.G50_API_KEY ?? '';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': G50_API_KEY,
};

export const g50Client = {
  pushSalesSummary:    (payload: unknown) =>
    fetch(`${G50_BASE_URL}/api/v1/g50/source/sales-summary`,
      { method: 'POST', headers, body: JSON.stringify(payload) }),

  pushPurchaseSummary: (payload: unknown) =>
    fetch(`${G50_BASE_URL}/api/v1/g50/source/purchase-summary`,
      { method: 'POST', headers, body: JSON.stringify(payload) }),

  listDeclarations:    (taxpayerId: string, year: number) =>
    fetch(`${G50_BASE_URL}/api/v1/g50/declarations?taxpayerId=${taxpayerId}&year=${year}`,
      { headers }),

  getDocument:         (declarationId: string, format = 'pdf') =>
    fetch(`${G50_BASE_URL}/api/v1/g50/declarations/${declarationId}/document?format=${format}`,
      { headers }),
};ßsß