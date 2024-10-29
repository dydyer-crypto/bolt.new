import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { useState } from 'react';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_LIST } from '~/utils/constants';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

export default function Index() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [modelList, setModelList] = useState(MODEL_LIST);
  const [providerList, setProviderList] = useState([...new Set([...MODEL_LIST.map((m) => m.provider), 'Ollama', 'OpenAILike'])]);
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<BaseChat  model={model} modelList={modelList} provider={provider} providerList={providerList} setModel={setModel} setProvider={setProvider}/>}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
