<script lang="ts">
  /**
   * `StateHero` — the canonical full-area watermark hero for state screens:
   * loading, load-failed, empty, warning and destructive outcomes.
   *
   * ONE anatomy for every "large icon + message" state: a `size-80` icon
   * (20 = `size-20` Tailwind) colored by severity, an optional looping
   * animation, a medium-weight title and a muted hint — centered in the
   * region (`min-h-56`), never boxed.
   *
   * Texts are i18n keys translated through the ui i18n bridge (`getT()`)
   * — pass `params` for interpolation (e.g. `{entity_singular}`).
   */
  import { getT } from '../../bridges.js';
  import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
  import { cn } from '../../utils/index.js';

  let {
    severity = 'info',
    icon,
    animation = 'pulse',
    title_key,
    hint_key,
    params,
    test_id,
  }: {
    /** Drives icon + title color: 'info' (primary icon, muted title),
     *  'warning' (amber), 'destructive' (destructive). */
    severity?: 'info' | 'warning' | 'destructive';
    /** DynamicIcon name — the metadata-driven icon vocabulary. */
    icon: string;
    /** Icon loop: 'pulse' (float+zoom+opacity — loading/boot states),
     *  'flip' (rotateY coin-flip), 'none'. */
    animation?: 'pulse' | 'flip' | 'none';
    title_key: string;
    hint_key?: string;
    /** i18n interpolation params (e.g. `{ entity_singular: 'user' }`). */
    params?: Record<string, unknown>;
    test_id?: string;
  } = $props();

  const t = getT();

  const SEVERITY_ICON: Record<string, string> = {
    info: 'text-primary',
    warning: 'text-amber-500',
    destructive: 'text-destructive',
  };
  const SEVERITY_TITLE: Record<string, string> = {
    info: 'text-muted-foreground',
    warning: 'text-amber-600 dark:text-amber-400',
    destructive: 'text-destructive',
  };
</script>

<div
  class="grid min-h-56 place-items-center p-3"
  data-testid={test_id ?? 'state-hero'}
  data-severity={severity}
>
  <div class="relative flex flex-col items-center gap-2 text-center">
    <div
      class={animation === 'flip'
        ? 'pb-hero-flip'
        : animation === 'pulse'
          ? 'pb-hero-pulse'
          : undefined}
    >
      <DynamicIcon name={icon} size={80} class={SEVERITY_ICON[severity]} />
    </div>
    <div class={cn('text-sm font-medium', SEVERITY_TITLE[severity])}>
      {$t(title_key, params)}
    </div>
    {#if hint_key}
      <div class="text-xs text-muted-foreground">
        {$t(hint_key, params)}
      </div>
    {/if}
  </div>
</div>

<style>
  /* 'pulse' — the canonical float+zoom+opacity loop (LoadingWatermark
     anatomy): gentle vertical drift, slight zoom, opacity breathing. */
  .pb-hero-pulse {
    transform-origin: center;
    animation: pb-hero-pulse 2s ease-in-out infinite;
  }

  @keyframes pb-hero-pulse {
    0%,
    100% {
      opacity: 0.55;
      transform: translateY(0) scale(1);
    }
    50% {
      opacity: 0.85;
      transform: translateY(-6px) scale(1.06);
    }
  }

  /* 'flip' — continuous spin on the vertical axis (rotateY, left-to-right
     coin flip) combined with a zoom in-out pulse. */
  .pb-hero-flip {
    transform-origin: center;
    transform-style: preserve-3d;
    animation: pb-hero-flip 1.2s ease-in-out infinite;
  }

  @keyframes pb-hero-flip {
    0% {
      opacity: 0.75;
      transform: rotateY(0deg) scale(1);
    }
    50% {
      opacity: 1;
      transform: rotateY(180deg) scale(1.15);
    }
    100% {
      opacity: 0.75;
      transform: rotateY(360deg) scale(1);
    }
  }
</style>
