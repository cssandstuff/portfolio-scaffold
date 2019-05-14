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

			const start_time = window.performance.now() + delay;
			const end_time = start_time + duration;

			if (task) task.abort();
			running = true;

			task = loop(now => {
				if (running) {
					if (now >= end_time) {
						tick$$1(1, 0);
						cleanup();
						return running = false;
					}

					if (now >= start_time) {
						const t = easing((now - start_time) / duration);
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

	const destroyingExpandedGallery = writable(false);
	const activeCollection = writable(0);
	const loadingSecondary = writable(false);

	/* src/GalleryExpanded.svelte generated by Svelte v3.2.1 */

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

	// (222:2) {#each stack as image, index}
	function create_each_block_1(ctx) {
		var a, a_href_value, current_1, dispose;

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
				a.href = a_href_value = "" + ctx.hiresdir + "/" + ctx.image.src;
				a.className = "svelte-k8z9y";
				add_location(a, file$1, 222, 4, 5315);
				dispose = listen(a, "click", click_handler);
			},

			m: function mount(target, anchor) {
				insert(target, a, anchor);
				mount_component(image, a, null);
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

	// (229:0) {#if ready}
	function create_if_block$1(ctx) {
		var div, t0, span0, t1, span1, current_1, dispose;

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
				span0.className = "previous svelte-k8z9y";
				add_location(span0, file$1, 235, 4, 5748);
				span1.className = "next svelte-k8z9y";
				add_location(span1, file$1, 236, 4, 5807);
				div.className = "hires svelte-k8z9y";
				add_location(div, file$1, 229, 2, 5500);

				dispose = [
					listen(span0, "click", ctx.showPrevious),
					listen(span1, "click", ctx.showNext)
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

	// (231:4) {#each stack as image, index}
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
				div.className = "svelte-k8z9y";
				toggle_class(div, "active", ctx.current === ctx.index);
				add_location(div, file$1, 231, 6, 5584);
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
				div.className = "stack gallery svelte-k8z9y";
				add_location(div, file$1, 220, 0, 5226);
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
	  let ExpandedBefore = false;
	  let ConsolidatedBefore = false;
	  let ready;
	  let current;
	  let y;
	  // count for loading
	  let count = 0;

	  // Function for bringing everything together.
	  function consolidateStuff(){
	    let rect = originaltarget.getBoundingClientRect();
	     
	    Object.entries(images).forEach(([key, value]) => {
	      let imageDivRect = value.getBoundingClientRect();
	      let transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
	      
	      // if gallery is being closed/destroyed we want a quicker transition.
	      if($destroyingExpandedGallery){
	        value.classList.add('quicktransition');
	      }else{
	        value.parentNode.style.zIndex = imageCount - key;
	      }
	      // Set tranformed style.
	      value.style.transform = transformedStyle;
	    });

	  }

	  // Function for Expanding things into place.
	  function expandStuff(){
	    secondLevel.style.transform = `translateY(${scrollY}px)`; $$invalidate('secondLevel', secondLevel);
	    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

	    (async () => {
	      await sleep(50);
	      Object.entries(images).forEach(([key, value]) => {
	        var imageDivRect = value.getBoundingClientRect();
	        value.classList.add('slowtransition');
	        value.style.transform = `translateX(0px) translateY(0px)`;
	      });
	    })();
	  }

	  onMount(() => {
	    $$invalidate('images', images = secondLevel.getElementsByTagName('img'));
	    $$invalidate('imageCount', imageCount = secondLevel.getElementsByTagName('img').length);
	    consolidateStuff();
	    
	  });

	  afterUpdate(() => {
	    if($loadingSecondary && !ExpandedBefore){
	      expandStuff();
	      $$invalidate('ExpandedBefore', ExpandedBefore = true);
	    }
	    if($destroyingExpandedGallery && !ConsolidatedBefore){
	      consolidateStuff();
	      $$invalidate('ConsolidatedBefore', ConsolidatedBefore = true);
	    }
	  });

	  onDestroy(() => {
	    console.log('being destoryed');
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
	      // show the image that was clicked.
	      console.log(count);
	      console.log(current);
	      console.log(thirdLevel);

	      $$invalidate('count', count = 0);
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

	/* src/GalleryStacks.svelte generated by Svelte v3.2.1 */

	const file$2 = "src/GalleryStacks.svelte";

	function get_each_context$1(ctx, list, i) {
		const child_ctx = Object.create(ctx);
		child_ctx.image = list[i];
		child_ctx.index = i;
		return child_ctx;
	}

	// (291:0) {#if $activeCollection == id}
	function create_if_block_2(ctx) {
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
				span.className = "svelte-c4dcfe";
				add_location(span, file$2, 292, 14, 7245);
				p.className = "svelte-c4dcfe";
				add_location(p, file$2, 292, 4, 7235);
				div.className = "breadcrumb svelte-c4dcfe";
				add_location(div, file$2, 291, 2, 7107);
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

	// (308:4) {:else}
	function create_else_block(ctx) {
		var span;

		return {
			c: function create() {
				span = element("span");
				span.className = "dummyimage svelte-c4dcfe";
				set_style(span, "transform", "rotate(" + ctx.index * 2 + "deg)");
				set_style(span, "z-index", "-" + ctx.index);
				set_style(span, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
				add_location(span, file$2, 308, 6, 7857);
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

	// (306:4) {#if index==0}
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

	// (305:2) {#each imagecollection as image, index}
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

	// (316:0) {#if attemptingtoLoad}
	function create_if_block$2(ctx) {
		var div, div_class_value, div_outro, current;

		var galleryexpanded = new GalleryExpanded({
			props: {
			lowresdir: ctx.lowresdir,
			hiresdir: ctx.hiresdir,
			stack: ctx.imagecollection,
			originaltarget: ctx.collection
		},
			$$inline: true
		});
		galleryexpanded.$on("loadingComplete", ctx.handleLoadingComplete);

		return {
			c: function create() {
				div = element("div");
				galleryexpanded.$$.fragment.c();
				div.className = div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-c4dcfe";
				add_location(div, file$2, 316, 3, 8129);
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

				if ((!current || changed.$loadingSecondary) && div_class_value !== (div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-c4dcfe")) {
					div.className = div_class_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				galleryexpanded.$$.fragment.i(local);

				if (div_outro) div_outro.end(1);

				current = true;
			},

			o: function outro(local) {
				galleryexpanded.$$.fragment.o(local);

				if (local) {
					div_outro = create_out_transition(div, fade, {duration: 500});
				}

				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				galleryexpanded.$destroy();

				if (detaching) {
					if (div_outro) div_outro.end();
				}
			}
		};
	}

	function create_fragment$2(ctx) {
		var t0, div, div_class_value, t1, if_block1_anchor, current, dispose;

		var if_block0 = (ctx.$activeCollection == ctx.id) && create_if_block_2(ctx);

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

		var if_block1 = (ctx.attemptingtoLoad) && create_if_block$2(ctx);

		return {
			c: function create() {
				if (if_block0) if_block0.c();
				t0 = space();
				div = element("div");

				for (var i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t1 = space();
				if (if_block1) if_block1.c();
				if_block1_anchor = empty();
				div.className = div_class_value = "collection " + ctx.darkness + " svelte-c4dcfe";
				add_location(div, file$2, 295, 0, 7311);

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
					if (if_block0) {
						if_block0.p(changed, ctx);
						if_block0.i(1);
					} else {
						if_block0 = create_if_block_2(ctx);
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

				if ((!current || changed.darkness) && div_class_value !== (div_class_value = "collection " + ctx.darkness + " svelte-c4dcfe")) {
					div.className = div_class_value;
				}

				if (ctx.attemptingtoLoad) {
					if (if_block1) {
						if_block1.p(changed, ctx);
						if_block1.i(1);
					} else {
						if_block1 = create_if_block$2(ctx);
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
				if (if_block0) if_block0.i();

				for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

				if (if_block1) if_block1.i();
				current = true;
			},

			o: function outro(local) {
				if (if_block0) if_block0.o();

				each_blocks = each_blocks.filter(Boolean);
				for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

				if (if_block1) if_block1.o();
				current = false;
			},

			d: function destroy(detaching) {
				if (if_block0) if_block0.d(detaching);

				if (detaching) {
					detach(t0);
					detach(div);
				}

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
		let $activeCollection, $destroyingExpandedGallery, $loadingSecondary;

		validate_store(activeCollection, 'activeCollection');
		subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });
		validate_store(destroyingExpandedGallery, 'destroyingExpandedGallery');
		subscribe($$self, destroyingExpandedGallery, $$value => { $destroyingExpandedGallery = $$value; $$invalidate('$destroyingExpandedGallery', $destroyingExpandedGallery); });
		validate_store(loadingSecondary, 'loadingSecondary');
		subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

		
	  
	  let { imagecollection, lowresdir, hiresdir, id, name } = $$props;

	  const dispatch = createEventDispatcher();

	  // Local stuff
	  let collection;
	  let darkness;
	  let fakeImages;
	  let firstImage;

	  // count for loading
	  let count = 0;
	  
	  let attemptingtoLoad = false;
	  let resetStacksBefore = false;

	  onMount(() => {
			$$invalidate('fakeImages', fakeImages = collection.getElementsByTagName('span'));
	    $$invalidate('firstImage', firstImage = collection.getElementsByTagName('img')[0]);
		});
	  
	  // Rotate image stack on hover
	  function rotate() {
	    collection.style.transform = 'rotate(-1.5deg)'; $$invalidate('collection', collection);
	    Object.entries(fakeImages).forEach(([key, value]) => {
	      value.style.transform = 'rotate(' + (23/(imagecollection.length - 1) * (parseInt(key)+ 1))+ 'deg)';
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
	    dispatch('expand', {
	        active: id
	    }); 

	    //this sets the loading to true.
	    loadingSecondary.update(n => true);
	  }

	  // Blow away the other stacks when we're initiating an Expanded Gallery
	  function blowStacks(){
	    var rect = collection.getBoundingClientRect();
	    let centerX = document.documentElement.clientWidth/2;
	    let centerY = document.documentElement.clientHeight/2;
	    
	    collection.style.transform = `translateX(${rect.left/3 - centerX/3}px) translateY(${rect.top/3 - centerY/3}px)`; $$invalidate('collection', collection);
	  }

	  // Function for bringing the stacks back after we've closed an Expanded Gallery
	  function resetStacks(){
	    if(!resetStacksBefore){
	      var rect = collection.getBoundingClientRect();
	      collection.style.transform = `translateX(0px) translateY(0px)`; $$invalidate('collection', collection);

	      const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
	        destroyingExpandedGallery.update(n => true);
	        (async () => {
	          await sleep(200);
	          dispatch('expand', {
	              active: 0
	          });
	          $$invalidate('attemptingtoLoad', attemptingtoLoad = false);
	          collection.classList.remove('no-pointer-events');
	        })();
	        $$invalidate('resetStacksBefore', resetStacksBefore = true);
	    }
	  }

	  // Lifecycle event. Calls whenever an update happens.
	  // some of this might need refactoring, not quite sure how it got like this.
	  afterUpdate(() => {
	    // If this is NOT the active collection.
	    if($activeCollection != id && $activeCollection!==0){
	      $$invalidate('darkness', darkness = 'total');
	      collection.classList.add('notransition');
	      collection.classList.add('no-pointer-events');
	      blowStacks();
	    
	    // If this IS the active collection.
	    }else if($activeCollection === id){
	      $$invalidate('darkness', darkness = 'none');
	      collection.classList.add('notransition');
	      $$invalidate('resetStacksBefore', resetStacksBefore = false);
	    
	    // If we're destroying the Expanded Gallery
	    }else if($destroyingExpandedGallery){
	      $$invalidate('darkness', darkness = '');
	      collection.classList.remove('notransition');
	      collection.classList.add('no-pointer-events');
	      $$invalidate('resetStacksBefore', resetStacksBefore = false);
	      resetStacks();
	    }
	  });
	  
	  // Wanted to maybe have a loader, so this tells me when all Image components in an Expanded Gallery have loaded.
	  function handleLoadingComplete(event) {
	    $$invalidate('count', count = count + event.detail.loadingComplete);
	    if(count === imagecollection.length){
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
			if ('lowresdir' in $$props) $$invalidate('lowresdir', lowresdir = $$props.lowresdir);
			if ('hiresdir' in $$props) $$invalidate('hiresdir', hiresdir = $$props.hiresdir);
			if ('id' in $$props) $$invalidate('id', id = $$props.id);
			if ('name' in $$props) $$invalidate('name', name = $$props.name);
		};

		return {
			imagecollection,
			lowresdir,
			hiresdir,
			id,
			name,
			collection,
			darkness,
			attemptingtoLoad,
			rotate,
			unRotate,
			showContents,
			resetStacks,
			handleLoadingComplete,
			$activeCollection,
			$loadingSecondary,
			div_binding
		};
	}

	class GalleryStacks extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["imagecollection", "lowresdir", "hiresdir", "id", "name"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.imagecollection === undefined && !('imagecollection' in props)) {
				console.warn("<GalleryStacks> was created without expected prop 'imagecollection'");
			}
			if (ctx.lowresdir === undefined && !('lowresdir' in props)) {
				console.warn("<GalleryStacks> was created without expected prop 'lowresdir'");
			}
			if (ctx.hiresdir === undefined && !('hiresdir' in props)) {
				console.warn("<GalleryStacks> was created without expected prop 'hiresdir'");
			}
			if (ctx.id === undefined && !('id' in props)) {
				console.warn("<GalleryStacks> was created without expected prop 'id'");
			}
			if (ctx.name === undefined && !('name' in props)) {
				console.warn("<GalleryStacks> was created without expected prop 'name'");
			}
		}

		get imagecollection() {
			throw new Error("<GalleryStacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set imagecollection(value) {
			throw new Error("<GalleryStacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get lowresdir() {
			throw new Error("<GalleryStacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set lowresdir(value) {
			throw new Error("<GalleryStacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get hiresdir() {
			throw new Error("<GalleryStacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set hiresdir(value) {
			throw new Error("<GalleryStacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get id() {
			throw new Error("<GalleryStacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set id(value) {
			throw new Error("<GalleryStacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get name() {
			throw new Error("<GalleryStacks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set name(value) {
			throw new Error("<GalleryStacks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/App.svelte generated by Svelte v3.2.1 */

	const file$3 = "src/App.svelte";

	function create_fragment$3(ctx) {
		var div, t0, t1, t2, t3, t4, t5, t6, current;

		var gallerystacks0 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection1,
			id: uid++,
			name: "Spider"
		},
			$$inline: true
		});
		gallerystacks0.$on("expand", handleExpand);

		var gallerystacks1 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection2,
			id: uid++,
			name: "Head"
		},
			$$inline: true
		});
		gallerystacks1.$on("expand", handleExpand);

		var gallerystacks2 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection3,
			id: uid++,
			name: "Octopus"
		},
			$$inline: true
		});
		gallerystacks2.$on("expand", handleExpand);

		var gallerystacks3 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection4,
			id: uid++,
			name: "Robot"
		},
			$$inline: true
		});
		gallerystacks3.$on("expand", handleExpand);

		var gallerystacks4 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection5,
			id: uid++,
			name: "Cash Suitcase"
		},
			$$inline: true
		});
		gallerystacks4.$on("expand", handleExpand);

		var gallerystacks5 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection6,
			id: uid++,
			name: "Citizens of Science"
		},
			$$inline: true
		});
		gallerystacks5.$on("expand", handleExpand);

		var gallerystacks6 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection4,
			id: uid++,
			name: "Robo"
		},
			$$inline: true
		});
		gallerystacks6.$on("expand", handleExpand);

		var gallerystacks7 = new GalleryStacks({
			props: {
			lowresdir: "images",
			hiresdir: "images/originals",
			imagecollection: ctx.collection1,
			id: uid++,
			name: "Kumo"
		},
			$$inline: true
		});
		gallerystacks7.$on("expand", handleExpand);

		return {
			c: function create() {
				div = element("div");
				gallerystacks0.$$.fragment.c();
				t0 = space();
				gallerystacks1.$$.fragment.c();
				t1 = space();
				gallerystacks2.$$.fragment.c();
				t2 = space();
				gallerystacks3.$$.fragment.c();
				t3 = space();
				gallerystacks4.$$.fragment.c();
				t4 = space();
				gallerystacks5.$$.fragment.c();
				t5 = space();
				gallerystacks6.$$.fragment.c();
				t6 = space();
				gallerystacks7.$$.fragment.c();
				div.className = "container svelte-rby08";
				add_location(div, file$3, 77, 0, 1680);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(gallerystacks0, div, null);
				append(div, t0);
				mount_component(gallerystacks1, div, null);
				append(div, t1);
				mount_component(gallerystacks2, div, null);
				append(div, t2);
				mount_component(gallerystacks3, div, null);
				append(div, t3);
				mount_component(gallerystacks4, div, null);
				append(div, t4);
				mount_component(gallerystacks5, div, null);
				append(div, t5);
				mount_component(gallerystacks6, div, null);
				append(div, t6);
				mount_component(gallerystacks7, div, null);
				current = true;
			},

			p: function update(changed, ctx) {
				var gallerystacks0_changes = {};
				if (changed.collection1) gallerystacks0_changes.imagecollection = ctx.collection1;
				if (changed.uid) gallerystacks0_changes.id = uid++;
				gallerystacks0.$set(gallerystacks0_changes);

				var gallerystacks1_changes = {};
				if (changed.collection2) gallerystacks1_changes.imagecollection = ctx.collection2;
				if (changed.uid) gallerystacks1_changes.id = uid++;
				gallerystacks1.$set(gallerystacks1_changes);

				var gallerystacks2_changes = {};
				if (changed.collection3) gallerystacks2_changes.imagecollection = ctx.collection3;
				if (changed.uid) gallerystacks2_changes.id = uid++;
				gallerystacks2.$set(gallerystacks2_changes);

				var gallerystacks3_changes = {};
				if (changed.collection4) gallerystacks3_changes.imagecollection = ctx.collection4;
				if (changed.uid) gallerystacks3_changes.id = uid++;
				gallerystacks3.$set(gallerystacks3_changes);

				var gallerystacks4_changes = {};
				if (changed.collection5) gallerystacks4_changes.imagecollection = ctx.collection5;
				if (changed.uid) gallerystacks4_changes.id = uid++;
				gallerystacks4.$set(gallerystacks4_changes);

				var gallerystacks5_changes = {};
				if (changed.collection6) gallerystacks5_changes.imagecollection = ctx.collection6;
				if (changed.uid) gallerystacks5_changes.id = uid++;
				gallerystacks5.$set(gallerystacks5_changes);

				var gallerystacks6_changes = {};
				if (changed.collection4) gallerystacks6_changes.imagecollection = ctx.collection4;
				if (changed.uid) gallerystacks6_changes.id = uid++;
				gallerystacks6.$set(gallerystacks6_changes);

				var gallerystacks7_changes = {};
				if (changed.collection1) gallerystacks7_changes.imagecollection = ctx.collection1;
				if (changed.uid) gallerystacks7_changes.id = uid++;
				gallerystacks7.$set(gallerystacks7_changes);
			},

			i: function intro(local) {
				if (current) return;
				gallerystacks0.$$.fragment.i(local);

				gallerystacks1.$$.fragment.i(local);

				gallerystacks2.$$.fragment.i(local);

				gallerystacks3.$$.fragment.i(local);

				gallerystacks4.$$.fragment.i(local);

				gallerystacks5.$$.fragment.i(local);

				gallerystacks6.$$.fragment.i(local);

				gallerystacks7.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				gallerystacks0.$$.fragment.o(local);
				gallerystacks1.$$.fragment.o(local);
				gallerystacks2.$$.fragment.o(local);
				gallerystacks3.$$.fragment.o(local);
				gallerystacks4.$$.fragment.o(local);
				gallerystacks5.$$.fragment.o(local);
				gallerystacks6.$$.fragment.o(local);
				gallerystacks7.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				gallerystacks0.$destroy();

				gallerystacks1.$destroy();

				gallerystacks2.$destroy();

				gallerystacks3.$destroy();

				gallerystacks4.$destroy();

				gallerystacks5.$destroy();

				gallerystacks6.$destroy();

				gallerystacks7.$destroy();
			}
		};
	}

	let uid = 1;

	function handleExpand(event) {
		console.log(event.detail.active);
		activeCollection.update(n => event.detail.active);
	}

	function instance$3($$self, $$props, $$invalidate) {
		let { name } = $$props;
		let collection1 = [
			{ src: 'IMG_0003.JPG' },
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0005.JPG' },
			{ src: 'IMG_0007.JPG' },
			{ src: 'IMG_0008.JPG' },
			{ src: 'IMG_0009.JPG' },
			{ src: 'IMG_0010.JPG' }
		];
		let collection2 = [
			{ src: 'IMG_0007.JPG' },
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0005.JPG' },
			{ src: 'IMG_0007.JPG' },
			{ src: 'IMG_0008.JPG' },
			{ src: 'IMG_0009.JPG' },
			{ src: 'IMG_0010.JPG' }
		];
		let collection3 = [
			{ src: 'IMG_0009.JPG' },
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0005.JPG' },
			{ src: 'IMG_0007.JPG' },
			{ src: 'IMG_0008.JPG' },
			{ src: 'IMG_0009.JPG' },
			{ src: 'IMG_0010.JPG' }
		];
		let collection4 = [
			{ src: 'IMG_0010.JPG' },
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0005.JPG' },
			{ src: 'IMG_0007.JPG' },
			{ src: 'IMG_0008.JPG' },
			{ src: 'IMG_0010.JPG' }
		];
		let collection5 = [
			{ src: 'IMG_0008.JPG' },
			{ src: 'IMG_0004.JPG' }
		];
		let collection6 = [
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0004.JPG' },
			{ src: 'IMG_0005.JPG' }
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
			collection6
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
