import { describe, expect, test } from "bun:test";
import { DEFAULT_MODEL_PER_PROVIDER, PROVIDER_DESCRIPTORS } from "@oh-my-pi/pi-catalog/provider-models/descriptors";
import { ionetModelManagerOptions } from "@oh-my-pi/pi-catalog/provider-models/openai-compat";

describe("IO Intelligence built-in provider", () => {
	test("registers catalog descriptor with keyless runtime discovery", () => {
		const descriptor = PROVIDER_DESCRIPTORS.find(item => item.providerId === "ionet");
		expect(descriptor).toBeDefined();
		expect(descriptor?.defaultModel).toBe("openai/gpt-oss-20b");
		// No `discovery` node on purpose (charm-hyper's reasoning): the catalog
		// drifts day to day, so generate-models.ts enrollment is declined and
		// discovery stays runtime-only. The provider is reachable before login
		// via the descriptor's top-level allowUnauthenticated flag.
		expect(descriptor?.allowUnauthenticated).toBe(true);
		expect(descriptor?.catalogDiscovery).toBeUndefined();
		expect(descriptor?.dynamicModelsAuthoritative).toBe(true);
		expect(DEFAULT_MODEL_PER_PROVIDER.ionet).toBe("openai/gpt-oss-20b");
	});

	test("maps IO Intelligence model catalog metadata from the public OpenAI-compatible endpoint", async () => {
		const requests: string[] = [];
		const fetchMock = async (input: string | URL | Request): Promise<Response> => {
			requests.push(input.toString());
			return Response.json({
				data: [
					{
						id: "openai/gpt-oss-20b",
						name: "OpenAI: gpt-oss-20b",
						supports_reasoning: true,
						supports_tools: true,
						input_modalities: ["text"],
						context_window: 64000,
						max_tokens: null,
						input_token_price: 1.8e-7,
						output_token_price: 6.8e-7,
						cache_read_token_price: 9e-8,
					},
					{
						id: "zai-org/GLM-5.3-Flash",
						name: "Z.AI: GLM-5.3-Flash",
						supports_reasoning: true,
						supports_tools: true,
						input_modalities: ["text", "image"],
						context_window: 262144,
						max_tokens: 131072,
						input_token_price: 2.1e-7,
						output_token_price: 7e-7,
						cache_read_token_price: 1.1e-7,
					},
					{
						id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
						name: "Meta: Llama 4 Maverick 17B 128E FP8",
						supports_reasoning: false,
						supports_tools: false,
						input_modalities: ["text", "image"],
						context_window: 430000,
						max_tokens: null,
						input_token_price: null,
						output_token_price: null,
						cache_read_token_price: null,
					},
				],
			});
		};

		const options = ionetModelManagerOptions({ fetch: fetchMock });
		const models = await options.fetchDynamicModels?.();
		const oss = models?.find(item => item.id === "openai/gpt-oss-20b");
		const flash = models?.find(item => item.id === "zai-org/GLM-5.3-Flash");
		const maverick = models?.find(item => item.id === "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8");

		expect(requests).toEqual(["https://api.intelligence.io.solutions/api/v1/models"]);
		expect(options.dynamicModelsAuthoritative).toBe(true);
		expect(models?.map(item => item.id)).toEqual([
			"meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
			"openai/gpt-oss-20b",
			"zai-org/GLM-5.3-Flash",
		]);
		expect(oss?.provider).toBe("ionet");
		expect(oss?.baseUrl).toBe("https://api.intelligence.io.solutions/api/v1");
		expect(oss?.name).toBe("OpenAI: gpt-oss-20b");
		expect(oss?.reasoning).toBe(true);
		expect(oss?.supportsTools).toBe(true);
		expect(oss?.input).toEqual(["text"]);
		expect(oss?.cost).toEqual({ input: 0.18, output: 0.68, cacheRead: 0.09, cacheWrite: 0 });
		expect(oss?.contextWindow).toBe(64000);
		expect(oss?.maxTokens).toBeNull();

		// Vision-capable rows declare image input.
		expect(flash?.input).toEqual(["text", "image"]);
		expect(flash?.cost).toEqual({ input: 0.21, output: 0.7, cacheRead: 0.11, cacheWrite: 0 });
		expect(flash?.maxTokens).toBe(131072);

		// Null/absent optional fields fall back to defaults instead of NaN.
		expect(maverick?.reasoning).toBe(false);
		expect(maverick?.supportsTools).toBe(false);
		expect(maverick?.input).toEqual(["text", "image"]);
		expect(maverick?.maxTokens).toBeNull();
		expect(maverick?.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
	});
});
