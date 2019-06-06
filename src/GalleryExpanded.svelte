<script>
  // This component expands the stack to show all images within the stack
  // and then loads higher res images (if user clicks an image) and displays 
  // them in a prev/next style lightbox.

  import Image from './Image.svelte';
  import Spinner from './Spinner.svelte';
  import { onMount, afterUpdate, onDestroy, createEventDispatcher } from 'svelte';
  import { destroyingExpandedGallery, loadingSecondary } from './stores.js';
  import { fade } from 'svelte/transition';
  //import { _resetStacks } from './GalleryStack.svelte';

  export let stack;
  export let lowresdir;
  export let hiresdir;
  export let originaltarget;

  const dispatch = createEventDispatcher();

  // references to divs
  let activeCollection;
  let thirdLevel;

  // placeholders for objects that we'll iterate over
  let images;
  let hiresImages;

  // indexes of the current image (why are there two??)
  let current;

  // Scroll position stuff
  let y;
  let originalScrollPos;
  let hiresScrollPos;
  
  // Handles transition of single gallery image when it transitions to hi-res.
  let transitionHandler;
  
  // count for loading
  let count = 0;

  // booleans, do I need so many?
  let showTitles          = true;
  let hiresLoaded         = false;
  let ready               = false;
  let loadedSuccessfully  = false;
  let expandedOnce        = false;
  let transitioning       = false;
  let closedGallery       = false;
  
  // could probably remove the need for this?
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  // want a reference to each gallery items within the active Collection.
  onMount(() => {
    images = activeCollection.getElementsByClassName('galleryitem');
    
    // want the item in a stack on first mount
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
    console.log('being destroyed... laters');
    destroyingExpandedGallery.update(n => false);
  });

  function handleLoadingComplete(event){
    count = count + event.detail.loadingComplete;
    if(count === stack.length){
      count = 0;
      loadedSuccessfully = true;
    }
  }

  function handleLoadingHiResComplete(event){
    count = count + event.detail.loadingComplete;
    if(count === stack.length){
      count = 0;
      hiresLoaded = true;
    }
    hiresImages = thirdLevel.getElementsByClassName('hi-image');
  }

  // Keyboard functionality.
  function handleKeydown(event){
    if(event.code == "ArrowRight"){
      showNext();
    }
    if(event.code == "ArrowLeft"){
      showPrevious();
    }
    if(event.code == "Escape"){
      if(!closedGallery){
        closeGallery();
      }else{
        document.getElementById("breadcrumb").click();
      }
    }
  }

  function loadLargeImages(event, index){
    current = index;
    event.preventDefault();

    // animates clicked image into center of screen.
    animateClicked(current);

    // Gets the hi-res images into the DOM and loading
    ready = true;
  }
  
  // Function for bringing everything together.
  function attemptToConsolidate(){
    activeCollection.classList.add('no-pointer-events');

    //sometimes the object is undefined I don't know why.
    if(images !== undefined){
      console.log("weren't me guv, everything normal...");
      performConsolidation();
    
    // not sure I'm even experiencing this bug anymore, but can't hurt to be sure?
    }else{
      console.log('object was undefined, hard luck son.');
      
      // Try again?
      (async () => {
        await sleep(180);
        Object.entries(images).forEach(([key, value]) => {
          console.log('trying again...');
          performConsolidation();
        });
      })();
    }
  }

  // sometimes the object is empty, so we want a function that only runs when the object is there.
  // This is only called by the attemptToConsolidate function.
  function performConsolidation(){
    let rect = originaltarget.getBoundingClientRect();
    
    Object.entries(images).forEach(([key, value]) => {
      let imageDivRect = value.getBoundingClientRect();
      let transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 4) - imageDivRect.y}px) rotate(${key * 4}deg)`;
      
      // If first image
      if(key == 0){
        transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 6) - imageDivRect.y}px) scale(1.08) translateY(5px) rotate(-2deg)`;
      }
      
      value.style.zIndex = images.length - key;

      // if gallery is being closed/destroyed we want a quicker transition.
      if($destroyingExpandedGallery){

        // Scroll to position we were at when item was first clicked.
        window.scrollTo(0, originalScrollPos);
        activeCollection.style.transform = `translateY(0px)`;
        transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
        
        // Quick transition please.
        value.classList.add('quicktransition');

        // Set tranformed style.
        value.style.transform = transformedStyle;

        }else{
        // Set tranformed style.
        value.style.transform = transformedStyle;
      }
      
    });
  }

  // Function for Expanding things into place.  
  function expandStuff(){
    
    originalScrollPos = scrollY;
    window.scrollTo(0,0);
    activeCollection.style.transform = `translateY(-${originalScrollPos}px)`;
  
    (async () => {
      await sleep(80);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        transitioning = true;
        value.classList.add('slowtransition');
        value.style.transform = `translateX(0px) translateY(${originalScrollPos}px)`; //translateY(${originalScrollPos}px)`;
      });
    })();

    (async () => {
      // sleep for half a second
      await sleep(500);
      activeCollection.classList.remove('no-pointer-events');
      transitioning = false;
    })();
  }

  // animate clicked image to the center.
  function animateClicked(current){
    let currentImage = images[current].getElementsByTagName('img')[0];
    let rect = images[current].getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;

    let centerArea = centerX + centerY * 2;
    let imageArea = rect.width + rect.height;

    showTitles = false;
    Object.entries(images).forEach(([key, value]) => {
      value.style.zIndex = '1';
    });

    currentImage.classList.remove('notransition');
    currentImage.classList.remove('quicktransition');
    images[current].style.zIndex = '99';
    hiresScrollPos = scrollY;

    (async () => {
      await sleep(10);
      currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;
      currentImage.addEventListener('transitionend', transitionHandler = () => {
        console.log('Transition ended');
        document.getElementsByTagName("body")[0].classList.add('locked');
      });
    })();
    closedGallery = false;
  }

  function showPrevious(){
    let offset = 25;
    if(current <= 0) {
      hiresImages[0].style.transform = `translateX(${offset}px)`;
      hiresImages[stack.length - 1].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep for half a second
        await sleep(200);
        current = stack.length - 1;
        setImagePos(current);
      })();
    }else{
      hiresImages[current].style.transform = `translateX(${offset}px)`;
      hiresImages[current - 1].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep for half a second
        await sleep(200);
        current--;
        setImagePos(current);
      })();
    }
    

  }
  
  function showNext(){
    let offset = 25;
    
    if(current >= (stack.length - 1)) {
      hiresImages[0].style.transform = `translateX(${offset}px)`;
      hiresImages[stack.length - 1].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep for half a second
        await sleep(200);
        current = 0;
        setImagePos(current);
      })();
    }else{
      hiresImages[current].style.transform = `translateX(-${offset}px)`;
      hiresImages[current + 1].style.transform = `translateX(${offset}px)`;
      (async () => {
        // sleep for half a second
        await sleep(200);
        current++;
        setImagePos(current);
      })();
    }
  }

  // Sets non-active gallery items to a position where they can shrink from when the hi-res gallery is closed.
  function setImagePos(current){
    let rect = images[current].getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;
    let centerArea = centerX + centerY * 2;
    let imageArea = rect.width + rect.height;
    let currentImage = images[current].getElementsByTagName('img')[0];

    
    Object.entries(images).forEach(([key, value]) => {
      value.style.zIndex = '1';
      value.firstChild.classList.add('notransition');
      value.firstChild.classList.remove('hitransition');
      value.firstChild.style.transform = `translateX(0) translateY(0px) scale(1)`;
    });

    images[current].style.zIndex = '99';
    currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;
  }

  function closeGallery(){
      let currentImage = images[current].getElementsByTagName('img')[0];
      let currentTransformPos = currentImage.style;
      currentImage.removeEventListener('transitionend', transitionHandler ,false);

      // this is tricky because we might need two offset values
      window.scrollTo(0, hiresScrollPos);
      document.getElementsByTagName("body")[0].classList.remove('locked');

      currentImage.classList.remove('notransition');
      currentImage.classList.add('hitransition');

      (async () => {
        // wait for animation to end.
        await sleep(200);
        currentImage.style.transform = `translateX(0) translateY(0) scale(1)`;
        ready = false;
        hiresLoaded = false;
        showTitles = true;
      })();
      
      closedGallery = true;
  }

