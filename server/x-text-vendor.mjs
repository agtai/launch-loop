/* Generated distribution of twitter-text 3.1.0 parseTweet and dependencies.
 * Bundled for Launch Loop (2026-09-24); counting algorithm unchanged.
 * Copyright Twitter, Inc.; Apache-2.0. Dependency notices: rules/x/COUNTER-LICENSES.txt.
 * Rebuild: node rules/x/build-counter.mjs (after npm ci). */
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
//#region node_modules/@babel/runtime/helpers/interopRequireDefault.js
var require_interopRequireDefault = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function _interopRequireDefault(e) {
		return e && e.__esModule ? e : { "default": e };
	}
	module.exports = _interopRequireDefault, module.exports.__esModule = true, module.exports["default"] = module.exports;
}));

//#endregion
//#region node_modules/core-js/modules/_global.js
var require__global = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var global = module.exports = typeof window != "undefined" && window.Math == Math ? window : typeof self != "undefined" && self.Math == Math ? self : Function("return this")();
	if (typeof __g == "number") __g = global;
}));

//#endregion
//#region node_modules/core-js/modules/_core.js
var require__core = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var core = module.exports = { version: "2.6.12" };
	if (typeof __e == "number") __e = core;
}));

//#endregion
//#region node_modules/core-js/modules/_is-object.js
var require__is_object = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(it) {
		return typeof it === "object" ? it !== null : typeof it === "function";
	};
}));

//#endregion
//#region node_modules/core-js/modules/_an-object.js
var require__an_object = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	module.exports = function(it) {
		if (!isObject(it)) throw TypeError(it + " is not an object!");
		return it;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_fails.js
var require__fails = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(exec) {
		try {
			return !!exec();
		} catch (e) {
			return true;
		}
	};
}));

//#endregion
//#region node_modules/core-js/modules/_descriptors.js
var require__descriptors = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = !require__fails()(function() {
		return Object.defineProperty({}, "a", { get: function() {
			return 7;
		} }).a != 7;
	});
}));

//#endregion
//#region node_modules/core-js/modules/_dom-create.js
var require__dom_create = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	var document = require__global().document;
	var is = isObject(document) && isObject(document.createElement);
	module.exports = function(it) {
		return is ? document.createElement(it) : {};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_ie8-dom-define.js
var require__ie8_dom_define = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = !require__descriptors() && !require__fails()(function() {
		return Object.defineProperty(require__dom_create()("div"), "a", { get: function() {
			return 7;
		} }).a != 7;
	});
}));

//#endregion
//#region node_modules/core-js/modules/_to-primitive.js
var require__to_primitive = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	module.exports = function(it, S) {
		if (!isObject(it)) return it;
		var fn, val;
		if (S && typeof (fn = it.toString) == "function" && !isObject(val = fn.call(it))) return val;
		if (typeof (fn = it.valueOf) == "function" && !isObject(val = fn.call(it))) return val;
		if (!S && typeof (fn = it.toString) == "function" && !isObject(val = fn.call(it))) return val;
		throw TypeError("Can't convert object to primitive value");
	};
}));

//#endregion
//#region node_modules/core-js/modules/_object-dp.js
var require__object_dp = /* @__PURE__ */ __commonJSMin(((exports) => {
	var anObject = require__an_object();
	var IE8_DOM_DEFINE = require__ie8_dom_define();
	var toPrimitive = require__to_primitive();
	var dP = Object.defineProperty;
	exports.f = require__descriptors() ? Object.defineProperty : function defineProperty(O, P, Attributes) {
		anObject(O);
		P = toPrimitive(P, true);
		anObject(Attributes);
		if (IE8_DOM_DEFINE) try {
			return dP(O, P, Attributes);
		} catch (e) {}
		if ("get" in Attributes || "set" in Attributes) throw TypeError("Accessors not supported!");
		if ("value" in Attributes) O[P] = Attributes.value;
		return O;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_property-desc.js
var require__property_desc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(bitmap, value) {
		return {
			enumerable: !(bitmap & 1),
			configurable: !(bitmap & 2),
			writable: !(bitmap & 4),
			value
		};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_hide.js
var require__hide = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var dP = require__object_dp();
	var createDesc = require__property_desc();
	module.exports = require__descriptors() ? function(object, key, value) {
		return dP.f(object, key, createDesc(1, value));
	} : function(object, key, value) {
		object[key] = value;
		return object;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_has.js
var require__has = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var hasOwnProperty = {}.hasOwnProperty;
	module.exports = function(it, key) {
		return hasOwnProperty.call(it, key);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_uid.js
var require__uid = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var id = 0;
	var px = Math.random();
	module.exports = function(key) {
		return "Symbol(".concat(key === void 0 ? "" : key, ")_", (++id + px).toString(36));
	};
}));

//#endregion
//#region node_modules/core-js/modules/_library.js
var require__library = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = false;
}));

//#endregion
//#region node_modules/core-js/modules/_shared.js
var require__shared = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var core = require__core();
	var global = require__global();
	var SHARED = "__core-js_shared__";
	var store = global[SHARED] || (global[SHARED] = {});
	(module.exports = function(key, value) {
		return store[key] || (store[key] = value !== void 0 ? value : {});
	})("versions", []).push({
		version: core.version,
		mode: require__library() ? "pure" : "global",
		copyright: "© 2020 Denis Pushkarev (zloirock.ru)"
	});
}));

//#endregion
//#region node_modules/core-js/modules/_function-to-string.js
var require__function_to_string = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require__shared()("native-function-to-string", Function.toString);
}));

//#endregion
//#region node_modules/core-js/modules/_redefine.js
var require__redefine = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var global = require__global();
	var hide = require__hide();
	var has = require__has();
	var SRC = require__uid()("src");
	var $toString = require__function_to_string();
	var TO_STRING = "toString";
	var TPL = ("" + $toString).split(TO_STRING);
	require__core().inspectSource = function(it) {
		return $toString.call(it);
	};
	(module.exports = function(O, key, val, safe) {
		var isFunction = typeof val == "function";
		if (isFunction) has(val, "name") || hide(val, "name", key);
		if (O[key] === val) return;
		if (isFunction) has(val, SRC) || hide(val, SRC, O[key] ? "" + O[key] : TPL.join(String(key)));
		if (O === global) O[key] = val;
		else if (!safe) {
			delete O[key];
			hide(O, key, val);
		} else if (O[key]) O[key] = val;
		else hide(O, key, val);
	})(Function.prototype, TO_STRING, function toString() {
		return typeof this == "function" && this[SRC] || $toString.call(this);
	});
}));

//#endregion
//#region node_modules/core-js/modules/_a-function.js
var require__a_function = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(it) {
		if (typeof it != "function") throw TypeError(it + " is not a function!");
		return it;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_ctx.js
var require__ctx = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var aFunction = require__a_function();
	module.exports = function(fn, that, length) {
		aFunction(fn);
		if (that === void 0) return fn;
		switch (length) {
			case 1: return function(a) {
				return fn.call(that, a);
			};
			case 2: return function(a, b) {
				return fn.call(that, a, b);
			};
			case 3: return function(a, b, c) {
				return fn.call(that, a, b, c);
			};
		}
		return function() {
			return fn.apply(that, arguments);
		};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_export.js
var require__export = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var global = require__global();
	var core = require__core();
	var hide = require__hide();
	var redefine = require__redefine();
	var ctx = require__ctx();
	var PROTOTYPE = "prototype";
	var $export = function(type, name, source) {
		var IS_FORCED = type & $export.F;
		var IS_GLOBAL = type & $export.G;
		var IS_STATIC = type & $export.S;
		var IS_PROTO = type & $export.P;
		var IS_BIND = type & $export.B;
		var target = IS_GLOBAL ? global : IS_STATIC ? global[name] || (global[name] = {}) : (global[name] || {})[PROTOTYPE];
		var exports$1 = IS_GLOBAL ? core : core[name] || (core[name] = {});
		var expProto = exports$1[PROTOTYPE] || (exports$1[PROTOTYPE] = {});
		var key, own, out, exp;
		if (IS_GLOBAL) source = name;
		for (key in source) {
			own = !IS_FORCED && target && target[key] !== void 0;
			out = (own ? target : source)[key];
			exp = IS_BIND && own ? ctx(out, global) : IS_PROTO && typeof out == "function" ? ctx(Function.call, out) : out;
			if (target) redefine(target, key, out, type & $export.U);
			if (exports$1[key] != out) hide(exports$1, key, exp);
			if (IS_PROTO && expProto[key] != out) expProto[key] = out;
		}
	};
	global.core = core;
	$export.F = 1;
	$export.G = 2;
	$export.S = 4;
	$export.P = 8;
	$export.B = 16;
	$export.W = 32;
	$export.U = 64;
	$export.R = 128;
	module.exports = $export;
}));

//#endregion
//#region node_modules/core-js/modules/es6.object.define-property.js
var require_es6_object_define_property = /* @__PURE__ */ __commonJSMin((() => {
	var $export = require__export();
	$export($export.S + $export.F * !require__descriptors(), "Object", { defineProperty: require__object_dp().f });
}));

//#endregion
//#region node_modules/core-js/modules/_defined.js
var require__defined = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(it) {
		if (it == void 0) throw TypeError("Can't call method on  " + it);
		return it;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_to-object.js
var require__to_object = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var defined = require__defined();
	module.exports = function(it) {
		return Object(defined(it));
	};
}));

//#endregion
//#region node_modules/core-js/modules/_cof.js
var require__cof = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toString = {}.toString;
	module.exports = function(it) {
		return toString.call(it).slice(8, -1);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_iobject.js
var require__iobject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cof = require__cof();
	module.exports = Object("z").propertyIsEnumerable(0) ? Object : function(it) {
		return cof(it) == "String" ? it.split("") : Object(it);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_to-integer.js
var require__to_integer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ceil = Math.ceil;
	var floor = Math.floor;
	module.exports = function(it) {
		return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_to-length.js
var require__to_length = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toInteger = require__to_integer();
	var min = Math.min;
	module.exports = function(it) {
		return it > 0 ? min(toInteger(it), 9007199254740991) : 0;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_array-reduce.js
var require__array_reduce = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var aFunction = require__a_function();
	var toObject = require__to_object();
	var IObject = require__iobject();
	var toLength = require__to_length();
	module.exports = function(that, callbackfn, aLen, memo, isRight) {
		aFunction(callbackfn);
		var O = toObject(that);
		var self = IObject(O);
		var length = toLength(O.length);
		var index = isRight ? length - 1 : 0;
		var i = isRight ? -1 : 1;
		if (aLen < 2) for (;;) {
			if (index in self) {
				memo = self[index];
				index += i;
				break;
			}
			index += i;
			if (isRight ? index < 0 : length <= index) throw TypeError("Reduce of empty array with no initial value");
		}
		for (; isRight ? index >= 0 : length > index; index += i) if (index in self) memo = callbackfn(memo, self[index], index, O);
		return memo;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_strict-method.js
var require__strict_method = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var fails = require__fails();
	module.exports = function(method, arg) {
		return !!method && fails(function() {
			arg ? method.call(null, function() {}, 1) : method.call(null);
		});
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.array.reduce.js
var require_es6_array_reduce = /* @__PURE__ */ __commonJSMin((() => {
	var $export = require__export();
	var $reduce = require__array_reduce();
	$export($export.P + $export.F * !require__strict_method()([].reduce, true), "Array", { reduce: function reduce(callbackfn) {
		return $reduce(this, callbackfn, arguments.length, arguments[1], false);
	} });
}));

//#endregion
//#region node_modules/core-js/modules/_wks.js
var require__wks = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var store = require__shared()("wks");
	var uid = require__uid();
	var Symbol = require__global().Symbol;
	var USE_SYMBOL = typeof Symbol == "function";
	var $exports = module.exports = function(name) {
		return store[name] || (store[name] = USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : uid)("Symbol." + name));
	};
	$exports.store = store;
}));

//#endregion
//#region node_modules/core-js/modules/_add-to-unscopables.js
var require__add_to_unscopables = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var UNSCOPABLES = require__wks()("unscopables");
	var ArrayProto = Array.prototype;
	if (ArrayProto[UNSCOPABLES] == void 0) require__hide()(ArrayProto, UNSCOPABLES, {});
	module.exports = function(key) {
		ArrayProto[UNSCOPABLES][key] = true;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_iter-step.js
var require__iter_step = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(done, value) {
		return {
			value,
			done: !!done
		};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_iterators.js
var require__iterators = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {};
}));

//#endregion
//#region node_modules/core-js/modules/_to-iobject.js
var require__to_iobject = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var IObject = require__iobject();
	var defined = require__defined();
	module.exports = function(it) {
		return IObject(defined(it));
	};
}));

//#endregion
//#region node_modules/core-js/modules/_to-absolute-index.js
var require__to_absolute_index = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toInteger = require__to_integer();
	var max = Math.max;
	var min = Math.min;
	module.exports = function(index, length) {
		index = toInteger(index);
		return index < 0 ? max(index + length, 0) : min(index, length);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_array-includes.js
var require__array_includes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toIObject = require__to_iobject();
	var toLength = require__to_length();
	var toAbsoluteIndex = require__to_absolute_index();
	module.exports = function(IS_INCLUDES) {
		return function($this, el, fromIndex) {
			var O = toIObject($this);
			var length = toLength(O.length);
			var index = toAbsoluteIndex(fromIndex, length);
			var value;
			if (IS_INCLUDES && el != el) while (length > index) {
				value = O[index++];
				if (value != value) return true;
			}
			else for (; length > index; index++) if (IS_INCLUDES || index in O) {
				if (O[index] === el) return IS_INCLUDES || index || 0;
			}
			return !IS_INCLUDES && -1;
		};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_shared-key.js
var require__shared_key = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var shared = require__shared()("keys");
	var uid = require__uid();
	module.exports = function(key) {
		return shared[key] || (shared[key] = uid(key));
	};
}));

