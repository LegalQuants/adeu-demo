# LegalQuants Engineering Practices: Agentic NDA Redlining Demo ⚖️🤖

Welcome to the official demo repository for the upcoming webinar: **"LegalQuants Engineering Practices - Fireside Chat with [Mikko](https://github.com/mkorpela/)."**

This repository is designed specifically for lawyers, paralegals, and legal operations professional who are currently using AI to write local scripts to automate legal work but lacking the guardrails, security, and scalability of professional software engineering.

In this demo, we scale a basic legal automation script into a shared, robust, and secure codebase by implementing four key professional engineering guardrails:

1. **Secret Management:** Safeguarding API keys using `.env` files and `.gitignore`.
2. **Local Git Hygiene:** Employing `Husky` pre-commit hooks to catch broken code and API key leaks before committing.
3. **Continuous Integration (CI):** Automating code validation with `GitHub Actions` to protect the shared main branch.
4. **Agentic Redlining:** A lightweight Node.js script using [**`@adeu/core`**](https://github.com/dealfluence/adeu) and **Gemini 3.5 Flash** to review and redline an NDA against a legal compliance playbook, producing a native Microsoft Word document with tracked changes.

---

## 🏛️ Repository Architecture

This repository is structured to be clean, low-friction, and highly visual:

```text
adeu-legalquants-demo/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI configuration
├── .husky/
│   └── pre-commit             # Git hook to scan secrets & check code before commit
├── scripts/
│   └── check-secrets.js       # Light, custom Node.js hybrid (.env + pattern) secret detector
├── .env.example               # Template for API keys (safe to commit to GitHub)
├── .gitignore                 # Crucial: instructs Git to ignore secret keys & build outputs
├── README.md                  # This lawyer-friendly guide!
├── contract_draft.docx        # The unreviewed, messy input contract (Cloud MSA)
├── index.ts                   # Core AI Agent script using @adeu/core & Gemini
├── package.json               # Defines dependencies, run scripts, and pre-commit hooks
├── playbook.md                # The legal compliance policy playbook (the rules)
└── tsconfig.json              # TypeScript compiler configurations
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites

Ensure you have the following installed on your local machine:

- **Node.js** (version 22 or higher recommended)
- **Git**
- A text editor (such as **VS Code**)

### 2. Setup & Installation

Clone this repository and run the setup command in your terminal:

```bash
npm install
```

This command installs the required dependencies (including the official [**`@adeu/core`**](https://github.com/dealfluence/adeu) package) and automatically initializes and configures `Husky` git hooks.

### 3. Setup Secret Management (The Leak Guard)

To run the AI agent, you need a Gemini API key.

#### 🎓 Concept Spotlight: What is a `.env` File?

Think of your code like an office building:

- **Your scripts (`index.ts`)** are like the public hallways and lobbies. Anyone visiting the building (or viewing your repository on GitHub) can walk through them. If you write your API key directly inside your script, it's like leaving your private safe's combination on a sticky note in the lobby. Anyone who looks at your repository can steal it.
- **A `.env` (pronounced "dot-env") file** is like a private, locked vault room in the basement. It holds your sensitive "secrets" (like API keys, passwords, or client database credentials).
- **Environment Variables** are the individual secrets stored inside this vault. When your program runs, it safely knocks on the vault door, retrieves the key it needs (e.g., `process.env.GEMINI_API_KEY`), and keeps it strictly in its short-term memory while running.
- **The `.gitignore` file** is the security guard. It is a file that tells Git: _"Never pack up the `.env` vault and send it to the public domain (GitHub)."_

#### Setup Steps:

1. Copy the environment template file:
   ```bash
   cp .env.example .env
   ```
   _If you are using Windows Command Prompt (CMD) instead of PowerShell/Git Bash, use this command instead:_
   ```cmd
   copy .env.example .env
   ```
   _(Note: `.env.example` contains no real keys, only placeholders like `your_gemini_api_key_here`. It is safe to share with others. Your real keys will live only in `.env`.)_
2. Open the newly created `.env` file in your text editor.
3. Replace `your_gemini_api_key_here` with your actual Gemini API key from [Google AI Studio](https://aistudio.google.com/).

> **Why this matters for lawyers:** Real-world contracts contain sensitive client data, and API keys cost money. Recording your API keys directly inside your scripts and pushing them to GitHub can result in massive leaks. Placing keys in `.env` and registering `.env` in `.gitignore` ensures your credentials never leave your computer.

### 4. Run the Agentic Redlining Script

To analyze your contract (`contract_draft.docx`) against your legal policies (`playbook.md`) and generate a fully redlined document, run:

```bash
npm run dev
```

Watch the console as your agent:

1. Parses the OpenXML structure of your Word document into token-efficient **CriticMarkup** (a standard Markdown format used to represent text insertions and deletions).
2. Reads your corporate compliance playbook.
3. Invokes **Gemini 3.5 Flash** via structured JSON output mode to identify clauses deviating from your guidelines.
4. Applies those corrections back into the Word document as native **Tracked Changes** and **Comment Bubbles** using [**`@adeu/core`**](https://github.com/dealfluence/adeu)'s `RedlineEngine`.
5. Outputs a final, native Word document named **`contract_redlined.docx`**.

---

## 🛡️ Engineering Guardrails Explained

### Guardrail A: Local Git Hygiene (Pre-Commit Hooks)

Have you ever made a typo that broke your script, or committed an API key by mistake?
To prevent this, we configured **Husky**—a tool that lets us run code quality checks automatically _locally_ on your machine, before your code is ever committed to Git or pushed to GitHub.

#### 🔧 How the Husky Setup Works Under the Hood

1. **Automatic Initialization**:
   In `package.json`, we defined a `"prepare"` script: `"prepare": "husky"`. When you run `npm install`, NPM automatically triggers this script to configure git hooks in your local `.git` directory.
2. **The Hook Pipeline (`.husky/pre-commit`)**:
   Whenever you run `git commit`, Husky intercepts the action and executes the script at `.husky/pre-commit`. This script runs three guardrails in sequence:
   - **Secret Scanning (`node scripts/check-secrets.js`)**: A smart, hybrid scanner that parses your local `.env` file to detect and block commits if your exact API keys are accidentally hardcoded in your staged code. It also includes a robust fallback pattern-matcher for Google/Gemini keys as an extra line of defense.
   - **Formatting Check (`npm run lint`)**: Validates that all files comply with Prettier's uniform formatting style.
   - **Type-Checking (`npm run type-check`)**: Runs the TypeScript compiler (`tsc --noEmit`) to verify that there are no syntax errors, typos, or type mismatches.

If any step in this pipeline fails, Git will **block your commit** entirely and show you an error:

```text
🔒 Running pre-commit secret scanner...
❌ Error: You are attempting to commit your local environment file: .env
   This file contains sensitive API keys and must NEVER be committed.
   Please run: git restore --staged .env

🛑 Commit blocked by local pre-commit guardrails. Please fix the security issues above.
```

> **Why this matters for legal engineering:** Catching errors locally on your computer keeps your Git commit history pristine and ensures you never leak secrets or break your code. It's the ultimate line of defense before your changes are submitted.

### Guardrail B: Continuous Integration (CI)

If you work in a team with other legal engineers, you want to ensure that no one pushes broken code to your main branch.
We added `.github/workflows/ci.yml`. Every time a Pull Request is opened on GitHub, GitHub launches a clean, temporary cloud computer, checks out your code, installs dependencies, checks formatting, and compiles TypeScript.
If a pull request contains typos or syntax errors, the CI turn **red**, indicating that the PR should not be merged.

---

## 🧑‍💻 How the AI Redlining Code Works

Open `index.ts` to see how clean and legible professional code can be:

1. **CriticMarkup Parsing:**
   We load the Word document and extract its content:
   ```typescript
   const contractMarkdown = await extractTextFromBuffer(contractBuffer, false);
   ```
2. **Structured AI Decisions:**
   We configure Gemini using a formal TypeScript JSON schema. We instruct the model to return a list of edits where the `target_text` matches the contract text character-for-character:
   ```typescript
   const model = genAI.getGenerativeModel({
     model: "gemini-3.5-flash",
     generationConfig: {
       responseMimeType: "application/json",
       responseSchema: { ... }
     }
   });
   ```
3. **The Redline Engine:**
   We pass Gemini's compliance edits into [**`@adeu/core`**](https://github.com/dealfluence/adeu)'s virtual DOM engine. It does the heavy lifting of editing the underlying Microsoft Word OpenXML, marking edits as a tracked change from "Adeu AI Compliance Reviewer" and dropping in comment bubbles:
   ```typescript
   const doc = await DocumentObject.load(contractBuffer);
   const engine = new RedlineEngine(doc, "Adeu AI Compliance Reviewer");
   engine.process_batch(edits);
   ```

---

## 🎓 Learning More

This repository proves that legal automation does not have to be fragile or risky. By applying simple, standard software engineering tools (Husky, Dotenv, GitHub Actions) to your legal codebases, you can build production-ready legal tech with confidence.

Enjoy the fireside chat, and happy legal engineering! 🚀
