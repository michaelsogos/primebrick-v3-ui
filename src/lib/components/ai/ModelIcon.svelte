<script lang="ts">
  /**
   * ModelIcon — picks the right brand icon based on the model family.
   *
   * Model families are detected from the model_id (case-insensitive):
   *   - qwen                -> QwenIcon
   *   - llama               -> MetaIcon
   *   - phi                 -> MicrosoftIcon
   *   - nvidia / nemotron   -> NvidiaIcon
   *   - granite             -> IbmIcon
   *   - gemma               -> GemmaIcon
   *   - deepseek            -> DeepSeekIcon
   *   - smollm              -> HuggingFaceIcon
   *   - gpt / openai        -> OpenAIIcon
   *   - anything else       -> Cpu (fallback)
   *
   * Usage: <ModelIcon model_id={model.model_id} class="size-5" />
   */
  import QwenIcon from '../ai/QwenIcon.svelte';
  import MetaIcon from '../ai/MetaIcon.svelte';
  import MicrosoftIcon from '../ai/MicrosoftIcon.svelte';
  import NvidiaIcon from '../ai/NvidiaIcon.svelte';
  import IbmIcon from '../ai/IbmIcon.svelte';
  import GemmaIcon from '../ai/GemmaIcon.svelte';
  import DeepSeekIcon from '../ai/DeepSeekIcon.svelte';
  import HuggingFaceIcon from '../ai/HuggingFaceIcon.svelte';
  import OpenAIIcon from '../ai/OpenAIIcon.svelte';
  import { Cpu } from '../../vendor/lucide.js';

  let {
    model_id,
    class: className = 'size-4',
  }: {
    model_id: string;
    class?: string;
  } = $props();

  const family = $derived.by(() => {
    const id = model_id ?? '';
    if (/qwen/i.test(id)) return 'qwen';
    if (/llama/i.test(id)) return 'meta';
    if (/phi/i.test(id)) return 'microsoft';
    if (/nvidia|nemotron/i.test(id)) return 'nvidia';
    if (/granite/i.test(id)) return 'ibm';
    if (/gemma/i.test(id)) return 'gemma';
    if (/deepseek/i.test(id)) return 'deepseek';
    if (/smollm/i.test(id)) return 'huggingface';
    if (/openai|gpt/i.test(id)) return 'openai';
    return 'generic';
  });
</script>

{#if family === 'qwen'}
  <QwenIcon class={className} />
{:else if family === 'meta'}
  <MetaIcon class={className} />
{:else if family === 'microsoft'}
  <MicrosoftIcon class={className} />
{:else if family === 'nvidia'}
  <NvidiaIcon class={className} />
{:else if family === 'ibm'}
  <IbmIcon class={className} />
{:else if family === 'gemma'}
  <GemmaIcon class={className} />
{:else if family === 'deepseek'}
  <DeepSeekIcon class={className} />
{:else if family === 'huggingface'}
  <HuggingFaceIcon class={className} />
{:else if family === 'openai'}
  <OpenAIIcon class={className} />
{:else}
  <Cpu class={className} />
{/if}
