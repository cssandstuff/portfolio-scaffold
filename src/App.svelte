<script>
	export let name;
	import GalleryStack from './GalleryStack.svelte';
	import { activeCollection } from './stores.js';

	let uid = 1;

	// Images, maybe I can make this easier somehow?
	// Auto-generate from a directory structure maybe?
	// let collection0 = [
	// 	{ src: '01_front_cover.jpg', name: 'Noa' },
	// 	{ src: '02_back_cover.jpg', name: 'Dog' },
	// 	{ src: 'racoon_together.jpg', name: 'Glass' }
	// ];
	let collection1 = [
		{ src: 'Noa.JPG', name: 'Noa' },
		{ src: 'dog.JPG', name: 'Dog' },
		{ src: 'glass.JPG', name: 'Glass' }
	];
	
	let collection4 = [
		{ src: 'atami.JPG', name: 'Atami at night' },
		{ src: 'kenodo.JPG', name: 'Konodo Highway' },
		{ src: 'kenodo2.JPG', name: 'Tunnels' }
	];
	let collection6 = [
		{ src: 'boring.JPG', name: 'Everything is boring' },
		{ src: 'hownotto.JPG', name: 'How not to draw' },
		{ src: 'isometric.JPG', name: 'Isometric' },
		{ src: 'notes.JPG', name: 'Notes' },
		{ src: 'glass-b+w.JPG', name: 'Glass' }
	];
	let collection2 = [
		{ src: 'cash.JPG', name: 'Cash suitcase' },
		{ src: 'robo.JPG', name: 'Robot' },
		{ src: 'tako.JPG', name: 'Octopus' }
	];
	let collection5 = [
		{ src: 'angrykid2.JPG', name: 'Angry 1' },
		{ src: 'angrykid1.JPG', name: 'Angry 2' },
		{ src: 'angrykid3.JPG', name: 'Angry 3' },
		{ src: 'angrykid4.JPG', name: 'Angry 4' },
		{ src: 'angrykid5.JPG', name: 'Angry 5' }
	];
	let collection3 = [
		{ src: 'citizens.JPG', name: 'Citizens of science' },
		{ src: 'screwit.JPG', name: 'Screw It' },
		{ src: 'boltit.JPG', name: 'Boltman' },
		{ src: 'kumo.JPG', name: 'Spiderdeath' }
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
		width: auto;
		margin: 40px 1em 1em;
	}
	/* .container{
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		grid-template-areas: "a a b"
												 "c d e"
												 "f g h";

		align-content: flex-start;
		justify-content: center;
		width: auto;
		margin: 40px 1em 1em;
	} 
	.container :global(.collection) {
		width: calc(100% - 3em);
		margin: 0em 1.5em 6em 1.5em;
		height: 15em;
	}
	.container :global(.collection:first-child) {
		grid-area: a;
		height: calc(100% - 6em);
	}
	.container :global(.galleryitem) {
		width: calc(19em - 3em);
		margin: 0em 1.5em 6em 1.5em;
		height: 15em;
	}
	*/
	.container :global(.collection, .galleryitem) {
		width: calc(100% - 3em);
		min-width: 16em;
		margin: 0em 1.5em 6em 1.5em;
		height: 15em;
	}
	p{text-align: center; margin-bottom: 7em;}
	p a{
		color: #2781b4;
		font-size: 0.8em;
	}
	@media(min-width: 420px){
		.container :global(.collection, .galleryitem) {
			width: calc(22vw - 3em);
		}
	}
</style>

<div class="container">
	<!-- <GalleryStack width="" name="Ongakukai" color="44, 47, 90" lowresdir="images/16_ongakukai" hiresdir="images/16_ongakukai/originals" imagecollection={collection0} id="{uid++}" /> -->
	<GalleryStack width="" name="Painterly" color="261, 27, 71" lowresdir="images" hiresdir="images/originals" imagecollection={collection1} id="{uid++}" />
	<GalleryStack width="" name="Splashes" color="206, 69, 88" lowresdir="images" hiresdir="images/originals" imagecollection={collection2} id="{uid++}" />
	<GalleryStack width="" name="Citizens of science" color="182, 37, 73" lowresdir="images" hiresdir="images/originals" imagecollection={collection3} id="{uid++}" />
	<GalleryStack width="" name="Travelling" color="209, 25, 24" lowresdir="images" hiresdir="images/originals" imagecollection={collection4} id="{uid++}" />
	<GalleryStack width="" name="Angry at kids" color="13, 92, 87" lowresdir="images" hiresdir="images/originals" imagecollection={collection5} id="{uid++}" />
	<GalleryStack width="" name="Sketches" color="109, 0, 76" lowresdir="images" hiresdir="images/originals" imagecollection={collection6} id="{uid++}"  />
</div>

<p><a href="https://github.com/cssandstuff/portfolio-scaffold">View on Github</a></p>
