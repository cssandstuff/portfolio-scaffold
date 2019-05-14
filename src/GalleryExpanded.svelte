<script>
  import Image from './Image.svelte';
  import { onMount, afterUpdate, onDestroy, createEventDispatcher } from 'svelte';
  import { destroyingExpandedGallery, loadingSecondary } from './stores.js';

  export let stack;
  export let lowresdir;
  export let hiresdir;
  export let originaltarget;

  // Local stuff
  let secondLevel;
  let thirdLevel;
  let images;
  let imageCount;
  let ExpandedBefore = false;
  let ConsolidatedBefore = false;
  let ready;
  let current;
  let y;
  // count for loading
  let count = 0;
  const dispatch = createEventDispatcher();

  // Function for bringing everything together.
  function consolidateStuff(){
    let rect = originaltarget.getBoundingClientRect();
     
    Object.entries(images).forEach(([key, value]) => {
      let imageDivRect = value.getBoundingClientRect();
      let transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
      
      // if gallery is being closed/destroyed we want a quicker transition.
      if($destroyingExpandedGallery){
        value.classList.add('quicktransition');
      }else{
        value.parentNode.style.zIndex = imageCount - key;
      }
      // Set tranformed style.
      value.style.transform = transformedStyle;
    });

  }

  // Function for Expanding things into place.
  function expandStuff(){
    secondLevel.style.transform = `translateY(${scrollY}px)`
    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

    (async () => {
      await sleep(50);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        value.classList.add('slowtransition');
        value.style.transform = `translateX(0px) translateY(0px)`
      });
    })();
  }

  onMount(() => {
    images = secondLevel.getElementsByTagName('img');
    imageCount = secondLevel.getElementsByTagName('img').length;
    consolidateStuff();
    
  });

  afterUpdate(() => {
    if($loadingSecondary && !ExpandedBefore){
      expandStuff();
      ExpandedBefore = true;
    }
    if($destroyingExpandedGallery && !ConsolidatedBefore){
      consolidateStuff();
      ConsolidatedBefore = true;
    }
  });

  onDestroy(() => {
    console.log('being destoryed');
    destroyingExpandedGallery.update(n => false);
  });

  function loadLargeImages(event, index){
    current = index;
    event.preventDefault();
    // after loading 
    ready = true;
  }

  function handleLoadingHiResComplete(event){
    count = count + event.detail.loadingComplete;
    if(count === stack.length){
      // show the image that was clicked.
      console.log(count);
      console.log(current);
      console.log(thirdLevel);

      count = 0;
    }
  }

  function showPrevious(){
    console.log(`current image is ${current}`)
    console.log("go prev");
    
    if(current <= 0) {
      current = stack.length - 1;
    }else{
      current--;
    }
    console.log(`current image is ${current}`)
  }
  function showNext(){
    
    if(current >= (stack.length - 1)) {
      current = 0;
    }else{
      current++;
    }
    console.log(`current image is ${current}`)

  }
</script>

<style>
  .stack{
    position: absolute !important;
    top: 2em; right: 2em;
    width: calc(100vw - 4em) !important;
    z-index: 3;
  }
  .stack a{
    display: block;
  }
  .stack :global(img) {
    box-shadow: 0 0 2px #ccc;
    border-radius: 4px;
    transition: 0s all !important;
    background: #ccc;
  }
  .stack :global(.slowtransition) {
    transition: all 0.6s cubic-bezier(0,0,.13,1.33) !important;
  }
  .stack :global(.quicktransition) {
    transition: transform 0.2s cubic-bezier(0,0,.13,1.2), opacity 0.3s ease-out !important;
    opacity: 0;
  }
  .stack :global(img:first-child.quicktransition) {
    transition: transform 0.2s cubic-bezier(0,0,.13,1.06) !important;
    opacity: 1;
  }

  .gallery{
    display: flex;
    flex: 1 auto;
    flex-basis: 25em;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
    height: 100%;
    width: auto;
    margin: 1em;
  }
  .gallery :global(img) {
    width: calc(25em - 3em);
    margin: 1em 1.5em 3em 1.5em;
    height: 15em;
    min-width: 0 !important;
    min-height: 0 !important;
    
  }
  /* Experimenting with grid. 
  .gallery{ 
    display: grid;
    position: absolute;
    grid-template-columns: 4fr 1fr 1fr;
    grid-template-rows: repeat(3, 1fr);
    grid-gap: 4em;
    width: calc(100% - 8em);
    height: 100%;
    z-index: 2;
  }
  .gallery :global(img:first-child) {
    grid-row-start: 1;
    grid-row-end: -1;
  } */
  .hires{
    position: fixed;
    top: 0; left: 0;
    z-index: 99;
    height: calc(100vh - 40px); width: 100vw;
    margin-top: 40px;
    background: #222;
  }
  .hires :global(img){
    object-fit: contain;
    position: absolute; top: 0;
  }
  .hires div{
    opacity: 0;
    transition: 0.3s all;
  }
  .hires div.active{
    opacity: 1;
  }
  .previous, .next{
    position: absolute;
    top: calc(50vh - 40px);
    background: yellow;
    height: 40px; width: 40px;
  }
  .previous{
    left: 0;
  }
  .next{
    right: 0;
  }
</style>

<svelte:window bind:scrollY={y}/>
<div class="stack gallery" bind:this={secondLevel} >
  {#each stack as image, index}
    <a href="{hiresdir}/{image.src}" on:click={e => loadLargeImages(e, index)}> 
      <Image image="{lowresdir}/{image.src}" on:loadingComplete />
    </a>
  {/each}
</div>

{#if ready}
  <div class="hires" bind:this={thirdLevel} >
    {#each stack as image, index}
      <div class:active="{current === index}">
      <Image image="{hiresdir}/{image.src}" on:loadingComplete={handleLoadingHiResComplete}/>
      </div>
    {/each}
    <span class="previous" on:click={showPrevious}></span>
    <span class="next" on:click={showNext}></span>
  </div>
{/if}