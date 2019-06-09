<script>
	export let name;
	import GalleryStack from './GalleryStack.svelte';
	import { fly } from 'svelte/transition';
	import { activeCollection } from './stores.js';

	let uid = 1;
	let menuHover = false;
	let about = false;
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

	function handleHover(){
		if(menuHover){
			menuHover = false;
		}else{
			menuHover = true;
		}
	}

	function handleAbout(event){
		event.preventDefault();
		if(about){
			about = false;
		}else{
			about = true;
		}
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
		vertical-align: middle;
		
		width: auto;
		margin: 40px 1em 1em;
	}
	.container .links{
		align-self: center;
		padding: 0 24px;
		color: #929292;
		font-weight: 200;
		text-decoration: none;
		opacity: 0;
		position: relative; top: -4px;
		transition: 0.8s opacity;
	}
	.container .links.hovering{
		opacity: 1;
	}
	.menu{

	}
	/* Experimenting with css grid...
	 .container{
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

	.stacks-logo{
		display: inline-block;
		padding: 15px 7px 8px;
		position: relative;
	}
	.stacks-logo svg{
		position: relative;
		z-index: 2;
		fill: var(--dark);
		transition: 0.3s all;
	}
	.stacks-logo:before{
		content: '';
		display: block;
		background: rgba(151,151,151, 0.23);
		width: 100%; height: 100%;
		transform: rotate(13deg);
		z-index: 1;
    position: absolute;
    top: 0;
    left: 0;
		border-radius: 3px; 
		transition: 0.3s all;
	}
	.stacks-logo:after{
		content: '';
		display: block;
		background: var(--light);
		border: 1px solid rgba(151,151,151, 0.23);
		width: 100%; height: 100%;
		transform: rotate(0deg);
		z-index: 1;
    position: absolute;
    top: 0;
    left: -1px;
		border-radius: 3px; 
		transition: 0.3s all;
	}
	.stacks-logo:hover:before,
	.stacks-logo.hovering:before{
		transform: rotate(0deg);
	}
	.stacks-logo:hover:after,
	.stacks-logo.hovering:after{
		background: var(--dark);
		transform: rotate(-5deg);
	}
	.stacks-logo:hover svg,
	.stacks-logo.hovering svg{
		fill: var(--light);
	}
	@media(min-width: 420px){
		.container :global(.collection, .galleryitem) {
			width: calc(22vw - 3em);
		}
	}

	.about{
		background: var(--dark);
		color: var(--light);
		width: 100vw;
		height: 100vh;
		position: fixed; top: 0; left: 0;
	}
	.about p{
		font-weight: 200;
		text-align: center;
		width: 40%;
		max-width: 800px;
		padding-top: 140px;
		margin: auto;
	}
</style>
<div class="container" style="height: 50px; margin-bottom: 20px; margin-top: 25px">
{#if $activeCollection==0}
	<div class="menu" on:mouseenter="{handleHover}" on:mouseleave="{handleHover}">
		<a on:click="{handleAbout}" class:hovering="{menuHover === true}" class="links" href="about">About</a>
		<div class:hovering="{menuHover === true}" class="stacks-logo" in:fly="{{ y: -50, duration: 400 }}" out:fly="{{ y: -50, duration: 400 }}">
			<svg width="65px" height="24px" viewBox="0 0 65 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
					<g transform="translate(-12.000000, -22.000000)" fill-rule="nonzero">
						<path d="M28.664,22.376 C30.152,22.376 31.784,23.72 31.784,25.28 C31.784,27.464 28.424,31.616 26.768,31.616 C26.144,31.616 25.064,30.68 25.064,30.152 C25.064,29.6 25.88,28.88 26.624,28.16 C27.32,27.464 27.656,26.792 27.896,26.792 C28.136,26.792 28.904,27.632 28.904,27.632 C29.576,27.056 30.44,26.024 30.44,25.064 C30.44,24.728 30.032,24.296 29.648,24.296 C26.648,24.296 21.224,28.376 21.224,31.112 C21.224,33.512 27.44,34.304 27.44,37.616 C27.44,41.576 22.64,45.464 18.368,45.464 C15.44,45.464 12.8,42.344 12.8,41.792 C12.8,41.48 13.04,41.144 13.328,41.144 C13.544,41.144 15.104,42.968 17.648,42.968 C20.864,42.968 24.2,40.136 24.2,37.472 C24.2,34.448 18.488,34.016 18.488,30.08 C18.488,26.36 24.632,22.376 28.664,22.376 Z M32.624,41.312 C31.04,41.312 28.904,39.992 28.904,38.096 C28.904,36.536 30.032,33.896 31.184,31.568 C30.56,31.304 30.176,30.728 30.176,30.488 C30.176,30.344 30.344,30.152 30.488,30.152 C30.656,30.152 30.92,30.416 31.736,30.488 C32.72,28.568 33.584,27.032 33.584,26.816 C33.584,26.624 33.632,26.456 33.848,26.456 C34.472,26.456 35.504,27.344 35.504,28.28 C35.504,28.904 35.288,29.12 34.544,30.44 C35.576,30.392 36.512,30.32 36.728,30.32 C37.112,30.32 37.208,30.392 37.208,30.632 C37.208,30.872 36.512,32.048 35.624,32.048 C35.216,32.048 34.496,32 33.776,31.928 L32.96,33.656 C31.472,36.896 31.352,38.024 31.352,38.528 C31.352,39.296 31.664,39.92 32.48,39.92 C33.488,39.92 35.168,37.856 36.152,36.488 C36.56,35.912 36.68,35.72 36.8,35.72 C36.992,35.72 37.376,36.296 37.376,36.656 C37.376,37.016 37.28,37.304 36.776,37.952 C35.864,39.152 34.232,41.312 32.624,41.312 Z M44.384,41.192 C43.328,41.192 42.392,40.616 41.984,39.944 C41.84,39.68 41.816,39.224 41.816,38.912 L41.816,38.6 C41.816,38.6 40.016,41.336 38.504,41.336 C37.016,41.336 35.624,39.728 35.624,38.36 C35.624,35.816 39.344,30.848 41.768,30.848 C42.872,30.848 44.096,31.904 44.096,32.696 C44.096,32.696 44.456,32.456 44.648,32.456 C45.152,32.456 46.352,33.248 46.352,33.584 C46.352,33.92 44.888,35.696 44.312,37.472 C44,38.432 43.928,38.96 43.928,39.2 C43.928,39.584 44.288,39.8 44.6,39.8 C45.104,39.8 46.736,37.856 47.72,36.488 C48.128,35.912 48.248,35.72 48.368,35.72 C48.56,35.72 48.944,36.296 48.944,36.656 C48.944,37.016 48.848,37.304 48.344,37.952 C47.432,39.152 45.896,41.192 44.384,41.192 Z M42.272,32.888 C41.144,32.888 37.904,37.4 37.904,39.392 C37.904,39.752 38.216,39.944 38.552,39.944 C39.104,39.944 41.168,37.712 42.056,36.152 C41.984,36.032 41.912,35.96 41.912,35.792 C41.912,35.384 42.872,34.592 42.872,33.464 C42.872,33.104 42.584,32.888 42.272,32.888 Z M51.992,41.336 C49.88,41.336 47.576,39.896 47.576,37.232 C47.576,34.64 50.792,30.944 52.976,30.944 C54.392,30.944 55.52,32.024 55.52,32.96 C55.52,34.04 54.656,36.008 54.056,36.008 C53.456,36.008 52.904,35.408 52.904,35.24 C52.904,35.168 52.976,35.072 53.12,34.928 C53.552,34.496 54.248,33.584 54.248,32.912 C54.248,32.696 54.104,32.6 53.936,32.6 C52.544,32.6 50.24,35.84 50.24,37.88 C50.24,39.104 51.08,39.992 52.112,39.992 C53.528,39.992 55.232,37.856 56.216,36.488 C56.624,35.912 56.744,35.72 56.864,35.72 C57.056,35.72 57.44,36.296 57.44,36.656 C57.44,37.016 57.344,37.304 56.84,37.952 C55.928,39.152 54.2,41.336 51.992,41.336 Z M62.816,32.264 C61.976,32.264 59.264,36.032 58.904,37.04 C60.728,37.04 63.128,34.304 63.128,32.672 C63.128,32.408 63.056,32.264 62.816,32.264 Z M62.384,41.528 C59.864,41.528 59.12,38.624 58.208,38.552 C58.208,38.552 57.248,40.568 57.2,41.024 C57.176,41.288 56.936,41.408 56.72,41.408 C56.504,41.408 55.208,41.096 55.208,40.16 C55.208,39.224 55.448,38.192 57.2,33.608 C58.952,29.024 59.96,27.08 59.96,26.696 C59.96,26.528 60.104,26.48 60.344,26.48 C60.584,26.48 62.048,27.104 62.048,27.584 C62.048,28.064 60.632,30.92 59.312,34.52 C59.84,33.968 61.568,31.112 63.008,31.112 C64.448,31.112 65.144,32.072 65.144,33.776 C65.144,36.104 62.768,37.688 60.872,38.072 C62,38.576 62.288,39.512 62.984,39.512 C64.016,39.512 65.336,37.856 66.32,36.488 C66.728,35.912 66.848,35.72 66.968,35.72 C67.16,35.72 67.544,36.296 67.544,36.656 C67.544,37.016 67.448,37.304 66.944,37.952 C66.032,39.152 63.992,41.528 62.384,41.528 Z M64.664,38.792 C64.664,38.168 65.192,37.448 65.744,37.28 C66.872,35.672 68.36,33.824 69.296,32.216 C69.752,30.464 70.592,28.76 71.168,28.76 C72.104,28.76 73.112,29.504 73.112,30.272 C73.112,30.848 72.08,32.072 71.264,33.128 C71.264,35.048 72.704,35.336 72.704,38.072 C72.704,38.456 72.536,38.936 72.536,38.936 C73.664,38.24 74.576,37.28 75.152,36.488 C75.56,35.912 75.68,35.72 75.8,35.72 C75.992,35.72 76.376,36.296 76.376,36.656 C76.376,37.016 76.256,37.256 75.752,37.952 C74.336,39.896 71.864,41.384 69.224,41.384 C66.656,41.384 64.664,39.992 64.664,38.792 Z M66.776,38.216 C66.776,38.744 67.64,39.848 68.456,39.848 C69.344,39.848 69.968,38.696 69.968,37.232 C69.968,35.744 69.8,33.776 69.8,33.776 C68.96,35.096 67.952,36.608 66.776,38.216 Z" id="Stacks"></path>
					</g>
			</svg>
		</div>
		<a class:hovering="{menuHover === true}" target="_blank" class="links" href="https://github.com/cssandstuff/portfolio-scaffold">Github</a>
	</div>
{/if}
</div>

<div class="container">
	<!-- <GalleryStack width="" name="Ongakukai" color="44, 47, 90" lowresdir="images/16_ongakukai" hiresdir="images/16_ongakukai/originals" imagecollection={collection0} id="{uid++}" /> -->
	<GalleryStack width="" name="Painterly" color="261, 27, 71" lowresdir="images" hiresdir="images/originals" imagecollection={collection1} id="{uid++}" />
	<GalleryStack width="" name="Splashes" color="206, 69, 88" lowresdir="images" hiresdir="images/originals" imagecollection={collection2} id="{uid++}" />
	<GalleryStack width="" name="Citizens of science" color="182, 37, 73" lowresdir="images" hiresdir="images/originals" imagecollection={collection3} id="{uid++}" />
	<GalleryStack width="" name="Travelling" color="209, 25, 24" lowresdir="images" hiresdir="images/originals" imagecollection={collection4} id="{uid++}" />
	<GalleryStack width="" name="Angry at kids" color="13, 92, 87" lowresdir="images" hiresdir="images/originals" imagecollection={collection5} id="{uid++}" />
	<GalleryStack width="" name="Sketches" color="109, 0, 76" lowresdir="images" hiresdir="images/originals" imagecollection={collection6} id="{uid++}"  />
</div>
{#if about }
<div on:click={handleAbout} class="about" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: 0, duration: 400 }}">
<p>This started out as a small code challenge to learn Svelte v3 & to see if I could build a procreate-like gallery.</p>
<p>I'm hopefully going to move it into Sapper and see if I can transition between routes.</p>
</div>
{/if}