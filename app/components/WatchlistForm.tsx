"use client";

import { useState, useEffect } from "react";

interface Ticker {
  id: number;
  ticker: string;
}

export default function WatchlistForm({
  onTickerSelect,
}: {
  onTickerSelect?: (id: number) => void;
}) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("Failed to fetch watchlist");
      const json = await response.json();
      setTickers(json.tickers);
      // Select the first ticker by default
      if (json.tickers.length > 0 && !selectedId) {
        setSelectedId(json.tickers[0].id);
        onTickerSelect?.(json.tickers[0].id);
      }
    } catch (error) {
      console.error("Error fetching watchlist:", error);
    }
  };

  const handleSelectTicker = (id: number) => {
    setSelectedId(id);
    onTickerSelect?.(id);
  };

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: input }),
      });

      const json = await response.json();

      if (!response.ok) {
        setMessage({
          type: "error",
          text: json.error || "Failed to add ticker",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `${input.toUpperCase()} added to watchlist`,
      });
      setInput("");
      fetchWatchlist();

      // Fetch data for the newly added ticker
      try {
        const tickerResponse = await fetch("/api/fetch-ticker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: input.toUpperCase() }),
        });

        if (tickerResponse.ok) {
          setMessage({
            type: "success",
            text: `${input.toUpperCase()} added and data fetched successfully`,
          });
        }
      } catch (error) {
        console.error("Error fetching ticker data:", error);
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTicker = async (ticker: string) => {
    try {
      const response = await fetch(`/api/watchlist?ticker=${ticker}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove ticker");

      setMessage({ type: "success", text: `${ticker} removed from watchlist` });
      fetchWatchlist();
    } catch (error) {
      setMessage({ type: "error", text: "Failed to remove ticker" });
    }
  };

  return (
    <div className="sticky top-20 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-yellow-900/30 rounded-2xl p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold tracking-tight mb-1 text-yellow-400">
          Watchlist
        </h2>
        <p className="text-gray-400 text-sm">Manage tracked securities</p>
      </div>

      {/* Add Ticker Form */}
      <form onSubmit={handleAddTicker} className="space-y-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="AAPL, ^SPX, etc."
          className="w-full px-4 py-3 bg-gray-900/50 border border-yellow-900/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 transition"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 disabled:from-gray-600 disabled:to-gray-700 text-black font-semibold rounded-lg transition shadow-lg hover:shadow-yellow-900/50 disabled:shadow-none"
        >
          {loading ? "Adding..." : "Add Ticker"}
        </button>
      </form>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium transition-all ${
            message.type === "success"
              ? "bg-emerald-900/30 border border-emerald-700/50 text-emerald-200"
              : "bg-red-900/30 border border-red-700/50 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Watchlist */}
      <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-yellow-900/30 rounded-2xl p-6 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-yellow-400 mb-4 uppercase tracking-wider">
          Current Watchlist ({tickers.length})
        </h3>
        {tickers.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            No tickers yet
          </p>
        ) : (
          <div className="space-y-2">
            {tickers.map((t) => (
              <div
                key={t.id}
                onClick={() => handleSelectTicker(t.id)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition group cursor-pointer ${
                  selectedId === t.id
                    ? "bg-yellow-900/30 border-yellow-500 shadow-lg shadow-yellow-500/20"
                    : "bg-gray-800/50 border-yellow-900/20 hover:bg-gray-700/50 hover:border-yellow-700/40"
                }`}
              >
                <span
                  className={`font-semibold ${
                    selectedId === t.id ? "text-yellow-300" : "text-yellow-400"
                  }`}
                >
                  {t.ticker}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTicker(t.ticker);
                  }}
                  className="text-yellow-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition font-bold text-lg"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
