"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface GEXData {
  strike: number;
  net_gex: number;
}

interface Summary {
  total_gex: number;
  flip_price: number;
  percentile: number;
  date: string;
}

interface GEXResponse {
  summary: Summary;
  price: number;
  strikes: GEXData[];
}

export default function GEXChart({ tickerId = 1 }: { tickerId?: number }) {
  const [data, setData] = useState<GEXResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/gex?ticker_id=${tickerId}`);
        if (!response.ok) throw new Error("Failed to fetch GEX data");
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tickerId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p>Loading gamma data...</p>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-200">
        <p className="font-semibold">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
        No data available
      </div>
    );

  const { summary, price, strikes } = data;

  // Prepare chart data
  const chartData = strikes.map((strike) => ({
    strike: strike.strike,
    "Negative GEX": Math.min(strike.net_gex, 0),
    "Positive GEX": Math.max(strike.net_gex, 0),
  }));

  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(2);
  };

  return (
    <div className="w-full space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total GEX"
          value={formatNumber(summary.total_gex)}
          color="emerald"
        />
        <StatCard
          label="Current Price"
          value={`$${price?.toFixed(2)}`}
          color="blue"
        />
        <StatCard
          label="Gamma Flip"
          value={`$${summary.flip_price?.toFixed(2)}`}
          color="amber"
        />
        <StatCard
          label="Percentile"
          value={`${summary.percentile}%`}
          color="purple"
        />
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-yellow-900/30 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-yellow-400">
            Net Gamma Exposure
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Strike-level analysis across options chain
          </p>
        </div>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#78350f"
              opacity={0.2}
            />
            <XAxis type="number" stroke="#78350f" />
            <YAxis
              dataKey="strike"
              type="category"
              stroke="#78350f"
              width={70}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#000000",
                border: "1px solid #b45309",
                borderRadius: "8px",
              }}
              formatter={(value: unknown) => formatNumber(value as number)}
              labelStyle={{ color: "#fbbf24" }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
                color: "#b45309",
              }}
            />
            <ReferenceLine x={0} stroke="#b45309" strokeWidth={2} />
            <Bar
              dataKey="Negative GEX"
              fill="#ef4444"
              stackId="gex"
              radius={[0, 8, 8, 0]}
            />
            <Bar
              dataKey="Positive GEX"
              fill="#10b981"
              stackId="gex"
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Info Footer */}
      <div className="flex items-center justify-between text-xs text-yellow-900/60">
        <div>Data as of: {new Date(summary.date).toLocaleDateString()}</div>
        <div>
          Strikes: {chartData.length} | Range:{" "}
          {Math.min(...chartData.map((d) => d.strike)).toFixed(0)} -{" "}
          {Math.max(...chartData.map((d) => d.strike)).toFixed(0)}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    emerald: "from-yellow-950/40 to-yellow-900/10 border-yellow-700/40",
    blue: "from-yellow-950/40 to-yellow-900/10 border-yellow-700/40",
    amber: "from-yellow-950/40 to-yellow-900/10 border-yellow-700/40",
    purple: "from-yellow-950/40 to-yellow-900/10 border-yellow-700/40",
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-5 backdrop-blur-sm hover:shadow-lg hover:shadow-yellow-500/20 transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold tracking-tight text-yellow-400">
        {value}
      </div>
    </div>
  );
}
