import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .order("ticker", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tickers: data || [] });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ticker } = await request.json();

    if (!ticker || typeof ticker !== "string") {
      return NextResponse.json(
        { error: "Invalid ticker symbol" },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase().trim();

    // Check if ticker already exists
    const { data: existing, error: checkError } = await supabase
      .from("watchlist")
      .select("id")
      .eq("ticker", tickerUpper)
      .limit(1);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Ticker already in watchlist" },
        { status: 409 }
      );
    }

    // Insert new ticker
    const { data, error } = await supabase
      .from("watchlist")
      .insert([{ ticker: tickerUpper }])
      .select();

    if (error) throw error;

    return NextResponse.json(
      { message: "Ticker added successfully", data: data?.[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding ticker:", error);
    return NextResponse.json(
      { error: "Failed to add ticker" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json(
        { error: "Ticker is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("ticker", ticker.toUpperCase())
      .select();

    if (error) throw error;

    return NextResponse.json({ message: "Ticker removed successfully" });
  } catch (error) {
    console.error("Error removing ticker:", error);
    return NextResponse.json(
      { error: "Failed to remove ticker" },
      { status: 500 }
    );
  }
}
