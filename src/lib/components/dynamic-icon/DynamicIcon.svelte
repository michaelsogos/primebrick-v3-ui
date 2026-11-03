<script lang="ts" module>
  // Pre-register all lucide icon modules at build time so Vite can resolve them.
  // `import.meta.glob` produces a map of path → lazy import function that Vite
  // can statically analyze, unlike the previous dynamic `import()` with template
  // literals which Vite could not resolve.
  // The glob is relative to THIS FILE so it resolves into @primebrick/ui's own
  // node_modules in every realm — the FE bundle AND vendored remote chunks
  // (an app-root `/node_modules/...` path would only exist in the FE build).
  // The package root sits at different relative depths depending on the
  // consuming layout: `dist/components/dynamic-icon/` is 3 levels below it,
  // `src/lib/components/dynamic-icon/` is 4. Glob BOTH prefixes and key the
  // map by icon basename — exactly one pattern matches in each layout.
  const iconModules = Object.fromEntries(
    Object.entries({
      ...import.meta.glob('../../../node_modules/@lucide/svelte/dist/icons/*.svelte'),
      ...import.meta.glob('../../../../node_modules/@lucide/svelte/dist/icons/*.svelte'),
    }).map(([path, loader]) => [path.split('/').pop()!.replace(/\.svelte$/, ''), loader]),
  );

  // Raw icon sources (?raw) — composed icons need the lucide `iconData`
  // node tuples to render base + overlay inside ONE svg (a real <mask>
  // must live in the same svg as what it masks).
  const iconRawModules = Object.fromEntries(
    Object.entries({
      ...import.meta.glob('../../../node_modules/@lucide/svelte/dist/icons/*.svelte', {
        query: '?raw',
        import: 'default',
      }),
      ...import.meta.glob('../../../../node_modules/@lucide/svelte/dist/icons/*.svelte', {
        query: '?raw',
        import: 'default',
      }),
    }).map(([path, loader]) => [path.split('/').pop()!.replace(/\.svelte$/, ''), loader]),
  );

  // Cache already-resolved icon components so repeated renders of the same
  // icon name don't re-trigger the dynamic import.
  const iconCache = new Map<string, Promise<any>>();
  const nodesCache = new Map<string, Promise<any>>();

  async function loadIcon(name: string): Promise<any> {
    let mod = iconCache.get(name);
    if (!mod) {
      const loader = iconModules[name];
      if (!loader) {
        console.warn(`[DynamicIcon] Icon "${name}" not found in @lucide/svelte/dist/icons/`);
        return null;
      }
      const loaded = loader().then((m: any) => m.default);
      iconCache.set(name, loaded);
      mod = loaded;
    }
    return mod;
  }

  async function loadIconNodes(name: string): Promise<any> {
    let mod = nodesCache.get(name);
    if (!mod) {
      const loader = iconRawModules[name] as (() => Promise<string>) | undefined;
      if (!loader) {
        console.warn(`[DynamicIcon] Icon "${name}" not found in @lucide/svelte/dist/icons/`);
        return null;
      }
      const loaded = loader().then((src: string) => {
        const m = src.match(/iconData = ({.*?});/s);
        // standards-exempt: ext-json — icon-internal spec format, not wire payloads
        return m ? (JSON.parse(m[1]).node as Array<[string, Record<string, string | number>]>) : null;
      });
      nodesCache.set(name, loaded);
      mod = loaded;
    }
    return mod;
  }

  // Deterministic mask ids — module counter keeps SSR and hydration in
  // sync (same instantiation order → same id sequence).
  let maskSeq = 0;
  export function nextMaskId(): string {
    return `dynicon-mask-${maskSeq++}`;
  }
</script>

<script lang="ts">
  import { cn } from '../../utils/index.js';
  import { COMPOSED_ICONS } from '../../icons/composed-icons.js';

  let {
    name,
    size = 16,
    class: className,
    style,
  }: {
    name: string;
    size?: number;
    class?: string;
    /** Inline style — for colors resolved from option data (token → CSS)
     *  where a Tailwind class cannot be generated. */
    style?: string;
  } = $props();

  const composed = $derived(COMPOSED_ICONS[name]);

  let IconComp = $state<any>(null);
  let baseNodes = $state<Array<[string, Record<string, string | number>]> | null>(null);
  let overlayNodes = $state<Array<[string, Record<string, string | number>]> | null>(null);
  let missing = $state(false);
  const maskId = nextMaskId();

  // Load the icon component whenever the name changes. A name that has no
  // lucide module is a declaration bug — it must surface visibly (the icon
  // box shows a "?" marker), not collapse into empty space.
  $effect(() => {
    let cancelled = false;
    missing = false;
    if (composed) {
      IconComp = null;
      baseNodes = null;
      overlayNodes = null;
      loadIconNodes(composed.base).then((n) => { if (!cancelled) baseNodes = n; });
      if (composed.overlay) {
        loadIconNodes(composed.overlay).then((n) => { if (!cancelled) overlayNodes = n; });
      }
      return () => { cancelled = true; };
    }
    loadIcon(name).then((comp) => {
      if (cancelled) return;
      IconComp = comp;
      missing = comp === null;
    });
    return () => { cancelled = true; };
  });
</script>

{#if composed}
  {@const badge = Math.max(Math.round(size * 0.55), 8)}
  {@const overlayShape = composed.overlay_nodes ?? overlayNodes}
  {#if baseNodes && overlayShape}
    <!-- ONE svg: the base glyph is masked by the overlay's fattened
         silhouette (black = knockout), so the overlay reads cleanly on
         ANY surface — no painted halo, no background-colored disc. -->
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      {style}
    >
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <g transform={composed.overlay_transform} stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
            {#each overlayShape as node}
              <svelte:element this={node[0]} {...node[1]} />
            {/each}
          </g>
        </mask>
      </defs>
      <g mask="url(#{maskId})">
        {#each baseNodes as node}
          <svelte:element this={node[0]} {...node[1]} />
        {/each}
      </g>
      <g transform={composed.overlay_transform}>
        {#each overlayShape as node}
          <svelte:element this={node[0]} {...node[1]} />
        {/each}
      </g>
    </svg>
  {:else}
    <!-- Placeholder while the icon nodes load — keeps layout stable -->
    <span style="display:inline-block;width:{size}px;height:{size}px" class={className}></span>
  {/if}
{:else if IconComp}
  <IconComp {size} class={cn(className)} {style} />
{:else if missing}
  <span
    role="img"
    aria-label="Icon not found: {name}"
    title="Icon not found: {name}"
    style="display:inline-flex;width:{size}px;height:{size}px;align-items:center;justify-content:center;font-size:{Math.max(
      size - 4,
      8
    )}px;font-weight:700"
    class={cn('rounded-sm border border-dashed border-destructive text-destructive', className)}>?</span
  >
{:else}
  <!-- Placeholder while the icon chunk loads — keeps layout stable -->
  <span style="display:inline-block;width:{size}px;height:{size}px" class={cn(className)}></span>
{/if}
