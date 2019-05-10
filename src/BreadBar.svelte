<script>
  import { activeCollection } from './stores.js';
</script>
<style>
  .breadbar{
    background: #fff;
    opacity: 1;
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 20px;
    z-index: 1;
  }
</style>
<div class="breadbar" on:click>
activeCollection : {$activeCollection}
</div>