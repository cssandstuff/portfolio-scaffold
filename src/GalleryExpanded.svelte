<script>
  // This component expands the stack to show all images within the stack
  // and then loads higher res images (if user clicks an image) and displays 
  // them in a prev/next style carousel.

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
  let ready;
  let current;
  let y;
  let expandedOnce = false;
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  // count for loading
  let count = 0;
  const dispatch = createEventDispatcher();

  // sometimes the object is empty, so we want a function that only runs when the object is there.
  // This is only called by the attemptToCOnsolidate function.
  function performConsolidation(){
    let rect = originaltarget.getBoundingClientRect();

    Object.entries(images).forEach(([key, value]) => {
      let imageDivRect = value.getBoundingClientRect();
      let transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 4) - imageDivRect.y}px) rotate(${key * 4}deg)`;
      
      if(key == 0){
        transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 6) - imageDivRect.y}px) scale(1.08) translateY(5px) rotate(-2deg)`;
      }
      
      // if gallery is being closed/destroyed we want a quicker transition.
      if($destroyingExpandedGallery){
        value.classList.add('quicktransition');
        transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
      }else{
        value.parentNode.style.zIndex = imageCount - key;
      }
      // Set tranformed style.
      value.style.transform = transformedStyle;
    });
  }
  // Function for bringing everything together.
  function attemptToConsolidate(){
    
    secondLevel.classList.add('no-pointer-events');

    console.log("BOTCH");
    console.log(images);

    //sometimes the object is undefined I don't know why.
    if(images !== undefined){
      console.log("weren't me guv");
      performConsolidation();
    }else{
      console.log('object was undefined, hard luck son.');
      
      (async () => {
        
        await sleep(180);
        Object.entries(images).forEach(([key, value]) => {
          console.log('trying again');
          performConsolidation();
        });
      })();
    }
  }

  // Function for Expanding things into place.
  function expandStuff(){
    
    secondLevel.style.transform = `translateY(${scrollY}px)`;
    

    (async () => {
      await sleep(80);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        value.classList.add('slowtransition');
        value.style.transform = `translateX(0px) translateY(0px)`;
      });
    })();

    (async () => {
      // sleep for half a second
      await sleep(500);
      secondLevel.classList.remove('no-pointer-events');
    })();
  }

  onMount(() => {
    images = secondLevel.getElementsByTagName('img');
    imageCount = secondLevel.getElementsByTagName('img').length; 
    attemptToConsolidate();
  });

  // Might be able to refactor this to not use AfterUpdate, 
  // but for now it seems ok.
  afterUpdate(() => {
    if(!$loadingSecondary && !$destroyingExpandedGallery && !expandedOnce){
      expandStuff();
      expandedOnce = true;
    }
    if($destroyingExpandedGallery && expandedOnce){
      attemptToConsolidate();
      expandedOnce = false;
    }
  });

  onDestroy(() => {
    console.log('being destroyed');
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
      count = 0;
      document.documentElement.classList.add('locked');
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

  function closeGallery(){
    ready = false;
    document.documentElement.classList.remove('locked');
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
    /* transition: all 3.6s cubic-bezier(0,0,.13,1.33) !important; */
    transition: all 0.5s cubic-bezier(0.38, 0.56, 0.21, 1.15) !important;
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
    /* height: 100%; */
    width: auto;
    margin: 1em;
  }
  .gallery a{
    position: relative;
    margin: 1em 1.5em 3em 1.5em;
  }
  .gallery :global(img) {
    width: calc(22em - 3em);
    margin: 0;
    height: 15em;
    min-width: 0 !important;
    min-height: 0 !important;
  }
  .gallery a:hover .magnify{
    opacity: 1;
  }
  .hires{
    position: fixed;
    top: 0; left: 0;
    z-index: 99;
    height: 100vh; width: 100vw;
    background: #fff;
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
    top: calc(50vh - 60px);
    background: rgba(255,255,255,0.05);
    height: 120px; width: 80px;
    cursor: pointer;
    transition: 0.4s all;
  }
  .previous:hover, .next:hover{
    background: rgba(255,255,255,0.15);
  }
  .previous:hover{
    transform: translateX(-5px);
  }
  .next:hover{
    transform: translateX(5px);
  }
  .previous:before, .previous:after, .next:before, .next:after{
    content:'';
    position: absolute;
    width: 22px;
    height: 2px;
    background: #999;
    right: 20px; top: 50px;
  }
  .previous:before{
    transform: rotate(-45deg)
  }
  .previous::after{
    transform: rotate(45deg);
    top: 65px;
  }
  .next:before{
    transform: rotate(45deg)
  }
  .next::after{
    transform: rotate(-45deg);
    top: 65px;
  }
  .previous{
    left: 0;
    border-radius: 0 20px 20px 0;
  }
  .next{
    right: 0;
    border-radius: 20px 0 0 20px;
  }
  .close{
    color: #999;
    left: 1em; top: 1em;
    position: absolute;
    font-weight: 300;
    text-transform: uppercase;
    font-size: 0.8em;
    width: 40px; height: 40px;
    padding-left: 20px;
    cursor: pointer;
  }
  .close:before, .close:after{
    content:'';
    position: absolute;
    width: 15px;
    height: 2px;
    background: #999;
    left: 0; top: 7px;
  }
  .close:before{
    transform: rotate(-45deg);
  }
  .close:after{
    transform: rotate(45deg);
  }
  .magnify{
    width: 100%;
    background-color: var(--bgcolortint);
    height: 100%;
    position: absolute; bottom: 0; right: 0;
    opacity: 0;
    transition: 0.3s opacity;
  }
  .magnify:before{
    content: '';
    position: absolute;
    right: calc(50% - 30px);
    bottom: calc(50% - 6px);
    width: 14px;
    height: 4px;
    background: #fff;
    transform: rotate(45deg);
  }
  .magnify:after{
    content: '';
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 4px solid #fff;
    position: absolute; left: calc(50% - 16px); top: calc(50% - 32px);
    z-index: 9;
  }
</style>

<svelte:window bind:scrollY={y}/>
<div class="stack gallery" bind:this={secondLevel} >
  {#each stack as image, index}
    <a href="{hiresdir}/{image.src}" on:click={e => loadLargeImages(e, index)}> 
      <Image image="{lowresdir}/{image.src}" on:loadingComplete />
      <span class="magnify"></span>
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
    <span class="close" on:click={closeGallery}>close</span>
  </div>
{/if}