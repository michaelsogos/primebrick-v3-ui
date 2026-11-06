<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /**
   * exec-start — the semantic "execution start" glyph: a filled play
   * triangle whose gradient is DERIVED from `currentColor` (light →
   * solid of the same hue). Zero color literals — the hue is whatever
   * `ActionColor` the item wears, so icon and label can never diverge.
   * See `ExecStop.svelte` for the icon↔color doctrine.
   */
  let {
    size = 16,
    class: className,
    style,
  }: {
    size?: number;
    class?: string;
    style?: string;
  } = $props();

  const gid = `exec-start-grad-${seq++}`;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class={className}
  {style}
  aria-hidden="true"
>
  <defs>
    <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" style="stop-color: color-mix(in oklab, currentColor 62%, white)" />
      <stop offset="100%" style="stop-color: currentColor" />
    </linearGradient>
  </defs>
  <path
    d="M7.5 4.8c0-1.5 1.65-2.4 2.9-1.55l10 6.2c1.15.72 1.15 2.38 0 3.1l-10 6.2c-1.25.85-2.9-.05-2.9-1.55V4.8Z"
    fill={`url(#${gid})`}
  />
</svg>
