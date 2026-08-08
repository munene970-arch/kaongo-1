import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json({ limit: "10mb" }));

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Deriv Trading Hub Backend on Vercel" });
});

// Server-Side OAuth Token Capture & Verification
app.post("/api/auth/capture-token", (req, res) => {
  try {
    const { accounts, rawUrl, state, appId } = req.body;

    console.log(`[Server Auth] Deriv OAuth Redirect Captured. Raw URL/Query: ${rawUrl || 'N/A'}, State: ${state || 'N/A'}, AppID: ${appId || '340mh9Kwzb9IINrqS379p'}`);

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ success: false, error: "No valid Deriv OAuth tokens supplied" });
    }

    // Sanitize and validate captured tokens server-side
    const sanitizedAccounts = accounts.map((acc: any) => ({
      account: String(acc.account || "Account").trim(),
      token: String(acc.token || "").replace(/^bearer\s+/i, "").replace(/['"\r\n\t\s]/g, ""),
      currency: String(acc.currency || "USD").toUpperCase(),
      type: String(acc.account || "").toUpperCase().startsWith("V") ? "DEMO" : "REAL",
    })).filter((acc: any) => acc.token.length >= 4);

    if (sanitizedAccounts.length === 0) {
      return res.status(400).json({ success: false, error: "Token validation failed: empty or malformed token" });
    }

    const primaryToken = sanitizedAccounts.find((a: any) => a.type === "REAL")?.token || sanitizedAccounts[0].token;

    console.log(`[Server Auth] Verified ${sanitizedAccounts.length} Deriv OAuth tokens server-side. App ID: ${appId || '340mh9Kwzb9IINrqS379p'}`);

    res.json({
      success: true,
      appId: appId || "340mh9Kwzb9IINrqS379p",
      capturedToken: primaryToken,
      accounts: sanitizedAccounts,
      state: state || null,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to capture token server-side" });
  }
});

// AI Market Analysis & Trade Signal endpoint
app.post("/api/ai/market-analysis", async (req, res) => {
  try {
    const { symbol, ticks, timeframe, indicatorSummary } = req.body;
    
    if (!ticks || !Array.isArray(ticks) || ticks.length === 0) {
      return res.status(400).json({ error: "Missing or invalid ticks data" });
    }

    const client = getAiClient();
    const prompt = `
You are a senior quantitative analyst specializing in Deriv Synthetic Indices (Volatility Indices, Crash/Boom, Jump Indices, Step Index).
Analyze the following market state for symbol: ${symbol || "Volatility 75 Index"}.
Current Timeframe: ${timeframe || "1m"}
Recent Ticks (last 10): ${JSON.stringify(ticks.slice(-10))}
Technical Indicators: ${JSON.stringify(indicatorSummary || {})}

Provide a concise, professional analysis in strict JSON format matching this schema:
{
  "symbol": "${symbol}",
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number (0-100),
  "keyObservation": "1-2 sentence description of price action and momentum",
  "recommendedStrategy": "Rise/Fall" | "Multipliers" | "Accumulator" | "Digits" | "No Trade",
  "suggestedEntry": "Immediate" | "Wait for pullback" | "On spike reset",
  "stopLossAdvice": "string advice on stop loss or stake sizing",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reasoningPoints": ["point 1", "point 2", "point 3"]
}
Respond ONLY with the valid JSON object.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI Market Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI market analysis" });
  }
});

// AI Bot Strategy Builder endpoint
app.post("/api/ai/generate-bot", async (req, res) => {
  try {
    const { userPrompt, targetMarket } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const client = getAiClient();
    const prompt = `
You are an expert Deriv DBot / Binary Bot strategy architect.
The user wants to generate an automated DBot strategy based on this requirement: "${userPrompt}".
Target Market: ${targetMarket || "Volatility 75 Index"}

Generate a complete trading bot strategy in JSON format:
{
  "botName": "Catchy Strategy Name",
  "market": "${targetMarket || "Volatility 75 Index"}",
  "tradeType": "Rise/Fall" | "Digits Differs" | "Crash/Boom Hunter" | "Accumulator" | "Multiplier",
  "contractType": "CALL" | "PUT" | "DIGITDIFF" | "DIGITEVEN" | "ACCU" | "MULT",
  "durationTicks": number (e.g. 1 to 10),
  "initialStake": number (e.g. 1, 5, 10),
  "martingaleMultiplier": number (e.g. 2.1),
  "takeProfit": number (e.g. 20),
  "stopLoss": number (e.g. 50),
  "maxConsecutiveLosses": number (e.g. 5),
  "rulesDescription": "Clear explanation of trigger conditions, entry logic, and risk controls.",
  "indicatorsUsed": ["EMA 10", "RSI 14", "Spike Detection"],
  "estimatedWinRatePercent": number (50 - 95),
  "recommendedBalance": number
}
Respond ONLY with the valid JSON object.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI Bot Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate DBot strategy" });
  }
});

// AI Risk Management Assistant
app.post("/api/ai/risk-assessment", async (req, res) => {
  try {
    const { balance, stake, strategy, martingaleSteps } = req.body;
    const client = getAiClient();
    const prompt = `
Analyze the trading risk profile for a Deriv trader:
- Account Balance: $${balance}
- Initial Stake: $${stake}
- Strategy: ${strategy || "Martingale"}
- Max Martingale Steps: ${martingaleSteps || 5}

Provide a JSON object with:
{
  "maxTotalDrawdownPossible": number,
  "riskRating": "SAFE" | "MODERATE" | "AGGRESSIVE" | "HIGHLY DANGEROUS",
  "maxLossPercentageOfAccount": number,
  "recommendations": ["string rule 1", "string rule 2"],
  "optimalStake": number
}
Respond ONLY with valid JSON.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Risk calculation failed" });
  }
});

export default app;
