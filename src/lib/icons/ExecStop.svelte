<script lang="ts" module>
  // SSR/hydration-safe gradient id sequence — mirrors DynamicIcon's
  // `nextMaskId` (same instantiation order → same ids).
  let seq = 0;
</script>

<script lang="ts">
  /**
   * exec-stop — the semantic "execution stop" glyph: a filled rounded
   * square whose gradient is DERIVED from `currentColor` (light → solid
   * of the same hue). The file contains zero color literals: the hue is
   * whatever `ActionColor` the menu item wears, so icon and label are the
   * same resolved color BY CONSTRUCTION — they cannot drift, even by
   * mistake. `SEMANTIC_ICON_COLORS` still pins the icon's semantic bound
   * (destructive) and `validateActionChrome` rejects divergent pairs.
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

  const gid = `exec-stop-grad-${seq++}`;
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
  <rect x="3" y="3" width="18" height="18" rx="5" fill={`url(#${gid})`} />
</svg>