//#endregion
//#region node_modules/core-js/modules/_object-keys-internal.js
var require__object_keys_internal = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var has = require__has();
	var toIObject = require__to_iobject();
	var arrayIndexOf = require__array_includes()(false);
	var IE_PROTO = require__shared_key()("IE_PROTO");
	module.exports = function(object, names) {
		var O = toIObject(object);
		var i = 0;
		var result = [];
		var key;
		for (key in O) if (key != IE_PROTO) has(O, key) && result.push(key);
		while (names.length > i) if (has(O, key = names[i++])) ~arrayIndexOf(result, key) || result.push(key);
		return result;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_enum-bug-keys.js
var require__enum_bug_keys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = "constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",");
}));

//#endregion
//#region node_modules/core-js/modules/_object-keys.js
var require__object_keys = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var $keys = require__object_keys_internal();
	var enumBugKeys = require__enum_bug_keys();
	module.exports = Object.keys || function keys(O) {
		return $keys(O, enumBugKeys);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_object-dps.js
var require__object_dps = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var dP = require__object_dp();
	var anObject = require__an_object();
	var getKeys = require__object_keys();
	module.exports = require__descriptors() ? Object.defineProperties : function defineProperties(O, Properties) {
		anObject(O);
		var keys = getKeys(Properties);
		var length = keys.length;
		var i = 0;
		var P;
		while (length > i) dP.f(O, P = keys[i++], Properties[P]);
		return O;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_html.js
var require__html = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var document = require__global().document;
	module.exports = document && document.documentElement;
}));

//#endregion
//#region node_modules/core-js/modules/_object-create.js
var require__object_create = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var anObject = require__an_object();
	var dPs = require__object_dps();
	var enumBugKeys = require__enum_bug_keys();
	var IE_PROTO = require__shared_key()("IE_PROTO");
	var Empty = function() {};
	var PROTOTYPE = "prototype";
	var createDict = function() {
		var iframe = require__dom_create()("iframe");
		var i = enumBugKeys.length;
		var lt = "<";
		var gt = ">";
		var iframeDocument;
		iframe.style.display = "none";
		require__html().appendChild(iframe);
		iframe.src = "javascript:";
		iframeDocument = iframe.contentWindow.document;
		iframeDocument.open();
		iframeDocument.write(lt + "script" + gt + "document.F=Object" + lt + "/script" + gt);
		iframeDocument.close();
		createDict = iframeDocument.F;
		while (i--) delete createDict[PROTOTYPE][enumBugKeys[i]];
		return createDict();
	};
	module.exports = Object.create || function create(O, Properties) {
		var result;
		if (O !== null) {
			Empty[PROTOTYPE] = anObject(O);
			result = new Empty();
			Empty[PROTOTYPE] = null;
			result[IE_PROTO] = O;
		} else result = createDict();
		return Properties === void 0 ? result : dPs(result, Properties);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_set-to-string-tag.js
var require__set_to_string_tag = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var def = require__object_dp().f;
	var has = require__has();
	var TAG = require__wks()("toStringTag");
	module.exports = function(it, tag, stat) {
		if (it && !has(it = stat ? it : it.prototype, TAG)) def(it, TAG, {
			configurable: true,
			value: tag
		});
	};
}));

//#endregion
//#region node_modules/core-js/modules/_iter-create.js
var require__iter_create = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var create = require__object_create();
	var descriptor = require__property_desc();
	var setToStringTag = require__set_to_string_tag();
	var IteratorPrototype = {};
	require__hide()(IteratorPrototype, require__wks()("iterator"), function() {
		return this;
	});
	module.exports = function(Constructor, NAME, next) {
		Constructor.prototype = create(IteratorPrototype, { next: descriptor(1, next) });
		setToStringTag(Constructor, NAME + " Iterator");
	};
}));

//#endregion
//#region node_modules/core-js/modules/_object-gpo.js
var require__object_gpo = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var has = require__has();
	var toObject = require__to_object();
	var IE_PROTO = require__shared_key()("IE_PROTO");
	var ObjectProto = Object.prototype;
	module.exports = Object.getPrototypeOf || function(O) {
		O = toObject(O);
		if (has(O, IE_PROTO)) return O[IE_PROTO];
		if (typeof O.constructor == "function" && O instanceof O.constructor) return O.constructor.prototype;
		return O instanceof Object ? ObjectProto : null;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_iter-define.js
var require__iter_define = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LIBRARY = require__library();
	var $export = require__export();
	var redefine = require__redefine();
	var hide = require__hide();
	var Iterators = require__iterators();
	var $iterCreate = require__iter_create();
	var setToStringTag = require__set_to_string_tag();
	var getPrototypeOf = require__object_gpo();
	var ITERATOR = require__wks()("iterator");
	var BUGGY = !([].keys && "next" in [].keys());
	var FF_ITERATOR = "@@iterator";
	var KEYS = "keys";
	var VALUES = "values";
	var returnThis = function() {
		return this;
	};
	module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
		$iterCreate(Constructor, NAME, next);
		var getMethod = function(kind) {
			if (!BUGGY && kind in proto) return proto[kind];
			switch (kind) {
				case KEYS: return function keys() {
					return new Constructor(this, kind);
				};
				case VALUES: return function values() {
					return new Constructor(this, kind);
				};
			}
			return function entries() {
				return new Constructor(this, kind);
			};
		};
		var TAG = NAME + " Iterator";
		var DEF_VALUES = DEFAULT == VALUES;
		var VALUES_BUG = false;
		var proto = Base.prototype;
		var $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT];
		var $default = $native || getMethod(DEFAULT);
		var $entries = DEFAULT ? !DEF_VALUES ? $default : getMethod("entries") : void 0;
		var $anyNative = NAME == "Array" ? proto.entries || $native : $native;
		var methods, key, IteratorPrototype;
		if ($anyNative) {
			IteratorPrototype = getPrototypeOf($anyNative.call(new Base()));
			if (IteratorPrototype !== Object.prototype && IteratorPrototype.next) {
				setToStringTag(IteratorPrototype, TAG, true);
				if (!LIBRARY && typeof IteratorPrototype[ITERATOR] != "function") hide(IteratorPrototype, ITERATOR, returnThis);
			}
		}
		if (DEF_VALUES && $native && $native.name !== VALUES) {
			VALUES_BUG = true;
			$default = function values() {
				return $native.call(this);
			};
		}
		if ((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) hide(proto, ITERATOR, $default);
		Iterators[NAME] = $default;
		Iterators[TAG] = returnThis;
		if (DEFAULT) {
			methods = {
				values: DEF_VALUES ? $default : getMethod(VALUES),
				keys: IS_SET ? $default : getMethod(KEYS),
				entries: $entries
			};
			if (FORCED) {
				for (key in methods) if (!(key in proto)) redefine(proto, key, methods[key]);
			} else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
		}
		return methods;
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.array.iterator.js
var require_es6_array_iterator = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var addToUnscopables = require__add_to_unscopables();
	var step = require__iter_step();
	var Iterators = require__iterators();
	var toIObject = require__to_iobject();
	module.exports = require__iter_define()(Array, "Array", function(iterated, kind) {
		this._t = toIObject(iterated);
		this._i = 0;
		this._k = kind;
	}, function() {
		var O = this._t;
		var kind = this._k;
		var index = this._i++;
		if (!O || index >= O.length) {
			this._t = void 0;
			return step(1);
		}
		if (kind == "keys") return step(0, index);
		if (kind == "values") return step(0, O[index]);
		return step(0, [index, O[index]]);
	}, "values");
	Iterators.Arguments = Iterators.Array;
	addToUnscopables("keys");
	addToUnscopables("values");
	addToUnscopables("entries");
}));

//#endregion
//#region node_modules/core-js/modules/web.dom.iterable.js
var require_web_dom_iterable = /* @__PURE__ */ __commonJSMin((() => {
	var $iterators = require_es6_array_iterator();
	var getKeys = require__object_keys();
	var redefine = require__redefine();
	var global = require__global();
	var hide = require__hide();
	var Iterators = require__iterators();
	var wks = require__wks();
	var ITERATOR = wks("iterator");
	var TO_STRING_TAG = wks("toStringTag");
	var ArrayValues = Iterators.Array;
	var DOMIterables = {
		CSSRuleList: true,
		CSSStyleDeclaration: false,
		CSSValueList: false,
		ClientRectList: false,
		DOMRectList: false,
		DOMStringList: false,
		DOMTokenList: true,
		DataTransferItemList: false,
		FileList: false,
		HTMLAllCollection: false,
		HTMLCollection: false,
		HTMLFormElement: false,
		HTMLSelectElement: false,
		MediaList: true,
		MimeTypeArray: false,
		NamedNodeMap: false,
		NodeList: true,
		PaintRequestList: false,
		Plugin: false,
		PluginArray: false,
		SVGLengthList: false,
		SVGNumberList: false,
		SVGPathSegList: false,
		SVGPointList: false,
		SVGStringList: false,
		SVGTransformList: false,
		SourceBufferList: false,
		StyleSheetList: true,
		TextTrackCueList: false,
		TextTrackList: false,
		TouchList: false
	};
	for (var collections = getKeys(DOMIterables), i = 0; i < collections.length; i++) {
		var NAME = collections[i];
		var explicit = DOMIterables[NAME];
		var Collection = global[NAME];
		var proto = Collection && Collection.prototype;
		var key;
		if (proto) {
			if (!proto[ITERATOR]) hide(proto, ITERATOR, ArrayValues);
			if (!proto[TO_STRING_TAG]) hide(proto, TO_STRING_TAG, NAME);
			Iterators[NAME] = ArrayValues;
			if (explicit) {
				for (key in $iterators) if (!proto[key]) redefine(proto, key, $iterators[key], true);
			}
		}
	}
}));

//#endregion
//#region node_modules/core-js/modules/_classof.js
var require__classof = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cof = require__cof();
	var TAG = require__wks()("toStringTag");
	var ARG = cof(function() {
		return arguments;
	}()) == "Arguments";
	var tryGet = function(it, key) {
		try {
			return it[key];
		} catch (e) {}
	};
	module.exports = function(it) {
		var O, T, B;
		return it === void 0 ? "Undefined" : it === null ? "Null" : typeof (T = tryGet(O = Object(it), TAG)) == "string" ? T : ARG ? cof(O) : (B = cof(O)) == "Object" && typeof O.callee == "function" ? "Arguments" : B;
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.object.to-string.js
var require_es6_object_to_string = /* @__PURE__ */ __commonJSMin((() => {
	var classof = require__classof();
	var test = {};
	test[require__wks()("toStringTag")] = "z";
	if (test + "" != "[object z]") require__redefine()(Object.prototype, "toString", function toString() {
		return "[object " + classof(this) + "]";
	}, true);
}));

//#endregion
//#region node_modules/core-js/modules/_object-sap.js
var require__object_sap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var $export = require__export();
	var core = require__core();
	var fails = require__fails();
	module.exports = function(KEY, exec) {
		var fn = (core.Object || {})[KEY] || Object[KEY];
		var exp = {};
		exp[KEY] = exec(fn);
		$export($export.S + $export.F * fails(function() {
			fn(1);
		}), "Object", exp);
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.object.keys.js
var require_es6_object_keys = /* @__PURE__ */ __commonJSMin((() => {
	var toObject = require__to_object();
	var $keys = require__object_keys();
	require__object_sap()("keys", function() {
		return function keys(it) {
			return $keys(toObject(it));
		};
	});
}));

//#endregion
//#region node_modules/twitter-text/dist/configs.js
var require_configs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = {
		version1: {
			version: 1,
			maxWeightedTweetLength: 140,
			scale: 1,
			defaultWeight: 1,
			transformedURLLength: 23,
			ranges: []
		},
		version2: {
			version: 2,
			maxWeightedTweetLength: 280,
			scale: 100,
			defaultWeight: 200,
			transformedURLLength: 23,
			ranges: [
				{
					start: 0,
					end: 4351,
					weight: 100
				},
				{
					start: 8192,
					end: 8205,
					weight: 100
				},
				{
					start: 8208,
					end: 8223,
					weight: 100
				},
				{
					start: 8242,
					end: 8247,
					weight: 100
				}
			]
		},
		version3: {
			version: 3,
			maxWeightedTweetLength: 280,
			scale: 100,
			defaultWeight: 200,
			emojiParsingEnabled: true,
			transformedURLLength: 23,
			ranges: [
				{
					start: 0,
					end: 4351,
					weight: 100
				},
				{
					start: 8192,
					end: 8205,
					weight: 100
				},
				{
					start: 8208,
					end: 8223,
					weight: 100
				},
				{
					start: 8242,
					end: 8247,
					weight: 100
				}
			]
		},
		defaults: {
			version: 3,
			maxWeightedTweetLength: 280,
			scale: 100,
			defaultWeight: 200,
			emojiParsingEnabled: true,
			transformedURLLength: 23,
			ranges: [
				{
					start: 0,
					end: 4351,
					weight: 100
				},
				{
					start: 8192,
					end: 8205,
					weight: 100
				},
				{
					start: 8208,
					end: 8223,
					weight: 100
				},
				{
					start: 8242,
					end: 8247,
					weight: 100
				}
			]
		}
	};
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/core-js/modules/es6.array.index-of.js
var require_es6_array_index_of = /* @__PURE__ */ __commonJSMin((() => {
	var $export = require__export();
	var $indexOf = require__array_includes()(false);
	var $native = [].indexOf;
	var NEGATIVE_ZERO = !!$native && 1 / [1].indexOf(1, -0) < 0;
	$export($export.P + $export.F * (NEGATIVE_ZERO || !require__strict_method()($native)), "Array", { indexOf: function indexOf(searchElement) {
		return NEGATIVE_ZERO ? $native.apply(this, arguments) || 0 : $indexOf(this, searchElement, arguments[1]);
	} });
}));

//#endregion
//#region node_modules/core-js/modules/_string-at.js
var require__string_at = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var toInteger = require__to_integer();
	var defined = require__defined();
	module.exports = function(TO_STRING) {
		return function(that, pos) {
			var s = String(defined(that));
			var i = toInteger(pos);
			var l = s.length;
			var a, b;
			if (i < 0 || i >= l) return TO_STRING ? "" : void 0;
			a = s.charCodeAt(i);
			return a < 55296 || a > 56319 || i + 1 === l || (b = s.charCodeAt(i + 1)) < 56320 || b > 57343 ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 55296 << 10) + (b - 56320) + 65536;
		};
	};
}));

