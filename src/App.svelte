<script>
	export let name;
	import ImageCollection from './ImageCollection.svelte'
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
</script>

<div class="nicediv">
	<ImageCollection imagecollection={collection1} />
	<ImageCollection imagecollection={collection2} />
	<ImageCollection imagecollection={collection3} />
	<ImageCollection imagecollection={collection4} />
	<ImageCollection imagecollection={collection5} />
	<ImageCollection imagecollection={collection6} />
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