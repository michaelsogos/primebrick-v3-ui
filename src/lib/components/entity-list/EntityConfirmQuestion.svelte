<script lang="ts">
  import { getT } from '../../bridges.js';
  import { getEntitiesNsContext } from './entities-ns-context.js';

  /**
   * Standard body copy for entity delete/restore dialogs — renders the
   * convention-built question with styled placeholders:
   *   "Sei sicuro di voler eliminare <strong>il Modello AI</strong>
   *    <em class="font-semibold">"Qwen2.5…"</em>?"
   * `action="delete"` also renders the undo-warning second line.
   */
  interface EntityConfirmQuestionProps {
    action: 'delete' | 'restore';
    entity: string;
    /** Entity-label i18n namespace from `meta.entities_ns` — defaults to the table context / `system`. */
    entities_ns?: string;
    recordName?: string;
    /** Message template override from `meta.actions[op].confirm_key` —
     *  when set it REPLACES the whole convention-built question (incl.
     *  the "cannot be undone" tail) — e.g. soft-delete-as-disable asks
     *  "disattivare" and notes the action is reversible. */
    confirm_key?: string;
  }

  let { action, entity, entities_ns, recordName, confirm_key }: EntityConfirmQuestionProps = $props();
  const t = getT();
  const ns = $derived(entities_ns ?? getEntitiesNsContext());

  const ENTITY_MARK = 'E';
  const NAME_MARK = 'N';

  let singularKey = $derived(`${ns}.entities.${entity}.singular`);
  let definiteKey = $derived(`${ns}.entities.${entity}.singular_definite`);
  let entityName = $derived($t(singularKey));
  // Definite form (with article, e.g. "il Modello AI") — falls back to the
  // bare singular when the key is missing ($t echoes the key).
  let entityDefinite = $derived.by(() => {
    const v = $t(definiteKey);
    return v === definiteKey ? entityName : v;
  });

  let segments = $derived.by(() => {
    const raw = $t(confirm_key ?? `app.common.${action}EntityConfirm`, {
      entity: ENTITY_MARK,
      name: NAME_MARK
    });
    const [pre, rest = ''] = raw.split(ENTITY_MARK);
    const [mid, post = ''] = rest.split(NAME_MARK);
    return { pre, mid, post };
  });
</script>

{segments.pre}<span class="font-semibold">{entityDefinite}</span>{segments.mid}{#if recordName}&nbsp;<em class="font-semibold">"{recordName}"</em>{/if}{segments.post}{#if action === 'delete' && !confirm_key}<span class="mt-1 block">{$t('app.common.deleteConfirm')}</span>{/if}
