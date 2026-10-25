<script lang="ts">
	import { Dialog as SheetPrimitive } from '../../vendor/bits-ui.js';

	let { open = $bindable(false), ...restProps }: SheetPrimitive.RootProps = $props();
</script>

<SheetPrimitive.Root bind:open {...restProps} />
