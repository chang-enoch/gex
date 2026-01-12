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
      .order("id", { ascending: true });

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

export async function PUT(request: NextRequest) {
  try {
    const { id, newIndex } = await request.json();

    if (!id || newIndex === undefined) {
      return NextResponse.json(
        { error: "ID and newIndex are required" },
        { status: 400 }
      );
    }

    // Get all tickers
    const { data: allTickers, error: fetchError } = await supabase
      .from("watchlist")
      .select("*")
      .order("id", { ascending: true });

    if (fetchError) throw fetchError;

    // Find the item to move
    const itemIndex = allTickers.findIndex((t) => t.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }

    // Reorder: move item from current position to new position
    const [movedItem] = allTickers.splice(itemIndex, 1);
    allTickers.splice(newIndex, 0, movedItem);

    // Create new id-based ordering by recreating the list with new IDs
    // Actually, we'll just return the new order - the client will manage it
    return NextResponse.json({ tickers: allTickers });
  } catch (error) {
    console.error("Error reordering watchlist:", error);
    return NextResponse.json(
      { error: "Failed to reorder watchlist" },
      { status: 500 }
    );
  }
}
