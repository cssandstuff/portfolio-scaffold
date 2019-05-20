<script>
	export let name;
	import GalleryStack from './GalleryStack.svelte';
	import { activeCollection } from './stores.js';

	let uid = 1;

	// Images, maybe I can make this easier somehow?
	// Auto-generate from a directory structure maybe?
	let collection1 = [
		{ src: 'Noa.JPG' },
		{ src: 'dog.JPG' },
		{ src: 'glass.JPG' }
	];
	
	let collection4 = [
		{ src: 'atami.JPG' },
		{ src: 'kenodo.JPG' },
		{ src: 'kenodo2.JPG' }
	];
	let collection6 = [
		{ src: 'boring.JPG' },
		{ src: 'hownotto.JPG' },
		{ src: 'isometric.JPG' },
		{ src: 'notes.JPG' },
		{ src: 'glass-b+w.JPG' }
	];
	let collection2 = [
		{ src: 'cash.JPG' },
		{ src: 'robo.JPG' },
		{ src: 'tako.JPG' }
	];
	let collection5 = [
		{ src: 'angrykid2.JPG' },
		{ src: 'angrykid1.JPG' },
		{ src: 'angrykid3.JPG' },
		{ src: 'angrykid4.JPG' },
		{ src: 'angrykid5.JPG' }
	];
	let collection3 = [
		{ src: 'citizens.JPG' },
		{ src: 'screwit.JPG' },
		{ src: 'boltit.JPG' },
		{ src: 'kumo.JPG' }
	];


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
	<GalleryStack name="Painterly" color="261, 27, 71" lowresdir="images" hiresdir="images/originals" imagecollection={collection1} id="{uid++}" />
	<GalleryStack name="Travelling" color="206, 69, 88" lowresdir="images" hiresdir="images/originals" imagecollection={collection2} id="{uid++}" />
	<GalleryStack name="Citizens of Science" lowresdir="images" hiresdir="images/originals" imagecollection={collection3} id="{uid++}" />
	<GalleryStack name="Splashes" lowresdir="images" hiresdir="images/originals" imagecollection={collection4} id="{uid++}" />
	<GalleryStack name="Angry at kids" lowresdir="images" hiresdir="images/originals" imagecollection={collection5} id="{uid++}" />
	<GalleryStack name="Sketches" lowresdir="images" hiresdir="images/originals" imagecollection={collection6} id="{uid++}"  />
</div>

