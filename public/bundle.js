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

	let now = typeof window !== 'undefined'
		? () => window.performance.now()
		: () => Date.now();

	const tasks = new Set();
	let running = false;

	function run_tasks() {
		tasks.forEach(task => {
			if (!task[0](now())) {
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

	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
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

	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else node.setAttribute(attribute, value);
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

	function toggle_class(element, name, toggle) {
		element.classList[toggle ? 'add' : 'remove'](name);
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

	function create_in_transition(node, fn, params) {
		let config = fn(node, params);
		let running = false;
		let animation_name;
		let task;
		let uid = 0;

		function cleanup() {
			if (animation_name) delete_rule(node, animation_name);
		}

		function go() {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick: tick$$1 = noop,
				css
			} = config;

			if (css) animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
			tick$$1(0, 1);

			const start_time = now() + delay;
			const end_time = start_time + duration;

			if (task) task.abort();
			running = true;

			task = loop(now$$1 => {
				if (running) {
					if (now$$1 >= end_time) {
						tick$$1(1, 0);
						cleanup();
						return running = false;
					}

					if (now$$1 >= start_time) {
						const t = easing((now$$1 - start_time) / duration);
						tick$$1(t, 1 - t);
					}
				}

				return running;
			});
		}

		let started = false;

		return {
			start() {
				if (started) return;

				delete_rule(node);

				if (typeof config === 'function') {
					config = config();
					wait().then(go);
				} else {
					go();
				}
			},

			invalidate() {
				started = false;
			},

			end() {
				if (running) {
					cleanup();
					running = false;
				}
			}
		};
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

			const start_time = now() + delay;
			const end_time = start_time + duration;

			loop(now$$1 => {
				if (running) {
					if (now$$1 >= end_time) {
						tick$$1(0, 1);

						if (!--group.remaining) {
							// this will result in `end()` being called,
							// so we don't need to clean up here
							run_all(group.callbacks);
						}

						return false;
					}

					if (now$$1 >= start_time) {
						const t = easing((now$$1 - start_time) / duration);
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
			component.$$.dirty = blank_object();
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

	/* src/Image.svelte generated by Svelte v3.4.2 */

	const file = "src/Image.svelte";

	// (82:0) {#if !visible}
	function create_if_block(ctx) {
		var div;

		return {
			c: function create() {
				div = element("div");
				div.className = "loader svelte-m5fr7l";
				set_style(div, "background", "#ccc");
				add_location(div, file, 82, 2, 1535);
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
				img.alt = "";
				img.className = img_class_value = "" + (ctx.visible ? '' : 'opacity--0') + " svelte-m5fr7l";
				add_location(img, file, 80, 0, 1453);
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
		
	  let { image, visible = 0 } = $$props;

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
			if ('visible' in $$props) $$invalidate('visible', visible = $$props.visible);
		};

		return { image, visible };
	}

	class Image_1 extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["image", "visible"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.image === undefined && !('image' in props)) {
				console.warn("<Image> was created without expected prop 'image'");
			}
		}

		get image() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set image(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get visible() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set visible(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	function noop$1() {}

	function safe_not_equal$1(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}
	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 * @param value initial value
	 * @param start start and stop notifications for subscriptions
	 */
	function writable(value, start = noop$1) {
	    let stop;
	    const subscribers = [];
	    function set(new_value) {
	        if (safe_not_equal$1(value, new_value)) {
	            value = new_value;
	            if (!stop) {
	                return; // not ready
	            }
	            subscribers.forEach((s) => s[1]());
	            subscribers.forEach((s) => s[0](value));
	        }
	    }
	    function update(fn) {
	        set(fn(value));
	    }
	    function subscribe$$1(run$$1, invalidate = noop$1) {
	        const subscriber = [run$$1, invalidate];
	        subscribers.push(subscriber);
	        if (subscribers.length === 1) {
	            stop = start(set) || noop$1;
	        }
	        run$$1(value);
	        return () => {
	            const index = subscribers.indexOf(subscriber);
	            if (index !== -1) {
	                subscribers.splice(index, 1);
	            }
	            if (subscribers.length === 0) {
	                stop();
	            }
	        };
	    }
	    return { set, update, subscribe: subscribe$$1 };
	}

	const destroyingExpandedGallery = writable(false);
	const activeCollection = writable(0);
	const loadingSecondary = writable(false);

	/* src/GalleryExpanded.svelte generated by Svelte v3.4.2 */

	const file$1 = "src/GalleryExpanded.svelte";

	function get_each_context(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	// (335:2) {#each stack as image, index}
	function create_each_block_1(ctx) {
		var a, t, span, a_href_value, current_1, dispose;

		var image = new Image_1({
			props: {
			image: "" + ctx.lowresdir + "/" + ctx.image.src
		},
			$$inline: true
		});
		image.$on("loadingComplete", ctx.loadingComplete_handler);

		function click_handler(...args) {
			return ctx.click_handler(ctx, ...args);
		}

		return {
			c: function create() {
				a = element("a");
				image.$$.fragment.c();
				t = space();
				span = element("span");
				span.className = "magnify svelte-ar9ky0";
				add_location(span, file$1, 337, 6, 8231);
				a.href = a_href_value = "" + ctx.hiresdir + "/" + ctx.image.src;
				a.className = "svelte-ar9ky0";
				add_location(a, file$1, 335, 4, 8081);
				dispose = listen(a, "click", click_handler);
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);
				mount_component(image, a, null);
				append(a, t);
				append(a, span);
				current_1 = true;
			},

			p: function update(changed, new_ctx) {
				ctx = new_ctx;
				var image_changes = {};
				if (changed.lowresdir || changed.stack) image_changes.image = "" + ctx.lowresdir + "/" + ctx.image.src;
				image.$set(image_changes);

				if ((!current_1 || changed.hiresdir || changed.stack) && a_href_value !== (a_href_value = "" + ctx.hiresdir + "/" + ctx.image.src)) {
					a.href = a_href_value;
				}
			},

			i: function intro(local) {
				if (current_1) return;
				image.$$.fragment.i(local);

				current_1 = true;
			},

			o: function outro(local) {
				image.$$.fragment.o(local);
				current_1 = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(a);
				}

				image.$destroy();

				dispose();
			}
		};
	}

	// (343:0) {#if ready}
	function create_if_block$1(ctx) {
		var div, t0, span0, t1, span1, t2, span2, current_1, dispose;

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

				t0 = space();
				span0 = element("span");
				t1 = space();
				span1 = element("span");
				t2 = space();
				span2 = element("span");
				span2.textContent = "close";
				span0.className = "previous svelte-ar9ky0";
				add_location(span0, file$1, 349, 4, 8550);
				span1.className = "next svelte-ar9ky0";
				add_location(span1, file$1, 350, 4, 8609);
				span2.className = "close svelte-ar9ky0";
				add_location(span2, file$1, 351, 4, 8660);
				div.className = "hires svelte-ar9ky0";
				add_location(div, file$1, 343, 2, 8302);

				dispose = [
					listen(span0, "click", ctx.showPrevious),
					listen(span1, "click", ctx.showNext),
					listen(span2, "click", ctx.closeGallery)
				];
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				append(div, t0);
				append(div, span0);
				append(div, t1);
				append(div, span1);
				append(div, t2);
				append(div, span2);
				add_binding_callback(() => ctx.div_binding_1(div, null));
				current_1 = true;
			},

			p: function update(changed, ctx) {
				if (changed.current || changed.hiresdir || changed.stack || changed.handleLoadingHiResComplete) {
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
							each_blocks[i].m(div, t0);
						}
					}

					group_outros();
					for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
					check_outros();
				}

				if (changed.items) {
					ctx.div_binding_1(null, div);
					ctx.div_binding_1(div, null);
				}
			},

			i: function intro(local) {
				if (current_1) return;
				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				current_1 = true;
			},

			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				current_1 = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);

				ctx.div_binding_1(null, div);
				run_all(dispose);
			}
		};
	}

	// (345:4) {#each stack as image, index}
	function create_each_block(ctx) {
		var div, current_1;

		var image = new Image_1({
			props: {
			image: "" + ctx.hiresdir + "/" + ctx.image.src
		},
			$$inline: true
		});
		image.$on("loadingComplete", ctx.handleLoadingHiResComplete);

		return {
			c: function create() {
				div = element("div");
				image.$$.fragment.c();
				div.className = "svelte-ar9ky0";
				toggle_class(div, "active", ctx.current === ctx.index);
				add_location(div, file$1, 345, 6, 8386);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(image, div, null);
				current_1 = true;
			},

			p: function update(changed, ctx) {
				var image_changes = {};
				if (changed.hiresdir || changed.stack) image_changes.image = "" + ctx.hiresdir + "/" + ctx.image.src;
				image.$set(image_changes);

				if (changed.current) {
					toggle_class(div, "active", ctx.current === ctx.index);
				}
			},

			i: function intro(local) {
				if (current_1) return;
				image.$$.fragment.i(local);

				current_1 = true;
			},

			o: function outro(local) {
				image.$$.fragment.o(local);
				current_1 = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				image.$destroy();
			}
		};
	}

	function create_fragment$1(ctx) {
		var scrolling = false, clear_scrolling = () => { scrolling = false; }, scrolling_timeout, div, t, if_block_anchor, current_1, dispose;

		add_render_callback(ctx.onwindowscroll);

		var each_value_1 = ctx.stack;

		var each_blocks = [];

		for (var i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
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

		var if_block = (ctx.ready) && create_if_block$1(ctx);

		return {
			c: function create() {
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
				div.className = "stack gallery svelte-ar9ky0";
				add_location(div, file$1, 333, 0, 7992);
				dispose = listen(window, "scroll", () => {
					scrolling = true;
					clearTimeout(scrolling_timeout);
					scrolling_timeout = setTimeout(clear_scrolling, 100);
					ctx.onwindowscroll();
				});
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
				insert(target, t, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current_1 = true;
			},

			p: function update(changed, ctx) {
				if (changed.y && !scrolling) {
					scrolling = true;
					clearTimeout(scrolling_timeout);
					window.scrollTo(window.pageXOffset, ctx.y);
					scrolling_timeout = setTimeout(clear_scrolling, 100);
				}

				if (changed.hiresdir || changed.stack || changed.lowresdir) {
					each_value_1 = ctx.stack;

					for (var i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(changed, child_ctx);
							each_blocks[i].i(1);
						} else {
							each_blocks[i] = create_each_block_1(child_ctx);
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

				if (ctx.ready) {
					if (if_block) {
						if_block.p(changed, ctx);
						if_block.i(1);
					} else {
						if_block = create_if_block$1(ctx);
						if_block.c();
						if_block.i(1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();
					on_outro(() => {
						if_block.d(1);
						if_block = null;
					});

					if_block.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current_1) return;
				for (var i = 0; i < each_value_1.length; i += 1) each_blocks[i].i();

				if (if_block) if_block.i();
				current_1 = true;
			},

			o: function outro(local) {
				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				if (if_block) if_block.o();
				current_1 = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);

				ctx.div_binding(null, div);

				if (detaching) {
					detach(t);
				}

				if (if_block) if_block.d(detaching);

				if (detaching) {
					detach(if_block_anchor);
				}

				dispose();
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let $destroyingExpandedGallery, $loadingSecondary;

		validate_store(destroyingExpandedGallery, 'destroyingExpandedGallery');
		subscribe($$self, destroyingExpandedGallery, $$value => { $destroyingExpandedGallery = $$value; $$invalidate('$destroyingExpandedGallery', $destroyingExpandedGallery); });
		validate_store(loadingSecondary, 'loadingSecondary');
		subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

		

	  let { stack, lowresdir, hiresdir, originaltarget } = $$props;

	  // Local stuff
	  let secondLevel;
	  let thirdLevel;
	  let images;
	  let imageCount;
	  let ready;
	  let current;
	  let y;
	  let expandedOnce = false;
	  
	  // count for loading
	  let count = 0;

	  // Function for bringing everything together.
	  function consolidateStuff(){
	    let rect = originaltarget.getBoundingClientRect();
	    secondLevel.classList.add('no-pointer-events');

	    console.log("BOTCH");
	    console.log(images);

	    //sometimes the object is undefined I don't know why.
	    if(images !== undefined){
	      Object.entries(images).forEach(([key, value]) => {
	        let imageDivRect = value.getBoundingClientRect();
	        let transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 4) - imageDivRect.y}px) rotate(${key * 4}deg)`;
	        
	        if(key == 0){
	          transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 6) - imageDivRect.y}px) scale(1.08) translateY(5px) rotate(-2deg)`;
	        }
	        
	        // if gallery is being closed/destroyed we want a quicker transition.
	        if($destroyingExpandedGallery){
	          value.classList.add('quicktransition');
	          transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
	        }else{
	          value.parentNode.style.zIndex = imageCount - key;
	        }
	        // Set tranformed style.
	        value.style.transform = transformedStyle;
	      });
	    }else{
	      console.log('object was undefined, hard luck son.');
	      //component.$destroy()
	    }
	    

	    
	    


	  }

	  // Function for Expanding things into place.
	  function expandStuff(){
	    
	    secondLevel.style.transform = `translateY(${scrollY}px)`; $$invalidate('secondLevel', secondLevel);
	    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

	    (async () => {
	      await sleep(80);
	      Object.entries(images).forEach(([key, value]) => {
	        var imageDivRect = value.getBoundingClientRect();
	        value.classList.add('slowtransition');
	        value.style.transform = `translateX(0px) translateY(0px)`;
	      });
	    })();

	    (async () => {
	      await sleep(500);
	      secondLevel.classList.remove('no-pointer-events');
	    })();
	  }

	  onMount(() => {
	    $$invalidate('images', images = secondLevel.getElementsByTagName('img'));
	    $$invalidate('imageCount', imageCount = secondLevel.getElementsByTagName('img').length); 
	    consolidateStuff();
	    
	  });

	  // Might be able to refactor this to not use AfterUpdate, 
	  // but for now it seems ok.
	  afterUpdate(() => {
	    if(!$loadingSecondary && !$destroyingExpandedGallery){
	      if(!expandedOnce){
	         expandStuff();
	      }
	      $$invalidate('expandedOnce', expandedOnce = true);
	    }
	    if($destroyingExpandedGallery){
	      consolidateStuff();
	      $$invalidate('expandedOnce', expandedOnce = false);
	    }
	  });

	  onDestroy(() => {
	    console.log('being destroyed');
	    destroyingExpandedGallery.update(n => false);
	  });

	  function loadLargeImages(event, index){
	    $$invalidate('current', current = index);
	    event.preventDefault();
	    // after loading 
	    $$invalidate('ready', ready = true);
	  }

	  function handleLoadingHiResComplete(event){
	    $$invalidate('count', count = count + event.detail.loadingComplete);
	    if(count === stack.length){
	      $$invalidate('count', count = 0);
	      document.documentElement.classList.add('locked');
	    }
	  }

	  function showPrevious(){
	    console.log(`current image is ${current}`);
	    console.log("go prev");
	    
	    if(current <= 0) {
	      $$invalidate('current', current = stack.length - 1);
	    }else{
	      current--; $$invalidate('current', current);
	    }
	    console.log(`current image is ${current}`);
	  }
	  
	  function showNext(){
	    
	    if(current >= (stack.length - 1)) {
	      $$invalidate('current', current = 0);
	    }else{
	      current++; $$invalidate('current', current);
	    }
	    console.log(`current image is ${current}`);
	  }

	  function closeGallery(){
	    $$invalidate('ready', ready = false);
	    document.documentElement.classList.remove('locked');
	  }

		function loadingComplete_handler(event) {
			bubble($$self, event);
		}

		function onwindowscroll() {
			y = window.pageYOffset; $$invalidate('y', y);
		}

		function click_handler({ index }, e) {
			return loadLargeImages(e, index);
		}

		function div_binding($$node, check) {
			secondLevel = $$node;
			$$invalidate('secondLevel', secondLevel);
		}

		function div_binding_1($$node, check) {
			thirdLevel = $$node;
			$$invalidate('thirdLevel', thirdLevel);
		}

		$$self.$set = $$props => {
			if ('stack' in $$props) $$invalidate('stack', stack = $$props.stack);
			if ('lowresdir' in $$props) $$invalidate('lowresdir', lowresdir = $$props.lowresdir);
			if ('hiresdir' in $$props) $$invalidate('hiresdir', hiresdir = $$props.hiresdir);
			if ('originaltarget' in $$props) $$invalidate('originaltarget', originaltarget = $$props.originaltarget);
		};

		return {
			stack,
			lowresdir,
			hiresdir,
			originaltarget,
			secondLevel,
			thirdLevel,
			ready,
			current,
			y,
			loadLargeImages,
			handleLoadingHiResComplete,
			showPrevious,
			showNext,
			closeGallery,
			loadingComplete_handler,
			onwindowscroll,
			click_handler,
			div_binding,
			div_binding_1
		};
	}

	class GalleryExpanded extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["stack", "lowresdir", "hiresdir", "originaltarget"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.stack === undefined && !('stack' in props)) {
				console.warn("<GalleryExpanded> was created without expected prop 'stack'");
			}
			if (ctx.lowresdir === undefined && !('lowresdir' in props)) {
				console.warn("<GalleryExpanded> was created without expected prop 'lowresdir'");
			}
			if (ctx.hiresdir === undefined && !('hiresdir' in props)) {
				console.warn("<GalleryExpanded> was created without expected prop 'hiresdir'");
			}
			if (ctx.originaltarget === undefined && !('originaltarget' in props)) {
				console.warn("<GalleryExpanded> was created without expected prop 'originaltarget'");
			}
		}

		get stack() {
			throw new Error("<GalleryExpanded>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set stack(value) {
			throw new Error("<GalleryExpanded>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get lowresdir() {
			throw new Error("<GalleryExpanded>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set lowresdir(value) {
			throw new Error("<GalleryExpanded>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get hiresdir() {
			throw new Error("<GalleryExpanded>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set hiresdir(value) {
			throw new Error("<GalleryExpanded>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get originaltarget() {
			throw new Error("<GalleryExpanded>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set originaltarget(value) {
			throw new Error("<GalleryExpanded>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/*
	Adapted from https://github.com/mattdesl
	Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
	*/

	function cubicOut(t) {
		const f = t - 1.0;
		return f * f * f + 1.0;
	}

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

	function fly(node, {
		delay = 0,
		duration = 400,
		easing = cubicOut,
		x = 0,
		y = 0,
		opacity = 0
	}) {
		const style = getComputedStyle(node);
		const target_opacity = +style.opacity;
		const transform = style.transform === 'none' ? '' : style.transform;

		const od = target_opacity * (1 - opacity);

		return {
			delay,
			duration,
			easing,
			css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
		};
	}

	/* src/GalleryStack.svelte generated by Svelte v3.4.2 */

	const file$2 = "src/GalleryStack.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	// (298:0) {#if $activeCollection == id}
	function create_if_block_3(ctx) {
		var div, p, t0, t1, span, t2, t3_value = ctx.imagecollection.length, t3, t4, div_intro, div_outro, current, dispose;

		return {
			c: function create() {
				div = element("div");
				p = element("p");
				t0 = text(ctx.name);
				t1 = space();
				span = element("span");
				t2 = text("(");
				t3 = text(t3_value);
				t4 = text(" images)");
				span.className = "svelte-1bnkrap";
				add_location(span, file$2, 299, 14, 8267);
				p.className = "svelte-1bnkrap";
				add_location(p, file$2, 299, 4, 8257);
				div.className = "breadcrumb svelte-1bnkrap";
				add_location(div, file$2, 298, 2, 8129);
				dispose = listen(div, "click", ctx.resetStacks);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(p, t0);
				append(p, t1);
				append(p, span);
				append(span, t2);
				append(span, t3);
				append(span, t4);
				current = true;
			},

			p: function update(changed, ctx) {
				if (!current || changed.name) {
					set_data(t0, ctx.name);
				}

				if ((!current || changed.imagecollection) && t3_value !== (t3_value = ctx.imagecollection.length)) {
					set_data(t3, t3_value);
				}
			},

			i: function intro(local) {
				if (current) return;
				add_render_callback(() => {
					if (div_outro) div_outro.end(1);
					if (!div_intro) div_intro = create_in_transition(div, fly, { y: -40, duration: 400 });
					div_intro.start();
				});

				current = true;
			},

			o: function outro(local) {
				if (div_intro) div_intro.invalidate();

				if (local) {
					div_outro = create_out_transition(div, fly, { y: -40, duration: 400 });
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
					if (div_outro) div_outro.end();
				}

				dispose();
			}
		};
	}

	// (314:2) {#if $activeCollection == id}
	function create_if_block_2(ctx) {
		var svg, circle;

		return {
			c: function create() {
				svg = svg_element("svg");
				circle = svg_element("circle");
				attr(circle, "class", "path svelte-1bnkrap");
				attr(circle, "cx", "25");
				attr(circle, "cy", "25");
				attr(circle, "r", "20");
				attr(circle, "fill", "none");
				attr(circle, "stroke-width", "3");
				add_location(circle, file$2, 315, 4, 8778);
				attr(svg, "class", "spinner svelte-1bnkrap");
				attr(svg, "viewBox", "0 0 50 50");
				add_location(svg, file$2, 314, 4, 8732);
			},

			m: function mount(target, anchor) {
				insert(target, svg, anchor);
				append(svg, circle);
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(svg);
				}
			}
		};
	}

	// (323:4) {:else}
	function create_else_block(ctx) {
		var span;

		return {
			c: function create() {
				span = element("span");
				span.className = "dummyimage svelte-1bnkrap";
				set_style(span, "transform", "rotate(" + ctx.index * 2 + "deg)");
				set_style(span, "z-index", "-" + ctx.index);
				set_style(span, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
				add_location(span, file$2, 323, 6, 9072);
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

	// (321:4) {#if index==0}
	function create_if_block_1(ctx) {
		var current;

		var image = new Image_1({
			props: {
			image: "" + ctx.lowresdir + "/" + ctx.image.src
		},
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
				if (changed.lowresdir || changed.imagecollection) image_changes.image = "" + ctx.lowresdir + "/" + ctx.image.src;
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

	// (320:2) {#each imagecollection as image, index}
	function create_each_block$1(ctx) {
		var current_block_type_index, if_block, if_block_anchor, current;

		var if_block_creators = [
			create_if_block_1,
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

	// (331:0) {#if attemptingtoLoad}
	function create_if_block$2(ctx) {
		var div, div_class_value, div_intro, div_outro, current;

		let galleryexpanded_props = {
			lowresdir: ctx.lowresdir,
			hiresdir: ctx.hiresdir,
			stack: ctx.imagecollection,
			originaltarget: ctx.collection
		};
		var galleryexpanded = new GalleryExpanded({
			props: galleryexpanded_props,
			$$inline: true
		});

		add_binding_callback(() => ctx.galleryexpanded_binding(galleryexpanded));
		galleryexpanded.$on("loadingComplete", ctx.handleLoadingComplete);

		return {
			c: function create() {
				div = element("div");
				galleryexpanded.$$.fragment.c();
				div.className = div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-1bnkrap";
				add_location(div, file$2, 332, 3, 9380);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(galleryexpanded, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var galleryexpanded_changes = {};
				if (changed.lowresdir) galleryexpanded_changes.lowresdir = ctx.lowresdir;
				if (changed.hiresdir) galleryexpanded_changes.hiresdir = ctx.hiresdir;
				if (changed.imagecollection) galleryexpanded_changes.stack = ctx.imagecollection;
				if (changed.collection) galleryexpanded_changes.originaltarget = ctx.collection;
				galleryexpanded.$set(galleryexpanded_changes);

				if ((!current || changed.$loadingSecondary) && div_class_value !== (div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-1bnkrap")) {
					div.className = div_class_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				galleryexpanded.$$.fragment.i(local);

				add_render_callback(() => {
					if (div_outro) div_outro.end(1);
					if (!div_intro) div_intro = create_in_transition(div, fade, {duration: 90});
					div_intro.start();
				});

				current = true;
			},

			o: function outro(local) {
				galleryexpanded.$$.fragment.o(local);
				if (div_intro) div_intro.invalidate();

				if (local) {
					div_outro = create_out_transition(div, fade, {duration: 500});
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				ctx.galleryexpanded_binding(null);

				galleryexpanded.$destroy();

				if (detaching) {
					if (div_outro) div_outro.end();
				}
			}
		};
	}

	function create_fragment$2(ctx) {
		var t0, div, t1, t2, if_block2_anchor, current, dispose;

		var if_block0 = (ctx.$activeCollection == ctx.id) && create_if_block_3(ctx);

		var if_block1 = (ctx.$activeCollection == ctx.id) && create_if_block_2(ctx);

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

		var if_block2 = (ctx.attemptingtoLoad) && create_if_block$2(ctx);

		return {
			c: function create() {
				if (if_block0) if_block0.c();
				t0 = space();
				div = element("div");
				if (if_block1) if_block1.c();
				t1 = space();

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t2 = space();
				if (if_block2) if_block2.c();
				if_block2_anchor = empty();
				div.className = "collection svelte-1bnkrap";
				div.dataset.id = ctx.id;
				toggle_class(div, "active", ctx.id === ctx.$activeCollection && ctx.$loadingSecondary == true);
				toggle_class(div, "nonactive", ctx.$activeCollection!== 0 && ctx.id !== ctx.$activeCollection);
				add_location(div, file$2, 303, 0, 8336);

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
				if (if_block0) if_block0.m(target, anchor);
				insert(target, t0, anchor);
				insert(target, div, anchor);
				if (if_block1) if_block1.m(div, null);
				append(div, t1);

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].m(div, null);
				}

				add_binding_callback(() => ctx.div_binding(div, null));
				insert(target, t2, anchor);
				if (if_block2) if_block2.m(target, anchor);
				insert(target, if_block2_anchor, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				if (ctx.$activeCollection == ctx.id) {
					if (if_block0) {
						if_block0.p(changed, ctx);
						if_block0.i(1);
					} else {
						if_block0 = create_if_block_3(ctx);
						if_block0.c();
						if_block0.i(1);
						if_block0.m(t0.parentNode, t0);
					}
				} else if (if_block0) {
					group_outros();
					on_outro(() => {
						if_block0.d(1);
						if_block0 = null;
					});

					if_block0.o(1);
					check_outros();
				}

				if (ctx.$activeCollection == ctx.id) {
					if (!if_block1) {
						if_block1 = create_if_block_2(ctx);
						if_block1.c();
						if_block1.m(div, t1);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (changed.lowresdir || changed.imagecollection) {
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

				if (!current || changed.id) {
					div.dataset.id = ctx.id;
				}

				if ((changed.id || changed.$activeCollection || changed.$loadingSecondary)) {
					toggle_class(div, "active", ctx.id === ctx.$activeCollection && ctx.$loadingSecondary == true);
				}

				if ((changed.$activeCollection || changed.id)) {
					toggle_class(div, "nonactive", ctx.$activeCollection!== 0 && ctx.id !== ctx.$activeCollection);
				}

				if (ctx.attemptingtoLoad) {
					if (if_block2) {
						if_block2.p(changed, ctx);
						if_block2.i(1);
					} else {
						if_block2 = create_if_block$2(ctx);
						if_block2.c();
						if_block2.i(1);
						if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
					}
				} else if (if_block2) {
					group_outros();
					on_outro(() => {
						if_block2.d(1);
						if_block2 = null;
					});

					if_block2.o(1);
					check_outros();
				}
			},

			i: function intro(local) {
				if (current) return;
				if (if_block0) if_block0.i();

				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				if (if_block2) if_block2.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block0) if_block0.o();

				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				if (if_block2) if_block2.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);

				if (detaching) {
					detach(t0);
					detach(div);
				}

				if (if_block1) if_block1.d();

				destroy_each(each_blocks, detaching);

				ctx.div_binding(null, div);

				if (detaching) {
					detach(t2);
				}

				if (if_block2) if_block2.d(detaching);

				if (detaching) {
					detach(if_block2_anchor);
				}

				run_all(dispose);
			}
		};
	}

	// for wizardry to keep tabs on the collections
		const elements = new Set();

	function instance$2($$self, $$props, $$invalidate) {
		let $activeCollection, $loadingSecondary;

		validate_store(activeCollection, 'activeCollection');
		subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });
		validate_store(loadingSecondary, 'loadingSecondary');
		subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

		
	  
	  let { imagecollection, lowresdir, hiresdir, id = 0, name, color } = $$props;

	  // Local stuff
	  let collection;
	  let originalbgcolor;
	  let galleryExpanded;
	  let fakeImages;
	  let firstImage;

	  // count for loading
	  let count = 0;
	  
	  let attemptingtoLoad = false;

	  onMount(() => {
			$$invalidate('fakeImages', fakeImages = collection.getElementsByTagName('span'));
	    $$invalidate('firstImage', firstImage = collection.getElementsByTagName('img')[0]);
	    
	    // some wizardry for keeping tabs on the collections
	    elements.add(collection);
			return () => elements.delete(collection);
		});
	  
	  // Rotate image stack on hover
	  function rotate() {
	    collection.style.transform = 'rotate(-1.5deg)'; $$invalidate('collection', collection);
	    Object.entries(fakeImages).forEach(([key, value]) => {
	      value.style.transform = 'rotate(' + ((parseInt(key)* 4) + 5)+ 'deg)';
	    });
	    firstImage.style.transform = 'scale(1.08) translateY(10px)'; $$invalidate('firstImage', firstImage);
	  }

	  // Un-Rotate image stack on hover out
	  function unRotate() {
	    collection.style.transform = 'rotate(0deg)'; $$invalidate('collection', collection);
	    Object.entries(fakeImages).forEach(([key, value]) => {
	      value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
	    });
	    firstImage.style.transform = 'scale(1)'; $$invalidate('firstImage', firstImage);
	  }

	  // Initiate the gallery and expand the stack
	  function showContents(){
	    $$invalidate('attemptingtoLoad', attemptingtoLoad = true);
	    //console.log(color);
	    $$invalidate('originalbgcolor', originalbgcolor = getComputedStyle(document.documentElement).getPropertyValue('--bgcolor'));
	    if(color){
	      
	      let hslcolor = color.split(",");
	      //console.log(hslcolor[0])
	      document.documentElement.style.setProperty('--bgcolor', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 1)`);
	      document.documentElement.style.setProperty('--bgcolortint', `hsla(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]}%, 0.6)`);
	      document.documentElement.style.setProperty('--bgcolordarktint', `hsl(${hslcolor[0]}, ${hslcolor[1]}%, ${hslcolor[2]/hslcolor[1] * 10}%)`);
	    }

	    // this sets the loading to true.
	    loadingSecondary.update(n => true);
	    
	    // sets which stack needs to be expanded.
	    activeCollection.update(n => id);
	    blowStacks();
	  }

	  // Blow away the other stacks when we're initiating an Expanded Gallery
	  function blowStacks(){
	    
	    let centerX = document.documentElement.clientWidth/2;
	    let centerY = document.documentElement.clientHeight/2;
	    
	    elements.forEach(element => {
	      var rect = element.getBoundingClientRect();
	      element.classList.add('notransition');
	      let myId = parseInt(element.dataset.id);
	      element.classList.add('no-pointer-events');
	      if(myId!==$activeCollection){
	        element.style.transform = `translateX(${rect.left/3 - centerX/3}px) translateY(${rect.top/3 - centerY/3}px)`;
	      }
	    });

	  }

	  // Function for bringing the stacks back after we've closed an Expanded Gallery
	  function resetStacks(){
	    console.log('resetting...');
	    elements.forEach(element => {
	      element.classList.remove('notransition');
	    });
	    document.documentElement.style.setProperty('--bgcolor', originalbgcolor);
	    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
	      // Tells the expanded gallery that we're about to destroy it, so we can then call the consolitateStuff() function.
	      // might be able to call the funtion directly instead of this??
	      console.log(galleryExpanded);
	      destroyingExpandedGallery.update(n => true);
	      (async () => {
	        await sleep(200);
	        activeCollection.update(n => 0);
	        $$invalidate('attemptingtoLoad', attemptingtoLoad = false);
	        elements.forEach(element => {
	          element.style.transform = `translateX(0px) translateY(0px)`;
	        });
	      })();
	      (async () => {
	        await sleep(600);
	        elements.forEach(element => {
	          element.classList.remove('no-pointer-events');
	        });
	      })();
	  }
	  
	  // Wanted to maybe have a loader, so the following will let us know when all
	  // Image components in an Expanded Gallery have loaded.
	  function handleLoadingComplete(event) {
	    $$invalidate('count', count = count + event.detail.loadingComplete);
	    if(count === imagecollection.length){
	      
	      console.log("Loading complete");
	      loadingSecondary.update(n => false);
	      
	      // // Faking slow loading....
	      // const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
	      // (async () => {
	      //   await sleep(3200);
	      //   loadingSecondary.update(n => false);
	      // })();

	      $$invalidate('count', count = 0);
	    }
		}

		function div_binding($$node, check) {
			collection = $$node;
			$$invalidate('collection', collection);
		}

		function galleryexpanded_binding($$component) {
			galleryExpanded = $$component;
			$$invalidate('galleryExpanded', galleryExpanded);
		}

		$$self.$set = $$props => {
			if ('imagecollection' in $$props) $$invalidate('imagecollection', imagecollection = $$props.imagecollection);
			if ('lowresdir' in $$props) $$invalidate('lowresdir', lowresdir = $$props.lowresdir);
			if ('hiresdir' in $$props) $$invalidate('hiresdir', hiresdir = $$props.hiresdir);
			if ('id' in $$props) $$invalidate('id', id = $$props.id);
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
			if ('color' in $$props) $$invalidate('color', color = $$props.color);
		};

		return {
			imagecollection,
			lowresdir,
			hiresdir,
			id,
			name,
			color,
			collection,
			galleryExpanded,
			attemptingtoLoad,
			rotate,
			unRotate,
			showContents,
			resetStacks,
			handleLoadingComplete,
			$activeCollection,
			$loadingSecondary,
			div_binding,
			galleryexpanded_binding
		};
	}

	class GalleryStack extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["imagecollection", "lowresdir", "hiresdir", "id", "name", "color"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.imagecollection === undefined && !('imagecollection' in props)) {
				console.warn("<GalleryStack> was created without expected prop 'imagecollection'");
			}
			if (ctx.lowresdir === undefined && !('lowresdir' in props)) {
				console.warn("<GalleryStack> was created without expected prop 'lowresdir'");
			}
			if (ctx.hiresdir === undefined && !('hiresdir' in props)) {
				console.warn("<GalleryStack> was created without expected prop 'hiresdir'");
			}
			if (ctx.name === undefined && !('name' in props)) {
				console.warn("<GalleryStack> was created without expected prop 'name'");
			}
			if (ctx.color === undefined && !('color' in props)) {
				console.warn("<GalleryStack> was created without expected prop 'color'");
			}
		}

		get imagecollection() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set imagecollection(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get lowresdir() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set lowresdir(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get hiresdir() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set hiresdir(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get name() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get color() {
			throw new Error("<GalleryStack>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set color(value) {
			throw new Error("<GalleryStack>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.4.2 */

	const file$3 = "src/App.svelte";

	function create_fragment$3(ctx) {
		var div, t0, t1, t2, t3, t4, current;

		var gallerystack0 = new GalleryStack({
			props: {
			name: "Painterly",
			color: "261, 27, 71",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection1,
			id: uid++
		},
			$$inline: true
		});

		var gallerystack1 = new GalleryStack({
			props: {
			name: "Travelling",
			color: "206, 69, 88",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection2,
			id: uid++
		},
			$$inline: true
		});

		var gallerystack2 = new GalleryStack({
			props: {
			name: "Citizens of Science",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection3,
			id: uid++
		},
			$$inline: true
		});

		var gallerystack3 = new GalleryStack({
			props: {
			name: "Splashes",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection4,
			id: uid++
		},
			$$inline: true
		});

		var gallerystack4 = new GalleryStack({
			props: {
			name: "Angry at kids",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection5,
			id: uid++
		},
			$$inline: true
		});

		var gallerystack5 = new GalleryStack({
			props: {
			name: "Sketches",
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection6,
			id: uid++
		},
			$$inline: true
		});

		return {
			c: function create() {
				div = element("div");
				gallerystack0.$$.fragment.c();
				t0 = space();
				gallerystack1.$$.fragment.c();
				t1 = space();
				gallerystack2.$$.fragment.c();
				t2 = space();
				gallerystack3.$$.fragment.c();
				t3 = space();
				gallerystack4.$$.fragment.c();
				t4 = space();
				gallerystack5.$$.fragment.c();
				div.className = "container svelte-rby08";
				add_location(div, file$3, 68, 0, 1321);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(gallerystack0, div, null);
				append(div, t0);
				mount_component(gallerystack1, div, null);
				append(div, t1);
				mount_component(gallerystack2, div, null);
				append(div, t2);
				mount_component(gallerystack3, div, null);
				append(div, t3);
				mount_component(gallerystack4, div, null);
				append(div, t4);
				mount_component(gallerystack5, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var gallerystack0_changes = {};
				if (changed.collection1) gallerystack0_changes.imagecollection = ctx.collection1;
				if (changed.uid) gallerystack0_changes.id = uid++;
				gallerystack0.$set(gallerystack0_changes);

				var gallerystack1_changes = {};
				if (changed.collection2) gallerystack1_changes.imagecollection = ctx.collection2;
				if (changed.uid) gallerystack1_changes.id = uid++;
				gallerystack1.$set(gallerystack1_changes);

				var gallerystack2_changes = {};
				if (changed.collection3) gallerystack2_changes.imagecollection = ctx.collection3;
				if (changed.uid) gallerystack2_changes.id = uid++;
				gallerystack2.$set(gallerystack2_changes);

				var gallerystack3_changes = {};
				if (changed.collection4) gallerystack3_changes.imagecollection = ctx.collection4;
				if (changed.uid) gallerystack3_changes.id = uid++;
				gallerystack3.$set(gallerystack3_changes);

				var gallerystack4_changes = {};
				if (changed.collection5) gallerystack4_changes.imagecollection = ctx.collection5;
				if (changed.uid) gallerystack4_changes.id = uid++;
				gallerystack4.$set(gallerystack4_changes);

				var gallerystack5_changes = {};
				if (changed.collection6) gallerystack5_changes.imagecollection = ctx.collection6;
				if (changed.uid) gallerystack5_changes.id = uid++;
				gallerystack5.$set(gallerystack5_changes);
			},

			i: function intro(local) {
				if (current) return;
				gallerystack0.$$.fragment.i(local);

				gallerystack1.$$.fragment.i(local);

				gallerystack2.$$.fragment.i(local);

				gallerystack3.$$.fragment.i(local);

				gallerystack4.$$.fragment.i(local);

				gallerystack5.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				gallerystack0.$$.fragment.o(local);
				gallerystack1.$$.fragment.o(local);
				gallerystack2.$$.fragment.o(local);
				gallerystack3.$$.fragment.o(local);
				gallerystack4.$$.fragment.o(local);
				gallerystack5.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				gallerystack0.$destroy();

				gallerystack1.$destroy();

				gallerystack2.$destroy();

				gallerystack3.$destroy();

				gallerystack4.$destroy();

				gallerystack5.$destroy();
			}
		};
	}

	let uid = 1;

	function instance$3($$self, $$props, $$invalidate) {
		let { name } = $$props;

		// Images, maybe I can make this easier somehow?
		// Auto-generate from a directory structure maybe?
		let collection1 = [
			{ src: 'Noa.JPG' },
			{ src: 'dog.JPG' },
			{ src: 'glass.JPG' }
		];
		
		let collection4 = [
			{ src: 'atami.JPG' },
			{ src: 'kenodo.JPG' },
			{ src: 'kenodo2.JPG' }
		];
		let collection6 = [
			{ src: 'boring.JPG' },
			{ src: 'hownotto.JPG' },
			{ src: 'isometric.JPG' },
			{ src: 'notes.JPG' },
			{ src: 'glass-b+w.JPG' }
		];
		let collection2 = [
			{ src: 'cash.JPG' },
			{ src: 'robo.JPG' },
			{ src: 'tako.JPG' }
		];
		let collection5 = [
			{ src: 'angrykid2.JPG' },
			{ src: 'angrykid1.JPG' },
			{ src: 'angrykid3.JPG' },
			{ src: 'angrykid4.JPG' },
			{ src: 'angrykid5.JPG' }
		];
		let collection3 = [
			{ src: 'citizens.JPG' },
			{ src: 'screwit.JPG' },
			{ src: 'boltit.JPG' },
			{ src: 'kumo.JPG' }
		];

		$$self.$set = $$props => {
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
		};

		return {
			name,
			collection1,
			collection4,
			collection6,
			collection2,
			collection5,
			collection3
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
