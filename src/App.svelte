<script>
	export let name;
	import ImageCollection from './ImageCollection.svelte';
	import { activeCollection } from './stores.js';
	let uid = 1;
	let collection1 = [
		{ src: 'images/IMG_0003.JPG' },
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0005.JPG' },
		{ src: 'images/IMG_0007.JPG' },
		{ src: 'images/IMG_0008.JPG' },
		{ src: 'images/IMG_0009.JPG' },
		{ src: 'images/IMG_0010.JPG' }
	];
	let collection2 = [
		{ src: 'images/IMG_0007.JPG' },
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0005.JPG' },
		{ src: 'images/IMG_0007.JPG' },
		{ src: 'images/IMG_0008.JPG' },
		{ src: 'images/IMG_0009.JPG' },
		{ src: 'images/IMG_0010.JPG' }
	];
	let collection3 = [
		{ src: 'images/IMG_0009.JPG' },
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0005.JPG' },
		{ src: 'images/IMG_0007.JPG' },
		{ src: 'images/IMG_0008.JPG' },
		{ src: 'images/IMG_0009.JPG' },
		{ src: 'images/IMG_0010.JPG' }
	];
	let collection4 = [
		{ src: 'images/IMG_0010.JPG' },
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0005.JPG' },
		{ src: 'images/IMG_0007.JPG' },
		{ src: 'images/IMG_0008.JPG' },
		{ src: 'images/IMG_0010.JPG' }
	];
	let collection5 = [
		{ src: 'images/IMG_0008.JPG' },
		{ src: 'images/IMG_0004.JPG' }
	];
	let collection6 = [
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0004.JPG' },
		{ src: 'images/IMG_0005.JPG' }
	];

	function handleExpand(event) {
		console.log(event.detail.active);
		activeCollection.update(n => event.detail.active);
	}
</script>

<style>
	.container{
		display: flex;
		flex: 1 auto;
		flex-basis: 15%;
		flex-flow: row wrap;
		align-content: flex-start;
		justify-content: center;
		height: 100%;
		width: auto;
		margin: 1em;
	}
	.container :global(.collection) {
		width: calc(25em - 3em);
		margin: 1em 1.5em 3em 1.5em;
		height: 15em;
	}
</style>

<div class="container">
	<ImageCollection on:expand={handleExpand} imagecollection={collection1} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection2} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection3} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection4} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection5} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection6} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection4} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection1} id="{uid++}" />
</div>

