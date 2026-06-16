import test from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import {
  validateApiKey,
  constructPrompt,
  validateEditsSchema,
} from "../index.js";
import {
  extractTextFromBuffer,
  DocumentObject,
  RedlineEngine,
} from "@adeu/core";

test("LegalQuants Demo Code Unit Tests", async (t) => {
  await t.test(
    "validateApiKey should correctly identify valid and invalid keys",
    () => {
      assert.strictEqual(
        validateApiKey(undefined),
        false,
        "Undefined key should be invalid",
      );
      assert.strictEqual(
        validateApiKey(""),
        false,
        "Empty key should be invalid",
      );
      assert.strictEqual(
        validateApiKey("your_gemini_api_key_here"),
        false,
        "Placeholder key should be invalid",
      );
      assert.strictEqual(
        validateApiKey("   "),
        false,
        "Whitespace-only key should be invalid",
      );
      assert.strictEqual(
        validateApiKey("AIzaSyActualValidKey123"),
        true,
        "Actual key string should be valid",
      );
    },
  );

  await t.test(
    "constructPrompt should build a prompt containing the contract and playbook",
    () => {
      const playbook = "# Playbook Guidelines";
      const contract = "This is a mock NDA contract.";
      const prompt = constructPrompt(playbook, contract);

      assert.ok(
        prompt.includes(playbook),
        "Prompt should contain the playbook",
      );
      assert.ok(
        prompt.includes(contract),
        "Prompt should contain the contract text",
      );
      assert.ok(
        prompt.includes("LEGAL COMPLIANCE PLAYBOOK"),
        "Prompt should contain header section",
      );
    },
  );

  await t.test(
    "validateEditsSchema should correctly validate structured edit array schema",
    () => {
      const validEdits = [
        {
          type: "modify",
          target_text: "Governing Law shall be England.",
          new_text: "Governing Law shall be Delaware.",
          comment: "As per policy, governing law must be Delaware.",
        },
      ];

      const invalidEditsEmpty = {};
      const invalidEditsBadType = [
        {
          type: "insert", // invalid type
          target_text: "some text",
          new_text: "new text",
          comment: "comment",
        },
      ];
      const invalidEditsMissingFields = [
        {
          type: "modify",
          target_text: "some text",
          // missing fields
        },
      ];

      assert.strictEqual(
        validateEditsSchema(validEdits),
        true,
        "Valid edits array should pass validation",
      );
      assert.strictEqual(
        validateEditsSchema(invalidEditsEmpty),
        false,
        "Empty object should fail validation",
      );
      assert.strictEqual(
        validateEditsSchema(invalidEditsBadType),
        false,
        "Wrong action type should fail validation",
      );
      assert.strictEqual(
        validateEditsSchema(invalidEditsMissingFields),
        false,
        "Missing fields should fail validation",
      );
    },
  );
});

test("LegalQuants Demo @adeu/core Integration Tests", async (t) => {
  const contractPath = "contract_draft.docx";

  if (!existsSync(contractPath)) {
    console.warn(`⚠️ Skipped integration test: ${contractPath} not found`);
    return;
  }

  const contractBuffer = readFileSync(contractPath);

  await t.test(
    "extractTextFromBuffer should parse Word doc and extract text",
    async () => {
      const contractMarkdown = await extractTextFromBuffer(
        contractBuffer,
        false,
      );
      assert.ok(
        contractMarkdown.length > 0,
        "Extracted markdown text should not be empty",
      );
      assert.ok(
        contractMarkdown.toLowerCase().includes("non-disclosure") ||
          contractMarkdown.toLowerCase().includes("agreement") ||
          contractMarkdown.toLowerCase().includes("confidentiality"),
        "Extracted text should contain standard contract keywords",
      );
    },
  );

  await t.test(
    "RedlineEngine should apply modifications and produce a structured report",
    async () => {
      const doc = await DocumentObject.load(contractBuffer);
      const engine = new RedlineEngine(doc, "Adeu AI Test Suite");

      // We search for a common term in our draft, or check if we can run process_batch
      const sampleEdits = [
        {
          type: "modify" as const,
          target_text: "This Cloud Master Services Agreement",
          new_text: "This Cloud Services Agreement",
          comment: "Testing redline capability in test environment",
        },
      ];

      const report = engine.process_batch(sampleEdits);
      assert.ok(report, "Should return a processing report");
      assert.strictEqual(
        typeof report.edits_applied,
        "number",
        "Report should indicate number of applied edits",
      );
      assert.strictEqual(
        typeof report.edits_skipped,
        "number",
        "Report should indicate number of skipped edits",
      );
      assert.strictEqual(
        report.edits_applied,
        1,
        "Should have applied exactly 1 edit",
      );
    },
  );
});
