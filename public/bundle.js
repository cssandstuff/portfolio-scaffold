var app = (function () {
	'use strict';

	function noop() {}

	const identity = x => x;

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function validate_store(store, name) {
		if (!store || typeof store.subscribe !== 'function') {
			throw new Error(`'${name}' is not a store with a 'subscribe' method`);
		}
	}

	function subscribe(component, store, callback) {
		const unsub = store.subscribe(callback);

		component.$$.on_destroy.push(unsub.unsubscribe
			? () => unsub.unsubscribe()
			: unsub);
	}

	const tasks = new Set();
	let running = false;

	function run_tasks() {
		tasks.forEach(task => {
			if (!task[0](window.performance.now())) {
				tasks.delete(task);
				task[1]();
			}
		});

		running = tasks.size > 0;
		if (running) requestAnimationFrame(run_tasks);
	}

	function loop(fn) {
		let task;

		if (!running) {
			running = true;
			requestAnimationFrame(run_tasks);
		}

		return {
			promise: new Promise(fulfil => {
				tasks.add(task = [fn, fulfil]);
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function empty() {
		return text('');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	function custom_event(type, detail) {
		const e = document.createEvent('CustomEvent');
		e.initCustomEvent(type, false, false, detail);
		return e;
	}

	let stylesheet;
	let active = 0;
	let current_rules = {};

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	function hash(str) {
		let hash = 5381;
		let i = str.length;

		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';

		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}

		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;

		if (!current_rules[name]) {
			if (!stylesheet) {
				const style = element('style');
				document.head.appendChild(style);
				stylesheet = style.sheet;
			}

			current_rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}

		const animation = node.style.animation || '';
		node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;

		active += 1;
		return name;
	}

	function delete_rule(node, name) {
		node.style.animation = (node.style.animation || '')
			.split(', ')
			.filter(name
				? anim => anim.indexOf(name) < 0 // remove specific animation
				: anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
			)
			.join(', ');

		if (name && !--active) clear_rules();
	}

	function clear_rules() {
		requestAnimationFrame(() => {
			if (active) return;
			let i = stylesheet.cssRules.length;
			while (i--) stylesheet.deleteRule(i);
			current_rules = {};
		});
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	function afterUpdate(fn) {
		get_current_component().$$.after_render.push(fn);
	}

	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	function createEventDispatcher() {
		const component = current_component;

		return (type, detail) => {
			const callbacks = component.$$.callbacks[type];

			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(type, detail);
				callbacks.slice().forEach(fn => {
					fn.call(component, event);
				});
			}
		};
	}

	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];

		if (callbacks) {
			callbacks.slice().forEach(fn => fn(event));
		}
	}

	const dirty_components = [];

	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	function add_binding_callback(fn) {
		binding_callbacks.push(fn);
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_scheduled = false;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	let promise;

	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}

		return promise;
	}

	let outros;

	function group_outros() {
		outros = {
			remaining: 0,
			callbacks: []
		};
	}

	function check_outros() {
		if (!outros.remaining) {
			run_all(outros.callbacks);
		}
	}

	function on_outro(callback) {
		outros.callbacks.push(callback);
	}

	function create_out_transition(node, fn, params) {
		let config = fn(node, params);
		let running = true;
		let animation_name;

		const group = outros;

		group.remaining += 1;

		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick: tick$$1 = noop,
				css
			} = config;

			if (css) animation_name = create_rule(node, 1, 0, duration, delay, easing, css);

			const start_time = window.performance.now() + delay;
			const end_time = start_time + duration;

			loop(now => {
				if (running) {
					if (now >= end_time) {
						tick$$1(0, 1);

						if (!--group.remaining) {
							// this will result in `end()` being called,
							// so we don't need to clean up here
							run_all(group.callbacks);
						}

						return false;
					}

					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
						tick$$1(1 - t, t);
					}
				}

				return running;
			});
		}

		if (typeof config === 'function') {
			wait().then(() => {
				config = config();
				go();
			});
		} else {
			go();
		}

		return {
			end(reset) {
				if (reset && config.tick) {
					config.tick(1, 0);
				}

				if (running) {
					if (animation_name) delete_rule(node, animation_name);
					running = false;
				}
			}
		};
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	/* src/Image.svelte generated by Svelte v3.2.1 */

	const file = "src/Image.svelte";

	// (83:0) {#if !visible}
	function create_if_block(ctx) {
		var div;

		return {
			c: function create() {
				div = element("div");
				div.className = "loader svelte-m5fr7l";
				set_style(div, "background", "#ccc");
				add_location(div, file, 83, 2, 1571);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function create_fragment(ctx) {
		var img, img_class_value, t, if_block_anchor;

		var if_block = (!ctx.visible) && create_if_block(ctx);

		return {
			c: function create() {
				img = element("img");
				t = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
				img.src = ctx.image;
				img.style.cssText = ctx.style;
				img.alt = "";
				img.className = img_class_value = "" + (ctx.visible ? '' : 'opacity--0') + " svelte-m5fr7l";
				add_location(img, file, 81, 0, 1473);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, img, anchor);
				insert(target, t, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},

			p: function update(changed, ctx) {
				if (changed.image) {
					img.src = ctx.image;
				}

				if (changed.style) {
					img.style.cssText = ctx.style;
				}

				if ((changed.visible) && img_class_value !== (img_class_value = "" + (ctx.visible ? '' : 'opacity--0') + " svelte-m5fr7l")) {
					img.className = img_class_value;
				}

				if (!ctx.visible) {
					if (!if_block) {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(img);
					detach(t);
				}

				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		
	  let { image, style, visible = 0 } = $$props;

	  const dispatch = createEventDispatcher();

	  onMount(async () => {
	    const res = await fetch(image);
	    //console.log(res);
	    if(res.status === 200){
	       $$invalidate('image', image = res.url);
	       const loader = new Image(); //  the script equivalent to the html image element
	       loader.onload = () => {
	         $$invalidate('visible', visible = true);
	         dispatch('loadingComplete', {
	          loadingComplete: 1
	         });
	       };
	       loader.src = image;
	    }else{
	      $$invalidate('visible', visible = false);
	    }
	  });

		$$self.$set = $$props => {
			if ('image' in $$props) $$invalidate('image', image = $$props.image);
			if ('style' in $$props) $$invalidate('style', style = $$props.style);
			if ('visible' in $$props) $$invalidate('visible', visible = $$props.visible);
		};

		return { image, style, visible };
	}

	class Image_1 extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["image", "style", "visible"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.image === undefined && !('image' in props)) {
				console.warn("<Image> was created without expected prop 'image'");
			}
			if (ctx.style === undefined && !('style' in props)) {
				console.warn("<Image> was created without expected prop 'style'");
			}
		}

		get image() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set image(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get style() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set style(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get visible() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set visible(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	function writable(value, start = noop) {
		let stop;
		const subscribers = [];

		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (!stop) return; // not ready
				subscribers.forEach(s => s[1]());
				subscribers.forEach(s => s[0](value));
			}
		}

		function update(fn) {
			set(fn(value));
		}

		function subscribe(run, invalidate = noop) {
			const subscriber = [run, invalidate];
			subscribers.push(subscriber);
			if (subscribers.length === 1) stop = start(set) || noop;
			run(value);

			return () => {
				const index = subscribers.indexOf(subscriber);
				if (index !== -1) subscribers.splice(index, 1);
				if (subscribers.length === 0) stop();
			};
		}

		return { set, update, subscribe };
	}

	const destroyingCollection = writable(false);
	const activeCollection = writable(0);
	const loadingSecondary = writable(false);

	/* src/ImageGallery.svelte generated by Svelte v3.2.1 */

	const file$1 = "src/ImageGallery.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	// (136:2) {#each stack as image, index}
	function create_each_block(ctx) {
		var current;

		var image = new Image_1({
			props: { image: ctx.image.src },
			$$inline: true
		});
		image.$on("loadingComplete", ctx.loadingComplete_handler);

		return {
			c: function create() {
				image.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(image, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var image_changes = {};
				if (changed.stack) image_changes.image = ctx.image.src;
				image.$set(image_changes);
			},

			i: function intro(local) {
				if (current) return;
				image.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				image.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				image.$destroy(detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		var div, current;

		var each_value = ctx.stack;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		function outro_block(i, detaching, local) {
			if (each_blocks[i]) {
				if (detaching) {
					on_outro(() => {
						each_blocks[i].d(detaching);
						each_blocks[i] = null;
					});
				}

				each_blocks[i].o(local);
			}
		}

		return {
			c: function create() {
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
				div.className = "stack gallery svelte-7vkxa2";
				add_location(div, file$1, 134, 0, 3518);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				add_binding_callback(() => ctx.div_binding(div, null));
				current = true;
			},

			p: function update(changed, ctx) {
				if (changed.stack) {
					each_value = ctx.stack;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
							each_blocks[i].i(1);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].i(1);
							each_blocks[i].m(div, null);
						}
					}

					group_outros();
					for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}

				if (changed.items) {
					ctx.div_binding(null, div);
					ctx.div_binding(div, null);
				}
			},

			i: function intro(local) {
				if (current) return;
				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				current = true;
			},

			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);

				ctx.div_binding(null, div);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let $destroyingCollection, $loadingSecondary;

		validate_store(destroyingCollection, 'destroyingCollection');
		subscribe($$self, destroyingCollection, $$value => { $destroyingCollection = $$value; $$invalidate('$destroyingCollection', $destroyingCollection); });
		validate_store(loadingSecondary, 'loadingSecondary');
		subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

		


	  let { stack, originaltarget } = $$props;
	  let secondlevel;
	  let expanded;
	  let notRunBefore = true;

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
	    $$invalidate('expanded', expanded = false);
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
	        value.style.transform = `translateX(0px) translateY(0px)`;
	      });
	      $$invalidate('expanded', expanded = true);
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
	      $$invalidate('notRunBefore', notRunBefore = false);
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

		function loadingComplete_handler(event) {
			bubble($$self, event);
		}

		function div_binding($$node, check) {
			secondlevel = $$node;
			$$invalidate('secondlevel', secondlevel);
		}

		$$self.$set = $$props => {
			if ('stack' in $$props) $$invalidate('stack', stack = $$props.stack);
			if ('originaltarget' in $$props) $$invalidate('originaltarget', originaltarget = $$props.originaltarget);
		};

		return {
			stack,
			originaltarget,
			secondlevel,
			loadingComplete_handler,
			div_binding
		};
	}

	class ImageGallery extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["stack", "originaltarget"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.stack === undefined && !('stack' in props)) {
				console.warn("<ImageGallery> was created without expected prop 'stack'");
			}
			if (ctx.originaltarget === undefined && !('originaltarget' in props)) {
				console.warn("<ImageGallery> was created without expected prop 'originaltarget'");
			}
		}

		get stack() {
			throw new Error("<ImageGallery>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set stack(value) {
			throw new Error("<ImageGallery>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get originaltarget() {
			throw new Error("<ImageGallery>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set originaltarget(value) {
			throw new Error("<ImageGallery>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/*
	Adapted from https://github.com/mattdesl
	Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
	*/

	function fade(node, {
		delay = 0,
		duration = 400
	}) {
		const o = +getComputedStyle(node).opacity;

		return {
			delay,
			duration,
			css: t => `opacity: ${t * o}`
		};
	}

	/* src/ImageCollection.svelte generated by Svelte v3.2.1 */

	const file$2 = "src/ImageCollection.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	// (326:0) {#if $activeCollection == id}
	function create_if_block_3(ctx) {
		return {
			c: noop,
			m: noop,
			d: noop
		};
	}

	// (334:4) {:else}
	function create_else_block(ctx) {
		var span;

		return {
			c: function create() {
				span = element("span");
				span.className = "dummyimage svelte-mfp4jx";
				set_style(span, "transform", "rotate(" + ctx.index * 2 + "deg)");
				set_style(span, "z-index", "-" + ctx.index);
				set_style(span, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
				add_location(span, file$2, 334, 6, 8602);
			},

			m: function mount(target, anchor) {
				insert(target, span, anchor);
			},

			p: function update(changed, ctx) {
				if (changed.imagecollection) {
					set_style(span, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (332:4) {#if index==0}
	function create_if_block_2(ctx) {
		var current;

		var image = new Image_1({
			props: { image: ctx.image.src },
			$$inline: true
		});

		return {
			c: function create() {
				image.$$.fragment.c();
			},

			m: function mount(target, anchor) {
				mount_component(image, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var image_changes = {};
				if (changed.imagecollection) image_changes.image = ctx.image.src;
				image.$set(image_changes);
			},

			i: function intro(local) {
				if (current) return;
				image.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				image.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				image.$destroy(detaching);
			}
		};
	}

	// (331:2) {#each imagecollection as image, index}
	function create_each_block$1(ctx) {
		var current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block_2,
			create_else_block
		];

		var if_blocks = [];

		function select_block_type(ctx) {
			if (ctx.index==0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c: function create() {
				if_block.c();
				if_block_anchor = empty();
			},

			m: function mount(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);
				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(changed, ctx);
				} else {
					group_outros();
					on_outro(() => {
						if_blocks[previous_block_index].d(1);
						if_blocks[previous_block_index] = null;
					});
					if_block.o(1);
					check_outros();

					if_block = if_blocks[current_block_type_index];
					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					}
					if_block.i(1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block) if_block.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block) if_block.o();
				current = false;
			},

			d: function destroy(detaching) {
				if_blocks[current_block_type_index].d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	// (340:0) {#if attemptingtoLoad}
	function create_if_block$1(ctx) {
		var div, div_class_value, div_outro, t, if_block_anchor, current;

		var imagegallery = new ImageGallery({
			props: {
			stack: ctx.imagecollection,
			originaltarget: ctx.collection
		},
			$$inline: true
		});
		imagegallery.$on("loadingComplete", ctx.handleLoadingComplete);

		var if_block = (ctx.$activeCollection == ctx.id) && create_if_block_1(ctx);

		return {
			c: function create() {
				div = element("div");
				imagegallery.$$.fragment.c();
				t = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
				div.className = div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-mfp4jx";
				add_location(div, file$2, 340, 3, 8803);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(imagegallery, div, null);
				insert(target, t, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var imagegallery_changes = {};
				if (changed.imagecollection) imagegallery_changes.stack = ctx.imagecollection;
				if (changed.collection) imagegallery_changes.originaltarget = ctx.collection;
				imagegallery.$set(imagegallery_changes);

				if ((!current || changed.$loadingSecondary) && div_class_value !== (div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-mfp4jx")) {
					div.className = div_class_value;
				}

				if (ctx.$activeCollection == ctx.id) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block_1(ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},

			i: function intro(local) {
				if (current) return;
				imagegallery.$$.fragment.i(local);

				if (div_outro) div_outro.end(1);

				current = true;
			},

			o: function outro(local) {
				imagegallery.$$.fragment.o(local);

				if (local) {
					div_outro = create_out_transition(div, fade, {});
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				imagegallery.$destroy();

				if (detaching) {
					if (div_outro) div_outro.end();
					detach(t);
				}

				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}
			}
		};
	}

	// (344:2) {#if $activeCollection == id}
	function create_if_block_1(ctx) {
		var div, dispose;

		return {
			c: function create() {
				div = element("div");
				div.className = "bg svelte-mfp4jx";
				add_location(div, file$2, 343, 31, 9014);
				dispose = listen(div, "click", ctx.removeDarkness);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
			},

			p: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				dispose();
			}
		};
	}

	function create_fragment$2(ctx) {
		var div, t0, div_class_value, t1, if_block1_anchor, current, dispose;

		var if_block0 = (ctx.$activeCollection == ctx.id) && create_if_block_3(ctx);

		var each_value = ctx.imagecollection;

		var each_blocks = [];

		for (var i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		function outro_block(i, detaching, local) {
			if (each_blocks[i]) {
				if (detaching) {
					on_outro(() => {
						each_blocks[i].d(detaching);
						each_blocks[i] = null;
					});
				}

				each_blocks[i].o(local);
			}
		}

		var if_block1 = (ctx.attemptingtoLoad) && create_if_block$1(ctx);

		return {
			c: function create() {
				div = element("div");
				if (if_block0) if_block0.c();
				t0 = space();

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t1 = space();
				if (if_block1) if_block1.c();
				if_block1_anchor = empty();
				div.className = div_class_value = "collection " + ctx.darkness + " svelte-mfp4jx";
				add_location(div, file$2, 323, 0, 8172);

				dispose = [
					listen(div, "mouseenter", ctx.rotate),
					listen(div, "mouseleave", ctx.unRotate),
					listen(div, "click", ctx.showContents)
				];
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				if (if_block0) if_block0.m(div, null);
				append(div, t0);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				add_binding_callback(() => ctx.div_binding(div, null));
				insert(target, t1, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, if_block1_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.$activeCollection == ctx.id) {
					if (!if_block0) {
						if_block0 = create_if_block_3(ctx);
						if_block0.c();
						if_block0.m(div, t0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (changed.imagecollection) {
					each_value = ctx.imagecollection;

					for (var i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
							each_blocks[i].i(1);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].i(1);
							each_blocks[i].m(div, null);
						}
					}

					group_outros();
					for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}

				if (changed.items) {
					ctx.div_binding(null, div);
					ctx.div_binding(div, null);
				}

				if ((!current || changed.darkness) && div_class_value !== (div_class_value = "collection " + ctx.darkness + " svelte-mfp4jx")) {
					div.className = div_class_value;
				}

				if (ctx.attemptingtoLoad) {
					if (if_block1) {
						if_block1.p(changed, ctx);
						if_block1.i(1);
					} else {
						if_block1 = create_if_block$1(ctx);
						if_block1.c();
						if_block1.i(1);
						if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
					}
				} else if (if_block1) {
					group_outros();
					on_outro(() => {
						if_block1.d(1);
						if_block1 = null;
					});

					if_block1.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				if (if_block1) if_block1.i();
				current = true;
			},

			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				if (if_block1) if_block1.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				if (if_block0) if_block0.d();

				destroy_each(each_blocks, detaching);

				ctx.div_binding(null, div);

				if (detaching) {
					detach(t1);
				}

				if (if_block1) if_block1.d(detaching);

				if (detaching) {
					detach(if_block1_anchor);
				}

				run_all(dispose);
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $activeCollection, $destroyingCollection, $loadingSecondary;

		validate_store(activeCollection, 'activeCollection');
		subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });
		validate_store(destroyingCollection, 'destroyingCollection');
		subscribe($$self, destroyingCollection, $$value => { $destroyingCollection = $$value; $$invalidate('$destroyingCollection', $destroyingCollection); });
		validate_store(loadingSecondary, 'loadingSecondary');
		subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

		
	  // export const posX = writable(0);
	  // export const posY = writable(0);

	  setContext('');
	  
	  let { imagecollection, id } = $$props;

	  const dispatch = createEventDispatcher();
	  let collection;
	  let darkness;
	  let stack = 'stack';
	  let count = 0;
	  let attemptingtoLoad = false;


	  
	  function rotate() {
	    let images = collection.getElementsByTagName('span');
	    let firstImage = collection.getElementsByTagName('img')[0];
	    collection.style.transform = 'rotate(-1.5deg)'; $$invalidate('collection', collection);
	    Object.entries(images).forEach(([key, value]) => {
	      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
	    });
	    firstImage.style.transform = 'scale(1.08) translateY(10px)';
	  }
	  
	  function unRotate() {
	    let images = collection.getElementsByTagName('span');
	    let firstImage = collection.getElementsByTagName('img')[0];
	    collection.style.transform = 'rotate(0deg)'; $$invalidate('collection', collection);
	    Object.entries(images).forEach(([key, value]) => {
	      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
	    });
	    firstImage.style.transform = 'scale(1)';
	    //collection.style.zIndex = '0';
	  }
	  
	  function showContents(){
	    //console.log(document.documentElement.clientWidth);
	    $$invalidate('attemptingtoLoad', attemptingtoLoad = true);
	    
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
	   
	    $$invalidate('stack', stack = 'stack');
	  }

	  function expandStuff(){
	    var rect = collection.getBoundingClientRect();
	    let centerX = document.documentElement.clientWidth/2;
	    let centerY = document.documentElement.clientHeight/2;
	    
	    collection.style.transform = `translateX(${rect.left - centerX}px) translateY(${rect.top - centerY}px)`; $$invalidate('collection', collection);
	  }

	  function consolidateStuff(){
	    var rect = collection.getBoundingClientRect();
	    collection.style.transform = `translateX(0px) translateY(0px)`; $$invalidate('collection', collection);
	  }

	  afterUpdate(() => {
	    if($activeCollection != id && $activeCollection!==0){
	      //console.log('id ',id,'is dark');
	      $$invalidate('darkness', darkness = 'dark');
	      collection.classList.add('notransition');
	      expandStuff();

	    }else if($activeCollection === id){
	      $$invalidate('darkness', darkness = 'active');

	    }else{
	      $$invalidate('darkness', darkness = '');
	      collection.classList.remove('notransition');
	      if($destroyingCollection){
	        console.log("BURRRRRN");
	        $$invalidate('attemptingtoLoad', attemptingtoLoad = false);
	        
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
	    $$invalidate('count', count = count + event.detail.loadingComplete);
	    console.log(count);
	    if(count === imagecollection.length){
	      console.log('everything loaded OK');
	      loadingSecondary.update(n => false);
	      $$invalidate('count', count = 0);
	    }
	    
		}

		function div_binding($$node, check) {
			collection = $$node;
			$$invalidate('collection', collection);
		}

		$$self.$set = $$props => {
			if ('imagecollection' in $$props) $$invalidate('imagecollection', imagecollection = $$props.imagecollection);
			if ('id' in $$props) $$invalidate('id', id = $$props.id);
		};

		return {
			imagecollection,
			id,
			collection,
			darkness,
			attemptingtoLoad,
			rotate,
			unRotate,
			showContents,
			removeDarkness,
			handleLoadingComplete,
			$activeCollection,
			$loadingSecondary,
			div_binding
		};
	}

	class ImageCollection extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["imagecollection", "id"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.imagecollection === undefined && !('imagecollection' in props)) {
				console.warn("<ImageCollection> was created without expected prop 'imagecollection'");
			}
			if (ctx.id === undefined && !('id' in props)) {
				console.warn("<ImageCollection> was created without expected prop 'id'");
			}
		}

		get imagecollection() {
			throw new Error("<ImageCollection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set imagecollection(value) {
			throw new Error("<ImageCollection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<ImageCollection>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<ImageCollection>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.2.1 */

	const file$3 = "src/App.svelte";

	function create_fragment$3(ctx) {
		var p, t0, t1, t2, div, t3, t4, t5, t6, t7, t8, t9, current;

		var imagecollection0 = new ImageCollection({
			props: {
			imagecollection: ctx.collection1,
			id: uid++
		},
			$$inline: true
		});
		imagecollection0.$on("expand", handleExpand);

		var imagecollection1 = new ImageCollection({
			props: {
			imagecollection: ctx.collection2,
			id: uid++
		},
			$$inline: true
		});
		imagecollection1.$on("expand", handleExpand);

		var imagecollection2 = new ImageCollection({
			props: {
			imagecollection: ctx.collection3,
			id: uid++
		},
			$$inline: true
		});
		imagecollection2.$on("expand", handleExpand);

		var imagecollection3 = new ImageCollection({
			props: {
			imagecollection: ctx.collection4,
			id: uid++
		},
			$$inline: true
		});
		imagecollection3.$on("expand", handleExpand);

		var imagecollection4 = new ImageCollection({
			props: {
			imagecollection: ctx.collection5,
			id: uid++
		},
			$$inline: true
		});
		imagecollection4.$on("expand", handleExpand);

		var imagecollection5 = new ImageCollection({
			props: {
			imagecollection: ctx.collection6,
			id: uid++
		},
			$$inline: true
		});
		imagecollection5.$on("expand", handleExpand);

		var imagecollection6 = new ImageCollection({
			props: {
			imagecollection: ctx.collection4,
			id: uid++
		},
			$$inline: true
		});
		imagecollection6.$on("expand", handleExpand);

		var imagecollection7 = new ImageCollection({
			props: {
			imagecollection: ctx.collection1,
			id: uid++
		},
			$$inline: true
		});
		imagecollection7.$on("expand", handleExpand);

		return {
			c: function create() {
				p = element("p");
				t0 = text("Active collection is: ");
				t1 = text(ctx.$activeCollection);
				t2 = space();
				div = element("div");
				imagecollection0.$$.fragment.c();
				t3 = space();
				imagecollection1.$$.fragment.c();
				t4 = space();
				imagecollection2.$$.fragment.c();
				t5 = space();
				imagecollection3.$$.fragment.c();
				t6 = space();
				imagecollection4.$$.fragment.c();
				t7 = space();
				imagecollection5.$$.fragment.c();
				t8 = space();
				imagecollection6.$$.fragment.c();
				t9 = space();
				imagecollection7.$$.fragment.c();
				add_location(p, file$3, 55, 0, 1930);
				div.className = "nicediv svelte-1uqsqaj";
				add_location(div, file$3, 56, 0, 1980);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, p, anchor);
				append(p, t0);
				append(p, t1);
				insert(target, t2, anchor);
				insert(target, div, anchor);
				mount_component(imagecollection0, div, null);
				append(div, t3);
				mount_component(imagecollection1, div, null);
				append(div, t4);
				mount_component(imagecollection2, div, null);
				append(div, t5);
				mount_component(imagecollection3, div, null);
				append(div, t6);
				mount_component(imagecollection4, div, null);
				append(div, t7);
				mount_component(imagecollection5, div, null);
				append(div, t8);
				mount_component(imagecollection6, div, null);
				append(div, t9);
				mount_component(imagecollection7, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if (!current || changed.$activeCollection) {
					set_data(t1, ctx.$activeCollection);
				}

				var imagecollection0_changes = {};
				if (changed.collection1) imagecollection0_changes.imagecollection = ctx.collection1;
				if (changed.uid) imagecollection0_changes.id = uid++;
				imagecollection0.$set(imagecollection0_changes);

				var imagecollection1_changes = {};
				if (changed.collection2) imagecollection1_changes.imagecollection = ctx.collection2;
				if (changed.uid) imagecollection1_changes.id = uid++;
				imagecollection1.$set(imagecollection1_changes);

				var imagecollection2_changes = {};
				if (changed.collection3) imagecollection2_changes.imagecollection = ctx.collection3;
				if (changed.uid) imagecollection2_changes.id = uid++;
				imagecollection2.$set(imagecollection2_changes);

				var imagecollection3_changes = {};
				if (changed.collection4) imagecollection3_changes.imagecollection = ctx.collection4;
				if (changed.uid) imagecollection3_changes.id = uid++;
				imagecollection3.$set(imagecollection3_changes);

				var imagecollection4_changes = {};
				if (changed.collection5) imagecollection4_changes.imagecollection = ctx.collection5;
				if (changed.uid) imagecollection4_changes.id = uid++;
				imagecollection4.$set(imagecollection4_changes);

				var imagecollection5_changes = {};
				if (changed.collection6) imagecollection5_changes.imagecollection = ctx.collection6;
				if (changed.uid) imagecollection5_changes.id = uid++;
				imagecollection5.$set(imagecollection5_changes);

				var imagecollection6_changes = {};
				if (changed.collection4) imagecollection6_changes.imagecollection = ctx.collection4;
				if (changed.uid) imagecollection6_changes.id = uid++;
				imagecollection6.$set(imagecollection6_changes);

				var imagecollection7_changes = {};
				if (changed.collection1) imagecollection7_changes.imagecollection = ctx.collection1;
				if (changed.uid) imagecollection7_changes.id = uid++;
				imagecollection7.$set(imagecollection7_changes);
			},

			i: function intro(local) {
				if (current) return;
				imagecollection0.$$.fragment.i(local);

				imagecollection1.$$.fragment.i(local);

				imagecollection2.$$.fragment.i(local);

				imagecollection3.$$.fragment.i(local);

				imagecollection4.$$.fragment.i(local);

				imagecollection5.$$.fragment.i(local);

				imagecollection6.$$.fragment.i(local);

				imagecollection7.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				imagecollection0.$$.fragment.o(local);
				imagecollection1.$$.fragment.o(local);
				imagecollection2.$$.fragment.o(local);
				imagecollection3.$$.fragment.o(local);
				imagecollection4.$$.fragment.o(local);
				imagecollection5.$$.fragment.o(local);
				imagecollection6.$$.fragment.o(local);
				imagecollection7.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(p);
					detach(t2);
					detach(div);
				}

				imagecollection0.$destroy();

				imagecollection1.$destroy();

				imagecollection2.$destroy();

				imagecollection3.$destroy();

				imagecollection4.$destroy();

				imagecollection5.$destroy();

				imagecollection6.$destroy();

				imagecollection7.$destroy();
			}
		};
	}

	let uid = 1;

	function handleExpand(event) {
		console.log(event.detail.active);
		activeCollection.update(n => event.detail.active);
	}

	function instance$3($$self, $$props, $$invalidate) {
		let $activeCollection;

		validate_store(activeCollection, 'activeCollection');
		subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });

		let { name } = $$props;
		let collection1 = [
			{ src: 'images/IMG_0003.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0005.JPG', name: 'moo' },
			{ src: 'images/IMG_0007.JPG', name: 'moo' },
			{ src: 'images/IMG_0008.JPG', name: 'moo' },
			{ src: 'images/IMG_0009.JPG', name: 'moo' },
			{ src: 'images/IMG_0010.JPG', name: 'moo' }
		];
		let collection2 = [
			{ src: 'images/IMG_0007.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0005.JPG', name: 'moo' },
			{ src: 'images/IMG_0007.JPG', name: 'moo' },
			{ src: 'images/IMG_0008.JPG', name: 'moo' },
			{ src: 'images/IMG_0009.JPG', name: 'moo' },
			{ src: 'images/IMG_0010.JPG', name: 'moo' }
		];
		let collection3 = [
			{ src: 'images/IMG_0009.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0005.JPG', name: 'moo' },
			{ src: 'images/IMG_0007.JPG', name: 'moo' },
			{ src: 'images/IMG_0008.JPG', name: 'moo' },
			{ src: 'images/IMG_0009.JPG', name: 'moo' },
			{ src: 'images/IMG_0010.JPG', name: 'moo' }
		];
		let collection4 = [
			{ src: 'images/IMG_0010.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0005.JPG', name: 'moo' },
			{ src: 'images/IMG_0007.JPG', name: 'moo' },
			{ src: 'images/IMG_0008.JPG', name: 'moo' },
			{ src: 'images/IMG_0010.JPG', name: 'moo' }
		];
		let collection5 = [
			{ src: 'images/IMG_0008.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' }
		];
		let collection6 = [
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0004.JPG', name: 'moo' },
			{ src: 'images/IMG_0005.JPG', name: 'moo' }
		];

		$$self.$set = $$props => {
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
		};

		return {
			name,
			collection1,
			collection2,
			collection3,
			collection4,
			collection5,
			collection6,
			$activeCollection
		};
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$3, safe_not_equal, ["name"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.name === undefined && !('name' in props)) {
				console.warn("<App> was created without expected prop 'name'");
			}
		}

		get name() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const app = new App({
		target: document.body,
		props: {
			name: 'world'
		}
	});

	return app;

}());
//# sourceMappingURL=bundle.js.map
