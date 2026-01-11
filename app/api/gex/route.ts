import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tickerId = searchParams.get("ticker_id") || "1";
    const date = searchParams.get("date");

    // Fetch summary data
    let summaryQuery = supabase
      .from("summaries")
      .select("*")
      .eq("ticker_id", tickerId);

    if (date) {
      summaryQuery = summaryQuery.eq("date", date);
    } else {
      // Get latest date
      summaryQuery = summaryQuery.order("date", { ascending: false }).limit(1);
    }

    const { data: summaryData, error: summaryError } = await summaryQuery;

    if (summaryError) throw summaryError;

    if (!summaryData || summaryData.length === 0) {
      return NextResponse.json(
        { error: "No summary data found" },
        { status: 404 }
      );
    }

    const summary = summaryData[0];
    const queryDate = date || summary.date;

    // Fetch strike details
    const { data: strikeData, error: strikeError } = await supabase
      .from("details")
      .select("*")
      .eq("ticker_id", tickerId)
      .eq("date", queryDate)
      .order("strike", { ascending: true });

    if (strikeError) throw strikeError;

    // Fetch price data
    const { data: priceData, error: priceError } = await supabase
      .from("prices")
      .select("*")
      .eq("ticker_id", tickerId)
      .eq("date", queryDate);

    if (priceError) throw priceError;

    const price = priceData && priceData.length > 0 ? priceData[0].price : null;

    return NextResponse.json({
      summary: {
        total_gex: summary.total_gex,
        flip_price: summary.flip_price,
        percentile: summary.percentile,
        date: summary.date,
      },
      price,
      strikes: strikeData || [],
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
