// src/host/index.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join3 } from "node:path";

// node_modules/.pnpm/@deepseek-ai+cosmokit@1.9.0/node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
  return result;
}
var write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
  if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value2) => {
      current = value2;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached2 = refs.get(source);
  if (cached2) return cached2;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor2 = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor2) descriptor2.value = Reflect.apply(clone, null, [descriptor2.value, refs]);
    Reflect.defineProperty(result, key, descriptor2);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set();
  function compare(a2, b2) {
    if (a2 === b2) return true;
    if (isVolatile(a2) || isVolatile(b2)) return isVolatile(a2) && isVolatile(b2);
    if (!strict && isNullable(a2) && isNullable(b2)) return true;
    if (typeof a2 !== typeof b2 || typeof a2 !== "object" || !a2 || !b2) return false;
    if (ancestors.has(a2)) return false;
    function check(test, then) {
      return test(a2) ? test(b2) ? then(a2, b2) : false : test(b2) ? false : void 0;
    }
    ancestors.add(a2);
    try {
      return check(Array.isArray, (a3, b3) => {
        if (a3.length !== b3.length) return false;
        for (let index = 0; index < a3.length; index++) if (!compare(a3[index], b3[index])) return false;
        return true;
      }) ?? check(is("Date"), (a3, b3) => a3.valueOf() === b3.valueOf()) ?? check(is("URL"), (a3, b3) => a3.href === b3.href) ?? check(is("RegExp"), (a3, b3) => a3.source === b3.source && a3.flags === b3.flags) ?? check(isArrayBufferLike, (a3, b3) => {
        if (a3.byteLength !== b3.byteLength) return false;
        const viewA = new Uint8Array(a3);
        const viewB = new Uint8Array(b3);
        for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
        return true;
      }) ?? ((!strict || [a2, b2].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a2,
        ...b2
      }).every((key) => compare(a2[key], b2[key])));
    } finally {
      ancestors.delete(a2);
    }
  }
  return compare(a, b);
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// node_modules/.pnpm/@deepseek-ai+schemastery@3.19.0/node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (isVolatile(value)) value = value.get();
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.volatile = function volatile() {
  if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
  return this.extra("volatile", true);
};
var resolvers = {};
var checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
  if (states.has(blocked)) return;
  states.add(blocked);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
  const nested = blocked || !!schema.meta?.volatile;
  if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
  if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
  if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (!options[checkedVolatile]) {
    validateVolatileSchema(schema, options.path);
    options = {
      ...options,
      [checkedVolatile]: true
    };
  }
  if (schema.meta?.volatile) {
    const inner = Schema(schema);
    inner.meta = {
      ...schema.meta,
      volatile: false
    };
    const [value, adapted] = Schema.resolve(data, inner, options, strict);
    try {
      return [createVolatile(value), adapted];
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error), options);
    }
  }
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
    validateVolatileSchema(schema.inner, options.path, true);
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, { [name2](...args) {
    const schema = new Schema({ type: name2 });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name2 === "object" || name2 === "dict") schema.meta.default = {};
    else if (name2 === "array" || name2 === "tuple") schema.meta.default = [];
    else if (name2 === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// src/host/pi-ai.ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
var LLM_PI_AI_PACKAGE = "@deepseek-ai/dsh-llm-pi-ai";
var PI_AI_PACKAGE = "@earendil-works/pi-ai";
function findUpPackage(start, name2) {
  let dir = start;
  for (; ; ) {
    const candidate = join(dir, "node_modules", name2);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return void 0;
    dir = parent;
  }
}
function locateLlmPiAi(ctx) {
  const editor = ctx.get("configEditor");
  const packages = ctx.get("pluginPackages");
  if (editor === void 0) throw new Error("configEditor service is unavailable");
  if (packages === void 0) throw new Error("pluginPackages service is unavailable");
  const entry = editor.entries().find((row) => row.options.name === LLM_PI_AI_PACKAGE);
  if (entry === void 0) throw new Error(`no Loader entry runs ${LLM_PI_AI_PACKAGE}`);
  const baseUrl = entry.parent.tree.ctx.baseUrl;
  if (baseUrl === void 0) throw new Error("the llm-pi-ai entry has no resolution base");
  const pkg = packages.packageOf(LLM_PI_AI_PACKAGE, baseUrl);
  if (pkg === void 0) throw new Error(`cannot locate ${LLM_PI_AI_PACKAGE} from ${baseUrl}`);
  return pkg.dir;
}
function locatePiAi(ctx, llmPiAiDir) {
  const parent = pathToFileURL(join(llmPiAiDir, "package.json")).href;
  const viaLookup = ctx.get("pluginPackages")?.packageOf(PI_AI_PACKAGE, parent)?.dir;
  const dir = viaLookup ?? findUpPackage(llmPiAiDir, PI_AI_PACKAGE);
  if (dir === void 0) throw new Error(`cannot locate ${PI_AI_PACKAGE} from ${llmPiAiDir}`);
  return dir;
}
function providersAllFile(piAiDir) {
  const manifest = JSON.parse(readFileSync(join(piAiDir, "package.json"), "utf8"));
  const pattern2 = manifest.exports?.["./providers/*"];
  const target = typeof pattern2 === "string" ? pattern2 : typeof pattern2 === "object" && pattern2 !== null ? pattern2.import ?? pattern2.default : void 0;
  if (typeof target !== "string" || !target.includes("*")) {
    throw new Error(`${PI_AI_PACKAGE} exports no "./providers/*" ESM target`);
  }
  const file = join(piAiDir, target.replace("*", "all"));
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  return { file, version: manifest.version };
}
var cached;
function loadTemplateCatalog(ctx) {
  cached ??= (async () => {
    const llmDir = locateLlmPiAi(ctx);
    const piDir = locatePiAi(ctx, llmDir);
    const { file, version } = providersAllFile(piDir);
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.builtinProviders !== "function" || typeof mod.getBuiltinModels !== "function") {
      throw new Error(`${file} does not export builtinProviders/getBuiltinModels`);
    }
    const all = mod;
    return {
      version,
      location: file,
      providers: () => all.builtinProviders().map((provider) => provider.id),
      models: (provider) => {
        try {
          return all.getBuiltinModels(provider).filter((model) => model.type === void 0 || model.type === "chat");
        } catch {
          return [];
        }
      }
    };
  })().catch((error) => {
    cached = void 0;
    throw error;
  });
  return cached;
}
function resetTemplateCatalog() {
  cached = void 0;
}

// src/host/cache.ts
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname as dirname2, join as join2 } from "node:path";
var inflight = /* @__PURE__ */ new Map();
async function cachedFetch(dir, name2, url, maxAgeMs, force = false, signal) {
  const file = join2(dir, name2);
  if (!force) {
    try {
      const info = await stat(file);
      if (Date.now() - info.mtimeMs < maxAgeMs) {
        return { text: await readFile(file, "utf8"), fetchedAt: info.mtimeMs, fresh: false };
      }
    } catch {
    }
  }
  const pending = inflight.get(file);
  if (pending !== void 0) return pending;
  const task = (async () => {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "dsh-models-helper" },
        signal: AbortSignal.any([AbortSignal.timeout(6e4), ...signal ? [signal] : []])
      });
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
      const text = await response.text();
      await mkdir(dirname2(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, text, "utf8");
      await rename(temp, file);
      return { text, fetchedAt: Date.now(), fresh: true };
    } catch (error) {
      try {
        const info = await stat(file);
        return {
          text: await readFile(file, "utf8"),
          fetchedAt: info.mtimeMs,
          fresh: false,
          staleReason: error instanceof Error ? error.message : String(error)
        };
      } catch {
        throw error;
      }
    }
  })().finally(() => {
    inflight.delete(file);
  });
  inflight.set(file, task);
  return task;
}

