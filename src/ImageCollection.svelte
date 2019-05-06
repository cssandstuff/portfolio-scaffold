<script>
  import { fly } from 'svelte/transition';
  import Image from './Image.svelte'
  export let imagecollection;
  let myCollection;
  let Gallery
  function rotate() {
    let images = myCollection.getElementsByTagName('span');
    let firstImage = myCollection.getElementsByTagName('img')[0];
    myCollection.style.transform = 'rotate(-1.5deg)';
    Object.entries(images).forEach(([key, value]) => {
      //console.log(`key= ${key} value = ${value}`);
      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1.08) translateY(10px)';
  }
  function unRotate() {
    let images = myCollection.getElementsByTagName('span');
    let firstImage = myCollection.getElementsByTagName('img')[0];
    myCollection.style.transform = 'rotate(0deg)';
    Object.entries(images).forEach(([key, value]) => {
      //console.log(`key= ${key} value = ${value}`);
      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
    })
    firstImage.style.transform = 'scale(1)';
  }
  function showContents(){
    console.log(document.documentElement.clientWidth);
    Gallery = true;
  }
</script>


<div class="collection" on:mouseenter={rotate} on:mouseleave={unRotate} bind:this={myCollection} on:click={showContents}>
  {#each imagecollection as image, index}
    {#if index==0}
      <Image image={image.src}/>
    {:else}
      <span class="dummyimage" style="transform: rotate({index * 2}deg); z-index: -{index}; opacity: {1 - 1/imagecollection.length * index/1.2}"></span>
    {/if}
  {/each}
</div>
{#if Gallery}
  <div transition:fly="{{ y: 200, duration: 2000 }}" class="gallery">
    {#each imagecollection as image, index}
      <Image image={image.src}/>
    {/each}
  </div>
  <div class="bg"></div>
  
{/if}
<style>
.gallery{ 
  display: grid;
  /* grid-column-start: 1;
  grid-column-end: -1;
  grid-row-start: 1;
  grid-row-end: -1; */
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
}
.bg{
  background: black;
  opacity: 0.9;
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  animation: hello 0.8s forwards;
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
  transition: 0.15s transform ease-out;
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