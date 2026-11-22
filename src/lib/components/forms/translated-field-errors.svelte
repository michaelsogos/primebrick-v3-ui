<script lang="ts">
	import * as FormPrimitive from "formsnap";
	import { cn, type WithoutChild } from "../../utils/index.js";
	import { getT } from "../../bridges.js";

import { translateFieldError } from '../../utils/translate-field-error.js';
	const t = getT();

	let {
		ref = $bindable(null),
		class: className,
		errorClasses,
		children: childrenProp,
		...restProps
	}: WithoutChild<FormPrimitive.FieldErrorsProps> & {
		errorClasses?: string | undefined | null;
	} = $props();

	function translateError(error: string): string {
		return translateFieldError(error, $t);
	}
</script>

<FormPrimitive.FieldErrors
	bind:ref
	class={cn("text-destructive text-xs font-medium", className)}
	{...restProps}
>
	{#snippet children({ errors, errorProps })}
		{#if childrenProp}
			{@render childrenProp({ errors, errorProps })}
		{:else}
			{#each [...new Set(errors)] as error (error)}
				<div {...errorProps} class={cn(errorClasses)}>{translateError(error)}</div>
			{/each}
		{/if}
	{/snippet}
</FormPrimitive.FieldErrors>