// src/host/sources.ts
var MODELS_DEV_URL = "https://models.dev/api.json";
var OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
var DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1e3;
var NPM_PROTOCOL = {
  "@ai-sdk/openai-compatible": "openai-completions",
  "@ai-sdk/openai": "openai-responses",
  "@ai-sdk/anthropic": "anthropic-messages",
  "@ai-sdk/google": "google-generative-ai",
  "@openrouter/ai-sdk-provider": "openai-completions"
};
function protocolOfNpm(npm) {
  return npm === void 0 ? void 0 : NPM_PROTOCOL[npm];
}
function normalizeBaseURL(api, url) {
  if (url === void 0) return void 0;
  let out = url.replace(/\/+$/, "");
  if (api === "anthropic-messages") out = out.replace(/\/v1$/, "");
  return out;
}
function positiveInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function modalities(list) {
  if (!Array.isArray(list)) return void 0;
  const out = ["text", "image"].filter((kind) => list.includes(kind));
  return out.length > 0 ? [...out] : void 0;
}
function modelsDevPrice(cost) {
  const input = finite(cost?.input);
  const output = finite(cost?.output);
  if (input === void 0 || output === void 0) return void 0;
  const tiers = (cost?.tiers ?? []).flatMap((tier) => {
    const above = positiveInt(tier.tier?.size);
    const tin = finite(tier.input);
    const tout = finite(tier.output);
    if (tier.tier?.type !== "context" || above === void 0 || tin === void 0 || tout === void 0) return [];
    return [{
      inputTokensAbove: above,
      input: tin,
      output: tout,
      ...finite(tier.cache_read) === void 0 ? {} : { cacheRead: finite(tier.cache_read) },
      ...finite(tier.cache_write) === void 0 ? {} : { cacheWrite: finite(tier.cache_write) }
    }];
  });
  return {
    input,
    output,
    ...finite(cost?.cache_read) === void 0 ? {} : { cacheRead: finite(cost?.cache_read) },
    ...finite(cost?.cache_write) === void 0 ? {} : { cacheWrite: finite(cost?.cache_write) },
    ...tiers.length > 0 ? { tiers } : {}
  };
}
function modelsDevReasoning(model) {
  if (model.reasoning !== true) return { supported: false };
  const options = model.reasoning_options ?? [];
  const effort = options.find((option) => option.type === "effort");
  if (effort !== void 0) return { supported: true, kind: "effort", efforts: [...effort.values ?? []] };
  if (options.some((option) => option.type === "budget_tokens")) return { supported: true, kind: "budget" };
  if (options.some((option) => option.type === "toggle")) return { supported: true, kind: "toggle" };
  return { supported: true };
}
function normalizeModelsDevProvider(provider) {
  return Object.values(provider.models).flatMap((model) => {
    if (model.type !== void 0 && model.type !== "chat") return [];
    if (model.tool_call === false) return [];
    const npm = model.provider?.npm ?? provider.npm;
    const api = protocolOfNpm(npm);
    const baseURL = normalizeBaseURL(api, model.provider?.api ?? provider.api);
    const cost = modelsDevPrice(model.cost);
    const out = {
      id: model.id,
      ...model.name === void 0 ? {} : { name: model.name },
      ...model.family === void 0 ? {} : { family: model.family },
      ...api === void 0 ? {} : { api },
      ...baseURL === void 0 ? {} : { baseURL },
      ...api === void 0 && npm !== void 0 ? { npm } : {},
      ...positiveInt(model.limit?.context) === void 0 ? {} : { contextWindow: positiveInt(model.limit?.context) },
      ...positiveInt(model.limit?.output) === void 0 ? {} : { maxTokens: positiveInt(model.limit?.output) },
      ...modalities(model.modalities?.input) === void 0 ? {} : { input: modalities(model.modalities?.input) },
      reasoning: modelsDevReasoning(model),
      ...cost === void 0 ? {} : { cost },
      ...model.release_date === void 0 ? {} : { releaseDate: model.release_date },
      ...model.status === void 0 ? {} : { status: model.status }
    };
    return [out];
  });
}
async function readModelsDev(cacheDir, options = {}) {
  const doc = await cachedFetch(cacheDir, "models-dev.json", MODELS_DEV_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal);
  const parsed = JSON.parse(doc.text);
  return {
    providerIds: Object.keys(parsed),
    provider: (id) => {
      const provider = parsed[id];
      if (provider === void 0) return void 0;
      return {
        ...provider.name === void 0 ? {} : { name: provider.name },
        ...provider.env === void 0 ? {} : { env: provider.env },
        ...provider.api === void 0 ? {} : { api: provider.api },
        models: normalizeModelsDevProvider(provider)
      };
    },
    fetchedAt: doc.fetchedAt,
    ...doc.staleReason === void 0 ? {} : { staleReason: doc.staleReason }
  };
}
function perMillion(value) {
  if (value === void 0) return void 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 1e6) / 1e6 : void 0;
}
function normalizeOpenRouter(data) {
  return data.flatMap((model) => {
    const params = model.supported_parameters ?? [];
    if (!params.includes("tools")) return [];
    if (model.architecture?.output_modalities !== void 0 && !model.architecture.output_modalities.includes("text")) return [];
    const input = perMillion(model.pricing?.prompt);
    const output = perMillion(model.pricing?.completion);
    const cacheRead = perMillion(model.pricing?.input_cache_read);
    const cacheWrite = perMillion(model.pricing?.input_cache_write);
    const contextWindow = positiveInt(model.top_provider?.context_length ?? void 0) ?? positiveInt(model.context_length);
    const maxTokens = positiveInt(model.top_provider?.max_completion_tokens ?? void 0);
    const out = {
      id: model.id,
      ...model.name === void 0 ? {} : { name: model.name },
      api: "openai-completions",
      baseURL: "https://openrouter.ai/api/v1",
      ...contextWindow === void 0 ? {} : { contextWindow },
      ...maxTokens === void 0 ? {} : { maxTokens },
      ...modalities(model.architecture?.input_modalities) === void 0 ? {} : { input: modalities(model.architecture?.input_modalities) },
      reasoning: params.includes("reasoning") || params.includes("reasoning_effort") ? { supported: true, kind: "effort" } : { supported: false },
      ...input === void 0 || output === void 0 ? {} : {
        cost: {
          input,
          output,
          ...cacheRead === void 0 ? {} : { cacheRead },
          ...cacheWrite === void 0 ? {} : { cacheWrite }
        }
      },
      ...model.created === void 0 ? {} : { releaseDate: new Date(model.created * 1e3).toISOString().slice(0, 10) },
      ...model.endpoints === void 0 ? {} : { endpoints: [...model.endpoints] }
    };
    return [out];
  });
}
async function readOpenRouter(cacheDir, options = {}) {
  const doc = await cachedFetch(cacheDir, "openrouter-models.json", OPENROUTER_MODELS_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal);
  const parsed = JSON.parse(doc.text);
  if (!Array.isArray(parsed.data)) throw new Error("OpenRouter model list has no data array");
  return {
    models: normalizeOpenRouter(parsed.data),
    fetchedAt: doc.fetchedAt,
    ...doc.staleReason === void 0 ? {} : { staleReason: doc.staleReason }
  };
}

