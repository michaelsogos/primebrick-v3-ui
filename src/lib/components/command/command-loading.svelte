<script lang="ts">
	import { Command as CommandPrimitive } from '../../vendor/bits-ui.js';

	let { ref = $bindable(null), ...restProps }: CommandPrimitive.LoadingProps = $props();
</script>

<CommandPrimitive.Loading bind:ref {...restProps} />
