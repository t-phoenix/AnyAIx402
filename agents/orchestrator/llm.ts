import type { AnyxConfig } from "@anyx/config";

/** Optional LLM assist. Never fails the run if keys are missing. */
export async function maybePlanWithLlm(config: AnyxConfig, goal: string): Promise<string | null> {
  if (config.anthropicApiKey) {
    return callAnthropic(config, goal);
  }
  if (config.openaiApiKey) {
    return callOpenAI(config, goal);
  }
  return null;
}

async function callOpenAI(config: AnyxConfig, goal: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.openaiApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        messages: [
          {
            role: "system",
            content:
              "You are the AnyX orchestrator. Reply with a short numbered plan for the goal. Stay inside v0: quote API, UPA SDK, tests, config.",
          },
          { role: "user", content: goal },
        ],
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function callAnthropic(config: AnyxConfig, goal: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.anthropicApiKey!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.anthropicModel,
        max_tokens: 400,
        messages: [{ role: "user", content: `AnyX v0 goal: ${goal}. Short numbered plan only.` }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: { text?: string }[] };
    return body.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}
