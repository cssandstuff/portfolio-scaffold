<script>
	export let name;
	import GalleryStacks from './GalleryStacks.svelte';
	import { activeCollection } from './stores.js';

	let uid = 1;
	let y;
	let collection1 = [
		{ src: 'IMG_0003.JPG' },
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0005.JPG' },
		{ src: 'IMG_0007.JPG' },
		{ src: 'IMG_0008.JPG' },
		{ src: 'IMG_0009.JPG' },
		{ src: 'IMG_0010.JPG' }
	];
	let collection2 = [
		{ src: 'IMG_0007.JPG' },
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0005.JPG' },
		{ src: 'IMG_0007.JPG' },
		{ src: 'IMG_0008.JPG' },
		{ src: 'IMG_0009.JPG' },
		{ src: 'IMG_0010.JPG' }
	];
	let collection3 = [
		{ src: 'IMG_0009.JPG' },
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0005.JPG' },
		{ src: 'IMG_0007.JPG' },
		{ src: 'IMG_0008.JPG' },
		{ src: 'IMG_0009.JPG' },
		{ src: 'IMG_0010.JPG' }
	];
	let collection4 = [
		{ src: 'IMG_0010.JPG' },
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0005.JPG' },
		{ src: 'IMG_0007.JPG' },
		{ src: 'IMG_0008.JPG' },
		{ src: 'IMG_0010.JPG' }
	];
	let collection5 = [
		{ src: 'IMG_0008.JPG' },
		{ src: 'IMG_0004.JPG' }
	];
	let collection6 = [
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0004.JPG' },
		{ src: 'IMG_0005.JPG' }
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
		margin: 40px 1em 1em;
	}
	.container :global(.collection) {
		width: calc(25em - 3em);
		margin: 1em 1.5em 3em 1.5em;
		height: 15em;
	}
</style>

<div class="container">
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection1} id="{uid++}" name="Spider"/>
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection2} id="{uid++}" name="Head" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection3} id="{uid++}" name="Octopus" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection4} id="{uid++}" name="Robot" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection5} id="{uid++}" name="Cash Suitcase" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection6} id="{uid++}" name="Citizens of Science" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection4} id="{uid++}" name="Robo" />
	<GalleryStacks lowresdir="images" hiresdir="images/originals" on:expand={handleExpand} imagecollection={collection1} id="{uid++}" name="Kumo" />
</div>

