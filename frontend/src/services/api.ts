import axios from 'axios';
import {
  Tower, TowerCreate,
  Obstacle, ObstacleCreate,
  SimulateRequest, SimulateResponse,
  SimulateMultiRequest, SimulateMultiResponse,
  CompareRequest, CompareResponse,
  RFPlanRequest, RFPlanResponse, RFRecommendedSite,
} from '../types';

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');
const api = axios.create({ baseURL: API_URL });

export const towerAPI = {
  create:    async (d: TowerCreate): Promise<Tower>   => (await api.post('/towers', d)).data,
  list:      async (source?: string): Promise<Tower[]> => {
    const params = source ? { source } : {};
    return (await api.get('/towers', { params })).data;
  },
  get:       async (id: string): Promise<Tower>       => (await api.get(`/towers/${id}`)).data,
  update:    async (id: string, d: Partial<TowerCreate>): Promise<Tower> => (await api.put(`/towers/${id}`, d)).data,
  delete:    async (id: string): Promise<void>        => { await api.delete(`/towers/${id}`); },
  deleteSite:async (siteId: string): Promise<void>    => { await api.delete(`/towers/site/${siteId}`); },
  deleteAll: async (source?: string): Promise<{ deleted_count: number }> => {
    const params = source ? { source } : {};
    return (await api.delete('/towers/all', { params })).data;
  },
};

export const obstacleAPI = {
  create: async (d: ObstacleCreate): Promise<Obstacle> => (await api.post('/obstacles', d)).data,
  list:   async (): Promise<Obstacle[]>                 => (await api.get('/obstacles')).data,
};

export const simulateAPI = {
  simulate: async (towerId: string, d: SimulateRequest): Promise<SimulateResponse> =>
    (await api.post(`/simulate/${towerId}`, d)).data,
  simulateMulti: async (d: SimulateMultiRequest): Promise<SimulateMultiResponse> =>
    (await api.post('/simulate/multi', d)).data,
};

export const rfPlanAPI = {
  generate: async (d: RFPlanRequest): Promise<RFPlanResponse> =>
    (await api.post('/rf-plan', d)).data,
  deploy:   async (sites: RFRecommendedSite[]): Promise<{ status: string; deployed_cells: number; sites_count: number }> =>
    (await api.post('/rf-plan/deploy', { sites })).data,
};

export const importAPI = {
  importData: async (file: File, format: string): Promise<{ batch_id: string; row_count: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    return (await api.post('/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
};

export const compareAPI = {
  compare: async (d: CompareRequest): Promise<CompareResponse> => (await api.post('/compare', d)).data,
};

// Open a download directly in the browser
export function downloadExport(format: 'csv' | 'json' | 'geojson', scope: 'all' | 'user_test' | 'real' = 'all') {
  window.open(`${API_URL}/export?format=${format}&scope=${scope}`, '_blank');
}
