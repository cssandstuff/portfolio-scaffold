var app = (function () {
    'use strict';

    function noop() { }
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
    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? requestAnimationFrame : noop;

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
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
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
            if (iterations[i])
                iterations[i].d(detaching);
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
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
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
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
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
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
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
            while (binding_callbacks.length)
                binding_callbacks.shift()();
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
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick: tick$$1 = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick$$1(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
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
                if (started)
                    return;
                delete_rule(node);
                if (typeof config === 'function') {
                    config = config();
                    wait().then(go);
                }
                else {
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
            const { delay = 0, duration = 300, easing = identity, tick: tick$$1 = noop, css } = config;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
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
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
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
            }
            else {
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
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
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
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
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
                if (index !== -1)
                    callbacks.splice(index, 1);
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

    /* src/Image.svelte generated by Svelte v3.4.4 */

    const file = "src/Image.svelte";

    // (103:0) {#if !visible}
    function create_if_block(ctx) {
    	var div1, div0;

    	return {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.className = "inner svelte-vtevxo";
    			add_location(div0, file, 104, 4, 2133);
    			div1.className = "loader svelte-vtevxo";
    			add_location(div1, file, 103, 2, 2108);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
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
    			img.className = img_class_value = "" + (ctx.visible ? '' : 'opacity--0') + " svelte-vtevxo";
    			add_location(img, file, 101, 0, 2026);
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

    			if ((changed.visible) && img_class_value !== (img_class_value = "" + (ctx.visible ? '' : 'opacity--0') + " svelte-vtevxo")) {
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
        if(res.status === 200){
           $$invalidate('image', image = res.url);
           const loader = new Image();
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

    	const writable_props = ['image', 'visible'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Image> was created with unknown prop '${key}'`);
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

    /* src/Spinner.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/Spinner.svelte";

    function create_fragment$1(ctx) {
    	var div1, div0;

    	return {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.className = "inner svelte-148bgtc";
    			add_location(div0, file$1, 68, 0, 1388);
    			div1.className = "spinner svelte-148bgtc";
    			add_location(div1, file$1, 67, 0, 1366);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    		},

    		p: noop,
    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    			}
    		}
    	};
    }

    class Spinner extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$1, safe_not_equal, []);
    	}
    }

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
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
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
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
        return { set, update, subscribe };
    }

    const destroyingExpandedGallery = writable(false);
    const activeCollection = writable(0);
    const loadingSecondary = writable(false);

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400 }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
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

    /* src/GalleryExpanded.svelte generated by Svelte v3.4.4 */

    const file$2 = "src/GalleryExpanded.svelte";

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

    // (584:4) {#each stack as image, index}
    function create_each_block_1(ctx) {
    	var a, t0, span, t1, h2, t2_value = ctx.image.name, t2, a_href_value, current_1, dispose;

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
    			t0 = space();
    			span = element("span");
    			t1 = space();
    			h2 = element("h2");
    			t2 = text(t2_value);
    			span.className = "magnify svelte-1gc5gmg";
    			toggle_class(span, "out", ctx.showTitles === false);
    			add_location(span, file$2, 586, 8, 16833);
    			h2.className = "svelte-1gc5gmg";
    			toggle_class(h2, "out", ctx.$destroyingExpandedGallery === true || ctx.showTitles === false);
    			toggle_class(h2, "in", ctx.$loadingSecondary === false && ctx.showTitles !== false && !ctx.$destroyingExpandedGallery);
    			add_location(h2, file$2, 587, 8, 16906);
    			a.className = "galleryitem svelte-1gc5gmg";
    			a.href = a_href_value = "" + ctx.hiresdir + "/" + ctx.image.src;
    			toggle_class(a, "transitioning", ctx.transitioning === true);
    			add_location(a, file$2, 584, 6, 16612);
    			dispose = listen(a, "click", click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);
    			mount_component(image, a, null);
    			append(a, t0);
    			append(a, span);
    			append(a, t1);
    			append(a, h2);
    			append(h2, t2);
    			current_1 = true;
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			var image_changes = {};
    			if (changed.lowresdir || changed.stack) image_changes.image = "" + ctx.lowresdir + "/" + ctx.image.src;
    			image.$set(image_changes);

    			if (changed.showTitles) {
    				toggle_class(span, "out", ctx.showTitles === false);
    			}

    			if ((!current_1 || changed.stack) && t2_value !== (t2_value = ctx.image.name)) {
    				set_data(t2, t2_value);
    			}

    			if ((changed.$destroyingExpandedGallery || changed.showTitles)) {
    				toggle_class(h2, "out", ctx.$destroyingExpandedGallery === true || ctx.showTitles === false);
    			}

    			if ((changed.$loadingSecondary || changed.showTitles || changed.$destroyingExpandedGallery)) {
    				toggle_class(h2, "in", ctx.$loadingSecondary === false && ctx.showTitles !== false && !ctx.$destroyingExpandedGallery);
    			}

    			if ((!current_1 || changed.hiresdir || changed.stack) && a_href_value !== (a_href_value = "" + ctx.hiresdir + "/" + ctx.image.src)) {
    				a.href = a_href_value;
    			}

    			if (changed.transitioning) {
    				toggle_class(a, "transitioning", ctx.transitioning === true);
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

    // (595:0) {#if ready}
    function create_if_block$1(ctx) {
    	var t0, div, t1, span0, t2, span1, t3, span2, t4, div_outro, current_1, dispose;

    	var if_block = (!ctx.hiresLoaded) && create_if_block_1(ctx);

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
    			if (if_block) if_block.c();
    			t0 = space();
    			div = element("div");

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			span0 = element("span");
    			t2 = space();
    			span1 = element("span");
    			t3 = space();
    			span2 = element("span");
    			t4 = text(ctx.currentTitle);
    			span0.className = "previous svelte-1gc5gmg";
    			add_location(span0, file$2, 604, 4, 17543);
    			span1.className = "next svelte-1gc5gmg";
    			add_location(span1, file$2, 605, 4, 17602);
    			span2.className = "close svelte-1gc5gmg";
    			add_location(span2, file$2, 606, 4, 17653);
    			div.className = "hires svelte-1gc5gmg";
    			toggle_class(div, "ready", ctx.hiresLoaded === true);
    			add_location(div, file$2, 598, 2, 17210);

    			dispose = [
    				listen(span0, "click", ctx.showPrevious),
    				listen(span1, "click", ctx.showNext),
    				listen(span2, "click", ctx.closeGallery)
    			];
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t0, anchor);
    			insert(target, div, anchor);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t1);
    			append(div, span0);
    			append(div, t2);
    			append(div, span1);
    			append(div, t3);
    			append(div, span2);
    			append(span2, t4);
    			add_binding_callback(() => ctx.div_binding_1(div, null));
    			current_1 = true;
    		},

    		p: function update(changed, ctx) {
    			if (!ctx.hiresLoaded) {
    				if (!if_block) {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.i(1);
    					if_block.m(t0.parentNode, t0);
    				} else {
    									if_block.i(1);
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
    						each_blocks[i].m(div, t1);
    					}
    				}

    				group_outros();
    				for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
    				check_outros();
    			}

    			if (!current_1 || changed.currentTitle) {
    				set_data(t4, ctx.currentTitle);
    			}

    			if (changed.items) {
    				ctx.div_binding_1(null, div);
    				ctx.div_binding_1(div, null);
    			}

    			if (changed.hiresLoaded) {
    				toggle_class(div, "ready", ctx.hiresLoaded === true);
    			}
    		},

    		i: function intro(local) {
    			if (current_1) return;
    			if (if_block) if_block.i();

    			for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

    			if (div_outro) div_outro.end(1);

    			current_1 = true;
    		},

    		o: function outro(local) {
    			if (if_block) if_block.o();

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

    			if (local) {
    				div_outro = create_out_transition(div, fade, {duration: 100});
    			}

    			current_1 = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(div);
    			}

    			destroy_each(each_blocks, detaching);

    			ctx.div_binding_1(null, div);

    			if (detaching) {
    				if (div_outro) div_outro.end();
    			}

    			run_all(dispose);
    		}
    	};
    }

    // (596:2) {#if !hiresLoaded}
    function create_if_block_1(ctx) {
    	var current_1;

    	var spinner = new Spinner({ $$inline: true });

    	return {
    		c: function create() {
    			spinner.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(spinner, target, anchor);
    			current_1 = true;
    		},

    		i: function intro(local) {
    			if (current_1) return;
    			spinner.$$.fragment.i(local);

    			current_1 = true;
    		},

    		o: function outro(local) {
    			spinner.$$.fragment.o(local);
    			current_1 = false;
    		},

    		d: function destroy(detaching) {
    			spinner.$destroy(detaching);
    		}
    	};
    }

    // (600:4) {#each stack as image, index}
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
    			div.className = "hi-image svelte-1gc5gmg";
    			toggle_class(div, "active", ctx.current === ctx.index);
    			add_location(div, file$2, 600, 6, 17359);
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

    function create_fragment$2(ctx) {
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
    			div.className = "stack gallery svelte-1gc5gmg";
    			add_location(div, file$2, 582, 2, 16514);

    			dispose = [
    				listen(window, "keydown", ctx.handleKeydown),
    				listen(window, "scroll", () => {
    					scrolling = true;
    					clearTimeout(scrolling_timeout);
    					scrolling_timeout = setTimeout(clear_scrolling, 100);
    					ctx.onwindowscroll();
    				})
    			];
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

    			if (changed.hiresdir || changed.stack || changed.transitioning || changed.$destroyingExpandedGallery || changed.showTitles || changed.$loadingSecondary || changed.lowresdir) {
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

    			run_all(dispose);
    		}
    	};
    }

    let offset = 25;

    function instance$1($$self, $$props, $$invalidate) {
    	let $loadingSecondary, $destroyingExpandedGallery;

    	validate_store(loadingSecondary, 'loadingSecondary');
    	subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });
    	validate_store(destroyingExpandedGallery, 'destroyingExpandedGallery');
    	subscribe($$self, destroyingExpandedGallery, $$value => { $destroyingExpandedGallery = $$value; $$invalidate('$destroyingExpandedGallery', $destroyingExpandedGallery); });

    	
      //import { _resetStacks } from './GalleryStack.svelte';

      let { stack, lowresdir, hiresdir, originaltarget } = $$props;

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
      let centerX = document.documentElement.clientWidth/2;
      let centerY = document.documentElement.clientHeight/2;
      
      // Handles transition of single gallery image when it transitions to hi-res.
      let transitionHandler;
      
      // count for loading
      let count = 0;

      // booleans, do I need so many?
      let showTitles          = true;
      let hiresLoaded         = false;
      let ready               = false;
      let expandedOnce        = false;
      let transitioning       = false;
      let closedGallery       = false;
      
      // could probably remove the need for this?
      const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

      // want a reference to each gallery items within the active Collection.
      onMount(() => {
        images = activeCollection.getElementsByClassName('galleryitem');  
        // want the item in a stack on first mount
        attemptToConsolidate();
        
      });

      // Might be able to refactor this to not use AfterUpdate, 
      // but for now it seems ok.
      afterUpdate(() => {
        if(!$loadingSecondary && !$destroyingExpandedGallery && !expandedOnce){
          expandStuff();
          expandedOnce = true;
        }
        if($destroyingExpandedGallery && expandedOnce){
          attemptToConsolidate();
          expandedOnce = false;
        }
      });

      onDestroy(() => {
        console.log('being destroyed... laters');
        destroyingExpandedGallery.update(n => false);
      });

      function handleLoadingHiResComplete(event){
        count = count + event.detail.loadingComplete;
        if(count === stack.length){
          count = 0;
          $$invalidate('hiresLoaded', hiresLoaded = true);
        }
        hiresImages = thirdLevel.getElementsByClassName('hi-image');
      }

      // Keyboard functionality.
      function handleKeydown(event){
        if(event.code == "ArrowRight"){
          showNext();
        }
        if(event.code == "ArrowLeft"){
          showPrevious();
        }
        if(event.code == "Escape"){
          if(!closedGallery){
            closeGallery();
          }else{
            document.getElementById("breadcrumb").click();
          }
        }
      }

      // This is called on click of gallery item, to init the lightbox.
      function loadLargeImages(event, index){
        $$invalidate('current', current = index);
        event.preventDefault();

        // animates clicked image into center of screen.
        animateClicked(current);

        // Gets the hi-res images into the DOM and loading
        $$invalidate('ready', ready = true);
      }
      
      // Function for bringing everything together. called onMount
      // and when gallery is being destroyed.
      function attemptToConsolidate(){
        activeCollection.classList.add('no-pointer-events');

        //sometimes the object is undefined I don't know why.
        if(images !== undefined){
          console.log("weren't me guv, everything normal...");
          performConsolidation();
        
        // not sure I'm even experiencing this bug anymore, but can't hurt to be sure?
        }else{
          console.log('object was undefined, hard luck son.');
          
          // Try again?
          (async () => {
            await sleep(180);
            Object.entries(images).forEach(([key, value]) => {
              console.log('trying again...');
              performConsolidation();
            });
          })();
        }
      }

      // sometimes the object is empty, so we want a function that only runs when the object is there.
      // This is only called by the attemptToConsolidate function.
      function performConsolidation(){
        let rect = originaltarget.getBoundingClientRect();
        
        Object.entries(images).forEach(([key, value]) => {
          let imageDivRect = value.getBoundingClientRect();
          let transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 4) - imageDivRect.y}px) rotate(${key * 4}deg)`;
          
          // If first image
          if(key == 0){
            transformedStyle = `translateX(${(rect.x + 4) - imageDivRect.x}px) translateY(${(rect.y + 6) - imageDivRect.y}px) scale(1.08) translateY(5px) rotate(-2deg)`;
          }
          
          // stacks the zindex's of images so first is always on top.
          value.style.zIndex = images.length - key;

          // if gallery is being closed/destroyed we want a quicker transition.
          if($destroyingExpandedGallery){

            // Scroll to position we were at when item was first clicked.
            window.scrollTo(0, originalScrollPos);
            activeCollection.style.transform = `translateY(0px)`; $$invalidate('activeCollection', activeCollection);
            transformedStyle = `translateX(${rect.x - imageDivRect.x}px) translateY(${rect.y - imageDivRect.y}px) rotate(${key * 2}deg)`;
            // Quick transition please.
            value.classList.add('quicktransition');
            // Set tranformed style (different if destroying)
            value.style.transform = transformedStyle;

          }else{
            // Set tranformed style.
            value.style.transform = transformedStyle;
          }
          
        });
      }

      // Function for Expanding things into place.  
      function expandStuff(){
        
        // Want items that are expanded to always be at the top of the viewport
        originalScrollPos = scrollY;
        window.scrollTo(0,0);
        activeCollection.style.transform = `translateY(-${originalScrollPos}px)`; $$invalidate('activeCollection', activeCollection);
      
        (async () => {
          // Need to wait a little bit after scrollTo.
          await sleep(80);
          Object.entries(images).forEach(([key, value]) => {
            var imageDivRect = value.getBoundingClientRect();
            $$invalidate('transitioning', transitioning = true);
            value.classList.add('slowtransition');
            value.style.transform = `translateX(0px) translateY(${originalScrollPos}px)`; //translateY(${originalScrollPos}px)`;
          });
        })();

        (async () => {
          // sleep to wait for transition to end, maybe better to use transitionend ?
          await sleep(500);
          activeCollection.classList.remove('no-pointer-events');
          $$invalidate('transitioning', transitioning = false);
        })();
      }

      // animate clicked image to the center.
      function animateClicked(current){
        // This could probably be done more accurately, but it works ok for now.
        let currentImage = images[current].getElementsByTagName('img')[0];
        let rect = images[current].getBoundingClientRect();
        let centerArea = centerX + centerY * 2;
        let imageArea = rect.width + rect.height;

        // Hide thumbnail titles, else they jump in front of transitioned image.
        $$invalidate('showTitles', showTitles = false);

        // Set active breadcrumb title
        $$invalidate('currentTitle', currentTitle = images[current].getElementsByTagName('h2')[0].innerText);
        Object.entries(images).forEach(([key, value]) => {
          value.style.zIndex = '1';
        });

        currentImage.classList.remove('notransition');
        currentImage.classList.remove('quicktransition');
        images[current].style.zIndex = '99';    hiresScrollPos = scrollY;

        (async () => {
          // Need to wait a bit after classes are removed.
          await sleep(10);
          currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;
          currentImage.addEventListener('transitionend', transitionHandler = () => {
            console.log('Transition ended');
            document.getElementsByTagName("body")[0].classList.add('locked');
          });    })();
        closedGallery = false;
      }

      function showPrevious(){
        if(current <= 0) {
          hiresImages[0].style.transform = `translateX(${offset}px)`;      hiresImages[stack.length - 1].style.transform = `translateX(-${offset}px)`;      (async () => {
            // sleep while animation happens
            await sleep(200);
            $$invalidate('current', current = stack.length - 1);
            setImagePos(current);
            $$invalidate('currentTitle', currentTitle = images[current].getElementsByTagName('h2')[0].innerText);
          })();
        }else{
          hiresImages[current].style.transform = `translateX(${offset}px)`;      hiresImages[current - 1].style.transform = `translateX(-${offset}px)`;      (async () => {
            // sleep while animation happens
            await sleep(200);
            current--; $$invalidate('current', current);
            setImagePos(current);
            $$invalidate('currentTitle', currentTitle = images[current].getElementsByTagName('h2')[0].innerText);
          })();
        }
      }
      
      function showNext(){
        if(current >= (stack.length - 1)) {
          hiresImages[0].style.transform = `translateX(${offset}px)`;      hiresImages[stack.length - 1].style.transform = `translateX(-${offset}px)`;      (async () => {
            // sleep while animation happens
            await sleep(200);
            $$invalidate('current', current = 0);
            setImagePos(current);
          })();
        }else{
          hiresImages[current].style.transform = `translateX(-${offset}px)`;      hiresImages[current + 1].style.transform = `translateX(${offset}px)`;      (async () => {
            // sleep while animation happens
            await sleep(200);
            current++; $$invalidate('current', current);
            setImagePos(current);
          })();
        }
        
      }

      // Sets non-active gallery items to a position where they can shrink from when the hi-res gallery is closed.
      function setImagePos(current){
        let rect = images[current].getBoundingClientRect();
        
        let centerArea = centerX + centerY * 2;
        let imageArea = rect.width + rect.height;
        let currentImage = images[current].getElementsByTagName('img')[0];

        
        Object.entries(images).forEach(([key, value]) => {
          value.style.zIndex = '1';
          value.firstChild.classList.add('notransition');
          value.firstChild.classList.remove('hitransition');
          value.firstChild.style.transform = `translateX(0) translateY(0px) scale(1)`;
        });

        images[current].style.zIndex = '99';    currentImage.style.transform = `translateX(${centerX - rect.left - (rect.width/2)}px) translateY(${centerY - rect.top - (rect.height/2)}px) scale(${centerArea/imageArea})`;
        $$invalidate('currentTitle', currentTitle = images[current].getElementsByTagName('h2')[0].innerText);
      }

      function closeGallery(){
          let currentImage = images[current].getElementsByTagName('img')[0];
          let currentTransformPos = currentImage.style;
          currentImage.removeEventListener('transitionend', transitionHandler ,false);

          // this is tricky because we might need two offset values
          window.scrollTo(0, hiresScrollPos);
          document.getElementsByTagName("body")[0].classList.remove('locked');

          currentImage.classList.remove('notransition');
          currentImage.classList.add('hitransition');

          (async () => {
            // wait for animation to end.
            await sleep(200);
            currentImage.style.transform = `translateX(0) translateY(0) scale(1)`;
            $$invalidate('ready', ready = false);
            $$invalidate('hiresLoaded', hiresLoaded = false);
            $$invalidate('showTitles', showTitles = true);
          })();
          
          closedGallery = true;
      }

    	const writable_props = ['stack', 'lowresdir', 'hiresdir', 'originaltarget'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<GalleryExpanded> was created with unknown prop '${key}'`);
    	});

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
    		activeCollection = $$node;
    		$$invalidate('activeCollection', activeCollection);
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
    		activeCollection,
    		thirdLevel,
    		currentTitle,
    		current,
    		y,
    		showTitles,
    		hiresLoaded,
    		ready,
    		transitioning,
    		handleLoadingHiResComplete,
    		handleKeydown,
    		loadLargeImages,
    		showPrevious,
    		showNext,
    		closeGallery,
    		$loadingSecondary,
    		$destroyingExpandedGallery,
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
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, ["stack", "lowresdir", "hiresdir", "originaltarget"]);

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

    /* src/GalleryStack.svelte generated by Svelte v3.4.4 */

    const file$3 = "src/GalleryStack.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.image = list[i];
    	child_ctx.index = i;
    	return child_ctx;
    }

    // (300:0) {#if $activeCollection == id}
    function create_if_block_3(ctx) {
    	var div, p, t, div_intro, div_outro, current, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t = text(ctx.name);
    			p.className = "svelte-78yqex";
    			add_location(p, file$3, 301, 4, 8351);
    			div.id = "breadcrumb";
    			div.className = "breadcrumb svelte-78yqex";
    			add_location(div, file$3, 300, 2, 8207);
    			dispose = listen(div, "click", ctx.resetStacks);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p);
    			append(p, t);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (!current || changed.name) {
    				set_data(t, ctx.name);
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

    // (316:2) {#if $activeCollection == id}
    function create_if_block_2(ctx) {
    	var current;

    	var spinner = new Spinner({ $$inline: true });

    	return {
    		c: function create() {
    			spinner.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(spinner, target, anchor);
    			current = true;
    		},

    		i: function intro(local) {
    			if (current) return;
    			spinner.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			spinner.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			spinner.$destroy(detaching);
    		}
    	};
    }

    // (323:4) {:else}
    function create_else_block(ctx) {
    	var div;

    	return {
    		c: function create() {
    			div = element("div");
    			div.className = "dummyimage svelte-78yqex";
    			set_style(div, "transform", "rotate(" + ctx.index * 2 + "deg)");
    			set_style(div, "z-index", "-" + ctx.index);
    			set_style(div, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
    			add_location(div, file$3, 323, 6, 9026);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    		},

    		p: function update(changed, ctx) {
    			if (changed.imagecollection) {
    				set_style(div, "opacity", (1 - 1/ctx.imagecollection.length * ctx.index/1.2));
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}
    		}
    	};
    }

    // (321:4) {#if index==0}
    function create_if_block_1$1(ctx) {
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
    		create_if_block_1$1,
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

    // (334:0) {#if attemptingtoLoad}
    function create_if_block$2(ctx) {
    	var div, div_class_value, current;

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
    			div.className = div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-78yqex";
    			add_location(div, file$3, 335, 3, 9406);
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

    			if ((!current || changed.$loadingSecondary) && div_class_value !== (div_class_value = "loading--" + ctx.$loadingSecondary + " svelte-78yqex")) {
    				div.className = div_class_value;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			galleryexpanded.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			galleryexpanded.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			ctx.galleryexpanded_binding(null);

    			galleryexpanded.$destroy();
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var t0, a, t1, t2, h2, t3, t4, span, t5, t6_value = ctx.imagecollection.length, t6, t7, a_href_value, t8, if_block2_anchor, current, dispose;

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
    			a = element("a");
    			if (if_block1) if_block1.c();
    			t1 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			h2 = element("h2");
    			t3 = text(ctx.name);
    			t4 = space();
    			span = element("span");
    			t5 = text("(");
    			t6 = text(t6_value);
    			t7 = text(" Images)");
    			t8 = space();
    			if (if_block2) if_block2.c();
    			if_block2_anchor = empty();
    			span.className = "svelte-78yqex";
    			add_location(span, file$3, 328, 4, 9213);
    			h2.className = "svelte-78yqex";
    			add_location(h2, file$3, 326, 2, 9193);
    			a.href = a_href_value = "" + ctx.hiresdir + "/" + ctx.imagecollection[0].src;
    			a.className = "collection svelte-78yqex";
    			a.dataset.id = ctx.id;
    			toggle_class(a, "active", ctx.id === ctx.$activeCollection && ctx.$loadingSecondary == true);
    			toggle_class(a, "nonactive", ctx.$activeCollection!== 0 && ctx.id !== ctx.$activeCollection);
    			add_location(a, file$3, 305, 0, 8381);

    			dispose = [
    				listen(a, "mouseenter", ctx.rotate),
    				listen(a, "mouseleave", ctx.unRotate),
    				listen(a, "click", ctx.showContents)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t0, anchor);
    			insert(target, a, anchor);
    			if (if_block1) if_block1.m(a, null);
    			append(a, t1);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(a, null);
    			}

    			append(a, t2);
    			append(a, h2);
    			append(h2, t3);
    			append(h2, t4);
    			append(h2, span);
    			append(span, t5);
    			append(span, t6);
    			append(span, t7);
    			add_binding_callback(() => ctx.a_binding(a, null));
    			insert(target, t8, anchor);
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
    					if_block1.i(1);
    					if_block1.m(a, t1);
    				} else {
    									if_block1.i(1);
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
    						each_blocks[i].m(a, t2);
    					}
    				}

    				group_outros();
    				for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
    				check_outros();
    			}

    			if (!current || changed.name) {
    				set_data(t3, ctx.name);
    			}

    			if ((!current || changed.imagecollection) && t6_value !== (t6_value = ctx.imagecollection.length)) {
    				set_data(t6, t6_value);
    			}

    			if (changed.items) {
    				ctx.a_binding(null, a);
    				ctx.a_binding(a, null);
    			}

    			if ((!current || changed.hiresdir || changed.imagecollection) && a_href_value !== (a_href_value = "" + ctx.hiresdir + "/" + ctx.imagecollection[0].src)) {
    				a.href = a_href_value;
    			}

    			if (!current || changed.id) {
    				a.dataset.id = ctx.id;
    			}

    			if ((changed.id || changed.$activeCollection || changed.$loadingSecondary)) {
    				toggle_class(a, "active", ctx.id === ctx.$activeCollection && ctx.$loadingSecondary == true);
    			}

    			if ((changed.$activeCollection || changed.id)) {
    				toggle_class(a, "nonactive", ctx.$activeCollection!== 0 && ctx.id !== ctx.$activeCollection);
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
    			if (if_block1) if_block1.i();

    			for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

    			if (if_block2) if_block2.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block0) if_block0.o();
    			if (if_block1) if_block1.o();

    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

    			if (if_block2) if_block2.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(a);
    			}

    			if (if_block1) if_block1.d();

    			destroy_each(each_blocks, detaching);

    			ctx.a_binding(null, a);

    			if (detaching) {
    				detach(t8);
    			}

    			if (if_block2) if_block2.d(detaching);

    			if (detaching) {
    				detach(if_block2_anchor);
    			}

    			run_all(dispose);
    		}
    	};
    }

    // TODO: refactor. also, keyboard navigation: make outline/hotspots consistent/prettier.
    // add dark mode.
    // for wizardry to keep tabs on the collections
    const elements = new Set();
    //export let _resetStacks;

    function instance$2($$self, $$props, $$invalidate) {
    	let $activeCollection, $loadingSecondary;

    	validate_store(activeCollection, 'activeCollection');
    	subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });
    	validate_store(loadingSecondary, 'loadingSecondary');
    	subscribe($$self, loadingSecondary, $$value => { $loadingSecondary = $$value; $$invalidate('$loadingSecondary', $loadingSecondary); });

    	
      
      let { imagecollection, lowresdir, hiresdir, id = 0, name, color } = $$props;
      const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

      // placeholders for objects that we'll iterate over
      let collection;
      let galleryExpanded;
      let fakeImages;
      let firstImage;

      // reference to orginal colour
      let originalbgcolor;

      // count for loading
      let count = 0;
      
      // booleans
      let attemptingtoLoad = false;

      onMount(() => {
    		fakeImages = collection.getElementsByTagName('div');
        firstImage = collection.getElementsByTagName('img')[0];
        
        // some wizardry for keeping tabs on the collections
        elements.add(collection);
    		return () => elements.delete(collection);
      });
      
      
      // Rotate image stack on hover over
      function rotate() {
        //collection.style.transform = 'rotate(-1.5deg)';
        Object.entries(fakeImages).forEach(([key, value]) => {
          value.style.transform = 'rotate(' + ((parseInt(key)* 4) + 5)+ 'deg)';
        });
        firstImage.style.transform = 'scale(1.03) translateY(5px) rotate(-1deg)';  }

      // Un-Rotate image stack on hover out
      function unRotate() {
        //collection.style.transform = 'rotate(0deg)';
        Object.entries(fakeImages).forEach(([key, value]) => {
          value.style.transform = 'rotate(' + (2 * (parseInt(key)+ 1))+ 'deg)';
        });
        firstImage.style.transform = 'scale(1) rotate(0deg)';  }

      // Initiate the gallery and expand the stack
      function showContents(event){
        $$invalidate('attemptingtoLoad', attemptingtoLoad = true);
        event.preventDefault();

        originalbgcolor = getComputedStyle(document.documentElement).getPropertyValue('--bgcolor');
        if(color){
          
          let hslcolor = color.split(",");

          // Can I do this automatically to find the primary color of the image?
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
          element.classList.add('neardeath');
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
        
        document.documentElement.style.setProperty('--bgcolor', originalbgcolor);
        
        // Tells the expanded gallery that we're about to destroy it, so we can then call the consolitateStuff() function.
        // might be able to call the funtion directly instead of this??
        destroyingExpandedGallery.update(n => true);

        elements.forEach(element => {
          element.classList.remove('neardeath'); 
        });
        
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
        count = count + event.detail.loadingComplete;
        if(count === imagecollection.length){
          
          console.log("Loading complete");
          loadingSecondary.update(n => false);

          count = 0;
        }
      }

    	const writable_props = ['imagecollection', 'lowresdir', 'hiresdir', 'id', 'name', 'color'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<GalleryStack> was created with unknown prop '${key}'`);
    	});

    	function a_binding($$node, check) {
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
    		a_binding,
    		galleryexpanded_binding
    	};
    }

    class GalleryStack extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, ["imagecollection", "lowresdir", "hiresdir", "id", "name", "color"]);

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

    /* src/App.svelte generated by Svelte v3.4.4 */

    const file$4 = "src/App.svelte";

    // (211:0) {#if $activeCollection==0}
    function create_if_block_1$2(ctx) {
    	var div1, a0, t1, div0, svg, g, path, div0_intro, div0_outro, t2, a1, current, dispose;

    	return {
    		c: function create() {
    			div1 = element("div");
    			a0 = element("a");
    			a0.textContent = "About";
    			t1 = space();
    			div0 = element("div");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path = svg_element("path");
    			t2 = space();
    			a1 = element("a");
    			a1.textContent = "Github";
    			a0.className = "links svelte-143rcmn";
    			a0.href = "about";
    			toggle_class(a0, "hovering", ctx.menuHover === true);
    			add_location(a0, file$4, 212, 2, 4752);
    			attr(path, "d", "M28.664,22.376 C30.152,22.376 31.784,23.72 31.784,25.28 C31.784,27.464 28.424,31.616 26.768,31.616 C26.144,31.616 25.064,30.68 25.064,30.152 C25.064,29.6 25.88,28.88 26.624,28.16 C27.32,27.464 27.656,26.792 27.896,26.792 C28.136,26.792 28.904,27.632 28.904,27.632 C29.576,27.056 30.44,26.024 30.44,25.064 C30.44,24.728 30.032,24.296 29.648,24.296 C26.648,24.296 21.224,28.376 21.224,31.112 C21.224,33.512 27.44,34.304 27.44,37.616 C27.44,41.576 22.64,45.464 18.368,45.464 C15.44,45.464 12.8,42.344 12.8,41.792 C12.8,41.48 13.04,41.144 13.328,41.144 C13.544,41.144 15.104,42.968 17.648,42.968 C20.864,42.968 24.2,40.136 24.2,37.472 C24.2,34.448 18.488,34.016 18.488,30.08 C18.488,26.36 24.632,22.376 28.664,22.376 Z M32.624,41.312 C31.04,41.312 28.904,39.992 28.904,38.096 C28.904,36.536 30.032,33.896 31.184,31.568 C30.56,31.304 30.176,30.728 30.176,30.488 C30.176,30.344 30.344,30.152 30.488,30.152 C30.656,30.152 30.92,30.416 31.736,30.488 C32.72,28.568 33.584,27.032 33.584,26.816 C33.584,26.624 33.632,26.456 33.848,26.456 C34.472,26.456 35.504,27.344 35.504,28.28 C35.504,28.904 35.288,29.12 34.544,30.44 C35.576,30.392 36.512,30.32 36.728,30.32 C37.112,30.32 37.208,30.392 37.208,30.632 C37.208,30.872 36.512,32.048 35.624,32.048 C35.216,32.048 34.496,32 33.776,31.928 L32.96,33.656 C31.472,36.896 31.352,38.024 31.352,38.528 C31.352,39.296 31.664,39.92 32.48,39.92 C33.488,39.92 35.168,37.856 36.152,36.488 C36.56,35.912 36.68,35.72 36.8,35.72 C36.992,35.72 37.376,36.296 37.376,36.656 C37.376,37.016 37.28,37.304 36.776,37.952 C35.864,39.152 34.232,41.312 32.624,41.312 Z M44.384,41.192 C43.328,41.192 42.392,40.616 41.984,39.944 C41.84,39.68 41.816,39.224 41.816,38.912 L41.816,38.6 C41.816,38.6 40.016,41.336 38.504,41.336 C37.016,41.336 35.624,39.728 35.624,38.36 C35.624,35.816 39.344,30.848 41.768,30.848 C42.872,30.848 44.096,31.904 44.096,32.696 C44.096,32.696 44.456,32.456 44.648,32.456 C45.152,32.456 46.352,33.248 46.352,33.584 C46.352,33.92 44.888,35.696 44.312,37.472 C44,38.432 43.928,38.96 43.928,39.2 C43.928,39.584 44.288,39.8 44.6,39.8 C45.104,39.8 46.736,37.856 47.72,36.488 C48.128,35.912 48.248,35.72 48.368,35.72 C48.56,35.72 48.944,36.296 48.944,36.656 C48.944,37.016 48.848,37.304 48.344,37.952 C47.432,39.152 45.896,41.192 44.384,41.192 Z M42.272,32.888 C41.144,32.888 37.904,37.4 37.904,39.392 C37.904,39.752 38.216,39.944 38.552,39.944 C39.104,39.944 41.168,37.712 42.056,36.152 C41.984,36.032 41.912,35.96 41.912,35.792 C41.912,35.384 42.872,34.592 42.872,33.464 C42.872,33.104 42.584,32.888 42.272,32.888 Z M51.992,41.336 C49.88,41.336 47.576,39.896 47.576,37.232 C47.576,34.64 50.792,30.944 52.976,30.944 C54.392,30.944 55.52,32.024 55.52,32.96 C55.52,34.04 54.656,36.008 54.056,36.008 C53.456,36.008 52.904,35.408 52.904,35.24 C52.904,35.168 52.976,35.072 53.12,34.928 C53.552,34.496 54.248,33.584 54.248,32.912 C54.248,32.696 54.104,32.6 53.936,32.6 C52.544,32.6 50.24,35.84 50.24,37.88 C50.24,39.104 51.08,39.992 52.112,39.992 C53.528,39.992 55.232,37.856 56.216,36.488 C56.624,35.912 56.744,35.72 56.864,35.72 C57.056,35.72 57.44,36.296 57.44,36.656 C57.44,37.016 57.344,37.304 56.84,37.952 C55.928,39.152 54.2,41.336 51.992,41.336 Z M62.816,32.264 C61.976,32.264 59.264,36.032 58.904,37.04 C60.728,37.04 63.128,34.304 63.128,32.672 C63.128,32.408 63.056,32.264 62.816,32.264 Z M62.384,41.528 C59.864,41.528 59.12,38.624 58.208,38.552 C58.208,38.552 57.248,40.568 57.2,41.024 C57.176,41.288 56.936,41.408 56.72,41.408 C56.504,41.408 55.208,41.096 55.208,40.16 C55.208,39.224 55.448,38.192 57.2,33.608 C58.952,29.024 59.96,27.08 59.96,26.696 C59.96,26.528 60.104,26.48 60.344,26.48 C60.584,26.48 62.048,27.104 62.048,27.584 C62.048,28.064 60.632,30.92 59.312,34.52 C59.84,33.968 61.568,31.112 63.008,31.112 C64.448,31.112 65.144,32.072 65.144,33.776 C65.144,36.104 62.768,37.688 60.872,38.072 C62,38.576 62.288,39.512 62.984,39.512 C64.016,39.512 65.336,37.856 66.32,36.488 C66.728,35.912 66.848,35.72 66.968,35.72 C67.16,35.72 67.544,36.296 67.544,36.656 C67.544,37.016 67.448,37.304 66.944,37.952 C66.032,39.152 63.992,41.528 62.384,41.528 Z M64.664,38.792 C64.664,38.168 65.192,37.448 65.744,37.28 C66.872,35.672 68.36,33.824 69.296,32.216 C69.752,30.464 70.592,28.76 71.168,28.76 C72.104,28.76 73.112,29.504 73.112,30.272 C73.112,30.848 72.08,32.072 71.264,33.128 C71.264,35.048 72.704,35.336 72.704,38.072 C72.704,38.456 72.536,38.936 72.536,38.936 C73.664,38.24 74.576,37.28 75.152,36.488 C75.56,35.912 75.68,35.72 75.8,35.72 C75.992,35.72 76.376,36.296 76.376,36.656 C76.376,37.016 76.256,37.256 75.752,37.952 C74.336,39.896 71.864,41.384 69.224,41.384 C66.656,41.384 64.664,39.992 64.664,38.792 Z M66.776,38.216 C66.776,38.744 67.64,39.848 68.456,39.848 C69.344,39.848 69.968,38.696 69.968,37.232 C69.968,35.744 69.8,33.776 69.8,33.776 C68.96,35.096 67.952,36.608 66.776,38.216 Z");
    			attr(path, "id", "Stacks");
    			add_location(path, file$4, 216, 6, 5225);
    			attr(g, "transform", "translate(-12.000000, -22.000000)");
    			attr(g, "fill-rule", "nonzero");
    			add_location(g, file$4, 215, 5, 5149);
    			attr(svg, "width", "65px");
    			attr(svg, "height", "24px");
    			attr(svg, "viewBox", "0 0 65 24");
    			attr(svg, "version", "1.1");
    			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr(svg, "class", "svelte-143rcmn");
    			add_location(svg, file$4, 214, 3, 4999);
    			div0.className = "stacks-logo svelte-143rcmn";
    			toggle_class(div0, "hovering", ctx.menuHover === true);
    			add_location(div0, file$4, 213, 2, 4857);
    			a1.target = "_blank";
    			a1.className = "links svelte-143rcmn";
    			a1.href = "https://github.com/cssandstuff/portfolio-scaffold";
    			toggle_class(a1, "hovering", ctx.menuHover === true);
    			add_location(a1, file$4, 220, 2, 10115);
    			div1.className = "menu svelte-143rcmn";
    			add_location(div1, file$4, 211, 1, 4671);

    			dispose = [
    				listen(a0, "click", ctx.handleAbout),
    				listen(div1, "mouseenter", ctx.handleHover),
    				listen(div1, "mouseleave", ctx.handleHover)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, a0);
    			append(div1, t1);
    			append(div1, div0);
    			append(div0, svg);
    			append(svg, g);
    			append(g, path);
    			append(div1, t2);
    			append(div1, a1);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.menuHover) {
    				toggle_class(a0, "hovering", ctx.menuHover === true);
    				toggle_class(div0, "hovering", ctx.menuHover === true);
    				toggle_class(a1, "hovering", ctx.menuHover === true);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div0_outro) div0_outro.end(1);
    				if (!div0_intro) div0_intro = create_in_transition(div0, fly, { y: -50, duration: 400 });
    				div0_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div0_intro) div0_intro.invalidate();

    			if (local) {
    				div0_outro = create_out_transition(div0, fly, { y: -50, duration: 400 });
    			}

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div1);
    				if (div0_outro) div0_outro.end();
    			}

    			run_all(dispose);
    		}
    	};
    }

    // (235:0) {#if about }
    function create_if_block$3(ctx) {
    	var div, p0, t_1, p1, div_intro, div_outro, current, dispose;

    	return {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			p0.textContent = "This started out as a small code challenge to learn Svelte v3 & to see if I could build a procreate-like gallery.";
    			t_1 = space();
    			p1 = element("p");
    			p1.textContent = "I'm hopefully going to move it into Sapper and see if I can transition between routes.";
    			p0.className = "svelte-143rcmn";
    			add_location(p0, file$4, 236, 0, 11560);
    			p1.className = "svelte-143rcmn";
    			add_location(p1, file$4, 237, 0, 11681);
    			div.className = "about svelte-143rcmn";
    			add_location(div, file$4, 235, 0, 11444);
    			dispose = listen(div, "click", ctx.handleAbout);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p0);
    			append(div, t_1);
    			append(div, p1);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);
    				if (!div_intro) div_intro = create_in_transition(div, fly, { y: -20, duration: 400 });
    				div_intro.start();
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (div_intro) div_intro.invalidate();

    			if (local) {
    				div_outro = create_out_transition(div, fly, { y: 0, duration: 400 });
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

    function create_fragment$4(ctx) {
    	var div0, t0, div1, t1, t2, t3, t4, t5, t6, if_block1_anchor, current;

    	var if_block0 = (ctx.$activeCollection==0) && create_if_block_1$2(ctx);

    	var gallerystack0 = new GalleryStack({
    		props: {
    		width: "",
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
    		width: "",
    		name: "Splashes",
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
    		width: "",
    		name: "Citizens of science",
    		color: "182, 37, 73",
    		lowresdir: "images",
    		hiresdir: "images/originals",
    		imagecollection: ctx.collection3,
    		id: uid++
    	},
    		$$inline: true
    	});

    	var gallerystack3 = new GalleryStack({
    		props: {
    		width: "",
    		name: "Travelling",
    		color: "209, 25, 24",
    		lowresdir: "images",
    		hiresdir: "images/originals",
    		imagecollection: ctx.collection4,
    		id: uid++
    	},
    		$$inline: true
    	});

    	var gallerystack4 = new GalleryStack({
    		props: {
    		width: "",
    		name: "Angry at kids",
    		color: "13, 92, 87",
    		lowresdir: "images",
    		hiresdir: "images/originals",
    		imagecollection: ctx.collection5,
    		id: uid++
    	},
    		$$inline: true
    	});

    	var gallerystack5 = new GalleryStack({
    		props: {
    		width: "",
    		name: "Sketches",
    		color: "109, 0, 76",
    		lowresdir: "images",
    		hiresdir: "images/originals",
    		imagecollection: ctx.collection6,
    		id: uid++
    	},
    		$$inline: true
    	});

    	var if_block1 = (ctx.about) && create_if_block$3(ctx);

    	return {
    		c: function create() {
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			gallerystack0.$$.fragment.c();
    			t1 = space();
    			gallerystack1.$$.fragment.c();
    			t2 = space();
    			gallerystack2.$$.fragment.c();
    			t3 = space();
    			gallerystack3.$$.fragment.c();
    			t4 = space();
    			gallerystack4.$$.fragment.c();
    			t5 = space();
    			gallerystack5.$$.fragment.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			div0.className = "container svelte-143rcmn";
    			set_style(div0, "height", "50px");
    			set_style(div0, "margin-bottom", "20px");
    			set_style(div0, "margin-top", "25px");
    			add_location(div0, file$4, 209, 0, 4559);
    			div1.className = "container svelte-143rcmn";
    			add_location(div1, file$4, 225, 0, 10276);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div0, anchor);
    			if (if_block0) if_block0.m(div0, null);
    			insert(target, t0, anchor);
    			insert(target, div1, anchor);
    			mount_component(gallerystack0, div1, null);
    			append(div1, t1);
    			mount_component(gallerystack1, div1, null);
    			append(div1, t2);
    			mount_component(gallerystack2, div1, null);
    			append(div1, t3);
    			mount_component(gallerystack3, div1, null);
    			append(div1, t4);
    			mount_component(gallerystack4, div1, null);
    			append(div1, t5);
    			mount_component(gallerystack5, div1, null);
    			insert(target, t6, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.$activeCollection==0) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    					if_block0.i(1);
    				} else {
    					if_block0 = create_if_block_1$2(ctx);
    					if_block0.c();
    					if_block0.i(1);
    					if_block0.m(div0, null);
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

    			if (ctx.about) {
    				if (if_block1) {
    					if_block1.p(changed, ctx);
    					if_block1.i(1);
    				} else {
    					if_block1 = create_if_block$3(ctx);
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

    			gallerystack0.$$.fragment.i(local);

    			gallerystack1.$$.fragment.i(local);

    			gallerystack2.$$.fragment.i(local);

    			gallerystack3.$$.fragment.i(local);

    			gallerystack4.$$.fragment.i(local);

    			gallerystack5.$$.fragment.i(local);

    			if (if_block1) if_block1.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block0) if_block0.o();
    			gallerystack0.$$.fragment.o(local);
    			gallerystack1.$$.fragment.o(local);
    			gallerystack2.$$.fragment.o(local);
    			gallerystack3.$$.fragment.o(local);
    			gallerystack4.$$.fragment.o(local);
    			gallerystack5.$$.fragment.o(local);
    			if (if_block1) if_block1.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div0);
    			}

    			if (if_block0) if_block0.d();

    			if (detaching) {
    				detach(t0);
    				detach(div1);
    			}

    			gallerystack0.$destroy();

    			gallerystack1.$destroy();

    			gallerystack2.$destroy();

    			gallerystack3.$destroy();

    			gallerystack4.$destroy();

    			gallerystack5.$destroy();

    			if (detaching) {
    				detach(t6);
    			}

    			if (if_block1) if_block1.d(detaching);

    			if (detaching) {
    				detach(if_block1_anchor);
    			}
    		}
    	};
    }

    let uid = 1;

    function instance$3($$self, $$props, $$invalidate) {
    	let $activeCollection;

    	validate_store(activeCollection, 'activeCollection');
    	subscribe($$self, activeCollection, $$value => { $activeCollection = $$value; $$invalidate('$activeCollection', $activeCollection); });

    	let { name } = $$props;
    	let menuHover = false;
    	let about = false;
    	// Images, maybe I can make this easier somehow?
    	// Auto-generate from a directory structure maybe?
    	// let collection0 = [
    	// 	{ src: '01_front_cover.jpg', name: 'Noa' },
    	// 	{ src: '02_back_cover.jpg', name: 'Dog' },
    	// 	{ src: 'racoon_together.jpg', name: 'Glass' }
    	// ];
    	let collection1 = [
    		{ src: 'Noa.JPG', name: 'Noa' },
    		{ src: 'dog.JPG', name: 'Dog' },
    		{ src: 'glass.JPG', name: 'Glass' }
    	];
    	
    	let collection4 = [
    		{ src: 'atami.JPG', name: 'Atami at night' },
    		{ src: 'kenodo.JPG', name: 'Konodo Highway' },
    		{ src: 'kenodo2.JPG', name: 'Tunnels' }
    	];
    	let collection6 = [
    		{ src: 'boring.JPG', name: 'Everything is boring' },
    		{ src: 'hownotto.JPG', name: 'How not to draw' },
    		{ src: 'isometric.JPG', name: 'Isometric' },
    		{ src: 'notes.JPG', name: 'Notes' },
    		{ src: 'glass-b+w.JPG', name: 'Glass' }
    	];
    	let collection2 = [
    		{ src: 'cash.JPG', name: 'Cash suitcase' },
    		{ src: 'robo.JPG', name: 'Robot' },
    		{ src: 'tako.JPG', name: 'Octopus' }
    	];
    	let collection5 = [
    		{ src: 'angrykid2.JPG', name: 'Angry 1' },
    		{ src: 'angrykid1.JPG', name: 'Angry 2' },
    		{ src: 'angrykid3.JPG', name: 'Angry 3' },
    		{ src: 'angrykid4.JPG', name: 'Angry 4' },
    		{ src: 'angrykid5.JPG', name: 'Angry 5' }
    	];
    	let collection3 = [
    		{ src: 'citizens.JPG', name: 'Citizens of science' },
    		{ src: 'screwit.JPG', name: 'Screw It' },
    		{ src: 'boltit.JPG', name: 'Boltman' },
    		{ src: 'kumo.JPG', name: 'Spiderdeath' }
    	];

    	function handleHover(){
    		if(menuHover){
    			$$invalidate('menuHover', menuHover = false);
    		}else{
    			$$invalidate('menuHover', menuHover = true);
    		}
    	}

    	function handleAbout(event){
    		event.preventDefault();
    		if(about){
    			$$invalidate('about', about = false);
    		}else{
    			$$invalidate('about', about = true);
    		}
    	}

    	const writable_props = ['name'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('name' in $$props) $$invalidate('name', name = $$props.name);
    	};

    	return {
    		name,
    		menuHover,
    		about,
    		collection1,
    		collection4,
    		collection6,
    		collection2,
    		collection5,
    		collection3,
    		handleHover,
    		handleAbout,
    		$activeCollection
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, ["name"]);

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
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
