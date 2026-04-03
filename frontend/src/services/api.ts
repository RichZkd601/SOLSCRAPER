import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 20_000 });

export const walletsApi = {
  list:           () => api.get('/wallets').then(r => r.data.data),
  add:            (address: string, label: string, tags: string[]) =>
                    api.post('/wallets', { address, label, tags }).then(r => r.data.data),
  update:         (address: string, body: object) => api.patch(`/wallets/${address}`, body),
  remove:         (address: string) => api.delete(`/wallets/${address}`),
  portfolio:      (address: string) => api.get(`/wallets/${address}/portfolio`).then(r => r.data.data),
  pnl:            (address: string, timeframe = '30d') =>
                    api.get(`/wallets/${address}/pnl`, { params: { timeframe } }).then(r => r.data.data),
  transactions:   (address: string, limit = 50, offset = 0) =>
                    api.get(`/wallets/${address}/transactions`, { params: { limit, offset } }).then(r => r.data.data),
  refresh:        (address: string) => api.post(`/wallets/${address}/refresh`).then(r => r.data.data),
  copyConfig:     (address: string) => api.get(`/wallets/${address}/copy-config`).then(r => r.data.data),
  saveCopyConfig: (address: string, cfg: object) => api.put(`/wallets/${address}/copy-config`, cfg),
};

export const discoverApi = {
  topTraders: (params?: Record<string, string>) =>
    api.get('/wallets/discover/top-traders', { params }).then(r => r.data.data),
  trending:   () => api.get('/wallets/discover/trending').then(r => r.data.data),
  newTokens:  () => api.get('/wallets/discover/new-tokens').then(r => r.data.data),
  appConfig:  () => api.get('/wallets/app/config').then(r => r.data.data),
};

export const tradesApi = {
  list:       (params?: object) => api.get('/trades', { params }).then(r => r.data.data),
  stats:      () => api.get('/trades/stats').then(r => r.data.data),
  alerts:     (unreadOnly = false) =>
                api.get('/trades/alerts', { params: { unreadOnly } }).then(r => r.data.data),
  readAlert:  (id: number) => api.patch(`/trades/alerts/${id}/read`),
  readAll:    () => api.post('/trades/alerts/read-all'),
  quote:      (params: object) => api.get('/trades/quote', { params }).then(r => r.data.data),
  manualBuy:  (tokenMint: string, solAmount: number, slippageBps?: number) =>
                api.post('/trades/manual-buy', { tokenMint, solAmount, slippageBps }).then(r => r.data),
  manualSell: (tokenMint: string, tokenAmount: number, decimals: number, slippageBps?: number) =>
                api.post('/trades/manual-sell', { tokenMint, tokenAmount, decimals, slippageBps }).then(r => r.data),
  solPrice:   () => api.get('/trades/sol-price').then(r => r.data.data.price as number),
};

export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
};
