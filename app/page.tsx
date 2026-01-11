"use client";

import GEXChart from "./components/GEXChart";
import WatchlistForm from "./components/WatchlistForm";
import { useState } from "react";

export default function Home() {
  const [selectedTickerId, setSelectedTickerId] = useState<number>(1);
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-black via-gray-950 to-black text-white">
      {/* Header */}
      <div className="border-b border-yellow-900/50 bg-gradient-to-r from-black to-gray-950 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-yellow-400">
                Gamma Exposure Tracker
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Monitor options gamma exposure across your watchlist
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <WatchlistForm onTickerSelect={setSelectedTickerId} />
          </div>
          {/* Chart */}
          <div className="lg:col-span-2">
            <GEXChart tickerId={selectedTickerId} />
          </div>
        </div>
      </div>
    </main>
  );
}
