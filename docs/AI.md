# AI insights

Smart Ward India has two kinds of insight:

1. **Rule-based alerts** (always on, no AI): water-supply risk, overdue road repairs, repeated drainage complaints and service backlogs — transparent thresholds described in `docs/SCORING.md`.
2. **AI development analysis** (optional): a language model reviews aggregated figures for a district (by mandal and municipality) or for the whole state (by district) and proposes priorities and preventive actions. Admins open it from **Insights & AI → AI development analysis**.

## Choose a provider

Set these in `.env`, then restart `npm run dev`.

### A. Local and free — Ollama (recommended for local use)
Nothing leaves your machine.
```bash
docker compose --profile ai up -d                 # starts the ollama service on port 11434
docker compose exec ollama ollama pull llama3.1:8b   # one-time download, about 5 GB
```
(Or install Ollama from ollama.com and run `ollama pull llama3.1:8b`.)
```dotenv
AI_PROVIDER=ollama
AI_MODEL=llama3.1:8b
AI_BASE_URL=http://localhost:11434
```
An 8-billion-parameter model needs about 8 GB of free RAM; on a laptop CPU an analysis takes 30–120 seconds (a GPU is much faster). `qwen2.5:7b` is a good alternative.

### B. OpenAI or any OpenAI-compatible server
Works with OpenAI, Azure OpenAI, Groq, OpenRouter, vLLM, LM Studio and others.
```dotenv
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1     # or your server's /v1 URL
AI_API_KEY=sk-...
AI_MODEL=<a current model name from your provider>
```

### C. Anthropic (Claude)
```dotenv
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-haiku-5-5                  # default if empty
```

`AI_TIMEOUT_MS` (default 120000) bounds each request. Older `AI_SUMMARY_*` variables are still read as a fallback.

## What the model receives — and never receives

Sent (see `buildAiContext` in `src/lib/services/ai-insights.ts`): the area name and real LGD structure counts (mandals, Gram Panchayats, urban bodies, wards, villages and villages without a GP mapping); per area the last-30-day and previous-30-day complaint counts, open and overdue counts, resolution rate, average development score and most frequent categories; category trends; indicator scores; the current rule-based alerts (title, ward label, severity); project counts.

Never sent: names, emails, phone numbers, addresses, complaint descriptions, comments, photos, videos, exact locations or internal notes.

Every report stores the exact data sent (expand **Data sent to the model** under the results) together with the provider, model, time and the administrator who requested it; generation is also written to the audit log.

## How the output is checked

The model must return JSON (`{"insights": [...]}` with title, area, category, severity, evidence, recommendation, horizon and confidence). `parseAiInsights` in `src/lib/domain/ai.ts`:
- extracts the JSON even if the model wraps it in prose or code fences,
- **drops any insight whose area is not one of the areas actually sent** (a common hallucination),
- maps category names to real categories, clips long text, normalises severity and confidence,
- marks the report `PARTIAL` if items were dropped and `FAILED` if no valid JSON came back.

Results are labelled as AI-generated advice to verify. The model cannot change any data.

## Access and limits

- District and ward administrators can analyse districts within their scope; state-wide analysis is for super administrators.
- At most 6 analyses per administrator per 10 minutes (models are slow and may cost money).

## Troubleshooting

| Message | Fix |
|---|---|
| "AI is not configured (AI_PROVIDER is not set)" | Set `AI_PROVIDER` and restart. |
| "Could not reach the ollama endpoint" | `docker compose --profile ai up -d`; if the app itself runs in Docker, use `AI_BASE_URL=http://host.docker.internal:11434`. |
| "The model returned an error (404)" with Ollama | The model is not pulled: `docker compose exec ollama ollama pull llama3.1:8b`. |
| "did not respond within 120 s" | Use a smaller/faster model or raise `AI_TIMEOUT_MS`. |
| Report shows FAILED / no usable insights | Small models sometimes ignore the JSON format; retry or use a larger model. |