// src/host/probe.ts
var LLM_PI_AI_NS = "llm-pi-ai";
var PROBE_ROUTE = "models-helper-probe";
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function descriptor(ctx, ns) {
  return ctx.get("settings")?.describe().find((row) => row.ns === ns);
}
function routesOf(ctx, value) {
  const providers = value?.providers ?? {};
  const directory = new Map((ctx.get("llm")?.listConfigurableProviders() ?? []).filter((entry) => entry.settingsNs === LLM_PI_AI_NS).map((entry) => [entry.provider, entry]));
  return Object.entries(providers).map(([id, profile]) => ({
    id,
    declared: directory.get(id)?.declared,
    apiKeyEnv: profile.apiKeyEnv,
    api: profile.api,
    baseURL: profile.baseURL,
    modelCount: Array.isArray(profile.models) ? profile.models.length : 0
  }));
}
function dataDir(ctx) {
  const home = ctx.get("profileContext")?.home;
  if (home === void 0) throw new Error("profileContext service is unavailable");
  return `${home}/integrations/dsh-models-helper`;
}
async function probeStatus(ctx) {
  const checks = [];
  const services = ["settings", "configEditor", "pluginPackages", "connection", "llm", "profileContext"];
  const missing = services.filter((name2) => ctx.get(name2) === void 0);
  checks.push({ id: "services", ok: missing.length === 0, detail: missing.length === 0 ? services.join(", ") : `missing: ${missing.join(", ")}` });
  const profile = ctx.get("profileContext");
  checks.push({ id: "dataDir", ok: profile !== void 0, detail: profile === void 0 ? "no profileContext" : `${dataDir(ctx)} (profile ${profile.name})` });
  try {
    checks.push({ id: "llmPiAiPackage", ok: true, detail: locateLlmPiAi(ctx) });
  } catch (error) {
    checks.push({ id: "llmPiAiPackage", ok: false, detail: errorText(error) });
  }
  let piAiVersion;
  try {
    const catalog = await loadTemplateCatalog(ctx);
    piAiVersion = catalog.version;
    const providers = catalog.providers();
    checks.push({ id: "template", ok: providers.length > 0, detail: `pi-ai ${catalog.version ?? "?"} · ${providers.length} providers · ${catalog.location}` });
  } catch (error) {
    checks.push({ id: "template", ok: false, detail: errorText(error) });
  }
  const llm = descriptor(ctx, LLM_PI_AI_NS);
  const routes = llm === void 0 ? [] : routesOf(ctx, llm.value);
  checks.push({
    id: "settingsRead",
    ok: llm !== void 0,
    detail: llm === void 0 ? `settings has no "${LLM_PI_AI_NS}" namespace` : `revision ${llm.revision} · ${routes.length} routes`
  });
  const selfNs = ctx.fiber.entry?.options.id;
  const self = selfNs === void 0 ? void 0 : descriptor(ctx, selfNs);
  checks.push({
    id: "selfSettings",
    ok: self !== void 0,
    detail: selfNs === void 0 ? "this plugin has no Loader entry" : self === void 0 ? `namespace "${selfNs}" not listed by settings` : `namespace "${selfNs}" revision ${self.revision}`
  });
  return {
    checks,
    routes,
    llmPiAiRevision: llm?.revision,
    selfNs,
    selfRevision: self?.revision,
    piAiVersion
  };
}
async function probeTemplate(ctx, provider) {
  const catalog = await loadTemplateCatalog(ctx);
  const models = catalog.models(provider);
  const groups = /* @__PURE__ */ new Map();
  for (const model of models) {
    const key = `${model.api} ${model.baseUrl ?? ""}`;
    const group = groups.get(key) ?? { api: model.api, baseURL: model.baseUrl ?? "", count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  const sample = models.find((model) => model.compat !== void 0 && Object.keys(model.compat).length > 0) ?? models[0];
  return {
    provider,
    modelCount: models.length,
    groups: [...groups.values()],
    sample: sample === void 0 ? null : {
      id: sample.id,
      api: sample.api,
      compat: sample.compat ?? null,
      thinkingLevelMap: sample.thinkingLevelMap ?? null,
      cost: sample.cost ?? null
    }
  };
}
async function probeSources(ctx, provider, signal) {
  const dir = `${dataDir(ctx)}/cache`;
  let templateIds = /* @__PURE__ */ new Set();
  try {
    templateIds = new Set((await loadTemplateCatalog(ctx)).models(provider).map((model) => model.id));
  } catch {
  }
  const summary = { provider, modelsDev: { ok: false, detail: "" } };
  try {
    const doc = await readModelsDev(dir, { signal });
    const entry = doc.provider(provider);
    if (entry === void 0) {
      summary.modelsDev = { ok: false, detail: `models.dev has no provider "${provider}" (${doc.providerIds.length} providers)` };
    } else {
      const groups = {};
      for (const model of entry.models) {
        const key = `${model.api ?? `unsupported:${model.npm ?? "?"}`} ${model.baseURL ?? ""}`;
        groups[key] = (groups[key] ?? 0) + 1;
      }
      summary.modelsDev = {
        ok: true,
        detail: `fetched ${new Date(doc.fetchedAt).toISOString()}${doc.staleReason === void 0 ? "" : ` (stale: ${doc.staleReason})`}`,
        count: entry.models.length,
        onlyInSource: entry.models.map((model) => model.id).filter((id) => !templateIds.has(id)),
        groups
      };
    }
  } catch (error) {
    summary.modelsDev = { ok: false, detail: errorText(error) };
  }
  if (provider === "openrouter") {
    try {
      const snapshot2 = await readOpenRouter(dir, { signal });
      summary.openrouter = {
        ok: true,
        detail: `fetched ${new Date(snapshot2.fetchedAt).toISOString()}${snapshot2.staleReason === void 0 ? "" : ` (stale: ${snapshot2.staleReason})`}`,
        count: snapshot2.models.length,
        onlyInSource: snapshot2.models.filter((model) => !templateIds.has(model.id)).length
      };
    } catch (error) {
      summary.openrouter = { ok: false, detail: errorText(error) };
    }
  }
  return summary;
}
async function probeWriteTest(ctx) {
  const checks = [];
  const settings = ctx.get("settings");
  if (settings === void 0) return { checks: [{ id: "settings", ok: false, detail: "settings service is unavailable" }] };
  const start = descriptor(ctx, LLM_PI_AI_NS);
  if (start === void 0) return { checks: [{ id: "settings", ok: false, detail: `no "${LLM_PI_AI_NS}" namespace` }] };
  const existing = start.value.providers ?? {};
  if (Object.hasOwn(existing, PROBE_ROUTE)) {
    return { checks: [{ id: "precondition", ok: false, detail: `route "${PROBE_ROUTE}" already exists; remove it first` }] };
  }
  let added = false;
  try {
    await settings.mutate(LLM_PI_AI_NS, [{
      op: "set",
      path: ["providers", PROBE_ROUTE],
      value: {
        displayName: "Models helper probe",
        api: "openai-completions",
        baseURL: "https://example.invalid/v1",
        compat: { supportsDeveloperRole: false, maxTokensField: "max_tokens" },
        models: [{ id: "probe-model", contextWindow: 32768, maxTokens: 4096, input: ["text"], reasoningEfforts: { off: null, high: "high" } }]
      }
    }], start.revision);
    added = true;
    const after = descriptor(ctx, LLM_PI_AI_NS);
    const route = after?.value?.providers?.[PROBE_ROUTE];
    checks.push({
      id: "addRoute",
      ok: route !== void 0,
      detail: `revision ${start.revision} → ${after?.revision ?? "?"}; stored ${JSON.stringify(route ?? null)}`
    });
    const listed = ctx.get("llm")?.listConfigurableProviders().find((entry) => entry.provider === PROBE_ROUTE);
    checks.push({ id: "routeRegistered", ok: listed !== void 0, detail: listed === void 0 ? "not in the configurable-provider directory" : `declared=${String(listed.declared)}` });
    try {
      await settings.mutate(LLM_PI_AI_NS, [{ op: "set", path: ["providers", PROBE_ROUTE, "displayName"], value: "stale" }], start.revision);
      checks.push({ id: "staleRevisionRefused", ok: false, detail: "a write with a stale revision was accepted" });
    } catch (error) {
      checks.push({ id: "staleRevisionRefused", ok: /changed since it was read/.test(errorText(error)), detail: errorText(error) });
    }
  } catch (error) {
    checks.push({ id: "addRoute", ok: false, detail: errorText(error) });
  } finally {
    if (added) {
      try {
        const current = descriptor(ctx, LLM_PI_AI_NS);
        await settings.mutate(LLM_PI_AI_NS, [{ op: "unset", path: ["providers", PROBE_ROUTE] }], current?.revision);
        const after = descriptor(ctx, LLM_PI_AI_NS);
        const gone = !Object.hasOwn(after?.value?.providers ?? {}, PROBE_ROUTE);
        checks.push({ id: "removeRoute", ok: gone, detail: gone ? `revision → ${after?.revision ?? "?"}` : "route still present" });
      } catch (error) {
        checks.push({ id: "removeRoute", ok: false, detail: errorText(error) });
      }
    }
  }
  const selfNs = ctx.fiber.entry?.options.id;
  if (selfNs === void 0) {
    checks.push({ id: "selfWrite", ok: false, detail: "this plugin has no Loader entry" });
  } else {
    try {
      const stamp = (/* @__PURE__ */ new Date()).toISOString();
      await settings.mutate(selfNs, [{ op: "set", path: ["probe", "lastWriteTest"], value: stamp }], descriptor(ctx, selfNs)?.revision);
      const stored = descriptor(ctx, selfNs)?.value?.probe?.lastWriteTest;
      await settings.mutate(selfNs, [{ op: "unset", path: ["probe"] }], descriptor(ctx, selfNs)?.revision);
      checks.push({ id: "selfWrite", ok: stored === stamp, detail: stored === stamp ? "set and unset own volatile field" : `read back ${String(stored)}` });
    } catch (error) {
      checks.push({ id: "selfWrite", ok: false, detail: errorText(error) });
    }
  }
  return { checks };
}

// src/shared/rpc.ts
var RPC_ENDPOINT = "dsh-models-helper/rpc";

// src/host/rpc.ts
var RpcError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "RpcError";
  }
};
function failure(error) {
  if (error instanceof RpcError) return { code: error.code, message: error.message, details: error.details };
  const message = error instanceof Error ? error.message : String(error);
  return { code: "models-helper/internal", message, details: {} };
}
function respond(rpcId, result) {
  return new Response(JSON.stringify({ type: "server-response", rpcId, result }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
function registerRpc(connection, handlers, logger) {
  return connection.fetch.register({
    path: `/api/${RPC_ENDPOINT}`,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      let envelope;
      try {
        envelope = await request.json();
      } catch {
        return new Response("invalid JSON", { status: 400 });
      }
      if (envelope.type !== "client-request" || typeof envelope.rpcId !== "string") {
        return new Response("invalid envelope", { status: 400 });
      }
      const rpcId = envelope.rpcId;
      const payload = envelope.payload;
      const method = payload?.method;
      if (typeof method !== "string" || !Object.hasOwn(handlers, method)) {
        return respond(rpcId, { ok: false, error: { code: "models-helper/unknown-method", message: `unknown method ${String(method)}`, details: {} } });
      }
      const args = typeof payload?.args === "object" && payload.args !== null ? payload.args : {};
      try {
        const handler = handlers[method];
        const value = await handler(args, request.signal);
        return respond(rpcId, { ok: true, value: value ?? null });
      } catch (error) {
        if (!(error instanceof RpcError)) logger.warn("models-helper: %s failed: %s", method, error instanceof Error ? error.stack ?? error.message : String(error));
        return respond(rpcId, { ok: false, error: failure(error) });
      }
    }
  });
}

// src/host/index.ts
async function recordProbe(ctx, name2, result) {
  const value = await result;
  try {
    const dir = join3(dataDir(ctx), "probe-results");
    await mkdir2(dir, { recursive: true });
    await writeFile2(join3(dir, `${name2}.json`), `${JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), value }, null, 2)}
`, "utf8");
  } catch (error) {
    ctx.logger.warn("models-helper: cannot record probe %s: %s", name2, error instanceof Error ? error.message : String(error));
  }
  return value;
}
var name = "dsh-models-helper";
var Config = Schema.object({
  bindings: Schema.dict(Schema.any()).default({}).volatile().description("Custom pi-ai routes bound to a metadata source, keyed by route id."),
  probe: Schema.object({
    lastWriteTest: Schema.string()
  }).volatile().description("Scratch field used by the M0 write probe; normally absent.")
});
function apply(ctx) {
  ctx.effect(() => () => {
    resetTemplateCatalog();
  }, "models-helper: template cache");
  ctx.inject(["connection"], (scoped) => {
    const connection = scoped.get("connection");
    if (connection === void 0) return;
    const dispose = registerRpc(connection, {
      "probe.status": () => recordProbe(ctx, "status", probeStatus(ctx)),
      "probe.template": (args) => {
        if (typeof args.provider !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(args.provider)) throw new RpcError("models-helper/bad-request", "provider is required");
        return recordProbe(ctx, `template-${args.provider}`, probeTemplate(ctx, args.provider));
      },
      "probe.sources": (args, signal) => {
        if (typeof args.provider !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(args.provider)) throw new RpcError("models-helper/bad-request", "provider is required");
        return recordProbe(ctx, `sources-${args.provider}`, probeSources(ctx, args.provider, signal));
      },
      "probe.writeTest": () => recordProbe(ctx, "write-test", probeWriteTest(ctx))
    }, ctx.logger);
    scoped.effect(() => dispose, "models-helper: rpc route");
  });
}
export {
  Config,
  apply,
  name
};
