import { readFileSync, writeFileSync, existsSync } from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import {
  extractTextFromBuffer,
  DocumentObject,
  RedlineEngine,
} from "@adeu/core";

// Load environment variables from .env file
dotenv.config();

/**
 * Validates whether the Gemini API key is configured and is not a placeholder.
 */
export function validateApiKey(apiKey: string | undefined): boolean {
  return (
    !!apiKey && apiKey !== "your_gemini_api_key_here" && apiKey.trim() !== ""
  );
}

/**
 * Constructs the compliance prompt by injecting playbook and contract text.
 */
export function constructPrompt(
  playbookMarkdown: string,
  contractMarkdown: string,
): string {
  return `
You are an expert legal engineering assistant helping lawyer-coders implement automated compliance workflows.
Your task is to analyze the following contract against our Legal Compliance Playbook and identify any deviations or non-compliant sections.
For each non-compliant section, you MUST propose a modification (a "modify" operation) that edits the text to comply with our playbook.

CRITICAL INSTRUCTIONS:
- The "target_text" must match the original contract text character-for-character, including capitalization, spacing, and punctuation. If it does not match exactly, the Word redlining engine will fail to locate and edit the text.
- Do not make changes that are not required by the playbook. Focus only on governing law, jurisdiction, and limitation of liability (liability caps).
- Provide clear, high-quality, professional comments for each change explaining the policy-based reason.

--- LEGAL COMPLIANCE PLAYBOOK ---
${playbookMarkdown}

--- CONTRACT DRAFT ---
${contractMarkdown}
`;
}

export interface EditOperation {
  type: "modify";
  target_text: string;
  new_text: string;
  comment: string;
}

/**
 * Validates that the AI-generated edits conform to the expected schema.
 */
export function validateEditsSchema(edits: any): edits is EditOperation[] {
  if (!Array.isArray(edits)) return false;
  for (const edit of edits) {
    if (typeof edit !== "object" || edit === null) return false;
    if (edit.type !== "modify") return false;
    if (typeof edit.target_text !== "string") return false;
    if (typeof edit.new_text !== "string") return false;
    if (typeof edit.comment !== "string") return false;
  }
  return true;
}

export async function main() {
  const contractPath = "contract_draft.docx";
  const playbookPath = "playbook.md";

  // 1. Validate environment & file inputs
  const apiKey = process.env.GEMINI_API_KEY;
  if (!validateApiKey(apiKey)) {
    console.error(
      "\n❌ Error: GEMINI_API_KEY is missing or contains placeholder.",
    );
    console.error(
      "Please copy .env.example to .env and insert your real Gemini API Key.",
    );
    console.error(
      "Get a key from Google AI Studio: https://aistudio.google.com/\n",
    );
    process.exit(1);
  }

  if (!existsSync(contractPath)) {
    console.error(
      `❌ Error: Input contract file not found at "${contractPath}".`,
    );
    process.exit(1);
  }

  if (!existsSync(playbookPath)) {
    console.error(`❌ Error: Playbook file not found at "${playbookPath}".`);
    process.exit(1);
  }

  console.log("📄 Reading contract draft and playbook...");
  const contractBuffer = readFileSync(contractPath);
  const playbookMarkdown = readFileSync(playbookPath, "utf-8");

  // 2. Extract contract text into CriticMarkup (Markdown) using @adeu/core
  console.log("🔍 Parsing Word document structure and extracting text...");
  const contractMarkdown = await extractTextFromBuffer(contractBuffer, false);
  console.log("--- Extracted Contract Text (Preview) ---");
  console.log(
    contractMarkdown.slice(0, 500) +
      "...\n-----------------------------------------",
  );

  // 3. Configure Gemini with structured JSON output schema matching @adeu/core's ModifyText interface
  console.log(
    "🤖 Initializing Gemini client with structured output schemas...",
  );
  const genAI = new GoogleGenerativeAI(apiKey!);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        description: "A list of text modifications to apply to the contract.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            type: {
              type: SchemaType.STRING,
              enum: ["modify"],
              description:
                "The type of operation. Always 'modify' for text replacements.",
            },
            target_text: {
              type: SchemaType.STRING,
              description:
                "The EXACT text string in the original contract that needs to be replaced. Must match character-for-character, including case and punctuation.",
            },
            new_text: {
              type: SchemaType.STRING,
              description:
                "The replacement text that corrects the issue in compliance with the playbook.",
            },
            comment: {
              type: SchemaType.STRING,
              description:
                "An educational comment explaining why this change was made, referencing specific playbook rules.",
            },
          },
          required: ["type", "target_text", "new_text", "comment"],
        },
      },
    },
  });

  // 4. Construct prompt and request compliance review
  const prompt = constructPrompt(playbookMarkdown, contractMarkdown);

  console.log("🧠 Analyzing contract against playbook using Gemini...");
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  const edits = JSON.parse(responseText);

  if (!validateEditsSchema(edits)) {
    console.error(
      "❌ Error: Gemini returned invalid edit operations structure.",
    );
    process.exit(1);
  }

  console.log(
    `\n✅ Gemini analysis complete. Identified ${edits.length} required correction(s):`,
  );
  console.log(JSON.stringify(edits, null, 2));

  // 5. Load contract DOM and apply edits as native Word Tracked Changes and comments
  console.log("\n🔀 Loading document into @adeu/core Virtual DOM...");
  const doc = await DocumentObject.load(contractBuffer);
  const engine = new RedlineEngine(doc, "Adeu AI Compliance Reviewer");

  console.log(
    "✍️  Applying redlines and inserting comment bubbles into DOCX...",
  );
  const report = engine.process_batch(edits);
  console.log("📊 Redlining Report Stats:", JSON.stringify(report, null, 2));

  // 6. Save modified buffer as contract_redlined.docx
  const outputFilename = "contract_redlined.docx";
  console.log(`💾 Saving redlined document as "${outputFilename}"...`);
  const outBuffer = await doc.save();
  writeFileSync(outputFilename, outBuffer);

  console.log(`\n🎉 Success! Native Word file "${outputFilename}" generated.`);
  console.log(
    "Open it in Microsoft Word to see native Tracked Changes and inline Comment bubbles!",
  );
}

// Ensure the main function only executes when index.ts is run directly, not when imported for testing
const isRunningDirectly = () => {
  if (!process.argv[1]) return false;
  const resolvedArg = process.argv[1].replace(/\\/g, "/");
  return resolvedArg.endsWith("index.ts") || resolvedArg.endsWith("index.js");
};

if (isRunningDirectly()) {
  main().catch((err) => {
    console.error("❌ Fatal Error in runner script:", err);
    process.exit(1);
  });
}
