// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { MODEL_LIST, DEFAULT_MODEL, DEFAULT_PROVIDER } from '~/utils/constants';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
  model?: string;
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

function extractModelFromMessage(message: Message): { model: string; content: string } {
  const modelRegex = /^\[Model: (.*?)\]\n\n/;
  const match = message.content.match(modelRegex);

  if (match) {
    const model = match[1];
    const content = message.content.replace(modelRegex, '');
    return { model, content };
  }

  return { model: 'claude-3-5-sonnet-20240620', content: message.content };
}

function determineProvider(model: string, env: Env): string {
  // First check if it's a static model
  const staticModel = MODEL_LIST.find((m) => m.name === model);
  if (staticModel) {
    return staticModel.provider;
  }

  // Check if it's an Ollama model by checking if it contains common Ollama model names
  if (env.OLLAMA_API_BASE_URL && (model.includes('llama') || model.includes('mistral'))) {
    return 'Ollama';
  }

  // Check if it's an OpenAI-like model
  if (env.OPENAI_LIKE_API_BASE_URL) {
    return 'OpenAILike';
  }

  // Default to Anthropic if no other provider is determined
  return 'Anthropic';
}

export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  let currentModel = extractModelFromMessage(messages[0]).model;
  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, content } = extractModelFromMessage(message);
      if (model) {
        currentModel = model;
      }
      return { ...message, content };
    }
    return message;
  });

  // Determine the provider based on the model and environment
  const provider = determineProvider(currentModel, env);

  console.log('Using provider:', provider, 'for model:', currentModel);

  try {
    return _streamText({
      model: getModel(provider, currentModel, env),
      system: getSystemPrompt(),
      maxTokens: MAX_TOKENS,
      messages: convertToCoreMessages(processedMessages),
      ...options,
    });
  } catch (error) {
    console.error('Error in streamText:', error);
    throw error;
  }
}
