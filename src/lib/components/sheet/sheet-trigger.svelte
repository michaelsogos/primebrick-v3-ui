<script lang="ts">
	import { Dialog as SheetPrimitive } from '../../vendor/bits-ui.js';

	let { ref = $bindable(null), ...restProps }: SheetPrimitive.TriggerProps = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...restProps} />
