
<style>
.opacity--0{
  opacity: 0;
}
.loader{
  width: 100%;
  position: absolute;
  background: rgba(0,0,0,0.04);
  z-index: 11;
  left: 0;
  display: block;
  transition: 0.2s all;
  /* animation: loading 4s infinite linear; */
  pointer-events: none;
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
  
  
<script>

  import { onMount } from 'svelte';
  export let image;
  export let style;
  let visible = false;

  onMount(async () => {
    const res = await fetch(image);
    console.log(res);
    if(res.status === 200){
       image = res.url;
       const loader = new Image(); //  the script equivalent to the html image element
       loader.onload = () => visible = true;
       loader.src = image;
    }else{
      visible = false
    }
  });
  
</script>


<img src="{image}" style="{style}" alt="" class="{visible ? '' : 'opacity--0'}">
{#if !visible}
  <div class="loader" style="background: #ccc"></div>
{/if}


