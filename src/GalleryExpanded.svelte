<script>
  // This component expands the stack to show all images within the stack
  // and then loads higher res images (if user clicks an image) and displays 
  // them in a prev/next style carousel.

  import Image from './Image.svelte';
  import { onMount, afterUpdate, onDestroy, createEventDispatcher } from 'svelte';
  import { destroyingExpandedGallery, loadingSecondary } from './stores.js';
  import { fade } from 'svelte/transition';

  export let stack;
  export let lowresdir;
  export let hiresdir;
  export let originaltarget;

  // Local stuff
  let secondLevel;
  let thirdLevel;
  let images;
  let hiresImages;
  let imageCount;
  let ready = false;
  let current;
  let clicked;
  let loadedSuccessfully = false;
  let y;
  let originalScrollPos;
  let hiresScrollPos;
  let expandedOnce = false;
  let transitionHandler;
  let animateDirection = 0;
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  // count for loading
  let count = 0;
  const dispatch = createEventDispatcher();

  onMount(() => {
    images = secondLevel.getElementsByClassName('galleryitem');
    imageCount = secondLevel.getElementsByClassName('galleryitem').length; 
    attemptToConsolidate();
  });

  // Might be able to refactor this to not use AfterUpdate, 
  // but for now it seems ok.
  afterUpdate(() => {
    if(!$loadingSecondary && !$destroyingExpandedGallery && !expandedOnce){
      expandStuff();
      expandedOnce = true;
      console.log('wtf');
    }
    if($destroyingExpandedGallery && expandedOnce){
      console.log('boom')
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
    clicked = index;
    event.preventDefault();
    animateClicked(current);
    ready = true;
  }

  function handleLoadingComplete(event){
    count = count + event.detail.loadingComplete;
    if(count === stack.length){
      count = 0;
      loadedSuccessfully = true;
    }
  }

  function handleLoadingHiResComplete(event){
    console.log('loading of hi res complete innit');
    count = count + event.detail.loadingComplete;
    if(count === stack.length){
      count = 0;

    }
    hiresImages = thirdLevel.getElementsByClassName('hi-image');
    console.log(hiresImages);
    console.log('loading of hi res complete innit');
  }
  
  // Function for bringing everything together.
  function attemptToConsolidate(){
    secondLevel.classList.add('no-pointer-events');

    //sometimes the object is undefined I don't know why.
    if(images !== undefined){
      console.log("weren't me guv");
      performConsolidation();
    }else{
      console.log('object was undefined, hard luck son.');
      
      // Try again?
      (async () => {
        await sleep(180);
        Object.entries(images).forEach(([key, value]) => {
          console.log('trying again');
          performConsolidation();
        });
      })();
    }
  }

  // sometimes the object is empty, so we want a function that only runs when the object is there.
  // This is only called by the attemptToCOnsolidate function.
  function performConsolidation(){
    let rect = originaltarget.getBoundingClientRect();
    
    Object.entries(images).forEach(([key, value]) => {
      let imageDivRect = value.getBoundingClientRect();
      let transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 4) - imageDivRect.y}px) rotate(${key * 4}deg)`;
      
      // If first image
      if(key == 0){
        transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 6) - imageDivRect.y}px) scale(1.08) translateY(5px) rotate(-2deg)`;
      }
      
      value.style.zIndex = imageCount - key;

      // if gallery is being closed/destroyed we want a quicker transition.
      if($destroyingExpandedGallery){
        console.log(`destroying originalScrollPos = ${originalScrollPos}`);

        window.scrollTo(0, originalScrollPos);
        secondLevel.style.transform = `translateY(0px)`;
        transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
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
    console.log(`scrollOffset = ${scrollY}`);
    
    originalScrollPos = scrollY;
    window.scrollTo(0,0);
    secondLevel.style.transform = `translateY(-${originalScrollPos}px)`;
  
    (async () => {
      await sleep(80);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        value.classList.add('slowtransition');
        value.style.transform = `translateX(0px) translateY(${originalScrollPos}px)`; //translateY(${originalScrollPos}px)`;
      });
    })();

    (async () => {
      // sleep for half a second
      await sleep(500);
      secondLevel.classList.remove('no-pointer-events');
    })();
  }

  function animateClicked(current){
    
    let currentImage = images[current].getElementsByTagName('img')[0];
    let rect = images[current].getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;

    let centerArea = centerX + centerY * 2;
    let imageArea = rect.width + rect.height;

    Object.entries(images).forEach(([key, value]) => {
      value.style.zIndex = '1';
    });

    currentImage.classList.remove('notransition');
    currentImage.classList.remove('quicktransition');
    images[current].style.zIndex = '99';
    hiresScrollPos = scrollY;
    console.log(`hiresScrollPos is ${hiresScrollPos}`);

    (async () => {
      await sleep(10);
      currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;
      //document.documentElement.classList.add('locked');
      
      currentImage.addEventListener('transitionend', transitionHandler = () => {
        console.log('Transition ended');
        document.getElementsByTagName("body")[0].classList.add('locked');
      });
    })();

    
  }

  function showPrevious(){
    let offset = 50;
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
    let offset = 50;
    
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

  function setImagePos(current){
    let rect = images[current].getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;
    let centerArea = centerX + centerY * 2;
    let imageArea = rect.width + rect.height;
    let currentImage = images[current].getElementsByTagName('img')[0];
    let openedImage = images[clicked].getElementsByTagName('img')[0];
    
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
      console.log(originalScrollPos);
      // this is tricky because we might need two offset values
      window.scrollTo(0, hiresScrollPos);
      document.getElementsByTagName("body")[0].classList.remove('locked');
      console.log(scrollY);

      currentImage.classList.remove('notransition');
      currentImage.classList.add('hitransition');

      (async () => {
        // sleep for half a second
        await sleep(200);
        currentImage.style.transform = `translateX(0) translateY(0) scale(1)`;
        ready = false;
      })();
      
  
  }

  function handleKeydown(event){
    if(event.code == "ArrowRight"){
      showNext();
    }
    if(event.code == "ArrowLeft"){
      showPrevious();
    }
    if(event.code == "Escape"){
      closeGallery();
    }
  }
</script>

<style>
  h2{
    position: absolute; bottom: -50px; left: -10px;
    font-weight: 200;
    padding: 0.5em 0;
    margin-left: 0.8em;
    font-size: 0.9em;
    color: #222;
    opacity: 0;
    width: 99%;
  }
  .in{
    animation: 0.4s 0.6s bringitIn forwards;
  }
  .out{
    animation: 0.4s 0.6s bringitIn reverse;
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
  @keyframes bringitIn{
    0%{
      opacity: 0;
    }
    100%{
      opacity: 1;
    }
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
  
  .gallery a:hover .magnify{
    opacity: 1;
  }
  .hires{
    position: fixed;
    top: 0; left: 0;
    z-index: 99;
    height: 100vh; width: 100vw;
    background: #fff;
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

<svelte:window bind:scrollY={y} on:keydown={handleKeydown}/>
<div class="stack gallery" bind:this={secondLevel} >
  {#each stack as image, index}
    <a class="galleryitem" href="{hiresdir}/{image.src}" on:click={e => loadLargeImages(e, index)}> 
      <Image image="{lowresdir}/{image.src}" on:loadingComplete />
      <span class="magnify"></span>
      <h2 class:out="{$destroyingExpandedGallery === true}" class:in="{$loadingSecondary === false}">
        {image.name}
      </h2>
    </a>
  {/each}
</div>

{#if ready}
  <div class="hires" in:fade={{duration: 300}} out:fade="{{duration: 100}}" bind:this={thirdLevel}>
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