//#endregion
//#region node_modules/core-js/modules/_advance-string-index.js
var require__advance_string_index = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var at = require__string_at()(true);
	module.exports = function(S, index, unicode) {
		return index + (unicode ? at(S, index).length : 1);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_regexp-exec-abstract.js
var require__regexp_exec_abstract = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var classof = require__classof();
	var builtinExec = RegExp.prototype.exec;
	module.exports = function(R, S) {
		var exec = R.exec;
		if (typeof exec === "function") {
			var result = exec.call(R, S);
			if (typeof result !== "object") throw new TypeError("RegExp exec method returned something other than an Object or null");
			return result;
		}
		if (classof(R) !== "RegExp") throw new TypeError("RegExp#exec called on incompatible receiver");
		return builtinExec.call(R, S);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_flags.js
var require__flags = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var anObject = require__an_object();
	module.exports = function() {
		var that = anObject(this);
		var result = "";
		if (that.global) result += "g";
		if (that.ignoreCase) result += "i";
		if (that.multiline) result += "m";
		if (that.unicode) result += "u";
		if (that.sticky) result += "y";
		return result;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_regexp-exec.js
var require__regexp_exec = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var regexpFlags = require__flags();
	var nativeExec = RegExp.prototype.exec;
	var nativeReplace = String.prototype.replace;
	var patchedExec = nativeExec;
	var LAST_INDEX = "lastIndex";
	var UPDATES_LAST_INDEX_WRONG = (function() {
		var re1 = /a/, re2 = /b*/g;
		nativeExec.call(re1, "a");
		nativeExec.call(re2, "a");
		return re1[LAST_INDEX] !== 0 || re2[LAST_INDEX] !== 0;
	})();
	var NPCG_INCLUDED = /()??/.exec("")[1] !== void 0;
	if (UPDATES_LAST_INDEX_WRONG || NPCG_INCLUDED) patchedExec = function exec(str) {
		var re = this;
		var lastIndex, reCopy, match, i;
		if (NPCG_INCLUDED) reCopy = new RegExp("^" + re.source + "$(?!\\s)", regexpFlags.call(re));
		if (UPDATES_LAST_INDEX_WRONG) lastIndex = re[LAST_INDEX];
		match = nativeExec.call(re, str);
		if (UPDATES_LAST_INDEX_WRONG && match) re[LAST_INDEX] = re.global ? match.index + match[0].length : lastIndex;
		if (NPCG_INCLUDED && match && match.length > 1) nativeReplace.call(match[0], reCopy, function() {
			for (i = 1; i < arguments.length - 2; i++) if (arguments[i] === void 0) match[i] = void 0;
		});
		return match;
	};
	module.exports = patchedExec;
}));

//#endregion
//#region node_modules/core-js/modules/es6.regexp.exec.js
var require_es6_regexp_exec = /* @__PURE__ */ __commonJSMin((() => {
	var regexpExec = require__regexp_exec();
	require__export()({
		target: "RegExp",
		proto: true,
		forced: regexpExec !== /./.exec
	}, { exec: regexpExec });
}));

//#endregion
//#region node_modules/core-js/modules/_fix-re-wks.js
var require__fix_re_wks = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_regexp_exec();
	var redefine = require__redefine();
	var hide = require__hide();
	var fails = require__fails();
	var defined = require__defined();
	var wks = require__wks();
	var regexpExec = require__regexp_exec();
	var SPECIES = wks("species");
	var REPLACE_SUPPORTS_NAMED_GROUPS = !fails(function() {
		var re = /./;
		re.exec = function() {
			var result = [];
			result.groups = { a: "7" };
			return result;
		};
		return "".replace(re, "$<a>") !== "7";
	});
	var SPLIT_WORKS_WITH_OVERWRITTEN_EXEC = (function() {
		var re = /(?:)/;
		var originalExec = re.exec;
		re.exec = function() {
			return originalExec.apply(this, arguments);
		};
		var result = "ab".split(re);
		return result.length === 2 && result[0] === "a" && result[1] === "b";
	})();
	module.exports = function(KEY, length, exec) {
		var SYMBOL = wks(KEY);
		var DELEGATES_TO_SYMBOL = !fails(function() {
			var O = {};
			O[SYMBOL] = function() {
				return 7;
			};
			return ""[KEY](O) != 7;
		});
		var DELEGATES_TO_EXEC = DELEGATES_TO_SYMBOL ? !fails(function() {
			var execCalled = false;
			var re = /a/;
			re.exec = function() {
				execCalled = true;
				return null;
			};
			if (KEY === "split") {
				re.constructor = {};
				re.constructor[SPECIES] = function() {
					return re;
				};
			}
			re[SYMBOL]("");
			return !execCalled;
		}) : void 0;
		if (!DELEGATES_TO_SYMBOL || !DELEGATES_TO_EXEC || KEY === "replace" && !REPLACE_SUPPORTS_NAMED_GROUPS || KEY === "split" && !SPLIT_WORKS_WITH_OVERWRITTEN_EXEC) {
			var nativeRegExpMethod = /./[SYMBOL];
			var fns = exec(defined, SYMBOL, ""[KEY], function maybeCallNative(nativeMethod, regexp, str, arg2, forceStringMethod) {
				if (regexp.exec === regexpExec) {
					if (DELEGATES_TO_SYMBOL && !forceStringMethod) return {
						done: true,
						value: nativeRegExpMethod.call(regexp, str, arg2)
					};
					return {
						done: true,
						value: nativeMethod.call(str, regexp, arg2)
					};
				}
				return { done: false };
			});
			var strfn = fns[0];
			var rxfn = fns[1];
			redefine(String.prototype, KEY, strfn);
			hide(RegExp.prototype, SYMBOL, length == 2 ? function(string, arg) {
				return rxfn.call(string, this, arg);
			} : function(string) {
				return rxfn.call(string, this);
			});
		}
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.regexp.replace.js
var require_es6_regexp_replace = /* @__PURE__ */ __commonJSMin((() => {
	var anObject = require__an_object();
	var toObject = require__to_object();
	var toLength = require__to_length();
	var toInteger = require__to_integer();
	var advanceStringIndex = require__advance_string_index();
	var regExpExec = require__regexp_exec_abstract();
	var max = Math.max;
	var min = Math.min;
	var floor = Math.floor;
	var SUBSTITUTION_SYMBOLS = /\$([$&`']|\d\d?|<[^>]*>)/g;
	var SUBSTITUTION_SYMBOLS_NO_NAMED = /\$([$&`']|\d\d?)/g;
	var maybeToString = function(it) {
		return it === void 0 ? it : String(it);
	};
	require__fix_re_wks()("replace", 2, function(defined, REPLACE, $replace, maybeCallNative) {
		return [function replace(searchValue, replaceValue) {
			var O = defined(this);
			var fn = searchValue == void 0 ? void 0 : searchValue[REPLACE];
			return fn !== void 0 ? fn.call(searchValue, O, replaceValue) : $replace.call(String(O), searchValue, replaceValue);
		}, function(regexp, replaceValue) {
			var res = maybeCallNative($replace, regexp, this, replaceValue);
			if (res.done) return res.value;
			var rx = anObject(regexp);
			var S = String(this);
			var functionalReplace = typeof replaceValue === "function";
			if (!functionalReplace) replaceValue = String(replaceValue);
			var global = rx.global;
			if (global) {
				var fullUnicode = rx.unicode;
				rx.lastIndex = 0;
			}
			var results = [];
			while (true) {
				var result = regExpExec(rx, S);
				if (result === null) break;
				results.push(result);
				if (!global) break;
				if (String(result[0]) === "") rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
			}
			var accumulatedResult = "";
			var nextSourcePosition = 0;
			for (var i = 0; i < results.length; i++) {
				result = results[i];
				var matched = String(result[0]);
				var position = max(min(toInteger(result.index), S.length), 0);
				var captures = [];
				for (var j = 1; j < result.length; j++) captures.push(maybeToString(result[j]));
				var namedCaptures = result.groups;
				if (functionalReplace) {
					var replacerArgs = [matched].concat(captures, position, S);
					if (namedCaptures !== void 0) replacerArgs.push(namedCaptures);
					var replacement = String(replaceValue.apply(void 0, replacerArgs));
				} else replacement = getSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
				if (position >= nextSourcePosition) {
					accumulatedResult += S.slice(nextSourcePosition, position) + replacement;
					nextSourcePosition = position + matched.length;
				}
			}
			return accumulatedResult + S.slice(nextSourcePosition);
		}];
		function getSubstitution(matched, str, position, captures, namedCaptures, replacement) {
			var tailPos = position + matched.length;
			var m = captures.length;
			var symbols = SUBSTITUTION_SYMBOLS_NO_NAMED;
			if (namedCaptures !== void 0) {
				namedCaptures = toObject(namedCaptures);
				symbols = SUBSTITUTION_SYMBOLS;
			}
			return $replace.call(replacement, symbols, function(match, ch) {
				var capture;
				switch (ch.charAt(0)) {
					case "$": return "$";
					case "&": return matched;
					case "`": return str.slice(0, position);
					case "'": return str.slice(tailPos);
					case "<":
						capture = namedCaptures[ch.slice(1, -1)];
						break;
					default:
						var n = +ch;
						if (n === 0) return match;
						if (n > m) {
							var f = floor(n / 10);
							if (f === 0) return match;
							if (f <= m) return captures[f - 1] === void 0 ? ch.charAt(1) : captures[f - 1] + ch.charAt(1);
							return match;
						}
						capture = captures[n - 1];
				}
				return capture === void 0 ? "" : capture;
			});
		}
	});
}));

//#endregion
//#region node_modules/core-js/modules/_object-pie.js
var require__object_pie = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.f = {}.propertyIsEnumerable;
}));

//#endregion
//#region node_modules/core-js/modules/_object-gopd.js
var require__object_gopd = /* @__PURE__ */ __commonJSMin(((exports) => {
	var pIE = require__object_pie();
	var createDesc = require__property_desc();
	var toIObject = require__to_iobject();
	var toPrimitive = require__to_primitive();
	var has = require__has();
	var IE8_DOM_DEFINE = require__ie8_dom_define();
	var gOPD = Object.getOwnPropertyDescriptor;
	exports.f = require__descriptors() ? gOPD : function getOwnPropertyDescriptor(O, P) {
		O = toIObject(O);
		P = toPrimitive(P, true);
		if (IE8_DOM_DEFINE) try {
			return gOPD(O, P);
		} catch (e) {}
		if (has(O, P)) return createDesc(!pIE.f.call(O, P), O[P]);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_set-proto.js
var require__set_proto = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	var anObject = require__an_object();
	var check = function(O, proto) {
		anObject(O);
		if (!isObject(proto) && proto !== null) throw TypeError(proto + ": can't set as prototype!");
	};
	module.exports = {
		set: Object.setPrototypeOf || ("__proto__" in {} ? function(test, buggy, set) {
			try {
				set = require__ctx()(Function.call, require__object_gopd().f(Object.prototype, "__proto__").set, 2);
				set(test, []);
				buggy = !(test instanceof Array);
			} catch (e) {
				buggy = true;
			}
			return function setPrototypeOf(O, proto) {
				check(O, proto);
				if (buggy) O.__proto__ = proto;
				else set(O, proto);
				return O;
			};
		}({}, false) : void 0),
		check
	};
}));

//#endregion
//#region node_modules/core-js/modules/_inherit-if-required.js
var require__inherit_if_required = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	var setPrototypeOf = require__set_proto().set;
	module.exports = function(that, target, C) {
		var S = target.constructor;
		var P;
		if (S !== C && typeof S == "function" && (P = S.prototype) !== C.prototype && isObject(P) && setPrototypeOf) setPrototypeOf(that, P);
		return that;
	};
}));

//#endregion
//#region node_modules/core-js/modules/_object-gopn.js
var require__object_gopn = /* @__PURE__ */ __commonJSMin(((exports) => {
	var $keys = require__object_keys_internal();
	var hiddenKeys = require__enum_bug_keys().concat("length", "prototype");
	exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
		return $keys(O, hiddenKeys);
	};
}));

//#endregion
//#region node_modules/core-js/modules/_is-regexp.js
var require__is_regexp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var isObject = require__is_object();
	var cof = require__cof();
	var MATCH = require__wks()("match");
	module.exports = function(it) {
		var isRegExp;
		return isObject(it) && ((isRegExp = it[MATCH]) !== void 0 ? !!isRegExp : cof(it) == "RegExp");
	};
}));

