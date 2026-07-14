import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchForecast, type ForecastResponse } from './api/forecasts';
import { subDays, format } from 'date-fns';
import { ChartContainer, CustomTooltip } from '@/shared/ui/ChartContainer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Forecasting() {
  const to = useMemo(() => new Date().toISOString(), []);
  const from = useMemo(() => subDays(new Date(), 30).toISOString(), []);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-forecast', from, to],
    queryFn: () => fetchForecast('revenue', from, to),
  });

  const forecast: ForecastResponse | undefined = data;

  const chartData = useMemo(() => {
    if (!forecast?.forecast) return [];
    return forecast.forecast.map((f) => ({
      date: f.period,
      forecast: Math.round(f.forecast_value),
      low: Math.round(f.confidence_low),
      high: Math.round(f.confidence_high),
    }));
  }, [forecast]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Sales Forecasting</h1>

      <div className="bg-black rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-4">Seasonal-naive revenue forecast (next 30 days) with 80% confidence band.</p>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#6B7280" tick={{ fontSize: 12 }} tickFormatter={(v) => format(new Date(v), 'MMM dd')} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${v.toLocaleString()}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="forecast" stroke="#FF6A1C" strokeWidth={2} dot={false} name="Forecast" />
                <Line type="monotone" dataKey="high" stroke="#FF6A1C" strokeWidth={1} dot={false} strokeDasharray="4 4" name="Upper bound" opacity={0.5} />
                <Line type="monotone" dataKey="low" stroke="#FF6A1C" strokeWidth={1} dot={false} strokeDasharray="4 4" name="Lower bound" opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {forecast && (
        <div className="bg-black rounded-xl p-4">
          <p className="text-xs text-gray-500">Generated: {new Date(forecast.generatedAt).toLocaleString()} | Model: seasonal_naive</p>
        </div>
      )}
    </div>
  );
}
