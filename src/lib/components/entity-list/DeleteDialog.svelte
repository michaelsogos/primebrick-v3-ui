<script lang="ts">
  import { getT } from '../../bridges.js';
  import type { ActionColor } from '@primebrick/core';
  import { Button } from '../button/index.js';
  import * as Dialog from '../dialog/index.js';
  import BorderedDialog from '../dialog-bordered.svelte';
  import EntityConfirmQuestion from './EntityConfirmQuestion.svelte';
  import { getEntitiesNsContext } from './entities-ns-context.js';
  import { actionColorButtonVariant } from '../../icons/semantic-icons.js';

  interface DeleteDialogProps {
    /**
     * Entity translation key (e.g. 'ai_model', 'customer'). The title is
     * auto-built as `<action label> <entities_ns>.entities.{entity}.singular`
     * — NEVER pass a custom title.
     */
    entity: string;
    /** Entity-label i18n namespace from `meta.entities_ns` — defaults to the table context / `system`. */
    entities_ns?: string;
    /** Optional record name shown under the description (e.g. model.name). */
    recordName?: string;
    /** `meta.actions["delete.single"]` chrome — meta-driven copy: label
     *  (title verb + confirm button), `confirm_key` (message template),
     *  `busy_key` (in-flight label), `color` (accent bar + button). */
    chrome?: {
      label_key?: string;
      confirm_key?: string;
      busy_key?: string;
      color?: ActionColor;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    entity,
    entities_ns,
    recordName,
    chrome,
    open = $bindable(),
    onOpenChange,
    isDeleting,
    onConfirm,
    onCancel
  }: DeleteDialogProps = $props();

  const t = getT();
  const ns = $derived(entities_ns ?? getEntitiesNsContext());
  let entityName = $derived($t(`${ns}.entities.${entity}.singular`));
  let actionLabel = $derived($t(chrome?.label_key ?? 'app.common.delete'));
  let severity = $derived(chrome?.color ?? 'destructive');
</script>

<BorderedDialog bind:open={open} {onOpenChange} {severity} class="sm:max-w-md" showCloseButton={false}>
  <Dialog.Header class="pb-4">
    <Dialog.Title>
      {actionLabel} {entityName}
    </Dialog.Title>
    <Dialog.Description>
      <EntityConfirmQuestion action="delete" {entity} entities_ns={ns} {recordName} confirm_key={chrome?.confirm_key} />
    </Dialog.Description>
  </Dialog.Header>
  <Dialog.Footer class="gap-2 sm:space-x-0">
    <Button
      variant="secondary-outline"
      class="hover:scale-105 transition-all"
      onclick={onCancel}
      disabled={isDeleting}
    >
      {$t('app.common.cancel')}
    </Button>
    <Button
      variant={actionColorButtonVariant(severity)}
      class="hover:scale-105 transition-all"
      onclick={onConfirm}
      disabled={isDeleting}
    >
      {#if isDeleting}
        {$t(chrome?.busy_key ?? 'app.common.deleting')}
      {:else}
        {actionLabel}
      {/if}
    </Button>
  </Dialog.Footer>
</BorderedDialog>
