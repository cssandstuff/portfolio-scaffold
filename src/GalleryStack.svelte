<script context="module">
  // TODO: refactor. also, keyboard navigation: make outline/hotspots consistent/prettier.
  // add dark mode.

  // for wizardry to keep tabs on the collections
  const elements = new Set();
  export let _waitingforSmoothness;
</script>

<script>
  // This component shows a cover image with dummy images (spans) behind to 
  // give an indication of gallery/stack quantity
  // The stack also splays out slightly on-hover.

  // We're also have a child component in here which loads & shows all images from the user-selected stack.
  import Image from './Image.svelte';
  import Spinner from './Spinner.svelte';
  import GalleryExpanded from './GalleryExpanded.svelte';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { activeCollection, destroyingExpandedGallery, loadingSecondary } from './stores.js';
  
  export let imagecollection;
  export let id = 0;
  export let name;
  export let bgcolor;
  export let textcolor;

  const dispatch = createEventDispatcher();
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  // placeholders for objects that we'll iterate over
  let collection;
  let galleryExpanded;
  let fakeImages;
  let firstImage;
  let stackHeight;
  let stackWidth;

  // reference to orginal colour
  let originalbgcolor;
  let originaltextcolor;

  // count for loading
  let count = 0;
  
  // booleans
  let attemptingtoLoad = false;


  onMount(() => {
		fakeImages = collection.getElementsByClassName('dummyimage');
    
    // some wizardry for keeping tabs on the collections
    elements.add(collection);
		return () => elements.delete(collection);
  });
  
  
  function extraHoverStuff(){
    if(bgcolor){
      let hslcolor = bgcolor.split(",");
      //check hovering....
      document.documentElement.style.setProperty('--bgcolor', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 1)`);
    }
    // grayscale other images
    elements.forEach(element => {
      element.style.removeProperty("transition");

      if (element !== collection) {
        element.style.transition = "0.9s all ease-out";
        element.style.filter = "opacity(0.94)";
        element.firstElementChild.style.filter = "sepia(0.25) grayscale(0.66)";
      }else{
        element.style.filter = "opacity(1)";
        element.firstElementChild.style.filter = "sepia(0) grayscale(0)";
      }
    });
  }

  // Rotate image stack on hover over
  function rotate() {
    clearTimeout(_waitingforSmoothness);

    Object.entries(fakeImages).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + ((parseInt(key)* 4) + 5)+ 'deg)';
    })

    firstImage.style.transform = 'scale(1.03) translateY(-3px)';
    originalbgcolor = getComputedStyle(document.documentElement).getPropertyValue('--bgcolor');
    //document.documentElement.style.setProperty('--bgcolor', `hsl(0, 0%, 90%)`);
    

    // set a timeout so things don't go batshit crazy if we hover a lot of elements
    _waitingforSmoothness = setTimeout(extraHoverStuff, 500);
    
    
  }

  // Un-Rotate image stack on hover out
  function unRotate() {
    clearTimeout(_waitingforSmoothness);
    Object.entries(fakeImages).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
    });
    firstImage.style.transform = 'scale(1) rotate(0deg)';
    document.documentElement.style.removeProperty('--bgcolor');

      //un-grayscale all images
      elements.forEach(element => {
        element.style.transform.delay
        element.style.removeProperty("transition");
        element.style.filter = "opacity(1)";
        element.firstElementChild.style.filter = "sepia(0) grayscale(0)";
      });
    
  }

  // Initiate the gallery and expand the stack
  function showContents(event){
    attemptingtoLoad = true;
    elements.forEach(element => {
      element.classList.add('neardeath');
      element.classList.add('no-pointer-events');
    });
    event.preventDefault();

    (async () => {
      await sleep(100);
      originalbgcolor = getComputedStyle(document.documentElement).getPropertyValue('--bgcolor');
      originaltextcolor = getComputedStyle(document.documentElement).getPropertyValue('--textcolor');
      
      if(bgcolor){
        
        let hslcolor = bgcolor.split(",");
        
        // Can I do this automatically to find the primary color of the image?
        document.documentElement.style.setProperty('--bgcolor', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 1)`);
        document.documentElement.style.setProperty('--bgcolortint', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 0.75)`);
        //document.documentElement.style.setProperty('--bgcolordarktint', `hsl(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]/hslcolor[1] * 15}%)`);
      }

      if(textcolor){
        let hslcolor = textcolor.split(",");
        document.documentElement.style.setProperty('--textcolor', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 1)`);
      }

    })();
    
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
      let myId = parseInt(element.dataset.id);
      
      if(myId!==$activeCollection){
        element.style.transform = `translateX(${rect.left/3 - centerX/3}px) translateY(${rect.top/3 - centerY/3}px)`
      }
    });

  }

  // Function for bringing the stacks back after we've closed an Expanded Gallery
  function resetStacks(){
    console.log('resetting...');

    document.documentElement.style.removeProperty('--bgcolor');
    document.documentElement.style.setProperty('--textcolor', originaltextcolor);
    
    // Tells the expanded gallery that we're about to destroy it, so we can then call the consolitateStuff() function.
    // might be able to call the funtion directly instead of this??
    destroyingExpandedGallery.update(n => true);

    elements.forEach(element => {
      element.classList.remove('neardeath'); 
    });
    
    (async () => {
      await sleep(200);
      activeCollection.update(n => 0);
      attemptingtoLoad = false;
      elements.forEach(element => {
        element.style.transform = `translateX(0px) translateY(0px)` 
      });

    })();
    (async () => {
      await sleep(600);
      elements.forEach(element => {
      element.classList.remove('no-pointer-events');
      });
    })();
  }
  
  // Calls when first image in each collection loads.
  function handleFirst(event) {
    // Some weird thing that the image is there but hasn't rendered to the DOM yet?
    // Maybe I could put this in afterupdate instead?
    // Perhaps my lazyloading just sucks?
    (async () => {
      await sleep(150);
      firstImage = collection.getElementsByTagName('img')[0];
      //stackHeight = firstImage.dataset.height/2;
      stackHeight = firstImage.height - 10;
      stackWidth = firstImage.dataset.width/2;
      console.log(firstImage.dataset.height)
    })();
  }

  function handleLoadingComplete(event) {
    count = count + event.detail.loadingComplete;
    // console.log(event);
    if(count === imagecollection.length){
      console.log("Loading complete");
      loadingSecondary.update(n => false);
      count = 0;
      let galleryExpandedContainer = galleryExpanded.firstElementChild;
      let loadedImages = galleryExpanded.getElementsByTagName('img');
      let loadedItems = galleryExpanded.getElementsByClassName('galleryitem');

      // Sleeping fixes everything
      (async () => {
        await sleep(50);
        Object.entries(loadedItems).forEach(([key, value]) => {
          let imgHeight = value.firstElementChild.dataset.height/2;
          value.style.height = imgHeight+'px';
          // console.log(value);
          // console.log(`height is ${imgHeight}`);
        });
      })();
      
    }
  }
