<script lang="ts">
  /**
   * AiTypingDots — the canonical three-dot "AI is generating" indicator used
   * by assistant surfaces (chat streaming bubble, translation suggestion
   * previews). It owns its keyframes so the animation travels with the
   * component — surfaces compose it next to a localized status label
   * (`*.thinking` / `*.generating`), never re-implement the dots locally.
   *
   * Decorative: the adjacent status label carries the meaning.
   */
  import { cn } from '../../utils/index.js';

  interface Props {
    class?: string;
    [key: string]: unknown;
  }

  let { class: className, ...restProps }: Props = $props();
</script>

<span class={cn('ai-typing-dots', className)} aria-hidden="true" {...restProps}>
  <span></span>
  <span></span>
  <span></span>
</span>

<style>
  .ai-typing-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .ai-typing-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: ai-dot-bounce 1.4s infinite ease-in-out both;
  }
  .ai-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
  .ai-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
  .ai-typing-dots span:nth-child(3) { animation-delay: 0s; }
  @keyframes ai-dot-bounce {
    0%, 80%, 100% { opacity: 0.4; transform: scale(0.6); }
    40% { opacity: 1; transform: scale(1); }
  }
</style>