</script>

<style>
  /* TODO: Clean+optimise these a little, get rid of any globals. */
  h2{
    position: absolute; bottom: -50px; left: -10px;
    font-weight: 200;
    padding: 0.5em 0;
    margin-left: 0.8em;
    font-size: 0.9em;
    color: #222;
    opacity: 0;
    width: 99%;
    transition: 0s opacity;
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

  .in{
    opacity: 1;
    transition: 0.4s 0.6s opacity;
  }
  .out{
    opacity: 0 !important;
  }

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
    background: #ccc;
  }
  .transitioning :global(img) {
    transition: 0s all;
  }
  .transitioning .magnify {
    display: none;
  }
  .stack :global(.slowtransition) {
    /* transition: all 3.6s cubic-bezier(0,0,.13,1.33) !important; */
    transition: all 0.5s cubic-bezier(0.38, 0.56, 0.21, 1.15) !important;
  }
  .stack :global(.quicktransition) {
    transition: transform 0.2s cubic-bezier(0,0,.13,1.2), opacity 0.3s ease-out !important;
    opacity: 0.5;
  }
  .stack :global(.hitransition) {
    transition: transform 0.33s cubic-bezier(0,0,.13,1.1);
    opacity: 1;
  }
  .stack :global(a:first-child.quicktransition) {
    transition: transform 0.2s cubic-bezier(0,0,.13,1.06) !important;
    opacity: 1;
  }

  .gallery{
    display: flex;
    flex: 1 auto;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center;
  }

  .gallery a{
    position: relative;
    margin: 1em 1.5em 3em 1.5em;
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
    opacity: 0;
    transition: 0.8s opacity;
  }

  .hires.ready{
    opacity: 1;
  }

  .hires :global(img){
    object-fit: contain;
    position: absolute; top: 0;
  }

  .hires div{
    opacity: 0;
    transition: 0.3s all;
    width: 100vw; height: 100vh;
    position: absolute;
  }
  
  .hires div.active{
    opacity: 1;
    transform: translateX(0) !important;
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
    color: #333;
    left: 0.4em; top: 0.5em;
    position: absolute;
    font-weight: 300;
    text-transform: lowercase;
    font-weight: bold;
    font-size: 1.2em;
    width: 40px; height: 40px;
    padding-left: 16px;
    cursor: pointer;
  }
  .close:before, .close:after{
    content:'';
    position: absolute;
    width: 10px;
    height: 2px;
    background: #333;
    left: 1px; top: 11px;
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
  .magnify.out{
    transition: 0s opacity;
  }
  .magnify:before{
    content: '';
    position: absolute;
    right: calc(50% - 22px);
    bottom: calc(50% - 16px);
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
    position: absolute; left: calc(50% - 24px); top: calc(50% - 22px);
    z-index: 9;
  }
  
</style>

<svelte:window bind:scrollY={y} on:keydown={handleKeydown}/>
  <div class="stack gallery" bind:this={activeCollection} >
    {#each stack as image, index}
      <a class:transitioning="{transitioning === true}" class="galleryitem" href="{hiresdir}/{image.src}" on:click={e => loadLargeImages(e, index)}> 
        <Image image="{lowresdir}/{image.src}" on:loadingComplete />
        <span class:out="{showTitles === false}" class="magnify"></span>
        <h2 class:out="{$destroyingExpandedGallery === true || showTitles === false}" class:in="{$loadingSecondary === false && showTitles !== false && !$destroyingExpandedGallery}">
          {image.name}
        </h2>
      </a>
    {/each}
  </div>

{#if ready}
  {#if !hiresLoaded}
    <Spinner />
  {/if}
  <div class="hires" class:ready="{hiresLoaded === true}" out:fade="{{duration: 100}}" bind:this={thirdLevel}>
    {#each stack as image, index}
      <div class:active="{current === index}" class="hi-image" >
        <Image image="{hiresdir}/{image.src}" on:loadingComplete={handleLoadingHiResComplete}/>
      </div>
    {/each}
    <span class="previous" on:click={showPrevious}></span>
    <span class="next" on:click={showNext}></span>
    <span class="close" on:click={closeGallery}>close</span>
  </div>
{/if}