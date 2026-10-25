<script lang="ts">
  import { getT } from '../../bridges.js';
  import { cn } from '../../utils/index.js';
  import { Button } from '../button/index.js';
  import { ButtonGroup } from '../button-group/index.js';
  import { ListCheck, ListX, TextAlignJustify } from '../../vendor/lucide.js';

  let {
    deletionFilterMode,
    onDeletionFilterModeChange
  }: {
    deletionFilterMode: 'non_deleted' | 'deleted' | 'all';
    onDeletionFilterModeChange: (mode: 'non_deleted' | 'deleted' | 'all') => void;
  } = $props();

  const t = getT();

  const modes = [
    { key: 'non_deleted', icon: ListCheck, titleKey: 'system.entities.list.deletionFilter.nonDeleted' },
    { key: 'deleted', icon: ListX, titleKey: 'system.entities.list.deletionFilter.deleted' },
    { key: 'all', icon: TextAlignJustify, titleKey: 'system.entities.list.deletionFilter.all' },
  ] as const;
</script>

<ButtonGroup segmented aria-label={$t('system.entities.list.deletionFilter.groupAria')}>
  {#each modes as mode (mode.key)}
    {@const active = deletionFilterMode === mode.key}
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      class={cn(active && 'bg-foreground/10 text-foreground shadow-xs')}
      aria-pressed={active}
      title={$t(mode.titleKey)}
      onclick={() => onDeletionFilterModeChange(mode.key)}
    >
      <mode.icon class="size-4" />
    </Button>
  {/each}
</ButtonGroup>
