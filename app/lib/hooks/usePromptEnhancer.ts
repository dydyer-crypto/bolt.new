import { useState } from "react";
import { createScopedLogger } from "~/utils/logger";

const logger = createScopedLogger("usePromptEnhancement");

export function usePromptEnhancer() {
	const [enhancingPrompt, setEnhancingPrompt] = useState(false);
	const [promptEnhanced, setPromptEnhanced] = useState(false);

	const resetEnhancer = () => {
		setEnhancingPrompt(false);
		setPromptEnhanced(false);
	};
	type EnhancePrompt = {
		input: string;
		model: string;
		provider: string;
		api_key: string;
	};

	const enhancePrompt = async (
		{ input, model, provider, api_key }: EnhancePrompt,
		setInput: (value: string) => void,
	) => {
		setEnhancingPrompt(true);
		setPromptEnhanced(false);

		const response = await fetch("/api/enhancer", {
			method: "POST",
			body: JSON.stringify({
				message: input,
				model,
				provider,
				api_key,
			}),
		});

		const reader = response.body?.getReader();

		const originalInput = input;

		if (reader) {
			const decoder = new TextDecoder();

			let _input = "";
			let _error;

			try {
				setInput("");

				while (true) {
					const { value, done } = await reader.read();

					if (done) {
						break;
					}

					_input += decoder.decode(value);

					logger.trace("Set input", _input);

					setInput(_input);
				}
			} catch (error) {
				_error = error;
				setInput(originalInput);
			} finally {
				if (_error) {
					logger.error(_error);
				}

				setEnhancingPrompt(false);
				setPromptEnhanced(true);

				setTimeout(() => {
					setInput(_input);
				});
			}
		}
	};

	return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
