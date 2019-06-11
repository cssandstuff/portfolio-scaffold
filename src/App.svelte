<script>
	// TODO: Add video if available
	// control width as demo.
	// Add swipe interactions.
	export let name;
	import Logo from './Logo.svelte';
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
		{ lowres: 'images/Noa.jpg', hires: 'images/originals/Noa.jpg', name: 'Noa' },
		{ lowres: 'images/dog.jpg', hires: 'images/originals/dog.jpg', name: 'Dog' },
		{ lowres: 'images/glass.jpg', hires: 'images/originals/glass.jpg', name: 'Glass' }
	];
	let collection2 = [
		{ lowres: 'images/cash.jpg', hires: 'images/originals/cash.jpg', name: 'Cash suitcase' },
		{ lowres: 'images/robo.jpg', hires: 'images/originals/robo.jpg', name: 'Robot' },
		{ lowres: 'images/tako.jpg', hires: 'images/originals/tako.jpg', name: 'Octopus' }
	];
	let collection3 = [
		{ lowres: 'images/boltit.jpg', hires: 'images/originals/boltit.jpg', name: 'Boltman' },
		{ lowres: 'images/citizens.jpg', hires: 'images/originals/citizens.jpg', name: 'Citizens of science' },
		{ lowres: 'images/screwit.jpg', hires: 'images/originals/screwit.jpg', name: 'Screw It' },
		{ lowres: 'images/kumo.jpg', hires: 'images/originals/kumo.jpg', name: 'Spiderdeath' }
	];
	let collection4 = [
		{ lowres: 'images/atami.jpg', hires: 'images/originals/atami.jpg', name: 'Atami at night' },
		{ lowres: 'images/kenodo.jpg', hires: 'images/originals/kenodo.jpg', name: 'Konodo Highway' },
		{ lowres: 'images/kenodo2.jpg', hires: 'images/originals/kenodo2.jpg', name: 'Tunnels' }
	];
	let collection6 = [
		{ lowres: 'images/notes.jpg', hires: 'images/originals/notes.jpg', name: 'Notes' },
		{ lowres: 'images/boring.jpg', hires: 'images/originals/boring.jpg', name: 'Everything is boring' },
		{ lowres: 'images/hownotto.jpg', hires: 'images/originals/hownotto.jpg', name: 'How not to draw' },
		{ lowres: 'images/isometric.jpg', hires: 'images/originals/isometric.jpg', name: 'Isometric' },
		{ lowres: 'images/glass-b+w.jpg', hires: 'images/originals/glass-b+w.jpg', name: 'Glass' },
		{ lowres: 'images/kenodo.jpg', hires: 'images/originals/kenodo.jpg', name: 'Konodo Highway' },
		{ lowres: 'images/kenodo2.jpg', hires: 'images/originals/kenodo2.jpg', name: 'Tunnels' }
	];
	let collection5 = [
		{ lowres: 'images/angrykid2.jpg', hires: 'images/originals/angrykid2.jpg', name: 'Angry 1' },
		{ lowres: 'images/angrykid4.jpg', hires: 'images/originals/angrykid4.jpg', name: 'Angry 3' },
		{ lowres: 'images/angrykid5.jpg', hires: 'images/originals/angrykid5.jpg', name: 'Angry 4' }
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
		padding: 10px;
		margin-top: -10px;
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
	/* .container :global(.collection){
		filter: grayscale(33%);
	}
	.container :global(.collection:hover){
		filter: grayscale(0%);
	} */

	.stacks-logo{
		display: inline-block;
		padding: 15px 7px 8px;
		position: relative;
	}
	.stacks-logo :global(svg){
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
	.stacks-logo.hovering:before{
		transform: rotate(0deg);
	}
	.stacks-logo.hovering:after{
		background: var(--dark);
		transform: rotate(-5deg);
	}
	.stacks-logo.hovering :global(svg){
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
		max-width: 650px;
		padding-top: 140px;
		margin: auto;
		text-align: left;
	}
	.about a{
		color: rgba(255,255,255,0.8);
	}
</style>
<div class="container" style="height: 50px; margin-bottom: 20px; margin-top: 25px">

	{#if $activeCollection==0}
		<div class="menu" on:mouseenter="{handleHover}" on:tap="{handleHover}" on:mouseleave="{handleHover}">
			
			<a on:click="{handleAbout}" class:hovering="{menuHover === true}" class="links" href="about">About</a>
			
			<div class:hovering="{menuHover === true}" class="stacks-logo" in:fly="{{ y: -50, duration: 400 }}" out:fly="{{ y: -50, duration: 400 }}">
				<Logo />
			</div>

			<a class:hovering="{menuHover === true}" target="_blank" class="links" href="https://github.com/cssandstuff/portfolio-scaffold">Github</a>

		</div>
	{/if}

</div>

<div class="container">
	<GalleryStack width="" name="Painterly" bgcolor="261, 27, 71" imagecollection={collection1} id="{uid++}" />
	<GalleryStack width="" name="Splashes" bgcolor="206, 69, 88" imagecollection={collection2} id="{uid++}" />
	<GalleryStack width="" name="Citizens of science" bgcolor="20, 62, 88" imagecollection={collection3} id="{uid++}" />
	
	
	
	<GalleryStack width="" name="Angry at kids" bgcolor="13, 92, 87" imagecollection={collection5} id="{uid++}" />
	<GalleryStack width="" name="Sketches" bgcolor="109, 0, 76" imagecollection={collection6} id="{uid++}"  />
</div>
{#if about }
<div on:click={handleAbout} class="about" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: 0, duration: 400 }}">
<p>This started out as a small code challenge to start getting to grips with <a href="http://svelte.dev">Svelte</a> v3 & to see if I could build a procreate-inspired UI for a gallery of images.<br/><br/>
I'm hopefully going to move it into <a href="http://svelte.dev/sapper">Sapper</a> soon and see if I can have a proper url structure and transition between routes.<br/><br/>
The current bundle size of stacks is arount 10kb (gzipped), and I'm sure there's room for improvement.</p>
</div>
{/if}