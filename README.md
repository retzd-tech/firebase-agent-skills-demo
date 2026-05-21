# Firebase Agent Skills

This project is a demonstration of using [Genkit](https://firebase.google.com/docs/genkit) to build AI-powered applications with JavaScript/Node.js.

## Prerequisites

- Node.js installed
- Google Gemini API Key

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your Google Gemini API key:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

## Genkit Configuration

The Genkit instance is configured in `ai/genkit.js`. It utilizes the `@genkit-ai/google-genai` plugin to communicate with Google's Gemini models. By default, it uses the `gemini-2.5-flash` model.

## Available Flows

### `greetingFlow`
Defined in `ai/index.js`. This flow takes a user's name as a string input and generates a personalized, friendly greeting message using the Gemini model.

## Running the Genkit Developer UI

You can interact with your flows, trace executions, and debug using the Genkit Developer UI. To start the UI with automatic reloading, run the following command:

```bash
npm run genkit:ui
```

This will launch a local web server (usually at http://localhost:4000) where you can run the `greetingFlow` directly from your browser.
