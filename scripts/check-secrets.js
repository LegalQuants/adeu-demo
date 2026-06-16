import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

console.log("🔒 Running pre-commit secret scanner...");

try {
  // Load active local secrets from .env if it exists
  const envSecrets = new Set();
  if (existsSync(".env")) {
    try {
      const envContent = readFileSync(".env", "utf8");
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const delimiterIndex = trimmed.indexOf("=");
        if (delimiterIndex > 0) {
          const key = trimmed.substring(0, delimiterIndex).trim();
          let value = trimmed.substring(delimiterIndex + 1).trim();

          // Strip surrounding quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1).trim();
          }

          const isPlaceholder =
            value.includes("your_") || value.includes("placeholder");
          if (value.length >= 10 && !isPlaceholder) {
            envSecrets.add(value);
          }
        }
      }
    } catch (err) {
      console.warn(
        "⚠️ Warning: Could not parse local .env file for dynamic scanning.",
        err,
      );
    }
  }

  // 1. Get list of files currently staged for commit
  const stagedFiles = execSync("git diff --cached --name-only", {
    encoding: "utf8",
  })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  let hasErrors = false;

  for (const file of stagedFiles) {
    // 2. Block staging of .env files
    if (file === ".env" || file.endsWith(".env") || file.includes(".env.")) {
      if (file !== ".env.example") {
        console.error(
          `❌ Error: You are attempting to commit your local environment file: ${file}`,
        );
        console.error(
          "   This file contains sensitive API keys and must NEVER be committed.",
        );
        console.error(`   Please run: git restore --staged ${file}`);
        hasErrors = true;
        continue;
      }
    }

    // 3. Scan readable staged text files for potential raw Gemini API keys
    if (existsSync(file)) {
      try {
        const content = readFileSync(file, "utf8");

        // A. Dynamic Check: Scan for actual active secrets defined in the local .env file
        for (const secret of envSecrets) {
          if (content.includes(secret)) {
            console.error(
              `❌ Error: Found a raw local secret from your .env inside staged file: ${file}`,
            );
            console.error(
              "   Please use environment variables (process.env) instead of hardcoding raw values!",
            );
            hasErrors = true;
          }
        }

        // B. Generic Fallback: Match any standard Gemini/GCP API Keys (starts with AIzaSy)
        const geminiKeyRegex = /AIzaSy[A-Za-z0-9_\-]{30,45}/g;
        const matches = content.match(geminiKeyRegex);

        if (matches) {
          for (const match of matches) {
            if (!match.includes("your_") && !match.includes("placeholder")) {
              console.error(
                `❌ Error: Found potential raw Gemini/GCP API Key in staged file: ${file}`,
              );
              console.error(
                "   Please remove the raw API key and use environment variables (.env) instead!",
              );
              hasErrors = true;
              break;
            }
          }
        }
      } catch (err) {
        // Safe to skip binary files (like .docx) or folders that can't be read as UTF-8
      }
    }
  }

  if (hasErrors) {
    console.error(
      "\n🛑 Commit blocked by local pre-commit guardrails. Please fix the security issues above.",
    );
    process.exit(1);
  } else {
    console.log(
      "✅ Secret scan passed: No raw keys or local .env files staged.",
    );
  }
} catch (err) {
  console.warn(
    "⚠️ Warning: Could not execute pre-commit secret scanner. Skipping.",
    err,
  );
}