//#endregion
//#region node_modules/core-js/modules/_set-species.js
var require__set_species = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var global = require__global();
	var dP = require__object_dp();
	var DESCRIPTORS = require__descriptors();
	var SPECIES = require__wks()("species");
	module.exports = function(KEY) {
		var C = global[KEY];
		if (DESCRIPTORS && C && !C[SPECIES]) dP.f(C, SPECIES, {
			configurable: true,
			get: function() {
				return this;
			}
		});
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.regexp.constructor.js
var require_es6_regexp_constructor = /* @__PURE__ */ __commonJSMin((() => {
	var global = require__global();
	var inheritIfRequired = require__inherit_if_required();
	var dP = require__object_dp().f;
	var gOPN = require__object_gopn().f;
	var isRegExp = require__is_regexp();
	var $flags = require__flags();
	var $RegExp = global.RegExp;
	var Base = $RegExp;
	var proto = $RegExp.prototype;
	var re1 = /a/g;
	var re2 = /a/g;
	var CORRECT_NEW = new $RegExp(re1) !== re1;
	if (require__descriptors() && (!CORRECT_NEW || require__fails()(function() {
		re2[require__wks()("match")] = false;
		return $RegExp(re1) != re1 || $RegExp(re2) == re2 || $RegExp(re1, "i") != "/a/i";
	}))) {
		$RegExp = function RegExp(p, f) {
			var tiRE = this instanceof $RegExp;
			var piRE = isRegExp(p);
			var fiU = f === void 0;
			return !tiRE && piRE && p.constructor === $RegExp && fiU ? p : inheritIfRequired(CORRECT_NEW ? new Base(piRE && !fiU ? p.source : p, f) : Base((piRE = p instanceof $RegExp) ? p.source : p, piRE && fiU ? $flags.call(p) : f), tiRE ? this : proto, $RegExp);
		};
		var proxy = function(key) {
			key in $RegExp || dP($RegExp, key, {
				configurable: true,
				get: function() {
					return Base[key];
				},
				set: function(it) {
					Base[key] = it;
				}
			});
		};
		for (var keys = gOPN(Base), i = 0; keys.length > i;) proxy(keys[i++]);
		proto.constructor = $RegExp;
		$RegExp.prototype = proto;
		require__redefine()(global, "RegExp", $RegExp);
	}
	require__set_species()("RegExp");
}));

//#endregion
//#region node_modules/core-js/modules/es6.regexp.match.js
var require_es6_regexp_match = /* @__PURE__ */ __commonJSMin((() => {
	var anObject = require__an_object();
	var toLength = require__to_length();
	var advanceStringIndex = require__advance_string_index();
	var regExpExec = require__regexp_exec_abstract();
	require__fix_re_wks()("match", 1, function(defined, MATCH, $match, maybeCallNative) {
		return [function match(regexp) {
			var O = defined(this);
			var fn = regexp == void 0 ? void 0 : regexp[MATCH];
			return fn !== void 0 ? fn.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
		}, function(regexp) {
			var res = maybeCallNative($match, regexp, this);
			if (res.done) return res.value;
			var rx = anObject(regexp);
			var S = String(this);
			if (!rx.global) return regExpExec(rx, S);
			var fullUnicode = rx.unicode;
			rx.lastIndex = 0;
			var A = [];
			var n = 0;
			var result;
			while ((result = regExpExec(rx, S)) !== null) {
				var matchStr = String(result[0]);
				A[n] = matchStr;
				if (matchStr === "") rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
				n++;
			}
			return n === 0 ? null : A;
		}];
	});
}));

//#endregion
//#region node_modules/twitter-text/dist/lib/regexSupplant.js
var require_regexSupplant = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = _default;
	require_es6_regexp_replace();
	require_es6_regexp_constructor();
	require_es6_array_index_of();
	function _default(regex, map, flags) {
		flags = flags || "";
		if (typeof regex !== "string") {
			if (regex.global && flags.indexOf("g") < 0) flags += "g";
			if (regex.ignoreCase && flags.indexOf("i") < 0) flags += "i";
			if (regex.multiline && flags.indexOf("m") < 0) flags += "m";
			regex = regex.source;
		}
		return new RegExp(regex.replace(/#\{(\w+)\}/g, function(match, name) {
			var newRegex = map[name] || "";
			if (typeof newRegex !== "string") newRegex = newRegex.source;
			return newRegex;
		}), flags);
	}
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validCCTLD.js
var require_validCCTLD = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_regexp_constructor();
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(RegExp("(?:(?:한국|香港|澳門|新加坡|台灣|台湾|中國|中国|გე|ລາວ|ไทย|ලංකා|ഭാരതം|ಭಾರತ|భారత్|சிங்கப்பூர்|இலங்கை|இந்தியா|ଭାରତ|ભારત|ਭਾਰਤ|ভাৰত|ভারত|বাংলা|भारोत|भारतम्|भारत|ڀارت|پاکستان|موريتانيا|مليسيا|مصر|قطر|فلسطين|عمان|عراق|سورية|سودان|تونس|بھارت|بارت|ایران|امارات|المغرب|السعودية|الجزائر|البحرين|الاردن|հայ|қаз|укр|срб|рф|мон|мкд|ею|бел|бг|ευ|ελ|zw|zm|za|yt|ye|ws|wf|vu|vn|vi|vg|ve|vc|va|uz|uy|us|um|uk|ug|ua|tz|tw|tv|tt|tr|tp|to|tn|tm|tl|tk|tj|th|tg|tf|td|tc|sz|sy|sx|sv|su|st|ss|sr|so|sn|sm|sl|sk|sj|si|sh|sg|se|sd|sc|sb|sa|rw|ru|rs|ro|re|qa|py|pw|pt|ps|pr|pn|pm|pl|pk|ph|pg|pf|pe|pa|om|nz|nu|nr|np|no|nl|ni|ng|nf|ne|nc|na|mz|my|mx|mw|mv|mu|mt|ms|mr|mq|mp|mo|mn|mm|ml|mk|mh|mg|mf|me|md|mc|ma|ly|lv|lu|lt|ls|lr|lk|li|lc|lb|la|kz|ky|kw|kr|kp|kn|km|ki|kh|kg|ke|jp|jo|jm|je|it|is|ir|iq|io|in|im|il|ie|id|hu|ht|hr|hn|hm|hk|gy|gw|gu|gt|gs|gr|gq|gp|gn|gm|gl|gi|gh|gg|gf|ge|gd|gb|ga|fr|fo|fm|fk|fj|fi|eu|et|es|er|eh|eg|ee|ec|dz|do|dm|dk|dj|de|cz|cy|cx|cw|cv|cu|cr|co|cn|cm|cl|ck|ci|ch|cg|cf|cd|cc|ca|bz|by|bw|bv|bt|bs|br|bq|bo|bn|bm|bl|bj|bi|bh|bg|bf|be|bd|bb|ba|az|ax|aw|au|at|as|ar|aq|ao|an|am|al|ai|ag|af|ae|ad|ac)(?=[^0-9a-zA-Z@+-]|$))"));
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/directionalMarkersGroup.js
var require_directionalMarkersGroup = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\u202A-\u202E\u061C\u200E\u200F\u2066\u2067\u2068\u2069/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/invalidCharsGroup.js
var require_invalidCharsGroup = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\uFFFE\uFEFF\uFFFF/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/punct.js
var require_punct = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\!'#%&'\(\)*\+,\\\-\.\/:;<=>\?@\[\]\^_{|}~\$/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/spacesGroup.js
var require_spacesGroup = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\x09-\x0D\x20\x85\xA0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/lib/stringSupplant.js
var require_stringSupplant = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = _default;
	require_es6_regexp_replace();
	function _default(str, map) {
		return str.replace(/#\{(\w+)\}/g, function(match, name) {
			return map[name] || "";
		});
	}
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/invalidDomainChars.js
var require_invalidDomainChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _directionalMarkersGroup = _interopRequireDefault(require_directionalMarkersGroup());
	var _invalidCharsGroup = _interopRequireDefault(require_invalidCharsGroup());
	var _punct = _interopRequireDefault(require_punct());
	var _spacesGroup = _interopRequireDefault(require_spacesGroup());
	var _default = (0, _interopRequireDefault(require_stringSupplant())["default"])("#{punct}#{spacesGroup}#{invalidCharsGroup}#{directionalMarkersGroup}", {
		punct: _punct["default"],
		spacesGroup: _spacesGroup["default"],
		invalidCharsGroup: _invalidCharsGroup["default"],
		directionalMarkersGroup: _directionalMarkersGroup["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validDomainChars.js
var require_validDomainChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _invalidDomainChars = _interopRequireDefault(require_invalidDomainChars());
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(/[^#{invalidDomainChars}]/, { invalidDomainChars: _invalidDomainChars["default"] });
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validDomainName.js
var require_validDomainName = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validDomainChars = _interopRequireDefault(require_validDomainChars());
	var _default = (0, _regexSupplant["default"])(/(?:(?:#{validDomainChars}(?:-|#{validDomainChars})*)?#{validDomainChars}\.)/, { validDomainChars: _validDomainChars["default"] });
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validGTLD.js
var require_validGTLD = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_regexp_constructor();
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(RegExp("(?:(?:삼성|닷컴|닷넷|香格里拉|餐厅|食品|飞利浦|電訊盈科|集团|通販|购物|谷歌|诺基亚|联通|网络|网站|网店|网址|组织机构|移动|珠宝|点看|游戏|淡马锡|机构|書籍|时尚|新闻|政府|政务|招聘|手表|手机|我爱你|慈善|微博|广东|工行|家電|娱乐|天主教|大拿|大众汽车|在线|嘉里大酒店|嘉里|商标|商店|商城|公益|公司|八卦|健康|信息|佛山|企业|中文网|中信|世界|ポイント|ファッション|セール|ストア|コム|グーグル|クラウド|みんな|คอม|संगठन|नेट|कॉम|همراه|موقع|موبايلي|كوم|كاثوليك|عرب|شبكة|بيتك|بازار|العليان|ارامكو|اتصالات|ابوظبي|קום|сайт|рус|орг|онлайн|москва|ком|католик|дети|zuerich|zone|zippo|zip|zero|zara|zappos|yun|youtube|you|yokohama|yoga|yodobashi|yandex|yamaxun|yahoo|yachts|xyz|xxx|xperia|xin|xihuan|xfinity|xerox|xbox|wtf|wtc|wow|world|works|work|woodside|wolterskluwer|wme|winners|wine|windows|win|williamhill|wiki|wien|whoswho|weir|weibo|wedding|wed|website|weber|webcam|weatherchannel|weather|watches|watch|warman|wanggou|wang|walter|walmart|wales|vuelos|voyage|voto|voting|vote|volvo|volkswagen|vodka|vlaanderen|vivo|viva|vistaprint|vista|vision|visa|virgin|vip|vin|villas|viking|vig|video|viajes|vet|versicherung|vermögensberatung|vermögensberater|verisign|ventures|vegas|vanguard|vana|vacations|ups|uol|uno|university|unicom|uconnect|ubs|ubank|tvs|tushu|tunes|tui|tube|trv|trust|travelersinsurance|travelers|travelchannel|travel|training|trading|trade|toys|toyota|town|tours|total|toshiba|toray|top|tools|tokyo|today|tmall|tkmaxx|tjx|tjmaxx|tirol|tires|tips|tiffany|tienda|tickets|tiaa|theatre|theater|thd|teva|tennis|temasek|telefonica|telecity|tel|technology|tech|team|tdk|tci|taxi|tax|tattoo|tatar|tatamotors|target|taobao|talk|taipei|tab|systems|symantec|sydney|swiss|swiftcover|swatch|suzuki|surgery|surf|support|supply|supplies|sucks|style|study|studio|stream|store|storage|stockholm|stcgroup|stc|statoil|statefarm|statebank|starhub|star|staples|stada|srt|srl|spreadbetting|spot|sport|spiegel|space|soy|sony|song|solutions|solar|sohu|software|softbank|social|soccer|sncf|smile|smart|sling|skype|sky|skin|ski|site|singles|sina|silk|shriram|showtime|show|shouji|shopping|shop|shoes|shiksha|shia|shell|shaw|sharp|shangrila|sfr|sexy|sex|sew|seven|ses|services|sener|select|seek|security|secure|seat|search|scot|scor|scjohnson|science|schwarz|schule|school|scholarships|schmidt|schaeffler|scb|sca|sbs|sbi|saxo|save|sas|sarl|sapo|sap|sanofi|sandvikcoromant|sandvik|samsung|samsclub|salon|sale|sakura|safety|safe|saarland|ryukyu|rwe|run|ruhr|rugby|rsvp|room|rogers|rodeo|rocks|rocher|rmit|rip|rio|ril|rightathome|ricoh|richardli|rich|rexroth|reviews|review|restaurant|rest|republican|report|repair|rentals|rent|ren|reliance|reit|reisen|reise|rehab|redumbrella|redstone|red|recipes|realty|realtor|realestate|read|raid|radio|racing|qvc|quest|quebec|qpon|pwc|pub|prudential|pru|protection|property|properties|promo|progressive|prof|productions|prod|pro|prime|press|praxi|pramerica|post|porn|politie|poker|pohl|pnc|plus|plumbing|playstation|play|place|pizza|pioneer|pink|ping|pin|pid|pictures|pictet|pics|piaget|physio|photos|photography|photo|phone|philips|phd|pharmacy|pfizer|pet|pccw|pay|passagens|party|parts|partners|pars|paris|panerai|panasonic|pamperedchef|page|ovh|ott|otsuka|osaka|origins|orientexpress|organic|org|orange|oracle|open|ooo|onyourside|online|onl|ong|one|omega|ollo|oldnavy|olayangroup|olayan|okinawa|office|off|observer|obi|nyc|ntt|nrw|nra|nowtv|nowruz|now|norton|northwesternmutual|nokia|nissay|nissan|ninja|nikon|nike|nico|nhk|ngo|nfl|nexus|nextdirect|next|news|newholland|new|neustar|network|netflix|netbank|net|nec|nba|navy|natura|nationwide|name|nagoya|nadex|nab|mutuelle|mutual|museum|mtr|mtpc|mtn|msd|movistar|movie|mov|motorcycles|moto|moscow|mortgage|mormon|mopar|montblanc|monster|money|monash|mom|moi|moe|moda|mobily|mobile|mobi|mma|mls|mlb|mitsubishi|mit|mint|mini|mil|microsoft|miami|metlife|merckmsd|meo|menu|men|memorial|meme|melbourne|meet|media|med|mckinsey|mcdonalds|mcd|mba|mattel|maserati|marshalls|marriott|markets|marketing|market|map|mango|management|man|makeup|maison|maif|madrid|macys|luxury|luxe|lupin|lundbeck|ltda|ltd|lplfinancial|lpl|love|lotto|lotte|london|lol|loft|locus|locker|loans|loan|llp|llc|lixil|living|live|lipsy|link|linde|lincoln|limo|limited|lilly|like|lighting|lifestyle|lifeinsurance|life|lidl|liaison|lgbt|lexus|lego|legal|lefrak|leclerc|lease|lds|lawyer|law|latrobe|latino|lat|lasalle|lanxess|landrover|land|lancome|lancia|lancaster|lamer|lamborghini|ladbrokes|lacaixa|kyoto|kuokgroup|kred|krd|kpn|kpmg|kosher|komatsu|koeln|kiwi|kitchen|kindle|kinder|kim|kia|kfh|kerryproperties|kerrylogistics|kerryhotels|kddi|kaufen|juniper|juegos|jprs|jpmorgan|joy|jot|joburg|jobs|jnj|jmp|jll|jlc|jio|jewelry|jetzt|jeep|jcp|jcb|java|jaguar|iwc|iveco|itv|itau|istanbul|ist|ismaili|iselect|irish|ipiranga|investments|intuit|international|intel|int|insure|insurance|institute|ink|ing|info|infiniti|industries|inc|immobilien|immo|imdb|imamat|ikano|iinet|ifm|ieee|icu|ice|icbc|ibm|hyundai|hyatt|hughes|htc|hsbc|how|house|hotmail|hotels|hoteles|hot|hosting|host|hospital|horse|honeywell|honda|homesense|homes|homegoods|homedepot|holiday|holdings|hockey|hkt|hiv|hitachi|hisamitsu|hiphop|hgtv|hermes|here|helsinki|help|healthcare|health|hdfcbank|hdfc|hbo|haus|hangout|hamburg|hair|guru|guitars|guide|guge|gucci|guardian|group|grocery|gripe|green|gratis|graphics|grainger|gov|got|gop|google|goog|goodyear|goodhands|goo|golf|goldpoint|gold|godaddy|gmx|gmo|gmbh|gmail|globo|global|gle|glass|glade|giving|gives|gifts|gift|ggee|george|genting|gent|gea|gdn|gbiz|gay|garden|gap|games|game|gallup|gallo|gallery|gal|fyi|futbol|furniture|fund|fun|fujixerox|fujitsu|ftr|frontier|frontdoor|frogans|frl|fresenius|free|fox|foundation|forum|forsale|forex|ford|football|foodnetwork|food|foo|fly|flsmidth|flowers|florist|flir|flights|flickr|fitness|fit|fishing|fish|firmdale|firestone|fire|financial|finance|final|film|fido|fidelity|fiat|ferrero|ferrari|feedback|fedex|fast|fashion|farmers|farm|fans|fan|family|faith|fairwinds|fail|fage|extraspace|express|exposed|expert|exchange|everbank|events|eus|eurovision|etisalat|esurance|estate|esq|erni|ericsson|equipment|epson|epost|enterprises|engineering|engineer|energy|emerck|email|education|edu|edeka|eco|eat|earth|dvr|dvag|durban|dupont|duns|dunlop|duck|dubai|dtv|drive|download|dot|doosan|domains|doha|dog|dodge|doctor|docs|dnp|diy|dish|discover|discount|directory|direct|digital|diet|diamonds|dhl|dev|design|desi|dentist|dental|democrat|delta|deloitte|dell|delivery|degree|deals|dealer|deal|dds|dclk|day|datsun|dating|date|data|dance|dad|dabur|cyou|cymru|cuisinella|csc|cruises|cruise|crs|crown|cricket|creditunion|creditcard|credit|cpa|courses|coupons|coupon|country|corsica|coop|cool|cookingchannel|cooking|contractors|contact|consulting|construction|condos|comsec|computer|compare|company|community|commbank|comcast|com|cologne|college|coffee|codes|coach|clubmed|club|cloud|clothing|clinique|clinic|click|cleaning|claims|cityeats|city|citic|citi|citadel|cisco|circle|cipriani|church|chrysler|chrome|christmas|chloe|chintai|cheap|chat|chase|charity|channel|chanel|cfd|cfa|cern|ceo|center|ceb|cbs|cbre|cbn|cba|catholic|catering|cat|casino|cash|caseih|case|casa|cartier|cars|careers|career|care|cards|caravan|car|capitalone|capital|capetown|canon|cancerresearch|camp|camera|cam|calvinklein|call|cal|cafe|cab|bzh|buzz|buy|business|builders|build|bugatti|budapest|brussels|brother|broker|broadway|bridgestone|bradesco|box|boutique|bot|boston|bostik|bosch|boots|booking|book|boo|bond|bom|bofa|boehringer|boats|bnpparibas|bnl|bmw|bms|blue|bloomberg|blog|blockbuster|blanco|blackfriday|black|biz|bio|bingo|bing|bike|bid|bible|bharti|bet|bestbuy|best|berlin|bentley|beer|beauty|beats|bcn|bcg|bbva|bbt|bbc|bayern|bauhaus|basketball|baseball|bargains|barefoot|barclays|barclaycard|barcelona|bar|bank|band|bananarepublic|banamex|baidu|baby|azure|axa|aws|avianca|autos|auto|author|auspost|audio|audible|audi|auction|attorney|athleta|associates|asia|asda|arte|art|arpa|army|archi|aramco|arab|aquarelle|apple|app|apartments|aol|anz|anquan|android|analytics|amsterdam|amica|amfam|amex|americanfamily|americanexpress|alstom|alsace|ally|allstate|allfinanz|alipay|alibaba|alfaromeo|akdn|airtel|airforce|airbus|aigo|aig|agency|agakhan|africa|afl|afamilycompany|aetna|aero|aeg|adult|ads|adac|actor|active|aco|accountants|accountant|accenture|academy|abudhabi|abogado|able|abc|abbvie|abbott|abb|abarth|aarp|aaa|onion)(?=[^0-9a-zA-Z@+-]|$))"));
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validPunycode.js
var require_validPunycode = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /(?:xn--[\-0-9a-z]+)/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validSubdomain.js
var require_validSubdomain = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validDomainChars = _interopRequireDefault(require_validDomainChars());
	var _default = (0, _regexSupplant["default"])(/(?:(?:#{validDomainChars}(?:[_-]|#{validDomainChars})*)?#{validDomainChars}\.)/, { validDomainChars: _validDomainChars["default"] });
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validDomain.js
var require_validDomain = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validCCTLD = _interopRequireDefault(require_validCCTLD());
	var _validDomainName = _interopRequireDefault(require_validDomainName());
	var _validGTLD = _interopRequireDefault(require_validGTLD());
	var _validPunycode = _interopRequireDefault(require_validPunycode());
	var _validSubdomain = _interopRequireDefault(require_validSubdomain());
	var _default = (0, _regexSupplant["default"])(/(?:#{validSubdomain}*#{validDomainName}(?:#{validGTLD}|#{validCCTLD}|#{validPunycode}))/, {
		validDomainName: _validDomainName["default"],
		validSubdomain: _validSubdomain["default"],
		validGTLD: _validGTLD["default"],
		validCCTLD: _validCCTLD["default"],
		validPunycode: _validPunycode["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validPortNumber.js
var require_validPortNumber = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /[0-9]+/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/cyrillicLettersAndMarks.js
var require_cyrillicLettersAndMarks = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\u0400-\u04FF/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/latinAccentChars.js
var require_latinAccentChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /\xC0-\xD6\xD8-\xF6\xF8-\xFF\u0100-\u024F\u0253\u0254\u0256\u0257\u0259\u025B\u0263\u0268\u026F\u0272\u0289\u028B\u02BB\u0300-\u036F\u1E00-\u1EFF/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validGeneralUrlPathChars.js
var require_validGeneralUrlPathChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _cyrillicLettersAndMarks = _interopRequireDefault(require_cyrillicLettersAndMarks());
	var _latinAccentChars = _interopRequireDefault(require_latinAccentChars());
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(/[a-z#{cyrillicLettersAndMarks}0-9!\*';:=\+,\.\$\/%#\[\]\-\u2013_~@\|&#{latinAccentChars}]/i, {
		cyrillicLettersAndMarks: _cyrillicLettersAndMarks["default"],
		latinAccentChars: _latinAccentChars["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlBalancedParens.js
var require_validUrlBalancedParens = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validGeneralUrlPathChars = _interopRequireDefault(require_validGeneralUrlPathChars());
	var _default = (0, _regexSupplant["default"])("\\((?:#{validGeneralUrlPathChars}+|(?:#{validGeneralUrlPathChars}*\\(#{validGeneralUrlPathChars}+\\)#{validGeneralUrlPathChars}*))\\)", { validGeneralUrlPathChars: _validGeneralUrlPathChars["default"] }, "i");
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlPathEndingChars.js
var require_validUrlPathEndingChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _cyrillicLettersAndMarks = _interopRequireDefault(require_cyrillicLettersAndMarks());
	var _latinAccentChars = _interopRequireDefault(require_latinAccentChars());
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validUrlBalancedParens = _interopRequireDefault(require_validUrlBalancedParens());
	var _default = (0, _regexSupplant["default"])(/[\+\-a-z#{cyrillicLettersAndMarks}0-9=_#\/#{latinAccentChars}]|(?:#{validUrlBalancedParens})/i, {
		cyrillicLettersAndMarks: _cyrillicLettersAndMarks["default"],
		latinAccentChars: _latinAccentChars["default"],
		validUrlBalancedParens: _validUrlBalancedParens["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlPath.js
var require_validUrlPath = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validGeneralUrlPathChars = _interopRequireDefault(require_validGeneralUrlPathChars());
	var _validUrlBalancedParens = _interopRequireDefault(require_validUrlBalancedParens());
	var _validUrlPathEndingChars = _interopRequireDefault(require_validUrlPathEndingChars());
	var _default = (0, _regexSupplant["default"])("(?:(?:#{validGeneralUrlPathChars}*(?:#{validUrlBalancedParens}#{validGeneralUrlPathChars}*)*#{validUrlPathEndingChars})|(?:@#{validGeneralUrlPathChars}+/))", {
		validGeneralUrlPathChars: _validGeneralUrlPathChars["default"],
		validUrlBalancedParens: _validUrlBalancedParens["default"],
		validUrlPathEndingChars: _validUrlPathEndingChars["default"]
	}, "i");
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlPrecedingChars.js
var require_validUrlPrecedingChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _directionalMarkersGroup = _interopRequireDefault(require_directionalMarkersGroup());
	var _invalidCharsGroup = _interopRequireDefault(require_invalidCharsGroup());
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(/(?:[^A-Za-z0-9@＠$#＃#{invalidCharsGroup}]|[#{directionalMarkersGroup}]|^)/, {
		invalidCharsGroup: _invalidCharsGroup["default"],
		directionalMarkersGroup: _directionalMarkersGroup["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlQueryChars.js
var require_validUrlQueryChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /[a-z0-9!?\*'@\(\);:&=\+\$\/%#\[\]\-_\.,~|]/i;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validUrlQueryEndingChars.js
var require_validUrlQueryEndingChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /[a-z0-9\-_&=#\/]/i;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/extractUrl.js
var require_extractUrl = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validDomain = _interopRequireDefault(require_validDomain());
	var _validPortNumber = _interopRequireDefault(require_validPortNumber());
	var _validUrlPath = _interopRequireDefault(require_validUrlPath());
	var _validUrlPrecedingChars = _interopRequireDefault(require_validUrlPrecedingChars());
	var _validUrlQueryChars = _interopRequireDefault(require_validUrlQueryChars());
	var _validUrlQueryEndingChars = _interopRequireDefault(require_validUrlQueryEndingChars());
	var _default = (0, _regexSupplant["default"])("((#{validUrlPrecedingChars})((https?:\\/\\/)?(#{validDomain})(?::(#{validPortNumber}))?(\\/#{validUrlPath}*)?(\\?#{validUrlQueryChars}*#{validUrlQueryEndingChars})?))", {
		validUrlPrecedingChars: _validUrlPrecedingChars["default"],
		validDomain: _validDomain["default"],
		validPortNumber: _validPortNumber["default"],
		validUrlPath: _validUrlPath["default"],
		validUrlQueryChars: _validUrlQueryChars["default"],
		validUrlQueryEndingChars: _validUrlQueryEndingChars["default"]
	}, "gi");
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/invalidUrlWithoutProtocolPrecedingChars.js
var require_invalidUrlWithoutProtocolPrecedingChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /[-_.\/]$/;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/core-js/modules/_species-constructor.js
var require__species_constructor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var anObject = require__an_object();
	var aFunction = require__a_function();
	var SPECIES = require__wks()("species");
	module.exports = function(O, D) {
		var C = anObject(O).constructor;
		var S;
		return C === void 0 || (S = anObject(C)[SPECIES]) == void 0 ? D : aFunction(S);
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.regexp.split.js
var require_es6_regexp_split = /* @__PURE__ */ __commonJSMin((() => {
	var isRegExp = require__is_regexp();
	var anObject = require__an_object();
	var speciesConstructor = require__species_constructor();
	var advanceStringIndex = require__advance_string_index();
	var toLength = require__to_length();
	var callRegExpExec = require__regexp_exec_abstract();
	var regexpExec = require__regexp_exec();
	var fails = require__fails();
	var $min = Math.min;
	var $push = [].push;
	var $SPLIT = "split";
	var LENGTH = "length";
	var LAST_INDEX = "lastIndex";
	var MAX_UINT32 = 4294967295;
	var SUPPORTS_Y = !fails(function() {
		RegExp(MAX_UINT32, "y");
	});
	require__fix_re_wks()("split", 2, function(defined, SPLIT, $split, maybeCallNative) {
		var internalSplit;
		if ("abbc"[$SPLIT](/(b)*/)[1] == "c" || "test"[$SPLIT](/(?:)/, -1)[LENGTH] != 4 || "ab"[$SPLIT](/(?:ab)*/)[LENGTH] != 2 || "."[$SPLIT](/(.?)(.?)/)[LENGTH] != 4 || "."[$SPLIT](/()()/)[LENGTH] > 1 || ""[$SPLIT](/.?/)[LENGTH]) internalSplit = function(separator, limit) {
			var string = String(this);
			if (separator === void 0 && limit === 0) return [];
			if (!isRegExp(separator)) return $split.call(string, separator, limit);
			var output = [];
			var flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.unicode ? "u" : "") + (separator.sticky ? "y" : "");
			var lastLastIndex = 0;
			var splitLimit = limit === void 0 ? MAX_UINT32 : limit >>> 0;
			var separatorCopy = new RegExp(separator.source, flags + "g");
			var match, lastIndex, lastLength;
			while (match = regexpExec.call(separatorCopy, string)) {
				lastIndex = separatorCopy[LAST_INDEX];
				if (lastIndex > lastLastIndex) {
					output.push(string.slice(lastLastIndex, match.index));
					if (match[LENGTH] > 1 && match.index < string[LENGTH]) $push.apply(output, match.slice(1));
					lastLength = match[0][LENGTH];
					lastLastIndex = lastIndex;
					if (output[LENGTH] >= splitLimit) break;
				}
				if (separatorCopy[LAST_INDEX] === match.index) separatorCopy[LAST_INDEX]++;
			}
			if (lastLastIndex === string[LENGTH]) {
				if (lastLength || !separatorCopy.test("")) output.push("");
			} else output.push(string.slice(lastLastIndex));
			return output[LENGTH] > splitLimit ? output.slice(0, splitLimit) : output;
		};
		else if ("0"[$SPLIT](void 0, 0)[LENGTH]) internalSplit = function(separator, limit) {
			return separator === void 0 && limit === 0 ? [] : $split.call(this, separator, limit);
		};
		else internalSplit = $split;
		return [function split(separator, limit) {
			var O = defined(this);
			var splitter = separator == void 0 ? void 0 : separator[SPLIT];
			return splitter !== void 0 ? splitter.call(separator, O, limit) : internalSplit.call(String(O), separator, limit);
		}, function(regexp, limit) {
			var res = maybeCallNative(internalSplit, regexp, this, limit, internalSplit !== $split);
			if (res.done) return res.value;
			var rx = anObject(regexp);
			var S = String(this);
			var C = speciesConstructor(rx, RegExp);
			var unicodeMatching = rx.unicode;
			var flags = (rx.ignoreCase ? "i" : "") + (rx.multiline ? "m" : "") + (rx.unicode ? "u" : "") + (SUPPORTS_Y ? "y" : "g");
			var splitter = new C(SUPPORTS_Y ? rx : "^(?:" + rx.source + ")", flags);
			var lim = limit === void 0 ? MAX_UINT32 : limit >>> 0;
			if (lim === 0) return [];
			if (S.length === 0) return callRegExpExec(splitter, S) === null ? [S] : [];
			var p = 0;
			var q = 0;
			var A = [];
			while (q < S.length) {
				splitter.lastIndex = SUPPORTS_Y ? q : 0;
				var z = callRegExpExec(splitter, SUPPORTS_Y ? S : S.slice(q));
				var e;
				if (z === null || (e = $min(toLength(splitter.lastIndex + (SUPPORTS_Y ? 0 : q)), S.length)) === p) q = advanceStringIndex(S, q, unicodeMatching);
				else {
					A.push(S.slice(p, q));
					if (A.length === lim) return A;
					for (var i = 1; i <= z.length - 1; i++) {
						A.push(z[i]);
						if (A.length === lim) return A;
					}
					q = p = e;
				}
			}
			A.push(S.slice(p));
			return A;
		}];
	});
}));

//#endregion
//#region node_modules/punycode/punycode.js
var require_punycode = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*! https://mths.be/punycode v1.4.1 by @mathias */
	(function(root) {
		/** Detect free variables */
		var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
		var freeModule = typeof module == "object" && module && !module.nodeType && module;
		var freeGlobal = typeof global == "object" && global;
		if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal) root = freeGlobal;
		/**
		* The `punycode` object.
		* @name punycode
		* @type Object
		*/
		var punycode, maxInt = 2147483647, base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128, delimiter = "-", regexPunycode = /^xn--/, regexNonASCII = /[^\x20-\x7E]/, regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, errors = {
			"overflow": "Overflow: input needs wider integers to process",
			"not-basic": "Illegal input >= 0x80 (not a basic code point)",
			"invalid-input": "Invalid input"
		}, baseMinusTMin = base - tMin, floor = Math.floor, stringFromCharCode = String.fromCharCode, key;
		/**
		* A generic error utility function.
		* @private
		* @param {String} type The error type.
		* @returns {Error} Throws a `RangeError` with the applicable error message.
		*/
		function error(type) {
			throw new RangeError(errors[type]);
		}
		/**
		* A generic `Array#map` utility function.
		* @private
		* @param {Array} array The array to iterate over.
		* @param {Function} callback The function that gets called for every array
		* item.
		* @returns {Array} A new array of values returned by the callback function.
		*/
		function map(array, fn) {
			var length = array.length;
			var result = [];
			while (length--) result[length] = fn(array[length]);
			return result;
		}
		/**
		* A simple `Array#map`-like wrapper to work with domain name strings or email
		* addresses.
		* @private
		* @param {String} domain The domain name or email address.
		* @param {Function} callback The function that gets called for every
		* character.
		* @returns {Array} A new string of characters returned by the callback
		* function.
		*/
		function mapDomain(string, fn) {
			var parts = string.split("@");
			var result = "";
			if (parts.length > 1) {
				result = parts[0] + "@";
				string = parts[1];
			}
			string = string.replace(regexSeparators, ".");
			var encoded = map(string.split("."), fn).join(".");
			return result + encoded;
		}
		/**
		* Creates an array containing the numeric code points of each Unicode
		* character in the string. While JavaScript uses UCS-2 internally,
		* this function will convert a pair of surrogate halves (each of which
		* UCS-2 exposes as separate characters) into a single code point,
		* matching UTF-16.
		* @see `punycode.ucs2.encode`
		* @see <https://mathiasbynens.be/notes/javascript-encoding>
		* @memberOf punycode.ucs2
		* @name decode
		* @param {String} string The Unicode input string (UCS-2).
		* @returns {Array} The new array of code points.
		*/
		function ucs2decode(string) {
			var output = [], counter = 0, length = string.length, value, extra;
			while (counter < length) {
				value = string.charCodeAt(counter++);
				if (value >= 55296 && value <= 56319 && counter < length) {
					extra = string.charCodeAt(counter++);
					if ((extra & 64512) == 56320) output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
					else {
						output.push(value);
						counter--;
					}
				} else output.push(value);
			}
			return output;
		}
		/**
		* Creates a string based on an array of numeric code points.
		* @see `punycode.ucs2.decode`
		* @memberOf punycode.ucs2
		* @name encode
		* @param {Array} codePoints The array of numeric code points.
		* @returns {String} The new Unicode string (UCS-2).
		*/
		function ucs2encode(array) {
			return map(array, function(value) {
				var output = "";
				if (value > 65535) {
					value -= 65536;
					output += stringFromCharCode(value >>> 10 & 1023 | 55296);
					value = 56320 | value & 1023;
				}
				output += stringFromCharCode(value);
				return output;
			}).join("");
		}
		/**
		* Converts a basic code point into a digit/integer.
		* @see `digitToBasic()`
		* @private
		* @param {Number} codePoint The basic numeric code point value.
		* @returns {Number} The numeric value of a basic code point (for use in
		* representing integers) in the range `0` to `base - 1`, or `base` if
		* the code point does not represent a value.
		*/
		function basicToDigit(codePoint) {
			if (codePoint - 48 < 10) return codePoint - 22;
			if (codePoint - 65 < 26) return codePoint - 65;
			if (codePoint - 97 < 26) return codePoint - 97;
			return base;
		}
		/**
		* Converts a digit/integer into a basic code point.
		* @see `basicToDigit()`
		* @private
		* @param {Number} digit The numeric value of a basic code point.
		* @returns {Number} The basic code point whose value (when used for
		* representing integers) is `digit`, which needs to be in the range
		* `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
		* used; else, the lowercase form is used. The behavior is undefined
		* if `flag` is non-zero and `digit` has no uppercase form.
		*/
		function digitToBasic(digit, flag) {
			return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
		}
		/**
		* Bias adaptation function as per section 3.4 of RFC 3492.
		* https://tools.ietf.org/html/rfc3492#section-3.4
		* @private
		*/
		function adapt(delta, numPoints, firstTime) {
			var k = 0;
			delta = firstTime ? floor(delta / damp) : delta >> 1;
			delta += floor(delta / numPoints);
			for (; delta > baseMinusTMin * tMax >> 1; k += base) delta = floor(delta / baseMinusTMin);
			return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
		}
		/**
		* Converts a Punycode string of ASCII-only symbols to a string of Unicode
		* symbols.
		* @memberOf punycode
		* @param {String} input The Punycode string of ASCII-only symbols.
		* @returns {String} The resulting string of Unicode symbols.
		*/
		function decode(input) {
			var output = [], inputLength = input.length, out, i = 0, n = initialN, bias = initialBias, basic = input.lastIndexOf(delimiter), j, index, oldi, w, k, digit, t, baseMinusT;
			if (basic < 0) basic = 0;
			for (j = 0; j < basic; ++j) {
				if (input.charCodeAt(j) >= 128) error("not-basic");
				output.push(input.charCodeAt(j));
			}
			for (index = basic > 0 ? basic + 1 : 0; index < inputLength;) {
				for (oldi = i, w = 1, k = base;; k += base) {
					if (index >= inputLength) error("invalid-input");
					digit = basicToDigit(input.charCodeAt(index++));
					if (digit >= base || digit > floor((maxInt - i) / w)) error("overflow");
					i += digit * w;
					t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
					if (digit < t) break;
					baseMinusT = base - t;
					if (w > floor(maxInt / baseMinusT)) error("overflow");
					w *= baseMinusT;
				}
				out = output.length + 1;
				bias = adapt(i - oldi, out, oldi == 0);
				if (floor(i / out) > maxInt - n) error("overflow");
				n += floor(i / out);
				i %= out;
				output.splice(i++, 0, n);
			}
			return ucs2encode(output);
		}
		/**
		* Converts a string of Unicode symbols (e.g. a domain name label) to a
		* Punycode string of ASCII-only symbols.
		* @memberOf punycode
		* @param {String} input The string of Unicode symbols.
		* @returns {String} The resulting Punycode string of ASCII-only symbols.
		*/
		function encode(input) {
			var n, delta, handledCPCount, basicLength, bias, j, m, q, k, t, currentValue, output = [], inputLength, handledCPCountPlusOne, baseMinusT, qMinusT;
			input = ucs2decode(input);
			inputLength = input.length;
			n = initialN;
			delta = 0;
			bias = initialBias;
			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue < 128) output.push(stringFromCharCode(currentValue));
			}
			handledCPCount = basicLength = output.length;
			if (basicLength) output.push(delimiter);
			while (handledCPCount < inputLength) {
				for (m = maxInt, j = 0; j < inputLength; ++j) {
					currentValue = input[j];
					if (currentValue >= n && currentValue < m) m = currentValue;
				}
				handledCPCountPlusOne = handledCPCount + 1;
				if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) error("overflow");
				delta += (m - n) * handledCPCountPlusOne;
				n = m;
				for (j = 0; j < inputLength; ++j) {
					currentValue = input[j];
					if (currentValue < n && ++delta > maxInt) error("overflow");
					if (currentValue == n) {
						for (q = delta, k = base;; k += base) {
							t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
							if (q < t) break;
							qMinusT = q - t;
							baseMinusT = base - t;
							output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
							q = floor(qMinusT / baseMinusT);
						}
						output.push(stringFromCharCode(digitToBasic(q, 0)));
						bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
						delta = 0;
						++handledCPCount;
					}
				}
				++delta;
				++n;
			}
			return output.join("");
		}
		/**
		* Converts a Punycode string representing a domain name or an email address
		* to Unicode. Only the Punycoded parts of the input will be converted, i.e.
		* it doesn't matter if you call it on a string that has already been
		* converted to Unicode.
		* @memberOf punycode
		* @param {String} input The Punycoded domain name or email address to
		* convert to Unicode.
		* @returns {String} The Unicode representation of the given Punycode
		* string.
		*/
		function toUnicode(input) {
			return mapDomain(input, function(string) {
				return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
			});
		}
		/**
		* Converts a Unicode string representing a domain name or an email address to
		* Punycode. Only the non-ASCII parts of the domain name will be converted,
		* i.e. it doesn't matter if you call it with a domain that's already in
		* ASCII.
		* @memberOf punycode
		* @param {String} input The domain name or email address to convert, as a
		* Unicode string.
		* @returns {String} The Punycode representation of the given domain name or
		* email address.
		*/
		function toASCII(input) {
			return mapDomain(input, function(string) {
				return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
			});
		}
		/** Define the public API */
		punycode = {
			/**
			* A string representing the current Punycode.js version number.
			* @memberOf punycode
			* @type String
			*/
			"version": "1.4.1",
			/**
			* An object of methods to convert from JavaScript's internal character
			* representation (UCS-2) to Unicode code points, and back.
			* @see <https://mathiasbynens.be/notes/javascript-encoding>
			* @memberOf punycode
			* @type Object
			*/
			"ucs2": {
				"decode": ucs2decode,
				"encode": ucs2encode
			},
			"decode": decode,
			"encode": encode,
			"toASCII": toASCII,
			"toUnicode": toUnicode
		};
		/** Expose `punycode` */
		if (typeof define == "function" && typeof define.amd == "object" && define.amd) define("punycode", function() {
			return punycode;
		});
		else if (freeExports && freeModule) if (module.exports == freeExports) freeModule.exports = punycode;
		else for (key in punycode) punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
		else root.punycode = punycode;
	})(exports);
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validAsciiDomain.js
var require_validAsciiDomain = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _latinAccentChars = _interopRequireDefault(require_latinAccentChars());
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validCCTLD = _interopRequireDefault(require_validCCTLD());
	var _validGTLD = _interopRequireDefault(require_validGTLD());
	var _validPunycode = _interopRequireDefault(require_validPunycode());
	var _default = (0, _regexSupplant["default"])(/(?:(?:[\-a-z0-9#{latinAccentChars}]+)\.)+(?:#{validGTLD}|#{validCCTLD}|#{validPunycode})/gi, {
		latinAccentChars: _latinAccentChars["default"],
		validGTLD: _validGTLD["default"],
		validCCTLD: _validCCTLD["default"],
		validPunycode: _validPunycode["default"]
	});
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/lib/idna.js
var require_idna = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_regexp_split();
	require_es6_regexp_match();
	var _punycode = _interopRequireDefault(require_punycode());
	var _validAsciiDomain = _interopRequireDefault(require_validAsciiDomain());
	var MAX_DOMAIN_LABEL_LENGTH = 63;
	var PUNYCODE_ENCODED_DOMAIN_PREFIX = "xn--";
	var _default = { toAscii: function toAscii(domain) {
		if (domain.substring(0, 4) === PUNYCODE_ENCODED_DOMAIN_PREFIX && !domain.match(_validAsciiDomain["default"])) return;
		var labels = domain.split(".");
		for (var i = 0; i < labels.length; i++) {
			var label = labels[i];
			var punycodeEncodedLabel = _punycode["default"].toASCII(label);
			if (punycodeEncodedLabel.length < 1 || punycodeEncodedLabel.length > MAX_DOMAIN_LABEL_LENGTH) return;
		}
		return labels.join(".");
	} };
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/validTcoUrl.js
var require_validTcoUrl = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _regexSupplant = _interopRequireDefault(require_regexSupplant());
	var _validUrlQueryChars = _interopRequireDefault(require_validUrlQueryChars());
	var _validUrlQueryEndingChars = _interopRequireDefault(require_validUrlQueryEndingChars());
	var _default = (0, _regexSupplant["default"])(/^https?:\/\/t\.co\/([a-z0-9]+)(?:\?#{validUrlQueryChars}*#{validUrlQueryEndingChars})?/, {
		validUrlQueryChars: _validUrlQueryChars["default"],
		validUrlQueryEndingChars: _validUrlQueryEndingChars["default"]
	}, "i");
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/extractUrlsWithIndices.js
var require_extractUrlsWithIndices = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_array_index_of();
	require_es6_regexp_replace();
	require_es6_regexp_constructor();
	require_es6_regexp_match();
	var _extractUrl = _interopRequireDefault(require_extractUrl());
	var _invalidUrlWithoutProtocolPrecedingChars = _interopRequireDefault(require_invalidUrlWithoutProtocolPrecedingChars());
	var _idna = _interopRequireDefault(require_idna());
	var _validAsciiDomain = _interopRequireDefault(require_validAsciiDomain());
	var _validTcoUrl = _interopRequireDefault(require_validTcoUrl());
	var DEFAULT_PROTOCOL = "https://";
	var DEFAULT_PROTOCOL_OPTIONS = { extractUrlsWithoutProtocol: true };
	var MAX_URL_LENGTH = 4096;
	var MAX_TCO_SLUG_LENGTH = 40;
	var extractUrlsWithIndices = function extractUrlsWithIndices(text) {
		var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : DEFAULT_PROTOCOL_OPTIONS;
		if (!text || (options.extractUrlsWithoutProtocol ? !text.match(/\./) : !text.match(/:/))) return [];
		var urls = [];
		var _loop = function _loop() {
			var before = RegExp.$2;
			var url = RegExp.$3;
			var protocol = RegExp.$4;
			var domain = RegExp.$5;
			var path = RegExp.$7;
			var endPosition = _extractUrl["default"].lastIndex;
			var startPosition = endPosition - url.length;
			if (!isValidUrl(url, protocol || DEFAULT_PROTOCOL, domain)) return "continue";
			if (!protocol) {
				if (!options.extractUrlsWithoutProtocol || before.match(_invalidUrlWithoutProtocolPrecedingChars["default"])) return "continue";
				var lastUrl = null;
				var asciiEndPosition = 0;
				domain.replace(_validAsciiDomain["default"], function(asciiDomain) {
					var asciiStartPosition = domain.indexOf(asciiDomain, asciiEndPosition);
					asciiEndPosition = asciiStartPosition + asciiDomain.length;
					lastUrl = {
						url: asciiDomain,
						indices: [startPosition + asciiStartPosition, startPosition + asciiEndPosition]
					};
					urls.push(lastUrl);
				});
				if (lastUrl == null) return "continue";
				if (path) {
					lastUrl.url = url.replace(domain, lastUrl.url);
					lastUrl.indices[1] = endPosition;
				}
			} else {
				if (url.match(_validTcoUrl["default"])) {
					var tcoUrlSlug = RegExp.$1;
					if (tcoUrlSlug && tcoUrlSlug.length > MAX_TCO_SLUG_LENGTH) return "continue";
					else {
						url = RegExp.lastMatch;
						endPosition = startPosition + url.length;
					}
				}
				urls.push({
					url,
					indices: [startPosition, endPosition]
				});
			}
		};
		while (_extractUrl["default"].exec(text)) if (_loop() === "continue") continue;
		return urls;
	};
	var isValidUrl = function isValidUrl(url, protocol, domain) {
		var urlLength = url.length;
		var punycodeEncodedDomain = _idna["default"].toAscii(domain);
		if (!punycodeEncodedDomain || !punycodeEncodedDomain.length) return false;
		urlLength = urlLength + punycodeEncodedDomain.length - domain.length;
		return protocol.length + urlLength <= MAX_URL_LENGTH;
	};
	var _default = extractUrlsWithIndices;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/core-js/modules/_is-array.js
var require__is_array = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var cof = require__cof();
	module.exports = Array.isArray || function isArray(arg) {
		return cof(arg) == "Array";
	};
}));

//#endregion
//#region node_modules/core-js/modules/es6.array.is-array.js
var require_es6_array_is_array = /* @__PURE__ */ __commonJSMin((() => {
	var $export = require__export();
	$export($export.S, "Array", { isArray: require__is_array() });
}));

//#endregion
//#region node_modules/twitter-text/dist/lib/getCharacterWeight.js
var require_getCharacterWeight = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_array_is_array();
	var _default = function getCharacterWeight(ch, options) {
		var defaultWeight = options.defaultWeight, ranges = options.ranges;
		var weight = defaultWeight;
		var chCodePoint = ch.charCodeAt(0);
		if (Array.isArray(ranges)) for (var i = 0, length = ranges.length; i < length; i++) {
			var currRange = ranges[i];
			if (chCodePoint >= currRange.start && chCodePoint <= currRange.end) {
				weight = currRange.weight;
				break;
			}
		}
		return weight;
	};
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/invalidChars.js
var require_invalidChars = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _invalidCharsGroup = _interopRequireDefault(require_invalidCharsGroup());
	var _default = (0, _interopRequireDefault(require_regexSupplant())["default"])(/[#{invalidCharsGroup}]/, { invalidCharsGroup: _invalidCharsGroup["default"] });
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/hasInvalidCharacters.js
var require_hasInvalidCharacters = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = _default;
	var _invalidChars = _interopRequireDefault(require_invalidChars());
	function _default(text) {
		return _invalidChars["default"].test(text);
	}
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/core-js/modules/es6.array.sort.js
var require_es6_array_sort = /* @__PURE__ */ __commonJSMin((() => {
	var $export = require__export();
	var aFunction = require__a_function();
	var toObject = require__to_object();
	var fails = require__fails();
	var $sort = [].sort;
	var test = [
		1,
		2,
		3
	];
	$export($export.P + $export.F * (fails(function() {
		test.sort(void 0);
	}) || !fails(function() {
		test.sort(null);
	}) || !require__strict_method()($sort)), "Array", { sort: function sort(comparefn) {
		return comparefn === void 0 ? $sort.call(toObject(this)) : $sort.call(toObject(this), aFunction(comparefn));
	} });
}));

//#endregion
//#region node_modules/twitter-text/dist/lib/convertUnicodeIndices.js
var require_convertUnicodeIndices = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_array_sort();
	var _default = function convertUnicodeIndices(text, entities, indicesInUTF16) {
		if (entities.length === 0) return;
		var charIndex = 0;
		var codePointIndex = 0;
		entities.sort(function(a, b) {
			return a.indices[0] - b.indices[0];
		});
		var entityIndex = 0;
		var entity = entities[0];
		while (charIndex < text.length) {
			if (entity.indices[0] === (indicesInUTF16 ? charIndex : codePointIndex)) {
				var len = entity.indices[1] - entity.indices[0];
				entity.indices[0] = indicesInUTF16 ? codePointIndex : charIndex;
				entity.indices[1] = entity.indices[0] + len;
				entityIndex++;
				if (entityIndex === entities.length) break;
				entity = entities[entityIndex];
			}
			var c = text.charCodeAt(charIndex);
			if (c >= 55296 && c <= 56319 && charIndex < text.length - 1) {
				c = text.charCodeAt(charIndex + 1);
				if (c >= 56320 && c <= 57343) charIndex++;
			}
			codePointIndex++;
			charIndex++;
		}
	};
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/modifyIndicesFromUTF16ToUnicode.js
var require_modifyIndicesFromUTF16ToUnicode = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = _default;
	var _convertUnicodeIndices = _interopRequireDefault(require_convertUnicodeIndices());
	function _default(text, entities) {
		(0, _convertUnicodeIndices["default"])(text, entities, true);
	}
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twemoji-parser/dist/lib/regex.js
var require_regex = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = /(?:\ud83d[\udc68\udc69])(?:\ud83c[\udffb-\udfff])?\u200d(?:\u2695\ufe0f|\u2696\ufe0f|\u2708\ufe0f|\ud83c[\udf3e\udf73\udf93\udfa4\udfa8\udfeb\udfed]|\ud83d[\udcbb\udcbc\udd27\udd2c\ude80\ude92]|\ud83e[\uddb0-\uddb3])|(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75]|\u26f9)((?:\ud83c[\udffb-\udfff]|\ufe0f)\u200d[\u2640\u2642]\ufe0f)|(?:\ud83c[\udfc3\udfc4\udfca]|\ud83d[\udc6e\udc71\udc73\udc77\udc81\udc82\udc86\udc87\ude45-\ude47\ude4b\ude4d\ude4e\udea3\udeb4-\udeb6]|\ud83e[\udd26\udd35\udd37-\udd39\udd3d\udd3e\uddb8\uddb9\uddd6-\udddd])(?:\ud83c[\udffb-\udfff])?\u200d[\u2640\u2642]\ufe0f|(?:\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\ud83c\udff4\u200d\u2620\ufe0f|\ud83d\udc41\u200d\ud83d\udde8|\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83e\uddde\u200d\u2640\ufe0f|\ud83e\uddde\u200d\u2642\ufe0f|\ud83e\udddf\u200d\u2640\ufe0f|\ud83e\udddf\u200d\u2642\ufe0f)|[#*0-9]\ufe0f?\u20e3|(?:[©®\u2122\u265f]\ufe0f)|(?:\ud83c[\udc04\udd70\udd71\udd7e\udd7f\ude02\ude1a\ude2f\ude37\udf21\udf24-\udf2c\udf36\udf7d\udf96\udf97\udf99-\udf9b\udf9e\udf9f\udfcd\udfce\udfd4-\udfdf\udff3\udff5\udff7]|\ud83d[\udc3f\udc41\udcfd\udd49\udd4a\udd6f\udd70\udd73\udd76-\udd79\udd87\udd8a-\udd8d\udda5\udda8\uddb1\uddb2\uddbc\uddc2-\uddc4\uddd1-\uddd3\udddc-\uddde\udde1\udde3\udde8\uddef\uddf3\uddfa\udecb\udecd-\udecf\udee0-\udee5\udee9\udef0\udef3]|[\u203c\u2049\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267b\u267f\u2692-\u2697\u2699\u269b\u269c\u26a0\u26a1\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f8\u26fa\u26fd\u2702\u2708\u2709\u270f\u2712\u2714\u2716\u271d\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u2764\u27a1\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299])(?:\ufe0f|(?!\ufe0e))|(?:(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75\udd90]|[\u261d\u26f7\u26f9\u270c\u270d])(?:\ufe0f|(?!\ufe0e))|(?:\ud83c[\udf85\udfc2-\udfc4\udfc7\udfca]|\ud83d[\udc42\udc43\udc46-\udc50\udc66-\udc69\udc6e\udc70-\udc78\udc7c\udc81-\udc83\udc85-\udc87\udcaa\udd7a\udd95\udd96\ude45-\ude47\ude4b-\ude4f\udea3\udeb4-\udeb6\udec0\udecc]|\ud83e[\udd18-\udd1c\udd1e\udd1f\udd26\udd30-\udd39\udd3d\udd3e\uddb5\uddb6\uddb8\uddb9\uddd1-\udddd]|[\u270a\u270b]))(?:\ud83c[\udffb-\udfff])?|(?:\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc6c\udb40\udc73\udb40\udc7f|\ud83c\udde6\ud83c[\udde8-\uddec\uddee\uddf1\uddf2\uddf4\uddf6-\uddfa\uddfc\uddfd\uddff]|\ud83c\udde7\ud83c[\udde6\udde7\udde9-\uddef\uddf1-\uddf4\uddf6-\uddf9\uddfb\uddfc\uddfe\uddff]|\ud83c\udde8\ud83c[\udde6\udde8\udde9\uddeb-\uddee\uddf0-\uddf5\uddf7\uddfa-\uddff]|\ud83c\udde9\ud83c[\uddea\uddec\uddef\uddf0\uddf2\uddf4\uddff]|\ud83c\uddea\ud83c[\udde6\udde8\uddea\uddec\udded\uddf7-\uddfa]|\ud83c\uddeb\ud83c[\uddee-\uddf0\uddf2\uddf4\uddf7]|\ud83c\uddec\ud83c[\udde6\udde7\udde9-\uddee\uddf1-\uddf3\uddf5-\uddfa\uddfc\uddfe]|\ud83c\udded\ud83c[\uddf0\uddf2\uddf3\uddf7\uddf9\uddfa]|\ud83c\uddee\ud83c[\udde8-\uddea\uddf1-\uddf4\uddf6-\uddf9]|\ud83c\uddef\ud83c[\uddea\uddf2\uddf4\uddf5]|\ud83c\uddf0\ud83c[\uddea\uddec-\uddee\uddf2\uddf3\uddf5\uddf7\uddfc\uddfe\uddff]|\ud83c\uddf1\ud83c[\udde6-\udde8\uddee\uddf0\uddf7-\uddfb\uddfe]|\ud83c\uddf2\ud83c[\udde6\udde8-\udded\uddf0-\uddff]|\ud83c\uddf3\ud83c[\udde6\udde8\uddea-\uddec\uddee\uddf1\uddf4\uddf5\uddf7\uddfa\uddff]|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c[\udde6\uddea-\udded\uddf0-\uddf3\uddf7-\uddf9\uddfc\uddfe]|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c[\uddea\uddf4\uddf8\uddfa\uddfc]|\ud83c\uddf8\ud83c[\udde6-\uddea\uddec-\uddf4\uddf7-\uddf9\uddfb\uddfd-\uddff]|\ud83c\uddf9\ud83c[\udde6\udde8\udde9\uddeb-\udded\uddef-\uddf4\uddf7\uddf9\uddfb\uddfc\uddff]|\ud83c\uddfa\ud83c[\udde6\uddec\uddf2\uddf3\uddf8\uddfe\uddff]|\ud83c\uddfb\ud83c[\udde6\udde8\uddea\uddec\uddee\uddf3\uddfa]|\ud83c\uddfc\ud83c[\uddeb\uddf8]|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c[\uddea\uddf9]|\ud83c\uddff\ud83c[\udde6\uddf2\uddfc]|\ud83c[\udccf\udd8e\udd91-\udd9a\udde6-\uddff\ude01\ude32-\ude36\ude38-\ude3a\ude50\ude51\udf00-\udf20\udf2d-\udf35\udf37-\udf7c\udf7e-\udf84\udf86-\udf93\udfa0-\udfc1\udfc5\udfc6\udfc8\udfc9\udfcf-\udfd3\udfe0-\udff0\udff4\udff8-\udfff]|\ud83d[\udc00-\udc3e\udc40\udc44\udc45\udc51-\udc65\udc6a-\udc6d\udc6f\udc79-\udc7b\udc7d-\udc80\udc84\udc88-\udca9\udcab-\udcfc\udcff-\udd3d\udd4b-\udd4e\udd50-\udd67\udda4\uddfb-\ude44\ude48-\ude4a\ude80-\udea2\udea4-\udeb3\udeb7-\udebf\udec1-\udec5\uded0-\uded2\udeeb\udeec\udef4-\udef9]|\ud83e[\udd10-\udd17\udd1d\udd20-\udd25\udd27-\udd2f\udd3a\udd3c\udd40-\udd45\udd47-\udd70\udd73-\udd76\udd7a\udd7c-\udda2\uddb4\uddb7\uddc0-\uddc2\uddd0\uddde-\uddff]|[\u23e9-\u23ec\u23f0\u23f3\u267e\u26ce\u2705\u2728\u274c\u274e\u2753-\u2755\u2795-\u2797\u27b0\u27bf\ue50a])|\ufe0f/g;
}));

//#endregion
//#region node_modules/twemoji-parser/dist/index.js
var require_dist = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TypeName = void 0;
	exports.parse = parse;
	exports.toCodePoints = toCodePoints;
	var _regex2 = _interopRequireDefault(require_regex());
	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : { default: obj };
	}
	var TypeName = exports.TypeName = "emoji";
	function parse(text, options) {
		var assetType = options && options.assetType ? options.assetType : "svg";
		var getTwemojiUrl = options && options.buildUrl ? options.buildUrl : function(codepoints, assetType) {
			return assetType === "png" ? "https://twemoji.maxcdn.com/2/72x72/" + codepoints + ".png" : "https://twemoji.maxcdn.com/2/svg/" + codepoints + ".svg";
		};
		var entities = [];
		_regex2.default.lastIndex = 0;
		while (true) {
			var result = _regex2.default.exec(text);
			if (!result) break;
			var emojiText = result[0];
			var codepoints = toCodePoints(removeVS16s(emojiText)).join("-");
			entities.push({
				url: codepoints ? getTwemojiUrl(codepoints, assetType) : "",
				indices: [result.index, _regex2.default.lastIndex],
				text: emojiText,
				type: TypeName
			});
		}
		return entities;
	}
	var vs16RegExp = /\uFE0F/g;
	var zeroWidthJoiner = String.fromCharCode(8205);
	var removeVS16s = function removeVS16s(rawEmoji) {
		return rawEmoji.indexOf(zeroWidthJoiner) < 0 ? rawEmoji.replace(vs16RegExp, "") : rawEmoji;
	};
	function toCodePoints(unicodeSurrogates) {
		var points = [];
		var char = 0;
		var previous = 0;
		var i = 0;
		while (i < unicodeSurrogates.length) {
			char = unicodeSurrogates.charCodeAt(i++);
			if (previous) {
				points.push((65536 + (previous - 55296 << 10) + (char - 56320)).toString(16));
				previous = 0;
			} else if (char > 55296 && char <= 56319) previous = char;
			else points.push(char.toString(16));
		}
		return points;
	}
}));

//#endregion
//#region node_modules/twitter-text/dist/regexp/urlHasHttps.js
var require_urlHasHttps = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	var _default = /^https:\/\//i;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region node_modules/twitter-text/dist/parseTweet.js
var require_parseTweet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var _interopRequireDefault = require_interopRequireDefault();
	require_es6_object_define_property();
	Object.defineProperty(exports, "__esModule", { value: true });
	exports["default"] = void 0;
	require_es6_array_reduce();
	require_web_dom_iterable();
	require_es6_array_iterator();
	require_es6_object_to_string();
	require_es6_object_keys();
	var _configs = _interopRequireDefault(require_configs());
	var _extractUrlsWithIndices = _interopRequireDefault(require_extractUrlsWithIndices());
	var _getCharacterWeight = _interopRequireDefault(require_getCharacterWeight());
	var _hasInvalidCharacters = _interopRequireDefault(require_hasInvalidCharacters());
	_interopRequireDefault(require_modifyIndicesFromUTF16ToUnicode());
	var _twemojiParser = require_dist();
	_interopRequireDefault(require_urlHasHttps());
	/**
	* [parseTweet description]
	* @param  {string} text tweet text to parse
	* @param  {Object} options config options to pass
	* @return {Object} Fields in response described below:
	*
	* Response fields:
	* weightedLength {int} the weighted length of tweet based on weights specified in the config
	* valid {bool} If tweet is valid
	* permillage {float} permillage of the tweet over the max length specified in config
	* validRangeStart {int} beginning of valid text
	* validRangeEnd {int} End index of valid part of the tweet text (inclusive) in utf16
	* displayRangeStart {int} beginning index of display text
	* displayRangeEnd {int} end index of display text (inclusive) in utf16
	*/
	var parseTweet = function parseTweet() {
		var text = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
		var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : _configs["default"].defaults;
		var mergedOptions = Object.keys(options).length ? options : _configs["default"].defaults;
		var defaultWeight = mergedOptions.defaultWeight, emojiParsingEnabled = mergedOptions.emojiParsingEnabled, scale = mergedOptions.scale, maxWeightedTweetLength = mergedOptions.maxWeightedTweetLength, transformedURLLength = mergedOptions.transformedURLLength;
		var normalizedText = typeof String.prototype.normalize === "function" ? text.normalize() : text;
		var urlEntitiesMap = transformEntitiesToHash((0, _extractUrlsWithIndices["default"])(normalizedText));
		var emojiEntitiesMap = emojiParsingEnabled ? transformEntitiesToHash((0, _twemojiParser.parse)(normalizedText)) : [];
		var tweetLength = normalizedText.length;
		var weightedLength = 0;
		var validDisplayIndex = 0;
		var valid = true;
		for (var charIndex = 0; charIndex < tweetLength; charIndex++) {
			if (urlEntitiesMap[charIndex]) {
				var _urlEntitiesMap$charI = urlEntitiesMap[charIndex], url = _urlEntitiesMap$charI.url;
				_urlEntitiesMap$charI.indices;
				weightedLength += transformedURLLength * scale;
				charIndex += url.length - 1;
			} else if (emojiParsingEnabled && emojiEntitiesMap[charIndex]) {
				var _emojiEntitiesMap$cha = emojiEntitiesMap[charIndex], emoji = _emojiEntitiesMap$cha.text;
				_emojiEntitiesMap$cha.indices;
				weightedLength += defaultWeight;
				charIndex += emoji.length - 1;
			} else {
				charIndex += isSurrogatePair(normalizedText, charIndex) ? 1 : 0;
				weightedLength += (0, _getCharacterWeight["default"])(normalizedText.charAt(charIndex), mergedOptions);
			}
			if (valid) valid = !(0, _hasInvalidCharacters["default"])(normalizedText.substring(charIndex, charIndex + 1));
			if (valid && weightedLength <= maxWeightedTweetLength * scale) validDisplayIndex = charIndex;
		}
		weightedLength = weightedLength / scale;
		valid = valid && weightedLength > 0 && weightedLength <= maxWeightedTweetLength;
		var permillage = Math.floor(weightedLength / maxWeightedTweetLength * 1e3);
		var normalizationOffset = text.length - normalizedText.length;
		validDisplayIndex += normalizationOffset;
		return {
			weightedLength,
			valid,
			permillage,
			validRangeStart: 0,
			validRangeEnd: validDisplayIndex,
			displayRangeStart: 0,
			displayRangeEnd: text.length > 0 ? text.length - 1 : 0
		};
	};
	var transformEntitiesToHash = function transformEntitiesToHash(entities) {
		return entities.reduce(function(map, entity) {
			map[entity.indices[0]] = entity;
			return map;
		}, {});
	};
	var isSurrogatePair = function isSurrogatePair(text, cIndex) {
		if (cIndex < text.length - 1) {
			var c = text.charCodeAt(cIndex);
			var cNext = text.charCodeAt(cIndex + 1);
			return 55296 <= c && c <= 56319 && 56320 <= cNext && cNext <= 57343;
		}
		return false;
	};
	var _default = parseTweet;
	exports["default"] = _default;
	module.exports = exports.default;
}));

//#endregion
//#region rules/x/counter-entry.mjs
var import_parseTweet = /* @__PURE__ */ __toESM(require_parseTweet(), 1);

//#endregion
var parseTweet_default = import_parseTweet.default;
export { parseTweet_default as default };