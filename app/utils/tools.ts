import type { ModelInfo, OllamaApiResponse, OllamaModel } from '~/utils/types';
import {  getStaticModels,setModelList } from '~/utils/constants';
import { getAPIKey, getBaseURL } from '~/lib/.server/llm/api-key';


export let MODEL_LIST: ModelInfo[] = [...getStaticModels()];



let isInitialized = false;
async function getOllamaModels(env: Env): Promise<ModelInfo[]> {
  try {
    const base_url = getBaseURL(env,"Ollama") ;
    const response = await fetch(`${base_url}/api/tags`);
    const data = await response.json() as OllamaApiResponse;
    return data.models.map((model: OllamaModel) => ({
      name: model.name,
      label: `${model.name} (${model.details.parameter_size})`,
      provider: 'Ollama',
    }));
  } catch (e) {
    return [{
      name: "Empty",
      label: "Empty",
      provider: "Ollama"
    }];
  }
}

async function getOpenAILikeModels(env: Env): Promise<ModelInfo[]> {
  try {
    const base_url = getBaseURL(env,"OpenAILike") ;
    if (!base_url) {
      return [{
        name: "Empty",
        label: "Empty",
        provider: "OpenAILike"
      }];
    }
    const api_key = getAPIKey(env,"OpenAILike") ?? "";
    const response = await fetch(`${base_url}/models`, {
      headers: {
        Authorization: `Bearer ${api_key}`,
      }
    });
    const res = await response.json() as any;
    return res.data.map((model: any) => ({
      name: model.id,
      label: model.id,
      provider: 'OpenAILike',
    }));
  }catch (e) {
    return [{
      name: "Empty",
      label: "Empty",
      provider: "OpenAILike"
    }];
  }
}


async function initializeModelList(env: Env): Promise<ModelInfo[]> {
  if (isInitialized) {
    return MODEL_LIST;
  }
  isInitialized = true;
  const ollamaModels = await getOllamaModels(env);
  const openAiLikeModels = await getOpenAILikeModels(env);
  MODEL_LIST = [...getStaticModels(), ...ollamaModels, ...openAiLikeModels];
  setModelList(MODEL_LIST);
  return MODEL_LIST;
}

export { getOllamaModels, getOpenAILikeModels, initializeModelList };
