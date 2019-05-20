<script context="module">
  // for wizardry to keep tabs on the collections
	const elements = new Set();
</script>

<script>
  // This component shows a cover image with dummy images (spans) behind to 
  // give an indication of gallery/stack quantity
  // The stack also splays out slightly on-hover.

  // We're also have a child component in here which loads & shows all images from the user-selected stack.
  import Image from './Image.svelte';
  import GalleryExpanded from './GalleryExpanded.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { activeCollection, destroyingExpandedGallery, loadingSecondary } from './stores.js';
  
  export let imagecollection;
  export let lowresdir;
  export let hiresdir;
  export let id;
  export let name;
  export let color;

  const dispatch = createEventDispatcher();

  // Local stuff
  let collection;
  let originalbgcolor;
  let galleryExpanded;
  let secondLevel;
  let fakeImages;
  let firstImage;

  // count for loading
  let count = 0;
  
  let attemptingtoLoad = false;

  onMount(() => {
		fakeImages = collection.getElementsByTagName('span');
    firstImage = collection.getElementsByTagName('img')[0];
    
    // some wizardry for keeping tabs on the collections
    elements.add(collection);
		return () => elements.delete(collection);
	});
  
  // Rotate image stack on hover
  function rotate() {
    collection.style.transform = 'rotate(-1.5deg)';
    Object.entries(fakeImages).forEach(([key, value]) => {
      //value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
      value.style.transform = 'rotate(' + ((parseInt(key)* 4) + 5)+ 'deg)';
      //transform: rotate({index * 2}deg);
    })
    firstImage.style.transform = 'scale(1.08) translateY(10px)';
  }

  // Un-Rotate image stack on hover out
  function unRotate() {
    collection.style.transform = 'rotate(0deg)';
    Object.entries(fakeImages).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1)';
  }

  // Initiate the gallery and expand the stack
  function showContents(){
    attemptingtoLoad = true;
    console.log(color);
    originalbgcolor = getComputedStyle(document.documentElement).getPropertyValue('--bgcolor');
    if(color){
      
      let hslcolor = color.split(",");
      console.log(hslcolor[0])
      document.documentElement.style.setProperty('--bgcolor', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 1)`);
      document.documentElement.style.setProperty('--bgcolortint', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 0.6)`);
      document.documentElement.style.setProperty('--bgcolordarktint', `hsl(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]/hslcolor[1] * 10}%)`);
    }

    // this sets the loading to true.
    loadingSecondary.update(n => true);
    
    // sets which stack needs to be expanded.
    activeCollection.update(n => id);

    blowStacks();
  }

  // Blow away the other stacks when we're initiating an Expanded Gallery
  function blowStacks(){
    
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;
    
    elements.forEach(element => {
      var rect = element.getBoundingClientRect();
      element.classList.add('notransition');
      let myId = parseInt(element.dataset.id);
      if(myId!==$activeCollection){
        element.classList.add('no-pointer-events');
        element.style.transform = `translateX(${rect.left/3 - centerX/3}px) translateY(${rect.top/3 - centerY/3}px)`
      }
    });

  }

  // Function for bringing the stacks back after we've closed an Expanded Gallery
  function resetStacks(){
    console.log('resetting...');
    elements.forEach(element => {
      element.classList.remove('notransition');
    });
    document.documentElement.style.setProperty('--bgcolor', originalbgcolor);
    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
      // Tells the expanded gallery that we're about to destroy it, so we can then call the consolitateStuff() function.
      // might be able to call the funtion directly instead of this??
      console.log(galleryExpanded);
      destroyingExpandedGallery.update(n => true);
      (async () => {
        await sleep(200);
        activeCollection.update(n => 0);
        attemptingtoLoad = false;
        elements.forEach(element => {
          element.style.transform = `translateX(0px) translateY(0px)`
        });
      })();
      (async () => {
        await sleep(400);
        elements.forEach(element => {
          element.classList.remove('no-pointer-events');
        });
      })();
  }
  
  // Wanted to maybe have a loader, so the following will let us know when all
  // Image components in an Expanded Gallery have loaded.
  function handleLoadingComplete(event) {
    count = count + event.detail.loadingComplete;
    if(count === imagecollection.length){
      
      console.log("Loading complete");

      // Faking slow loading....
      const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
      (async () => {
        await sleep(3200);
        loadingSecondary.update(n => false);
      })();

      count = 0;
    }
	}
  
