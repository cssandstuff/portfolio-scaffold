<script>
  import Image from './Image.svelte'
  import ImageGallery from './ImageGallery.svelte'
  import { afterUpdate, setContext, createEventDispatcher } from 'svelte';
  import { expoOut } from 'svelte/easing';

  import { fade, fly } from 'svelte/transition';
  
  import { activeCollection, destroyingCollection, loadingSecondary } from './stores.js';
  // export const posX = writable(0);
  // export const posY = writable(0);

  setContext('');
  
  export let imagecollection;
  export let id;

  const dispatch = createEventDispatcher();
  let collection;
  let secondLevel;
  let darkness;
  let stack = 'stack';
  let count = 0;
  let attemptingtoLoad = false;


  
  function rotate() {
    let images = collection.getElementsByTagName('span');
    let firstImage = collection.getElementsByTagName('img')[0];
    collection.style.transform = 'rotate(-1.5deg)';
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1.08) translateY(10px)';
  }
  
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
  
  function showContents(){
    //console.log(document.documentElement.clientWidth);
    attemptingtoLoad = true;
    
    //this makes the child component load.
    dispatch('expand', {
        active: id
    }); 

    //this sets the loading to true.
    loadingSecondary.update(n => true);
        // var cln = collection.cloneNode(true);
        // cln.classList.add('cloned');
        // var translatePos = "translateX("+rect.left+"px) translateY("+rect.top+"px)";
        // cln.style.transform = translatePos;
        // console.log("translateX("+rect.left+"px) translateY("+rect.top+"px);");
        // document.documentElement.appendChild(cln);
        // console.log(rect.top, rect.right, rect.bottom, rect.left);

      // const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

      // (async () => {
      //   console.log('スタート');
      //   await sleep(500);
      //   console.log('1秒経ってる!')
      //   cln.classList.add('animatetofull');
      // })();
  }

  function removeDarkness(event){
    //event.stopPropagation();
    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
      destroyingCollection.update(n => true);
      (async () => {
        console.log('スタート');
        await sleep(500);

        dispatch('expand', {
            active: 0
        });
      })();
   
    stack = 'stack';
  }

  function expandStuff(){
    let images = collection;
    var rect = collection.getBoundingClientRect();
    let centerX = document.documentElement.clientWidth/2;
    let centerY = document.documentElement.clientHeight/2;
    
    collection.style.transform = `translateX(${rect.left - centerX}px) translateY(${rect.top - centerY}px)`
  }

  function consolidateStuff(){
    let images = collection;
    var rect = collection.getBoundingClientRect();
    collection.style.transform = `translateX(0px) translateY(0px)`
  }

  afterUpdate(() => {
    if($activeCollection != id && $activeCollection!==0){
      //console.log('id ',id,'is dark');
      darkness = 'dark';
      collection.classList.add('notransition');
      expandStuff();

    }else if($activeCollection === id){
      darkness = 'active';

    }else{
      darkness = '';
      collection.classList.remove('notransition');
      if($destroyingCollection){
        console.log("BURRRRRN");
        attemptingtoLoad = false;
        
        consolidateStuff();
      }
    }
  });
  
  
  // function unZoom(node, { duration }) {
  //   var rect = collection.getBoundingClientRect();
	// 	return {
	// 		duration,
	// 		css: t => {
	// 			const eased = expoOut(t);
  //       const easePos = expoOut(t);
	// 			return `
  //         transform: translateX(${rect.x * ( 1 - eased)}px) translateY(${rect.y *( 1 - eased)}px);
  //         `
	// 		}
  //   };
  // }

  // function customZoomy(node, { duration }) {
  //   var rect = galleryChild.getBoundingClientRect();
  //   console.log(rect);
  //   var translatePos = "translateX("+rect.x+"px) translateY("+rect.y+"px)";

  //   const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  //     (async () => {
  //       console.log('スタート');
  //       await sleep(1500);
  //       console.log(rect);
  //     })();

  //   //secondLevel.style.transform = translatePos;
  //   //secondLevel.style.transformOrigin = 'top left';
	// 	return {
	// 		duration,
	// 		css: t => {
	// 			const eased = expoOut(t);
	// 			return `
  //         transform: translateX(${rect.x * ( 1 - eased)}px) translateY(${rect.y *( 1 - eased)}px);
  //         `
	// 		}
	// 	};
  // }
  
  //in:customZoom="{{duration: 3400}}" 
  function handleLoadingComplete(event) {
    
    console.log(` loading complete is ${event.detail.loadingComplete}`);
    count = count + event.detail.loadingComplete;
    console.log(count);
    if(count === imagecollection.length){
      console.log('everything loaded OK');
      loadingSecondary.update(n => false);
      count = 0;
    }
    
	}
  
</script>

<style>
  .dark{
    opacity: 0;
    /* animation: dropAway 0.5s cubic-bezier(1, 0, 1, 1) forwards; */

  }
  .notransition{
    opacity: 0;
    transition: 0s !important;
  }
  .active{
    z-index: 2 !important;
    opacity: 0;
    /* display: grid;
    position: absolute !important;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 200px;
    grid-gap: 4em;
    width: calc(100% - 8em);
    height: 100%; */
    /* z-index: 2;
    order: -1;
    width: 100% !important;
    transition-delay: 1s !important;
    transition-duration: 3s !important; */
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
    /* box-shadow: 0 0 2px #ccc; */
  }
  .collection:hover span{
    transition: 0.3s transform ease-out;
  }
  .collection{
    position: relative;
    transition: 0.15s all ease-out;
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
    background: #fff;
    opacity: 1;
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 10vh;
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
  
{#if $activeCollection == id}
  <!-- <svg class="spinner" viewBox="0 0 50 50">
  <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle>
  </svg> -->
{/if}
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image={image.src} />
    {:else}
      <span class="dummyimage" style="transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></span>
    {/if}
  {/each}

</div>
{#if attemptingtoLoad}
   <div out:fade class="loading--{$loadingSecondary}">
    <ImageGallery stack={imagecollection} originaltarget={collection} on:loadingComplete="{handleLoadingComplete}"  />
  </div>
  {#if $activeCollection == id}<div class="bg" on:click={removeDarkness}></div>{/if}
{/if}
