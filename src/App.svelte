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
		{ lowres: 'images/portfolio/01_above and below/_above_below.jpg', hires: 'images/portfolio/01_above and below/Original Files/_above_below.jpg', name: 'Above and Below' },
		{ lowres: 'images/portfolio/01_above and below/bird_island_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/bird_island_final.jpg', name: 'Bird Island' },
		{ lowres: 'images/portfolio/01_above and below/cave_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/cave_final.jpg', name: 'Cave' },
		{ lowres: 'images/portfolio/01_above and below/forest_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/forest_final.jpg', name: 'Forest' },
		{ lowres: 'images/portfolio/01_above and below/northpole_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/northpole_final.jpg', name: 'North Pole' },
		{ lowres: 'images/portfolio/01_above and below/ocean_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/ocean_final.jpg', name: 'Ocean' },
		{ lowres: 'images/portfolio/01_above and below/rainforest-final.jpg', hires: 'images/portfolio/01_above and below/Original Files/rainforest-final.jpg', name: 'Rain Forest' },
		{ lowres: 'images/portfolio/01_above and below/river_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/river_final.jpg', name: 'River' },
		{ lowres: 'images/portfolio/01_above and below/savannah_final.jpg', hires: 'images/portfolio/01_above and below/Original Files/savannah_final.jpg', name: 'Savannah' }
	];
	let collection2 = [
		{ lowres: 'images/portfolio/02_The River/The_river_Cover.jpg', hires: 'images/portfolio/02_The River/Original Files/The_river_Cover.jpg', name: 'The River' },
		{ lowres: 'images/portfolio/02_The River/spread1_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread1_final.jpg', name: 'Bird Island' },
		{ lowres: 'images/portfolio/02_The River/spread2_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread2_final.jpg', name: 'Cave' },
		{ lowres: 'images/portfolio/02_The River/spread3_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread3_final.jpg', name: 'Forest' },
		{ lowres: 'images/portfolio/02_The River/spread4_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread4_final.jpg', name: 'North Pole' },
		{ lowres: 'images/portfolio/02_The River/spread5_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread5_final.jpg', name: 'Ocean' },
		{ lowres: 'images/portfolio/02_The River/spread6_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread6_final.jpg', name: 'Rain Forest' },
		{ lowres: 'images/portfolio/02_The River/spread7_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread7_final.jpg', name: 'River' },
		{ lowres: 'images/portfolio/02_The River/spread8_final.jpg', hires: 'images/portfolio/02_The River/Original Files/spread8_final.jpg', name: 'Savannah' }
	];
	let collection3 = [
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/01_bear_cover_edited_half.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/01_bear_cover_edited_half.jpg', name: 'The River' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/02_bear_cover_edited.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/02_bear_cover_edited.jpg', name: 'Bird Island' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/intro_amended_.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/intro_amended_.jpg', name: 'Cave' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/spread_9.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/spread_9.jpg', name: 'Forest' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/spread1_hives.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/spread1_hives.jpg', name: 'North Pole' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/spread5.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/spread5.jpg', name: 'Ocean' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/Spread6.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/Spread6.jpg', name: 'Rain Forest' },
		{ lowres: 'images/portfolio/03_10 reasons to love a bear/spread8.jpg', hires: 'images/portfolio/03_10 reasons to love a bear/Original Files/spread8.jpg', name: 'River' }
	];
  let collection4 = [
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/01_elephant_cover_edited_half.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/01_elephant_cover_edited_half.jpg', name: 'The River' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/elephant_cover_edited.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/elephant_cover_edited.jpg', name: 'Bird Island' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/spread3.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/spread3.jpg', name: 'Cave' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/spread7.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/spread7.jpg', name: 'Forest' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/spread8.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/spread8.jpg', name: 'North Pole' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/spread9.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/spread9.jpg', name: 'Ocean' },
		{ lowres: 'images/portfolio/04_10 reasons to love an elephant/spread10.jpg', hires: 'images/portfolio/04_10 reasons to love an elephant/Original Files/spread10.jpg', name: 'Rain Forest' }
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
		/* display: flex;
		flex: 1 auto;
		flex-basis: 15%;
		flex-flow: row wrap;
		align-content: flex-start;
		justify-content: center;
		vertical-align: middle; */
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
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
		margin: 0em 1.5em 6em 1.5em;
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
			/* width: calc(22vw - 3em); */
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
	<GalleryStack width="" name="Above and Below" imagecollection={collection1} id="{uid++}" />
	<GalleryStack width="" name="The River" imagecollection={collection2} id="{uid++}" />
	<GalleryStack width="" name="10 Reasons to love a Bear" imagecollection={collection3} id="{uid++}" />
	<GalleryStack width="" name="10 Reasons to love an Elephant" imagecollection={collection4} id="{uid++}" />
	<!-- <GalleryStack width="" name="Citizens of science" bgcolor="20, 62, 88" imagecollection={collection3} id="{uid++}" />
	<GalleryStack width="" name="Angry at kids" bgcolor="13, 92, 87" imagecollection={collection5} id="{uid++}" />
	<GalleryStack width="" name="Sketches" bgcolor="109, 0, 76" imagecollection={collection6} id="{uid++}"  /> -->
</div>
{#if about }
<div on:click={handleAbout} class="about" in:fly="{{ y: -20, duration: 400 }}" out:fly="{{ y: 0, duration: 400 }}">
<p>This started out as a small code challenge to start getting to grips with <a href="http://svelte.dev">Svelte</a> v3 & to see if I could build a procreate-inspired UI for a gallery of images.<br/><br/>
I'm hopefully going to move it into <a href="http://svelte.dev/sapper">Sapper</a> soon and see if I can have a proper url structure and transition between routes.<br/><br/>
The current bundle size of stacks is arount 10kb (gzipped), and I'm sure there's room for improvement.</p>
</div>
{/if}