<script>
	export let name;
	import ImageCollection from './ImageCollection.svelte';
	import { activeCollection } from './stores.js';
	let uid = 1;
	let collection1 = [
		{ src: 'images/IMG_0003.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0005.JPG', name: 'moo' },
		{ src: 'images/IMG_0007.JPG', name: 'moo' },
		{ src: 'images/IMG_0008.JPG', name: 'moo' },
		{ src: 'images/IMG_0009.JPG', name: 'moo' },
		{ src: 'images/IMG_0010.JPG', name: 'moo' }
	];
	let collection2 = [
		{ src: 'images/IMG_0007.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0005.JPG', name: 'moo' },
		{ src: 'images/IMG_0007.JPG', name: 'moo' },
		{ src: 'images/IMG_0008.JPG', name: 'moo' },
		{ src: 'images/IMG_0009.JPG', name: 'moo' },
		{ src: 'images/IMG_0010.JPG', name: 'moo' }
	];
	let collection3 = [
		{ src: 'images/IMG_0009.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0005.JPG', name: 'moo' },
		{ src: 'images/IMG_0007.JPG', name: 'moo' },
		{ src: 'images/IMG_0008.JPG', name: 'moo' },
		{ src: 'images/IMG_0009.JPG', name: 'moo' },
		{ src: 'images/IMG_0010.JPG', name: 'moo' }
	];
	let collection4 = [
		{ src: 'images/IMG_0010.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0005.JPG', name: 'moo' },
		{ src: 'images/IMG_0007.JPG', name: 'moo' },
		{ src: 'images/IMG_0008.JPG', name: 'moo' },
		{ src: 'images/IMG_0010.JPG', name: 'moo' }
	];
	let collection5 = [
		{ src: 'images/IMG_0008.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' }
	];
	let collection6 = [
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0004.JPG', name: 'moo' },
		{ src: 'images/IMG_0005.JPG', name: 'moo' }
	];

	function handleExpand(event) {
		console.log(event.detail.active);
		activeCollection.update(n => event.detail.active);

	}
</script>
<p>Active collection is: {$activeCollection}</p> 
<div class="nicediv">
	<ImageCollection on:expand={handleExpand} imagecollection={collection1} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection2} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection3} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection4} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection5} id="{uid++}" />
	<ImageCollection on:expand={handleExpand} imagecollection={collection6} id="{uid++}" />
</div>

<style>
.nicediv{
	display: grid;
	height: 100%;
	margin: 4em;
	grid-template-columns: repeat(4, 1fr);
	grid-auto-rows: 200px;
	grid-gap: 4em;
}
</style>