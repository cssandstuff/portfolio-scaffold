<script>
  // This component expands the stack to show all images within the stack
  // and then loads higher res images (if user clicks an image) and displays
  // them in a prev/next style lightbox.

  import Image from "./Image.svelte";
  import Spinner from "./Spinner.svelte";
  import {
    onMount,
    afterUpdate,
    onDestroy,
    createEventDispatcher
  } from "svelte";
  import { destroyingExpandedGallery, loadingSecondary } from "./stores.js";
  import { fade } from "svelte/transition";
  //import { _resetStacks } from './GalleryStack.svelte';

  export let stack;
  export let originaltarget;

  const dispatch = createEventDispatcher();

  // references to divs
  let activeCollection;
  let thirdLevel;

  // placeholders for objects that we'll iterate over
  let images;
  let hiresImages;
  let currentTitle;

  // indexes of the current image (why are there two??)
  let current;

  // Scroll position stuff
  let y;
  let originalScrollPos;
  let hiresScrollPos;

  // x + y for center of document
  let centerX = document.documentElement.clientWidth / 2;
  let centerY = document.documentElement.clientHeight / 2;

  // Offset transition distance for hi-res lightbox
  let offset = 25;

  // Handles transition of single gallery image when it transitions to hi-res.
  let transitionHandler;

  // count for loading
  let count = 0;

  // booleans, do I need so many?
  let showTitles = true;
  let hiresLoaded = false;
  let ready = false;
  let loadedSuccessfully = false;
  let expandedOnce = false;
  let transitioning = false;
  let closedGallery = false;

  // could probably remove the need for this?
  const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

  // want a reference to each gallery items within the active Collection.
  onMount(() => {
    images = activeCollection.getElementsByClassName("galleryitem");
    // Object.entries(images).forEach(([key, value]) => {
    //   value.style.opacity = 0;
    // });
    // want the item in a stack on first mount
    attemptToConsolidate();
  });

  // Might be able to refactor this to not use AfterUpdate,
  // but for now it seems ok.
  afterUpdate(() => {
    if (!$loadingSecondary && !$destroyingExpandedGallery && !expandedOnce) {
      //expandStuff();
      (async () => {
        await performConsolidation();
        expandStuff();
      })();
      expandedOnce = true;
    }
    if ($destroyingExpandedGallery && expandedOnce) {
      attemptToConsolidate();
      expandedOnce = false;
    }
  });

  onDestroy(() => {
    console.log("being destroyed... laters");
    destroyingExpandedGallery.update(n => false);
  });

  // Rotate image stack on hover over
  function rotate(event, index) {
    // grayscale other images
    Object.entries(images).forEach(([key, value]) => {
      value.style.removeProperty("transition");
      // console.log(`current is ${index} Key is ${key}`)
      // console.log(parseInt(key) !== parseInt(index));
      if (parseInt(key) !== parseInt(index)) {
        value.style.transition = "0.8s all ease-out";
        value.style.filter = "opacity(0.54)";
        value.firstElementChild.style.filter = "grayscale(0.6)";
      } else {
        value.style.filter = "opacity(1)";
        value.firstElementChild.style.filter = "sepia(0) grayscale(0)";
        //value.firstElementChild.style.transition = '0.3s all ease-out';
        value.firstElementChild.style.transform =
          "scale(1.03) translateY(-3px)";
      }
    });
  }

  // Un-Rotate image stack on hover out
  function unRotate(event, index) {
    //anchoredImage.style.transform = 'scale(1) rotate(0deg)';

    //un-grayscale all images
    Object.entries(images).forEach(([key, value]) => {
      value.style.transform.delay;
      value.style.removeProperty("transition");
      value.firstElementChild.style.removeProperty("transition");
      value.firstElementChild.style.removeProperty("transform");
      value.style.filter = "opacity(1)";
      value.firstElementChild.style.filter = "sepia(0) grayscale(0)";
      //value.firstElementChild.style.transform = 'scale(1) translateY(0) rotate(0deg)';
    });
  }

  // could the following two function be consolidated into one?
  // function handleLoadingComplete(event){
  //   count = count + event.detail.loadingComplete;
  //   console.log('this is me');
  //   console.log(event);

  //   if(count === stack.length){
  //     count = 0;
  //     loadedSuccessfully = true;
  //   }
  // }

  function handleLoadingHiResComplete(event) {
    count = count + event.detail.loadingComplete;
    if (count === stack.length) {
      count = 0;
      hiresLoaded = true;
    }
    hiresImages = thirdLevel.getElementsByClassName("hi-image");
  }

  // Keyboard functionality.
  function handleKeydown(event) {
    if (event.code == "ArrowRight") {
      showNext();
    }
    if (event.code == "ArrowLeft") {
      showPrevious();
    }
    if (event.code == "Escape") {
      if (!closedGallery) {
        closeGallery();
      } else {
        document.getElementById("breadcrumb").click();
      }
    }
  }

  // This is called on click of gallery item, to init the lightbox.
  function loadLargeImages(event, index) {
    current = index;
    event.preventDefault();

    // animates clicked image into center of screen.
    animateClicked(current);

    // Gets the hi-res images into the DOM and loading
    ready = true;
  }

  // Function for bringing everything together. called onMount
  // and when gallery is being destroyed.
  function attemptToConsolidate() {
    activeCollection.classList.add("no-pointer-events");

    //sometimes the object is undefined I don't know why.
    if (images !== undefined) {
      console.log("weren't me guv, everything normal...");

      // An extra check to only call this when destroying the gallery
      if ($destroyingExpandedGallery) {
        performConsolidation();
      }

      // not sure I'm even experiencing this bug anymore, but can't hurt to be sure?
    } else {
      console.log("object was undefined, hard luck son.");

      // Try again?
      (async () => {
        await sleep(180);
        Object.entries(images).forEach(([key, value]) => {
          console.log("trying again...");
          performConsolidation();
        });
      })();
    }
  }

  // sometimes the object is empty, so we want a function that only runs when the object is there.
  // This is only called by the attemptToConsolidate function.
  function performConsolidation() {
    console.log("performing consolitation!");
    let rect = originaltarget.getBoundingClientRect();

    Object.entries(images).forEach(([key, value]) => {
      let imageDivRect = value.getBoundingClientRect();
      let transformedStyle = `translateX(${rect.x -
        imageDivRect.x}px) translateY(${rect.y -
        imageDivRect.y}px) rotate(${key * 4}deg)`;
      //console.log(`my transformed style is ${transformedStyle}`);
      //recty inconsistent?`
      if (key != 0) {
        value.style.opacity = 0;
      }
      // If first image
      if (key == 0) {
        transformedStyle = `translateX(${rect.x -
          imageDivRect.x}px) translateY(${rect.y -
          imageDivRect.y}px) scale(1.03) translateY(-3px) rotate(-2deg)`;
      }

      // stacks the zindex's of images so first is always on top.
      value.style.zIndex = images.length - key;

      // if gallery is being closed/destroyed we want a quicker transition.
      if ($destroyingExpandedGallery) {
        // Scroll to position we were at when item was first clicked.
        window.scrollTo(0, originalScrollPos);
        activeCollection.style.transform = `translateY(0px)`;
        transformedStyle = `translateX(${rect.x -
          imageDivRect.x}px) translateY(${rect.y -
          imageDivRect.y}px) rotate(${key * 2}deg)`;
        // Quick transition please.
        value.classList.add("quicktransition");
        // Set tranformed style (different if destroying)
        value.style.transform = transformedStyle;
      } else {
        // Set tranformed style.
        value.style.transform = transformedStyle;
      }
    });
  }

  // Function for Expanding things into place.
  function expandStuff() {
    // Want items that are expanded to always be at the top of the viewport
    originalScrollPos = scrollY;
    window.scrollTo(0, 0);
    activeCollection.style.transform = `translateY(-${originalScrollPos}px)`;

    (async () => {
      // Need to wait a little bit after scrollTo.
      await sleep(80);
      Object.entries(images).forEach(([key, value]) => {
        var imageDivRect = value.getBoundingClientRect();
        transitioning = true;
        value.classList.add("slowtransition");
        value.style.transform = `translateX(0px) translateY(${originalScrollPos}px)`; //translateY(${originalScrollPos}px)`;
        if (key != 0) {
          value.style.opacity = 1;
        }
      });
    })();

    (async () => {
      // sleep to wait for transition to end, maybe better to use transitionend ?
      await sleep(500);
      activeCollection.classList.remove("no-pointer-events");
      transitioning = false;
    })();
  }

  // animate clicked image to the center.
  function animateClicked(current) {
    // This could probably be done more accurately, but it works ok for now.
    let currentImage = images[current].getElementsByTagName("img")[0];
    let parentRect = activeCollection.getBoundingClientRect();
    let parentCenterX = parentRect.width / 2;
    let rect = currentImage.getBoundingClientRect();
    let scaleDifference = 2;
    let area1 = rect.height;
    let area2 = centerY * 2;
    let leftOffset = rect.left;
    let leftDifference = centerX - leftOffset - rect.width / 2;

    let topOffset = rect.top;
    let topDifference = centerY - topOffset - rect.height / 2;

    // let scaledtopDifference =
    //   topDifference * scaleDifference * 2 - topDifference / 2;

    // want it to always be positive
    // if (leftDifference < 0) {
    //   leftDifference = Math.abs(leftDifference);
    // }
    console.log(rect);
    console.log(`area 1 is ${area1}`);
    console.log(`area 2 is ${area2}`);

    scaleDifference = area2 / area1;
    console.log(`scaleDifference is ${scaleDifference}`);

    console.log(`rect.width is ${rect.width}`);
    console.log(`left offset is ${leftOffset}`);
    console.log(`rect.height is ${rect.height}`);
    console.log(`top offset is ${topOffset}`);
    console.log(`centerX is ${centerX}`);
    console.log(`centerY is ${centerY}`);
    console.log(`left difference is ${leftDifference}`);
    console.log(`top difference is ${topDifference}`);
    console.log(
      `scaled left difference is ${leftDifference * scaleDifference}`
    );
    console.log(`scaled top difference is ${topDifference * scaleDifference}`);
    console.log(`parent width is ${parentRect.width}`);
    console.log(`browser width is ${centerX * 2}`);
    console.log(`parent height is ${parentRect.height}`);
    console.log(`browser height is ${centerY * 2}`);

    // if (leftCenter < centerX) {
    //   leftOffset = centerX - leftCenter; // * scaleDifference;
    // } else {
    //   leftOffset = leftCenter - centerX; //* scaleDifference * -1;
    // }
    // if (topCenter < centerY) {
    //   topOffset = centerY - topCenter + scrollY;
    // } else {
    //   topOffset = (topCenter - centerY + scrollY) * -1;
    // }

    // Hide thumbnail titles, else they jump in front of transitioned image.
    showTitles = false;

    // Set active breadcrumb title
    currentTitle = images[current].getElementsByTagName("h2")[0].innerText;
    Object.entries(images).forEach(([key, value]) => {
      value.style.zIndex = "1";
    });

    currentImage.classList.remove("notransition");
    currentImage.classList.remove("quicktransition");
    images[current].style.zIndex = "99";
    hiresScrollPos = scrollY;

    (async () => {
      // Need to wait a bit after classes are removed.
      await sleep(100);
      //currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;

      // HOW DO I DO THIS?
      // activeCollection.style.transform = `translateX(${leftDifference *
      //   scaleDifference}px) translateY(${topDifference *
      //   scaleDifference}px) scale(${scaleDifference})`;
      // currentImage.addEventListener(
      //   "transitionend",
      //   (transitionHandler = () => {
      //     console.log("Transition ended");
      //     document.getElementsByTagName("body")[0].classList.add("locked");
      //   })
      // );

      // WITHOUT SCALE DIFFERENCE
      // activeCollection.style.transform = `translateX(${leftDifference}px) translateY(${topDifference}px)`;
      // currentImage.addEventListener(
      //   "transitionend",
      //   (transitionHandler = () => {
      //     console.log("Transition ended");
      //     document.getElementsByTagName("body")[0].classList.add("locked");
      //   })
      // );
      activeCollection.style.transformOrigin = `${leftOffset +
        rect.width / 2}px ${topOffset - (rect.height / 6) * -1}px`;
      activeCollection.style.transform = `translateX(${leftDifference}px) translateY(${topDifference}px) scale(${scaleDifference *
        0.88})`;
      currentImage.addEventListener(
        "transitionend",
        (transitionHandler = () => {
          console.log("Transition ended");
          document.getElementsByTagName("body")[0].classList.add("locked");
        })
      );
    })();
    closedGallery = false;
  }

  function showPrevious() {
    if (current <= 0) {
      hiresImages[0].style.transform = `translateX(${offset}px)`;
      hiresImages[
        stack.length - 1
      ].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep while animation happens
        await sleep(200);
        current = stack.length - 1;
        setImagePos(current);
        currentTitle = images[current].getElementsByTagName("h2")[0].innerText;
      })();
    } else {
      hiresImages[current].style.transform = `translateX(${offset}px)`;
      hiresImages[current - 1].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep while animation happens
        await sleep(200);
        current--;
        setImagePos(current);
        currentTitle = images[current].getElementsByTagName("h2")[0].innerText;
      })();
    }
  }

  function showNext() {
    if (current >= stack.length - 1) {
      hiresImages[0].style.transform = `translateX(${offset}px)`;
      hiresImages[
        stack.length - 1
      ].style.transform = `translateX(-${offset}px)`;
      (async () => {
        // sleep while animation happens
        await sleep(200);
        current = 0;
        setImagePos(current);
      })();
    } else {
      hiresImages[current].style.transform = `translateX(-${offset}px)`;
      hiresImages[current + 1].style.transform = `translateX(${offset}px)`;
      (async () => {
        // sleep while animation happens
        await sleep(200);
        current++;
        setImagePos(current);
      })();
    }
  }

  // Sets non-active gallery items to a position where they can shrink from when the hi-res gallery is closed.
  function setImagePos(current) {
    let rect = images[current].getBoundingClientRect();

    let centerArea = centerX + centerY * 2;
    let imageArea = rect.width + rect.height;
    let currentImage = images[current].getElementsByTagName("img")[0];

    Object.entries(images).forEach(([key, value]) => {
      value.style.zIndex = "1";
      value.firstChild.classList.add("notransition");
      value.firstChild.classList.remove("hitransition");
      value.firstChild.style.transform = `translateX(0) translateY(0px) scale(1)`;
    });

    images[current].style.zIndex = "99";
    currentImage.style.transform = `translateX(${centerX -
      rect.left -
      rect.width / 2}px) translateY(${centerY -
      rect.top -
      rect.height / 2}px) scale(${centerArea / imageArea})`;
    currentTitle = images[current].getElementsByTagName("h2")[0].innerText;
  }

  function closeGallery() {
    console.log("HEY HEY");

    let currentImage = images[current].getElementsByTagName("img")[0];
    let currentTransformPos = currentImage.style;
    currentImage.removeEventListener("transitionend", transitionHandler, false);

    // this is tricky because we might need two offset values
    window.scrollTo(0, hiresScrollPos);
    document.getElementsByTagName("body")[0].classList.remove("locked");

    currentImage.classList.remove("notransition");
    currentImage.classList.add("hitransition");

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
  h2 {
    position: absolute;
    bottom: -40px;
    left: -10px;
    font-weight: 200;
    padding: 1.8em 0 10px 0px;
    margin: 0 0 0 11px;
    font-size: 0.85em;
    color: var(--textcolor);
    opacity: 0;
    width: 99%;
    transition: 0s opacity;
  }

  h2:after {
    position: relative;
    display: block;
    content: "";
    height: 1px;
    width: 100%;
    bottom: -8px;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.03) 0%,
      rgba(0, 0, 0, 0.1) 25%,
      rgba(0, 0, 0, 0.1) 55%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .in {
    opacity: 1;
    transition: 0.4s 0.6s opacity;
  }
  .out {
    opacity: 0 !important;
  }

  .stack {
    position: absolute !important;
    top: 2em;
    right: 2em;
    width: calc(100vw - 4em) !important;
    z-index: 3;
    transition: transform 1.2s cubic-bezier(1, 0.1, 0.35, 0.92),
      opacity 3.2s ease-out !important;
  }
  .stack a {
    display: block;
  }
  .stack :global(img) {
    box-shadow: 0 0 2px #ccc;
    border-radius: 4px;
    background: #ccc;

    /* width: calc(100% - 2px);
    height: calc(100% - 2px);
    min-width: calc(100% - 2px);
    min-height: calc(100% - 2px); 
    border: 1px solid #fff;*/
  }
  /* .stack a:hover :global(img) {
    border: 1px solid rgba(90,90,90,0.7);
  } */
  .transitioning :global(img) {
    transition: 0s all;
  }
  /* .stack .galleryitem{
    animation: animateOpacity 0.4s forwards;
  } */
  .stack :global(.slowtransition) {
    /* transition: all 3.6s cubic-bezier(0,0,.13,1.33) !important; */
    transition: all 0.7s cubic-bezier(0.38, 0.56, 0.21, 1.15) !important;
  }
  .stack :global(.quicktransition) {
    transition: transform 0.2s cubic-bezier(0, 0, 0.13, 1),
      opacity 0.2s ease-out !important;
    /*opacity: 0.5;*/
  }
  .stack :global(.hitransition) {
    transition: transform 0.33s cubic-bezier(0, 0, 0.13, 1.1);
    opacity: 1;
  }
  .stack :global(a:first-child.quicktransition) {
    transition: transform 0.2s cubic-bezier(0, 0, 0.13, 1.06) !important;
    opacity: 1;
  }

  .gallery {
    /* display: flex;
    flex: 1 auto;
    flex-flow: row wrap;
    align-content: flex-start;
    justify-content: center; */
    transform-origin: center center;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-gap: 0;
    width: auto;
    margin: 40px 1em 1em;
  }

  .gallery a {
    position: relative;
    margin: 1em 1.5em 3em 1.5em;
    /* padding: 0.5em 0; */
    /* width: calc(22vw - 3em); */
  }

  /* .gallery a:hover .magnify{
    opacity: 1;
  } */

  .hires {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99;
    height: 100vh;
    width: 100vw;
    background: #fff;
    opacity: 0;
    transition: 0.8s 0.9s opacity;
  }

  .hires.ready {
    opacity: 1;
  }

  .hires :global(img) {
    object-fit: contain;
    position: absolute;
    top: 0;
    height: 100%;
  }

  .hires div {
    opacity: 0;
    transition: 0.3s all;
    width: 100vw;
    height: 100vh;
    position: absolute;
  }

  .hires div.active {
    opacity: 1;
    transform: translateX(0) !important;
  }

  .previous,
  .next {
    position: absolute;
    top: calc(50vh - 60px);
    background: rgba(255, 255, 255, 0.05);
    height: 120px;
    width: 80px;
    cursor: pointer;
    transition: 0.4s all;
  }
  .previous:hover,
  .next:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .previous:hover {
    transform: translateX(-5px);
  }
  .next:hover {
    transform: translateX(5px);
  }
  .previous:before,
  .previous:after,
  .next:before,
  .next:after {
    content: "";
    position: absolute;
    width: 22px;
    height: 2px;
    background: #999;
    right: 20px;
    top: 50px;
  }
  .previous:before {
    transform: rotate(-45deg);
  }
  .previous::after {
    transform: rotate(45deg);
    top: 65px;
  }
  .next:before {
    transform: rotate(45deg);
  }
  .next::after {
    transform: rotate(-45deg);
    top: 65px;
  }
  .previous {
    left: 0;
    border-radius: 0 20px 20px 0;
  }
  .next {
    right: 0;
    border-radius: 20px 0 0 20px;
  }
  .close {
    color: #333;
    left: 0.4em;
    top: 0;
    position: absolute;
    font-weight: 300;
    text-transform: none;
    font-weight: bold;
    font-size: 1.2em;
    width: auto;
    height: 38px;
    padding-left: 18px;
    cursor: pointer;
    background: #fff;
    padding: 0.5em 1em 0;
    border-radius: 0 0 4px;
  }
  .close:before,
  .close:after {
    content: "";
    position: absolute;
    width: 2px;
    height: 6px;
    background: #333;
    left: 9px;
    top: 17px;
  }
  .close:hover:before {
    transform: translateX(-2px);
    transform: rotate(45deg);
  }
  .close:hover:after {
    transform: translateX(-2px);
    transform: rotate(-45deg);
  }
  .close:before {
    transform: rotate(45deg);
  }
  .close:after {
    transform: rotate(-45deg);
    top: 20px;
  }
  /* .magnify{
    width: 100%;
    height: 100%;]
    position: absolute; top: 0px; left: 0px;
    opacity: 0;
    transition: 0.3s opacity;
    border-radius: 4px;
  }
  .magnify.out{
    transition: 0s opacity;
  }
  .magnify:before{
    content: '';
    position: absolute;
    right: calc(50% - 29px);
    bottom: calc(50% - 16px);
    width: 14px;
    height: 4px;
    background: var(--dark);
    transform: rotate(45deg);
  }
  .magnify:after{
    content: '';
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 4px solid var(--dark);
    position: absolute; left: calc(50% - 19px); top: calc(50% - 22px);
    z-index: 9;
  } */
</style>

<svelte:window bind:scrollY={y} on:keydown={handleKeydown} />
<div class="stack gallery" bind:this={activeCollection}>
  {#each stack as image, index}
    <a
      class:transitioning={transitioning === true}
      class="galleryitem"
      href={image.hires}
      on:mouseenter={e => rotate(e, index)}
      on:mouseleave={e => unRotate(e, index)}
      on:click={e => loadLargeImages(e, index)}>
      <Image image={image.lowres} on:loadingComplete />
      <h2
        class:out={$destroyingExpandedGallery === true || showTitles === false}
        class:in={$loadingSecondary === false && showTitles !== false && !$destroyingExpandedGallery}>
        {image.name}
      </h2>
    </a>
  {/each}
</div>

{#if ready}
  {#if !hiresLoaded}
    <Spinner />
  {/if}
  <div
    class="hires"
    class:ready={hiresLoaded === true}
    out:fade={{ duration: 100 }}
    bind:this={thirdLevel}>
    {#each stack as image, index}
      <div class:active={current === index} class="hi-image">
        <Image
          image={image.hires}
          on:loadingComplete={handleLoadingHiResComplete} />
      </div>
    {/each}
    <span class="previous" on:click={showPrevious} />
    <span class="next" on:click={showNext} />
    <span class="close" on:click={closeGallery}>{currentTitle}</span>
  </div>
{/if}