</script>

<style>
  /* These refer to the darkness class, none or total */
  h2{
    position: absolute; bottom: -60px; left: -10px;
    font-weight: 200;
    padding: 0.5em 0 0.5em 0.5em;
    margin-left: 0.8em;
    font-size: 0.85em;
    color: var(--textcolor);
    display: block;
    width: 99%;
  }

  h2:after{
    position: relative;
    display: block;
    content: '';
    height: 1px;
    width: 100%;
    bottom: -8px;
    background: linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.1) 25%,rgba(0,0,0,0.1) 55%, rgba(0,0,0,0) 100%);
  }

  h2 span{
    display: block;
    color: #a9a9a9;
    font-size: 0.75em;
  }

  .collection.active{
    z-index: 2 !important;
    opacity: 0.6;
  }

  .collection.nonactive{
    opacity: 0;
    pointer-events: none;
  }

  .collection :global(.loader){
    border-radius: 4px;
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
    /* position: absolute;
    top: 0; left: 0; */
    /* width: calc(100% - 2px);
    height: calc(100% - 2px);
    min-width: calc(100% - 2px);
    min-height: calc(100% - 2px);
        border: 1px solid #fff;
         */
    box-shadow: 0 0 2px #ccc;
    /* transition: 0.15s all ease-out; */
    border-radius: 4px;

  } 

  .collection:hover :global(img){
    transition: 0.3s all ease-out;
    /* border: 1px solid rgba(90,90,90,0.7); */
  }

  .collection :global(img:first-child){
    box-shadow: 0px 1px 3px rgba(90,90,90, 0.2)
  }
  .collection:hover :global(img:first-child){
    box-shadow: 0px -5px 20px rgba(90,90,90, 0.2)
  }

  .breadcrumb{
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
      color: var(--textcolor);
      padding-left: 16px;
      text-transform: none;
    }
    .breadcrumb p:before, .breadcrumb p:after{
      content: '';
      display: block;
      position: absolute;
      left: 6px; top: 7px;
      height: 6px; width: 2px;
      background: currentColor;
      transform: rotate(45deg);
      transition: 0.3s all;
    }
    .breadcrumb p:hover:before{
      transform: translateX(-2px) rotate(45deg);
    }
    .breadcrumb p:hover:after{
      transform: translateX(-2px) rotate(-45deg);
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

</style>

{#if $activeCollection == id}
  <div id="breadcrumb" class="breadcrumb" on:click={resetStacks} in:fly="{{ y: -40, duration: 400 }}" out:fly="{{ y: -40, duration: 400 }}" >
    <p>{name}</p>
  </div>
{/if}
<!-- style="height: {stackHeight}px; width: {stackWidth}px" -->
<a href="{imagecollection[0].hires}" class:active="{id === $activeCollection && $loadingSecondary == true}" 
     class:nonactive="{$activeCollection!== 0 && id !== $activeCollection}" 
     class="collection" 
     
     data-id={id} 
     bind:this={collection} 
     on:mouseenter={rotate} 
     on:mouseleave={unRotate} 
     on:click={showContents}>

  <!-- in case we want a spinner  -->
  {#if $activeCollection == id}
    <Spinner />
  {/if}

  <!-- Initial Stacked Gallery, we only load the first image -->
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image="{image.lowres}" on:loadingComplete="{handleFirst}" />
    {:else}
      <div class="dummyimage" style="height: {stackHeight}px; transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></div>
    {/if}
  {/each}
  <h2>
    {name}
    <span>({imagecollection.length} Images)</span>
  </h2>
</a>

<!-- Real Gallery, we load all images and then it can be expanded -->
{#if attemptingtoLoad}
  <!-- {@debug imagecollection} -->
   <div class="loading--{$loadingSecondary}" bind:this={galleryExpanded}>
    <GalleryExpanded stack={imagecollection} originaltarget={collection} on:loadingComplete="{handleLoadingComplete}"  />
  </div>
{/if}
