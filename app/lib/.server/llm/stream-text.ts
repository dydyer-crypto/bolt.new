// @ts-nocheck
// Preventing TS checks with files presented in the video for a better presentation.
import { streamText as _streamText, convertToCoreMessages } from "ai";
import { getModel } from "~/lib/.server/llm/model";
import { MAX_TOKENS } from "./constants";
import { getSystemPrompt } from "./prompts";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, hasModel } from "~/utils/constants";
import type { ChatRequest } from "~/routes/api.chat";

interface ToolResult<Name extends string, Args, Result> {
	toolCallId: string;
	toolName: Name;
	args: Args;
	result: Result;
}

interface Message {
	role: "user" | "assistant";
	content: string;
	toolInvocations?: ToolResult<string, unknown, unknown>[];
	model?: string;
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], "model">;

// function extractModelFromMessage(message: Message): { model: string; content: string } {
//   const modelRegex = /^\[Model: (.*?)Provider: (.*?)\]\n\n/;
//   const match = message.content.match(modelRegex);
//
//   if (!match) {
//     return { model: DEFAULT_MODEL, content: message.content,provider: DEFAULT_PROVIDER };
//   }
//   const [_,model,provider] = match;
//   const content = message.content.replace(modelRegex, '');
//   return { model, content ,provider};
//   // Default model if not specified
//
// }

export function streamText(
	chatRequest: ChatRequest,
	env: Env,
	options?: StreamingOptions,
) {
	const { messages, model, api_key, provider } = chatRequest;

	const _hasModel = hasModel(model, provider);
	let currentModel = _hasModel ? model : DEFAULT_MODEL;
	let currentProvider = _hasModel ? provider : DEFAULT_PROVIDER;

	const coreMessages = convertToCoreMessages(messages);
	return _streamText({
		model: getModel(currentProvider, currentModel, api_key, env),
		system: getSystemPrompt(),
		maxTokens: MAX_TOKENS,
		// headers: {
		//   'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
		// },
		messages: coreMessages,
		...options,
	});
}
