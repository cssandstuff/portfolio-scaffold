<script>
  import { createEventDispatcher } from 'svelte';
  import { afterUpdate } from 'svelte';
  import { backOut } from 'svelte/easing';
  import { spring } from 'svelte/motion';
  import { fly } from 'svelte/transition';
  import Image from './Image.svelte'
  import { activeCollection } from './stores.js';
  // export const posX = writable(0);
  // export const posY = writable(0);
  
  export let imagecollection;
  export let id;

  const dispatch = createEventDispatcher();
  let myCollection;
  let zoomed;
  let darkness;

  // //spring settings
  // let coords = spring({ x: 50, y: 50 }, {
	// 	stiffness: 0.1,
	// 	damping: 0.25
	// });

	// let size = spring(10);
  
  function rotate() {
    let images = myCollection.getElementsByTagName('span');
    let firstImage = myCollection.getElementsByTagName('img')[0];
    myCollection.style.transform = 'rotate(-1.5deg)';
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1.08) translateY(10px)';
  }
  
  function unRotate() {
    let images = myCollection.getElementsByTagName('span');
    let firstImage = myCollection.getElementsByTagName('img')[0];
    myCollection.style.transform = 'rotate(0deg)';
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1)';
    //myCollection.style.zIndex = '0';
  }
  
  function showContents(){
    //console.log(document.documentElement.clientWidth);
    dispatch('expand', {
        active: id
    });
      
        // var cln = myCollection.cloneNode(true);
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
    console.log(event)
    event.stopPropagation();
    dispatch('expand', {
        active: 0
    });
  }

  afterUpdate(() => {
    console.log('the component has mounted');
    if($activeCollection != id && $activeCollection!==0){
      //console.log('id ',id,'is dark');
      darkness = 'dark';
    }else if($activeCollection === id){
      darkness = 'active';
      
    }else{
      darkness = '';
    }
  });
  
  function customZoom(node, { duration }) {
    var rect = myCollection.getBoundingClientRect();
    var translatePos = "translateX("+rect.left+"px) translateY("+rect.top+"px)";

    //zoomed.style.transform = translatePos;
    zoomed.style.transformOrigin = 'top left';
		return {
			duration,
			css: t => {
				const eased = backOut(t);
        const easePos = backOut(t);
				return `
          transform: translateX(${rect.left * ( 1 - eased)}px) translateY(${rect.top *( 1 - eased)}px) scale(${eased});
          `
			}
		};
	}
</script>


<div class="collection {darkness}" on:mouseenter={rotate} on:mouseleave={unRotate} bind:this={myCollection} on:click={showContents}>
  {#if $activeCollection == id}<p on:click={removeDarkness}>It was me!!!</p>{/if}
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image={image.src}/>
    {:else}
      <span class="dummyimage" style="transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></span>
    {/if}
  {/each}

</div>
{#if $activeCollection == id}<div class="bg" on:click={removeDarkness}></div>{/if}
{#if $activeCollection == id}
  <div in:customZoom="{{duration: 500}}" class="cloned gallery" bind:this={zoomed}>
    {#each imagecollection as image, index}
      <Image image={image.src}/>
    {/each}
  </div>
{/if}
<!-- {#if Gallery}
  <div transition:fly="{{ y: 200, duration: 400 }}" class="gallery">
    {#each imagecollection as image, index}
      <Image image={image.src}/>
    {/each}
  </div>
  <div class="bg"></div>
{/if} -->
<style>
.cloned{
  position: absolute !important;
  top: 0; left: 0;
  width: calc(25% - 3em);
  height: 15em;
  z-index: 3;
}

.dark{
  opacity: 0.2;
  /* animation: dropAway 0.5s cubic-bezier(1, 0, 1, 1) forwards; */

}
.active{
   z-index: 2 !important;
   opacity: 0;
   transition: 0s all !Important;
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

/* .active .dummyimage, .active :global(img){
  position: static !important;
  height: 100vh
} */
@keyframes dropAway{
  0%{
    transform: translateY(0);
  }
  100%{
    transform: translateY(100vh);
  }
}
.gallery{
	display: flex;
	flex: 1 auto;
	flex-basis: 15%;
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
.bg{
  background: #ccc;
  opacity: 0.9;
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  animation: hello 0.4s forwards;
  pointer-events: none;
  z-index: 1;
}
@keyframes hello{
  0%{
    opacity: 0;
    pointer-events: none;
  }
  100%{
    opacity: 0.7;
    pointer-events: auto;
  }
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
.collection p{
  position: absolute;
  top: 0;
  background: red;
  color: white; 
  padding: 4px;
  z-index: 99
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
</style>