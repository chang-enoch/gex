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
  const today = new Date();
  const initialDates: string[] = [];
  // Start from yesterday to avoid edge cases with future dates
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 1);

  for (let i = 0; i < 20; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() - i);
    initialDates.push(date.toISOString().split("T")[0]);
  }

  const [data, setData] = useState<GEXResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(initialDates[0]);
  const [availableDates, setAvailableDates] = useState<string[]>(initialDates);
  const [dataCache, setDataCache] = useState<Map<string, GEXResponse>>(
    new Map()
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDate) return;

      // Check cache first
      const cacheKey = `${tickerId}-${selectedDate}`;
      if (dataCache.has(cacheKey)) {
        const cachedData = dataCache.get(cacheKey);
        setData(cachedData || null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("ticker_id", String(tickerId));
        params.append("date", selectedDate);
        const response = await fetch(`/api/gex?${params}`);
        const json = await response.json();

        // If we have summary data, treat it as success (API may return 404 with fallback data)
        if (json.summary) {
          // Cache the result
          setDataCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, json);
            return newCache;
          });
          setData(json);
          setError(null);
        } else if (json.error && json.error.includes("No data")) {
          // No data for this ticker - treat as empty state, not an error
          console.warn(
            "No data for ticker:",
            tickerId,
            "Date:",
            selectedDate
          );
          setData(null);
          setError(null);
        } else if (!response.ok) {
          // Real error (connection issue, etc)
          throw new Error(json.error || "Failed to fetch GEX data");
        } else {
          // Response ok but no summary (shouldn't happen)
          setData(null);
          setError(null);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(
          "GEX Fetch Error:",
          errorMsg,
          "Date:",
          selectedDate,
          "Ticker:",
          tickerId
        );
        setError(errorMsg);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tickerId, selectedDate, dataCache]);

  if (!data && loading)
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mb-4"></div>
          <p>Loading gamma data...</p>
        </div>
      </div>
    );
  if (error && !data)
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-200">
        <p className="font-semibold">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
        <p className="mb-2">No data available for this ticker</p>
        <p className="text-xs text-slate-500">Data will appear after the market closes and data is fetched</p>
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

  // Custom tooltip that shows only positive or negative based on net GEX
  const CustomTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const netGEX = data["Positive GEX"] + data["Negative GEX"];
      const isPositive = netGEX > 0;

      return (
        <div
          className="bg-black border border-yellow-700 rounded-lg p-3"
          style={{ backgroundColor: "#000000", borderColor: "#b45309" }}
        >
          <p style={{ color: "#fbbf24", fontWeight: "bold" }}>
            Strike: ${data.strike}
          </p>
          <p
            style={{
              color: isPositive ? "#10b981" : "#ef4444",
              fontSize: "14px",
            }}
          >
            {isPositive ? "Positive" : "Negative"} GEX: {formatNumber(netGEX)}
          </p>
        </div>
      );
    }
    return null;
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
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-yellow-900/30 rounded-2xl p-8 shadow-xl backdrop-blur-sm relative">
        {loading && data && (
          <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
          </div>
        )}
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
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(187, 134, 11, 0.1)" }}
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

      {/* Date Slider */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-yellow-900/30 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4">
          <label className="text-sm font-semibold text-yellow-600 uppercase tracking-wide">
            Historical Data: {new Date(selectedDate).toLocaleDateString()}
          </label>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max={availableDates.length - 1}
            value={availableDates.indexOf(selectedDate)}
            onChange={(e) => {
              setSelectedDate(availableDates[parseInt(e.target.value)]);
            }}
            className="flex-1 h-2 bg-yellow-900/30 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            style={{
              background: `linear-gradient(to right, #b45309 0%, #b45309 ${
                ((availableDates.indexOf(selectedDate) /
                  (availableDates.length - 1)) *
                  100) >>
                0
              }%, #78350f 0%, #78350f 100%)`,
            }}
          />
          <span className="text-xs text-yellow-600 font-mono min-w-20">
            {availableDates.length - 1 - availableDates.indexOf(selectedDate)}{" "}
            days ago
          </span>
        </div>
        <div className="mt-3 text-xs text-yellow-900/60">
          Drag to view data from the past 20 days
        </div>
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
