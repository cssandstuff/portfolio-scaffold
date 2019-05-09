<script>
  import Image from './Image.svelte';
  import GalleryExpanded from './GalleryExpanded.svelte';
  import { afterUpdate, createEventDispatcher } from 'svelte';
  import { expoOut } from 'svelte/easing';
  import { fade, fly } from 'svelte/transition';
  import { activeCollection, destroyingCollection, loadingSecondary } from './stores.js';
  
  export let imagecollection;
  export let id;

  const dispatch = createEventDispatcher();

  // Local stuff
  let collection;
  let secondLevel;
  let darkness;
  let count = 0;
  let attemptingtoLoad = false;
  let resetStacksBefore = false;

  // Rotate images on hover
  function rotate() {
    let images = collection.getElementsByTagName('span');
    let firstImage = collection.getElementsByTagName('img')[0];
    collection.style.transform = 'rotate(-1.5deg)';
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1.08) translateY(10px)';
  }

  // Un-Rotate images on hover out
  function unRotate() {
    let images = collection.getElementsByTagName('span');
    let firstImage = collection.getElementsByTagName('img')[0];
    collection.style.transform = 'rotate(0deg)';
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1)';
    //collection.style.zIndex = '0';
  }
  
  // Initiate the gallery and expand the stack
  function showContents(){
    attemptingtoLoad = true;
    
    //this makes the child component load.
    dispatch('expand', {
        active: id
    }); 

    //this sets the loading to true.
    loadingSecondary.update(n => true);
  }

  // Function for resetting the stacks
  function resetStacks(){
    if(!resetStacksBefore){
      console.log('resetting stacks');
      let images = collection;
      var rect = collection.getBoundingClientRect();
      collection.style.transform = `translateX(0px) translateY(0px)`

      const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
        destroyingCollection.update(n => true);
        (async () => {
          await sleep(200);
          dispatch('expand', {
              active: 0
          });
          attemptingtoLoad = false;
        })();
        resetStacksBefore = true;
    }
  }

  // Blow away the other stacks when we're initiating an Expanded Gallery
  function blowStacks(){
    let images = collection;
    var rect = collection.getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;
    
    collection.style.transform = `translateX(${rect.left/3 - centerX/3}px) translateY(${rect.top/3 - centerY/3}px)`
  }


  // Lifecycle event. Calls whenever an update happens.
  // some of this might need refactoring, not quite sure why it can't be in mnormal functions.
  afterUpdate(() => {
    if($activeCollection != id && $activeCollection!==0){
      darkness = 'total';
      collection.classList.add('notransition');
      blowStacks();
    }else if($activeCollection === id){
      darkness = 'none';
      collection.classList.add('notransition');
      resetStacksBefore = false;
    }else{
      darkness = '';
      collection.classList.remove('notransition');
      if($destroyingCollection){
        resetStacksBefore = false;
        resetStacks();
      }
    }
  });
  
  // Wanted to have a loader, so this tells me when all Image components in an Expanded Gallery have loaded.
  function handleLoadingComplete(event) {
    count = count + event.detail.loadingComplete;
    if(count === imagecollection.length){
      loadingSecondary.update(n => false);
      count = 0;
    }
	}
  
</script>

<style>
  /* clean up these styles a little bro */
  .total{
    opacity: 0;
    pointer-events: none;
  }
  .notransition{
    opacity: 0;
    transition: 0s !important;
  }
  .none{
    z-index: 2 !important;
    opacity: 0;
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

  .bg{
    /*TODO need this to be a sticky menu */
    background: #fff;
    opacity: 1;
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 20px;
    animation: hello 0s forwards;
    pointer-events: none;
    z-index: 1;
  }
  @keyframes hello{
    0%{
      opacity: 0;
      pointer-events: none;
    }
    100%{
      opacity: 1;
      pointer-events: auto;
    }
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


<div class="collection {darkness}" on:mouseenter={rotate} on:mouseleave={unRotate} bind:this={collection} on:click={showContents}>
  <!-- in case we want a spinner 
  {#if $activeCollection == id}
    <svg class="spinner" viewBox="0 0 50 50">
    <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle>
    </svg>
  {/if} -->

  <!-- Initial Stacked Gallery, we only load the first image -->
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image={image.src} />
    {:else}
      <span class="dummyimage" style="transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></span>
    {/if}
  {/each}

</div>
<!-- Real Gallery, we only load all images and the can be expanded -->
{#if attemptingtoLoad}
   <div out:fade class="loading--{$loadingSecondary}">
    <GalleryExpanded stack={imagecollection} originaltarget={collection} on:loadingComplete="{handleLoadingComplete}"  />
  </div>
  {#if $activeCollection == id}<div class="bg" on:click={resetStacks}></div>{/if}
{/if}
