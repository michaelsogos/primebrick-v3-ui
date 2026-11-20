<script lang="ts">
  /**
   * SafeHtml — the ONLY sanctioned `{@html}` boundary.
   *
   * Raw HTML reaches the DOM exclusively through this component: the `html`
   * prop is DOMPurify-sanitized in `$derived` before render, so call sites
   * cannot forget the sanitize step — it is enforced by construction, not
   * by an eslint-disable comment.
   *
   * Profiles:
   * - `strict` (default) — plain DOMPurify defaults. Chat/AI/markdown prose.
   * - `docs` — the KB/doc profile: allows `data-docpath`/`data-docrepo`/
   *   `data-docanchor`/`target` attrs and `<figure>` (docs-render pipeline).
   */
  import DOMPurify, { type Config } from 'dompurify';

  type Props = {
    /** Raw, UNSANITIZED html — cleaned here; upstream callers never pre-clean. */
    html: string;
    /** Sanitize profile. */
    profile?: 'strict' | 'docs';
  };

  let { html, profile = 'strict' }: Props = $props();

  const PROFILES: Record<NonNullable<Props['profile']>, Config> = {
    strict: {},
    docs: {
      ADD_ATTR: ['data-docpath', 'data-docrepo', 'data-docanchor', 'target'],
      ADD_TAGS: ['figure'],
    },
  };

  const clean = $derived(DOMPurify.sanitize(html, PROFILES[profile]));
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- SafeHtml IS the governed boundary: `html` is DOMPurify-sanitized in $derived above; a direct {@html} anywhere else is a violation. -->
{@html clean}
