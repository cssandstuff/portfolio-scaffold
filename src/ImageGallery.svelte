<script>
  import Image from './Image.svelte'
  import { onMount, afterUpdate, onDestroy, getContext, createEventDispatcher } from 'svelte';

  import { destroyingCollection, loadingSecondary } from './stores.js';


  export let stack;
  export let originaltarget;
  let secondlevel;
  let expanded;
  let notRunBefore = true;
  const dispatch = createEventDispatcher();

  function consolidateStuff(){
    var rect = originaltarget.getBoundingClientRect();
    let images = secondlevel.getElementsByTagName('img');
    let imageCount = secondlevel.getElementsByTagName('img').length;
    
     
    Object.entries(images).forEach(([key, value]) => {
      var imageDivRect = value.getBoundingClientRect();
      if($destroyingCollection){
        value.classList.add('slowtransition');
      }else{
        value.style.zIndex = imageCount - key;
      }
      console.log("WTF>???");
      console.log(value);
      let transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${(38/imageCount-1) * key}deg)`;
      value.style.transform = transformedStyle;
      console.log(`translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${(38/imageCount-1) * key}deg)`);
    });
    expanded = false;
  }

  function expandStuff(){
    let images = secondlevel.getElementsByTagName('img');
    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

    (async () => {
      console.log('スタート');
      await sleep(10);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        value.classList.add('slowtransition');
        value.style.transform = `translateX(0px) translateY(0px)`
      });
      expanded = true;
    })();
  }

  onMount(() => {
    consolidateStuff();
    console.log(`this is the value of LOADING ${loadingSecondary}`);
  });

  afterUpdate(() => {
    console.log('the component has mounted', $loadingSecondary);
    // use get/set context somehow....instead of this
    if($loadingSecondary && notRunBefore){
      expandStuff();
      notRunBefore = false;
    }
    if($destroyingCollection){
      console.log("Image GALLERY is BeiNG DestoryED!!!");
      consolidateStuff();
    }
  });

  onDestroy(() => {
    // do something
    destroyingCollection.update(n => false);
  });


  
</script>

<style>
  .stack{
    position: absolute !important;
    top: 2em; right: 2em;
    width: calc(100vw - 4em) !important;
    z-index: 3;
  }
  .stack :global(img) {
    box-shadow: 0 0 2px #ccc;
    border-radius: 4px;
    transition: 0s all !important;
    background: #ccc;
    /* border: 1px solid #ccc; */

  }
  .stack :global(.slowtransition) {
    transition: all 0.6s cubic-bezier(0,0,.13,1.33) !important;
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
  /* .gallery{ 
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

</style>

<div class="stack gallery" bind:this={secondlevel} >
  {#each stack as image, index}
    <Image image={image.src} on:loadingComplete/>
  {/each}
</div>

<!-- <div style="z-index:99; position: absolute">
  <p on:click={expandStuff}>Expand</p>
  <p on:click={consolidateStuff}>consolidate</p>
</div> -->