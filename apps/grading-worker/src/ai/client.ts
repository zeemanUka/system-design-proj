import { GradeActionItem, GradeCategoryScore } from '@sdc/shared-types';

export type AiFeedbackInput = {
  overallScore: number;
  categoryScores: GradeCategoryScore[];
  strengths: string[];
  risks: string[];
  deterministicNotes: string[];
  actionItems: GradeActionItem[];
};

export type AiFeedbackOutput = {
  summary: string;
  strengths: string[];
  risks: string[];
  actionItems: Pick<GradeActionItem, 'priority' | 'title' | 'description'>[];
  provider: string;
  model: string;
};

export type AiFeedbackClient = {
  generateFeedback(input: AiFeedbackInput): Promise<AiFeedbackOutput>;
};

type AiProvider = 'mock' | 'openai-compatible' | 'anthropic';

type EnvConfig = {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
};

function parseEnvConfig(): EnvConfig {
  const provider = (process.env.AI_PROVIDER || 'mock') as AiProvider;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.AI_API_KEY || '';
  const temperature = Number(process.env.AI_TEMPERATURE || 0.2);
  const maxTokens = Number(process.env.AI_MAX_TOKENS || 800);

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
    maxTokens: Number.isFinite(maxTokens) ? maxTokens : 800
  };
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const snippet = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(snippet) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string').slice(0, 6);
}

function parseAiActions(value: unknown): Pick<GradeActionItem, 'priority' | 'title' | 'description'>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const priorityRaw = (entry as Record<string, unknown>).priority;
      const titleRaw = (entry as Record<string, unknown>).title;
      const descriptionRaw = (entry as Record<string, unknown>).description;

      const priority =
        priorityRaw === 'P0' || priorityRaw === 'P1' || priorityRaw === 'P2' ? priorityRaw : 'P2';

      if (typeof titleRaw !== 'string' || typeof descriptionRaw !== 'string') {
        return null;
      }

      return {
        priority,
        title: titleRaw,
        description: descriptionRaw
      };
    })
    .filter((entry): entry is Pick<GradeActionItem, 'priority' | 'title' | 'description'> => Boolean(entry))
    .slice(0, 8);
}

function buildPrompt(input: AiFeedbackInput): string {
  return JSON.stringify(
    {
      task: 'Generate concise interview coaching feedback strictly grounded on deterministic rubric output.',
      requirements: [
        'Do not invent architecture details that are not in evidence.',
        'Keep language clear and actionable.',
        'Return JSON with keys: summary, strengths, risks, actionItems.',
        'actionItems must include priority (P0/P1/P2), title, description.'
      ],
      deterministicRubric: {
        overallScore: input.overallScore,
        categoryScores: input.categoryScores,
        strengths: input.strengths,
        risks: input.risks,
        deterministicNotes: input.deterministicNotes,
        actionItems: input.actionItems
      }
    },
    null,
    2
  );
}

function mockFeedback(input: AiFeedbackInput): AiFeedbackOutput {
  const topStrength = input.strengths[0] || 'Design has a reasonable starting architecture.';
  const topRisk = input.risks[0] || 'Document tradeoffs and reliability assumptions more explicitly.';
  return {
    summary: `Deterministic grading completed with score ${input.overallScore}/100. Prioritize P0 items first, then iterate on P1 reliability and scalability improvements.`,
    strengths: [topStrength, ...input.strengths.slice(1, 3)],
    risks: [topRisk, ...input.risks.slice(1, 4)],
    actionItems: input.actionItems.map((item) => ({
      priority: item.priority,
      title: item.title,
      description: item.description
    })),
    provider: 'mock',
    model: 'mock-v1'
  };
}

async function openAiCompatibleFeedback(
  config: EnvConfig,
  input: AiFeedbackInput
): Promise<AiFeedbackOutput> {
  if (!config.apiKey) {
    throw new Error('AI_API_KEY is required for openai-compatible provider.');
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: 'system',
          content:
            'You are a system design interview coach. Return only valid JSON. Avoid markdown and prose outside JSON.'
        },
        {
          role: 'user',
          content: buildPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error('AI provider returned non-JSON response.');
  }

  return {
    summary:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : `Deterministic grading completed with score ${input.overallScore}/100.`,
    strengths: parseStringList(parsed.strengths).length > 0 ? parseStringList(parsed.strengths) : input.strengths,
    risks: parseStringList(parsed.risks).length > 0 ? parseStringList(parsed.risks) : input.risks,
    actionItems:
      parseAiActions(parsed.actionItems).length > 0
        ? parseAiActions(parsed.actionItems)
        : input.actionItems.map((item) => ({
            priority: item.priority,
            title: item.title,
            description: item.description
          })),
    provider: config.provider,
    model: config.model
  };
}

async function anthropicFeedback(config: EnvConfig, input: AiFeedbackInput): Promise<AiFeedbackOutput> {
  if (!config.apiKey) {
    throw new Error('AI_API_KEY is required for anthropic provider.');
  }

  const endpointBase = config.baseUrl.replace(/\/+$/, '');
  const endpoint = endpointBase.endsWith('/v1') ? `${endpointBase}/messages` : `${endpointBase}/v1/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system:
        'You are a system design interview coach. Respond with valid JSON only and no markdown.',
      messages: [
        {
          role: 'user',
          content: buildPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((item) => item.type === 'text')?.text ?? '';
  const parsed = extractJsonObject(text);

  if (!parsed) {
    throw new Error('Anthropic provider returned non-JSON response.');
  }

  return {
    summary:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : `Deterministic grading completed with score ${input.overallScore}/100.`,
    strengths: parseStringList(parsed.strengths).length > 0 ? parseStringList(parsed.strengths) : input.strengths,
    risks: parseStringList(parsed.risks).length > 0 ? parseStringList(parsed.risks) : input.risks,
    actionItems:
      parseAiActions(parsed.actionItems).length > 0
        ? parseAiActions(parsed.actionItems)
        : input.actionItems.map((item) => ({
            priority: item.priority,
            title: item.title,
            description: item.description
          })),
    provider: config.provider,
    model: config.model
  };
}

class DefaultAiFeedbackClient implements AiFeedbackClient {
  private readonly config: EnvConfig;

  constructor() {
    this.config = parseEnvConfig();
  }

  async generateFeedback(input: AiFeedbackInput): Promise<AiFeedbackOutput> {
    if (this.config.provider === 'mock') {
      return mockFeedback(input);
    }

    if (this.config.provider === 'openai-compatible') {
      return openAiCompatibleFeedback(this.config, input);
    }

    if (this.config.provider === 'anthropic') {
      return anthropicFeedback(this.config, input);
    }

    throw new Error(`Unsupported AI_PROVIDER: ${this.config.provider}`);
  }
}

export function createAiFeedbackClient(): AiFeedbackClient {
  return new DefaultAiFeedbackClient();
}
