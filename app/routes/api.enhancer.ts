import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { StreamingTextResponse, parseStreamPart } from 'ai';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import { promptCacheStore } from '~/lib/stores/prompt-cache';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {
  const { message } = await request.json<{ message: string }>();

  try {
    // Check cache first
    const cachedPrompt = promptCacheStore.getEnhancedPrompt(message);
    if (cachedPrompt) {
      // Return cached result immediately with cache header
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cachedPrompt));
          controller.close();
        },
      });
      const response = new StreamingTextResponse(stream);
      response.headers.set('x-from-cache', 'true');
      return response;
    }

    // If not in cache, proceed with LLM call
    const result = await streamText(
      [
        {
          role: 'user',
          content: stripIndents`
          I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

          IMPORTANT: Only respond with the improved prompt and nothing else!

          <original_prompt>
            ${message}
          </original_prompt>
        `,
        },
      ],
      context.cloudflare.env,
    );

    let enhancedPrompt = '';

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseStreamPart)
          .map((part) => part.value)
          .join('');

        // Accumulate the enhanced prompt
        enhancedPrompt += processedChunk;
        
        controller.enqueue(encoder.encode(processedChunk));
      },
      flush() {
        // Cache the complete enhanced prompt
        promptCacheStore.addToCache(message, enhancedPrompt);
      }
    });

    const transformedStream = result.toAIStream().pipeThrough(transformStream);
    const response = new StreamingTextResponse(transformedStream);
    response.headers.set('x-from-cache', 'false');
    return response;

  } catch (error) {
    console.log(error);

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
