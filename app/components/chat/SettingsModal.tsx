import { DialogRoot, Dialog, DialogTitle, DialogButton, DialogDescription } from '~/components/ui/Dialog';
import { useState, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { initializeModelList, MODEL_LIST } from '~/utils/constants';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdate?: () => void;
}

interface ApiKeys {
  [key: string]: string;
}

const API_PROVIDERS = {
  'OpenAI': 'OPENAI_API_KEY',
  'Anthropic': 'ANTHROPIC_API_KEY',
  'Groq': 'GROQ_API_KEY',
  'OpenRouter': 'OPEN_ROUTER_API_KEY',
  'Google': 'GOOGLE_GENERATIVE_AI_API_KEY',
  'DeepSeek': 'DEEPSEEK_API_KEY',
  'Mistral': 'MISTRAL_API_KEY',
  'Ollama': 'OLLAMA_API_BASE_URL',
  'OpenAILike': 'OPENAI_LIKE_API_KEY',
} as const;

export function Settings({ open, onOpenChange, onSettingsUpdate }: SettingsProps) {
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [defaultProvider, setDefaultProvider] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [openAiLikeBaseUrl, setOpenAiLikeBaseUrl] = useState('');

  // Load settings when component mounts or modal opens
  useEffect(() => {
    if (open) {
      // Load API keys
      const savedKeys: ApiKeys = {};
      Object.values(API_PROVIDERS).forEach(key => {
        const value = localStorage.getItem(key);
        if (value) savedKeys[key] = value;

        // Load base URLs
      const ollamaBaseUrlSaved = localStorage.getItem('OLLAMA_API_BASE_URL');
      if (ollamaBaseUrlSaved) setOllamaBaseUrl(ollamaBaseUrlSaved);

      const openAiLikeBaseUrlSaved = localStorage.getItem('OPENAI_LIKE_API_BASE_URL');
      if (openAiLikeBaseUrlSaved) setOpenAiLikeBaseUrl(openAiLikeBaseUrlSaved);
    });
      setApiKeys(savedKeys);

      // Load default provider/model
      const savedProvider = localStorage.getItem('DEFAULT_PROVIDER');
      if (savedProvider) setDefaultProvider(savedProvider);

      const savedModel = localStorage.getItem('DEFAULT_MODEL');
      if (savedModel) setDefaultModel(savedModel);
    }
  }, [open]);

  const handleSave = () => {
    // Save API keys
    Object.entries(apiKeys).forEach(([key, value]) => {
      if (value) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    });

    // Save OpenAI-like base URL
    if (openAiLikeBaseUrl) {
      localStorage.setItem('OPENAI_LIKE_API_BASE_URL', openAiLikeBaseUrl);
    } else {
      localStorage.removeItem('OPENAI_LIKE_API_BASE_URL');
    }

    // Save Ollama base URL, ensuring it doesn't end with /api
    if (ollamaBaseUrl) {
      const cleanBaseUrl = ollamaBaseUrl.endsWith('/api') 
        ? ollamaBaseUrl.slice(0, -4) 
        : ollamaBaseUrl;
      localStorage.setItem('OLLAMA_API_BASE_URL', cleanBaseUrl);
    } else {
      localStorage.removeItem('OLLAMA_API_BASE_URL');
    }

    // Save default provider/model
    if (defaultProvider) {
      localStorage.setItem('DEFAULT_PROVIDER', defaultProvider);
    } else {
      localStorage.removeItem('DEFAULT_PROVIDER');
    }

    if (defaultModel) {
      localStorage.setItem('DEFAULT_MODEL', defaultModel);
    } else {
      localStorage.removeItem('DEFAULT_MODEL');
    }

    // Notify parent component to update settings and close modal immediately
    onSettingsUpdate?.();
    onOpenChange(false);

    // Update model list if base URLs have changed
    initializeModelList().catch(console.error);
  };

  const clearApiKeys = () => {
    // Clear all API keys from localStorage and state
    Object.values(API_PROVIDERS).forEach(key => {
      localStorage.removeItem(key);
    });
    localStorage.removeItem('OPENAI_LIKE_API_BASE_URL');
    setApiKeys({});
    setOpenAiLikeBaseUrl('');
  };

  const handleClearKey = (key: string) => {
    setApiKeys((prevKeys) => {
      const newKeys = { ...prevKeys };
      delete newKeys[key];
      return newKeys;
    });
    localStorage.removeItem(key);
  };

  const handleClearBaseUrl = (key: string, setBaseUrl: React.Dispatch<React.SetStateAction<string>>) => {
    setBaseUrl('');
    localStorage.removeItem(key);
  };

  const clearDefaults = () => {
    localStorage.removeItem('DEFAULT_PROVIDER');
    localStorage.removeItem('DEFAULT_MODEL');
    setDefaultProvider('');
    setDefaultModel('');
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog className="flex flex-col max-h-[85vh]">
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription className="px-5 py-4 space-y-4">Configure your API keys and default settings.</DialogDescription>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            <div>
              <button
                onClick={() => setIsApiKeysOpen(!isApiKeysOpen)}
                className="flex items-center justify-between w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
              >
                <span>API Keys</span>
                <div className={classNames("i-ph:caret-down transition-transform", {
                  "rotate-180": isApiKeysOpen
                })}/>
              </button>
              {isApiKeysOpen && (
                <div className="mt-2 space-y-2">
                  {Object.entries(API_PROVIDERS).map(([provider, key]) => {
                    if (provider === 'OpenAILike') {
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-sm text-bolt-elements-textSecondary">OpenAI-like Base URL</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={openAiLikeBaseUrl}
                                onChange={(e) => setOpenAiLikeBaseUrl(e.target.value)}
                                className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
                                placeholder="Enter OpenAI-like Base URL"
                              />
                              <button
                                onClick={() => handleClearBaseUrl('OPENAI_LIKE_API_BASE_URL', setOpenAiLikeBaseUrl)}
                                className="p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-sm text-bolt-elements-textSecondary">OpenAI-like API Key</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="password"
                                value={apiKeys[key] || ''}
                                onChange={(e) => setApiKeys({...apiKeys, [key]: e.target.value})}
                                className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
                                placeholder="Enter OpenAI-like API Key"
                              />
                              <button
                                onClick={() => handleClearKey(key)}
                                className="p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (provider === 'Ollama') {
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-sm text-bolt-elements-textSecondary">Ollama Base URL</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={ollamaBaseUrl}
                              onChange={(e) => setOllamaBaseUrl(e.target.value)}
                              className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
                              placeholder="Enter Ollama Base URL (without /api)"
                            />
                            <button
                              onClick={() => handleClearBaseUrl('OLLAMA_API_BASE_URL', setOllamaBaseUrl)}
                              className="p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-sm text-bolt-elements-textSecondary">{provider}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type='password'
                            value={apiKeys[key] || ''}
                            onChange={(e) => setApiKeys({...apiKeys, [key]: e.target.value})}
                            className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
                            placeholder={provider === 'Ollama' ? 'Enter Ollama Base URL' : `Enter ${provider} API Key`}
                          />
                          <button
                            onClick={() => handleClearKey(key)}
                            className="p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={clearApiKeys}
                    className="mt-4 w-full p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
                  >
                    Clear All API Keys
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-bolt-elements-textSecondary">Default Provider</label>
              <select
                value={defaultProvider}
                onChange={(e) => {
                  setDefaultProvider(e.target.value);
                  setDefaultModel(''); // Reset model when provider changes
                }}
                className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
              >
                <option value="">Select Provider</option>
                {Object.keys(API_PROVIDERS).map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-bolt-elements-textSecondary">Default Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full p-2 rounded-lg border border-bolt-elements-borderColor hover:bg-gray-600 bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none"
              >
                <option value="">Select Model</option>
                {MODEL_LIST.filter(model => model.provider === defaultProvider).map(model => (
                  <option key={model.name} value={model.name}>{model.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={clearDefaults}
              className="mt-4 w-full p-2 text-red-500 border border-red-500 rounded bg-red-500/10 hover:bg-bolt-elements-prompt-background"
            >
              Clear Defaults
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 mt-auto border-t border-bolt-elements-borderColor">
          <DialogButton 
            type="primary" 
            onClick={() => onOpenChange(false)}
            className="bg-transparent border border-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-background/10"
          >
            Cancel
          </DialogButton>
          <DialogButton 
            type="primary" 
            onClick={handleSave}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            Save
          </DialogButton>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
