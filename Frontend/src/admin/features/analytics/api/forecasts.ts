import { api } from '@/admin/lib/api';

export interface ForecastDataPoint {
  period: string;
  forecast_value: number;
  confidence_low: number;
  confidence_high: number;
}

export interface ForecastResponse {
  metric: string;
  forecast: ForecastDataPoint[];
  generatedAt: string;
}

export async function fetchForecast(metric = 'revenue', from?: string, to?: string) {
  const { data } = await api.get('/admin/analytics/forecast', { params: { metric, from, to } });
  return data.data as ForecastResponse;
}

export async function saveForecast(metric: string, forecast: ForecastDataPoint[]) {
  const { data } = await api.post('/admin/analytics/forecast', { metric, forecast });
  return data.data;
}