</script>

<style>
  /* These refer to the darkness class, none or total */
  .collection.active{
    z-index: 2 !important;
    opacity: 0.6;
  }
  .collection.nonactive{
    opacity: 0;
    pointer-events: none;
  }

  .dummyimage{
    border: 1px solid #d6d6d6;
    background: rgba(255,255,255,0.8);
    border-radius: 4px;
    display: block;
    width: 100%;
    height: 100%;
    position: absolute; top: 0; left: 0;
    transition: 0.15s transform ease-out;
  }

  .collection:hover span{
    transition: 0.3s transform ease-out;
  }

  .collection{
    position: relative;
    transition: 0.2s all ease-out;
  }

  .collection:hover{
    transition: 0.3s all ease-out;
  }

  .collection :global(img) {
    position: absolute;
    top: 0; left: 0;
    box-shadow: 0 0 2px #ccc;
    transition: 0.15s all ease-out;
    border-radius: 4px;
  } 
  .collection:hover :global(img){
    transition: 0.3s all ease-out;
  }

  .collection :global(img:first-child){
    box-shadow: 0px 1px 3px rgba(90,90,90, 0.3)
  }
  .collection:hover :global(img:first-child){
    box-shadow: 0px -5px 30px rgba(90,90,90, 0.3)
  }

  .breadcrumb{
    /*TODO need this to be a sticky menu */
    /* background: #efefef; */
    opacity: 1;
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 20px;
    z-index: 99;
    padding: 10px;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.2em;
  }
    .breadcrumb p{
      margin: 0;
      position: relative;
      display: block;
      color: #333;
      padding-left: 10px;
      text-transform: uppercase;
    }
    .breadcrumb p:before, .breadcrumb p:after{
      content: '';
      display: block;
      position: absolute;
      left: 0; top: 7px;
      height: 6px; width: 2px;
      background: currentColor;
      transform: rotate(45deg);
    }
    .breadcrumb p span{
      text-transform: none;
      font-weight: 300;
      color: rgba(255,255,255,0.5);
    }
    .breadcrumb p:after{
      top: 10px;
      transform: rotate(-45deg);
    }

  .loading--false{
    opacity: 1;
    pointer-events: auto;
  }
  .loading--true{
    opacity: 0;
    pointer-events: none;
  }

   .spinner {
    animation: rotate 2s linear infinite;
    z-index: 2;
    position: absolute;
    top: 50%;
    left: 50%;
    margin: -25px 0 0 -25px;
    width: 50px;
    height: 50px;
  }

  .spinner .path {
      stroke: rgb(26, 118, 211);
      stroke-linecap: round;
      animation: dash 1.5s ease-in-out infinite;
  } 
  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -55;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }
  
</style>

{#if $activeCollection == id}
  <div class="breadcrumb" on:click={resetStacks} in:fly="{{ y: -40, duration: 400 }}" out:fly="{{ y: -40, duration: 400 }}" >
    <p>{name} <span>({imagecollection.length} images)</span></p>
  </div>
{/if}
  
<div class:active="{id === $activeCollection && $loadingSecondary == true}" 
     class:nonactive="{$activeCollection!== 0 && id !== $activeCollection}" 
     class="collection" 
     data-id={id} 
     bind:this={collection} 
     on:mouseenter={rotate} 
     on:mouseleave={unRotate} 
     on:click={showContents}>
 
  <!-- in case we want a spinner  -->
  {#if $activeCollection == id}
    <svg class="spinner" viewBox="0 0 50 50">
    <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle>
    </svg>
  {/if}
  <!-- Initial Stacked Gallery, we only load the first image -->
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image="{lowresdir}/{image.src}" />
    {:else}
      <span class="dummyimage" style="transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></span>
    {/if}
  {/each}

</div>

<!-- Real Gallery, we load all images and then it can be expanded -->
{#if attemptingtoLoad}
   <div out:fade={{duration: 500}} class="loading--{$loadingSecondary}">
    <GalleryExpanded bind:this={galleryExpanded} lowresdir={lowresdir} hiresdir={hiresdir} stack={imagecollection} originaltarget={collection} on:loadingComplete="{handleLoadingComplete}"  />
  </div>
{/if}


