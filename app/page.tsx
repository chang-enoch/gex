"use client";

import GEXChart from "./components/GEXChart";
import WatchlistForm from "./components/WatchlistForm";
import { useState } from "react";

export default function Home() {
  const [selectedTickerId, setSelectedTickerId] = useState<number>(1);
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-black via-gray-950 to-black text-white">
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
