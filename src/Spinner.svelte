<style>
.spinner {
    /* animation: rotate 4s linear infinite; */
    z-index: 100;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
.inner{
  width: 300%;
  height: 300%;
  top: 0 ; left: 0;
  animation: shimmer 3s linear infinite;
  background: linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.1) 90%,rgba(0,0,0,0.1) 95%, rgba(0,0,0,0) 100%);
}

@keyframes shimmer {
	0%{
		transform: rotate(-15deg) translateX(-100%) translateY(-50%);
	}
	100%{
		transform: rotate(-15deg) translateX(100%) translateY(-50%);
	}
}
/*
  .spinner .path {
      stroke: #ccc;/* rgb(26, 118, 211);
      stroke-linecap: round;
      animation: dash 3s ease-in-out infinite;
      animation: shimmer 3s linear infinite;
      /* box-shadow: 2px 2px 10px #000; 
  } 
  @keyframes rotate {
    100% {
      transform: rotate(-360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: 20,10;
      stroke-dashoffset: 60;
      stroke-width: 2;
    }
    30%{
      stroke-dasharray: 50, 50;
      stroke-dashoffset: 50;
      stroke-width: 10;
    }
    70% {
      stroke-dasharray: 200, 150;
      stroke-dashoffset: -100;
      stroke-width: 100;
    }
    100% {
      stroke-dasharray: 200, 150;
      stroke-dashoffset: -100;
      stroke-width: 100;
      opacity: 0;
    }
  } */
  
</style>

<div class="spinner">
<div class="inner"></div>
<!-- <rect class="path" id="Rectangle" fill="none" x="0.5" y="0.5" width="50" height="50"></rect> -->
<!-- <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="3"></circle> -->
</div>
<!--<svg class="spinner" viewBox="0 0 40 40">
 <polygon class="path" id="Star" fill="none" stroke-width="2" points="21 35.7417225 15.3653489 39.1898595 12.4893823 33.2427796 5.88500851 33.0972147 6.68082558 26.5393478 1.20357116 22.8462968 5.41850557 17.7597193 2.80736009 11.6916997 9.10319994 9.69136407 10.1871837 3.17492934 16.5650443 4.8959279 21 0 25.4349557 4.8959279 31.8128163 3.17492934 32.8968001 9.69136407 39.1926399 11.6916997 36.5814944 17.7597193 40.7964288 22.8462968 35.3191744 26.5393478 36.1149915 33.0972147 29.5106177 33.2427796 26.6346511 39.1898595"></polygon>
<polygon class="path" id="Star" stroke-width="2" fill="none" points="18 37.0914249 0.679491924 31 4.0644173 12.9542876 18 1 31.9355827 12.9542876 35.3205081 31"></polygon>
</svg>-->