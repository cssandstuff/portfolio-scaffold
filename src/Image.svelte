<script>
  // This handles the lazy loading of images, or the best I could copy or come up with
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  export let image;
  export let visible = 0;

  let height;
  let width;
  const dispatch = createEventDispatcher();

  onMount(async () => {
    const res = await fetch(image);
    if(res.status === 200){
       image = res.url;
       console.log(`this is the url ${image}`)
       const loader = new Image();
       loader.onload = () => {
         visible = true;
         height = loader.height;
         width = loader.width;
         dispatch('loadingComplete', {
          loadingComplete: 1
         });
       }
       loader.src = image;
    }else{
      visible = false
    }
  });
  
</script>

<style>
  .opacity--0{
    opacity: 0;
  }
  .loader{
    width: 100%;
    height: 100%;
    position: absolute;
    background: rgba(0,0,0,0.04);
    z-index: 11;
    left: 0;
    display: block;
    transition: 0.2s all;
    /* animation: loading 4s infinite linear; */
    pointer-events: none;
    overflow: hidden;
  }

  .inner{
    width: 300%;
    height: 300%;
    top: 0 ; left: 0;
    animation: shimmer 3s linear infinite;
    background: linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.1) 90%,rgba(0,0,0,0.1) 95%, rgba(0,0,0,0) 100%);
  }

  img{
    display: block;
    object-fit: cover;
    transition: 0.4s all ease-out;
    justify-self: center;
    align-self: center;
    min-width: 100%;
    min-height: 100%;
    width: 100%;
    height: 100%;
  }
  @keyframes shimmer {
    0%{
      transform: rotate(-15deg) translateX(-100%) translateY(-50%);
    }
    100%{
      transform: rotate(-15deg) translateX(100%) translateY(-50%);
    }
  }
  @keyframes loading{
    0%{
      height: 0%;
      top: auto;
      bottom: 0;
    }
    50%{
      height: 100%;
      top: auto;
      bottom: 0;
    }
    51%{
      top: 0;
      bottom: auto;
      height: 100%;
    }
    100%{
      top: 0;
      bottom: auto;
      height: 0%;
    }
  }
</style>

<img src="{image}" alt="" class="{visible ? '' : 'opacity--0'}">
{#if !visible}
  <div class="loader">
    <div class="inner"></div>
  </div>
{/if}



