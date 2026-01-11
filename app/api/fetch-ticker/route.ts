import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { ticker } = await request.json();

    if (!ticker || typeof ticker !== "string") {
      return NextResponse.json(
        { error: "Invalid ticker symbol" },
        { status: 400 }
      );
    }

    // Run the Python script to fetch data for this ticker
    const pythonScriptPath = path.join(
      process.cwd(),
      "scripts",
      "fetch_single_ticker.py"
    );

    return new Promise((resolve) => {
      const pythonProcess = spawn("python3", [pythonScriptPath, ticker]);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code === 0) {
          resolve(
            NextResponse.json(
              {
                message: `Data fetched successfully for ${ticker}`,
                output: stdout,
              },
              { status: 200 }
            )
          );
        } else {
          resolve(
            NextResponse.json(
              {
                error: `Failed to fetch data for ${ticker}`,
                details: stderr,
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error) {
    console.error("Error fetching ticker data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
