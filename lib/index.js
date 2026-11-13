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

// src/shared/rpc.ts
var RPC_ENDPOINT = "dsh-models-helper/rpc";
function deriveKeyRef(route) {
  return `${route.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}
var MODEL_FIELDS = ["name", "contextWindow", "maxTokens", "input", "reasoningEfforts", "compat"];

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

// src/host/actions.ts
import { join as join4 } from "node:path";

// src/host/cache.ts
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname as dirname2, join as join2 } from "node:path";

// src/host/util.ts
function deepEqual2(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual2(value, b[index]));
  }
  const left = a;
  const right = b;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.hasOwn(right, key) && deepEqual2(left[key], right[key]));
}
function cloneJson(value) {
  return value === void 0 ? value : JSON.parse(JSON.stringify(value));
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function iso(ms) {
  return new Date(ms).toISOString();
}

// src/host/cache.ts
var inflight = /* @__PURE__ */ new Map();
function metaPath(file) {
  return `${file}.meta.json`;
}
async function readMeta(file) {
  try {
    return JSON.parse(await readFile(metaPath(file), "utf8"));
  } catch {
    return {};
  }
}
async function writeMeta(file, meta) {
  await mkdir(dirname2(file), { recursive: true });
  const temp = `${metaPath(file)}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(meta)}
`, "utf8");
  await rename(temp, metaPath(file));
}
async function readCachedBody(file) {
  try {
    const [text, meta, info] = await Promise.all([readFile(file, "utf8"), readMeta(file), stat(file)]);
    return { text, fetchedAt: meta.fetchedAt ?? info.mtimeMs };
  } catch {
    return void 0;
  }
}
async function cachedFetch(dir, name2, url, maxAgeMs, force = false, signal) {
  const file = join2(dir, name2);
  const meta = await readMeta(file);
  if (!force) {
    const cached2 = await readCachedBody(file);
    if (cached2 !== void 0 && Date.now() - cached2.fetchedAt < maxAgeMs) {
      return { ...cached2, online: false };
    }
  }
  const pending = inflight.get(file);
  if (pending !== void 0) return pending;
  const task = (async () => {
    try {
      const headers = { accept: "application/json", "user-agent": "dsh-models-helper" };
      if (meta.etag !== void 0) headers["if-none-match"] = meta.etag;
      if (meta.lastModified !== void 0) headers["if-modified-since"] = meta.lastModified;
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.any([AbortSignal.timeout(6e4), ...signal ? [signal] : []])
      });
      if (response.status === 304) {
        const cached2 = await readCachedBody(file);
        if (cached2 === void 0) throw new Error(`GET ${url}: 304 without a cached copy`);
        await writeMeta(file, { ...meta, checkedAt: Date.now(), lastError: void 0 });
        return { text: cached2.text, fetchedAt: cached2.fetchedAt, online: true };
      }
      if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
      const text = await response.text();
      await mkdir(dirname2(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, text, "utf8");
      await rename(temp, file);
      const now = Date.now();
      await writeMeta(file, {
        fetchedAt: now,
        checkedAt: now,
        ...response.headers.get("etag") === null ? {} : { etag: response.headers.get("etag") },
        ...response.headers.get("last-modified") === null ? {} : { lastModified: response.headers.get("last-modified") },
        lastError: void 0
      });
      return { text, fetchedAt: now, online: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const cached2 = await readCachedBody(file);
      if (cached2 === void 0) throw error;
      await writeMeta(file, { ...meta, checkedAt: Date.now(), lastError: reason });
      return { ...cached2, online: false, staleReason: reason };
    }
  })().finally(() => {
    inflight.delete(file);
  });
  inflight.set(file, task);
  return task;
}
async function readCacheEntry(dir, name2) {
  const file = join2(dir, name2);
  const meta = await readMeta(file);
  try {
    const info = await stat(file);
    return {
      ...meta.fetchedAt === void 0 ? {} : { fetchedAt: iso(meta.fetchedAt) },
      ...meta.checkedAt === void 0 ? {} : { checkedAt: iso(meta.checkedAt) },
      ...meta.lastError === void 0 ? {} : { staleReason: meta.lastError },
      size: info.size
    };
  } catch {
    return meta.lastError === void 0 ? {} : { staleReason: meta.lastError };
  }
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
async function readModelsDev(cacheDir2, options = {}) {
  const doc = await cachedFetch(cacheDir2, "models-dev.json", MODELS_DEV_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal);
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
    online: doc.online,
    checkedAt: Date.now(),
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
async function readOpenRouter(cacheDir2, options = {}) {
  const doc = await cachedFetch(cacheDir2, "openrouter-models.json", OPENROUTER_MODELS_URL, options.maxAgeMs ?? DEFAULT_MAX_AGE_MS, options.force, options.signal);
  const parsed = JSON.parse(doc.text);
  if (!Array.isArray(parsed.data)) throw new Error("OpenRouter model list has no data array");
  return {
    models: normalizeOpenRouter(parsed.data),
    fetchedAt: doc.fetchedAt,
    online: doc.online,
    ...doc.staleReason === void 0 ? {} : { staleReason: doc.staleReason }
  };
}

// src/host/domain.ts
var LLM_PI_AI_NS = "llm-pi-ai";
var OFFERED_COMPAT = {
  "openai-completions": [
    "supportsStore",
    "supportsDeveloperRole",
    "supportsReasoningEffort",
    "supportsUsageInStreaming",
    "supportsFinishReason",
    "maxTokensField",
    "requiresToolResultName",
    "requiresAssistantAfterToolResult",
    "requiresThinkingAsText",
    "requiresReasoningContentOnAssistantMessages",
    "thinkingFormat",
    "chatTemplateKwargs",
    "chatTemplateArgs",
    "supportsThinkingTokenBudget",
    "thinkingTokenBudgetField",
    "vllmPriority",
    "supportsStrictMode",
    "cacheControlFormat",
    "supportsLongCacheRetention"
  ],
  "openai-responses": [
    "supportsDeveloperRole",
    "supportsMaxOutputTokens",
    "supportsStrictMode",
    "supportsLongCacheRetention"
  ],
  "anthropic-messages": [
    "supportsEagerToolInputStreaming",
    "supportsLongCacheRetention",
    "supportsCacheControlOnTools",
    "supportsTemperature",
    "forceAdaptiveThinking",
    "allowEmptySignature",
    "supportsStrictTools"
  ],
  "google-generative-ai": []
};
var THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var GEMINI_LEVELS = ["minimal", "low", "medium", "high"];
function modelFieldsOf(raw) {
  if (raw === void 0) return {};
  const out = {};
  if (typeof raw.name === "string") out.name = raw.name;
  if (typeof raw.contextWindow === "number") out.contextWindow = raw.contextWindow;
  if (typeof raw.maxTokens === "number") out.maxTokens = raw.maxTokens;
  if (Array.isArray(raw.input)) {
    const input = raw.input.filter((kind) => kind === "text" || kind === "image");
    if (input.length > 0) out.input = input;
  }
  if (raw.reasoningEfforts === false) out.reasoningEfforts = false;
  else if (raw.reasoningEfforts !== void 0 && typeof raw.reasoningEfforts === "object" && raw.reasoningEfforts !== null) {
    const efforts = {};
    for (const [level, value] of Object.entries(raw.reasoningEfforts)) {
      if (value === null || typeof value === "string") efforts[level] = value;
    }
    if (Object.keys(efforts).length > 0) out.reasoningEfforts = efforts;
  }
  if (raw.compat !== void 0 && typeof raw.compat === "object" && raw.compat !== null && Object.keys(raw.compat).length > 0) {
    out.compat = raw.compat;
  }
  return out;
}
function definedFields(fields, only) {
  const out = {};
  const keys = only ?? Object.keys(fields);
  for (const key of keys) {
    const value = fields[key];
    if (value === void 0) continue;
    out[key] = value;
  }
  return out;
}
function lockKey(model, field) {
  return `${model}/${field}`;
}

// src/host/merge.ts
function offeredCompat(compat, api) {
  if (compat === void 0) return void 0;
  const offered = OFFERED_COMPAT[api];
  const out = {};
  for (const key of offered) {
    if (Object.hasOwn(compat, key) && compat[key] !== void 0) out[key] = compat[key];
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function hasWithheldCompat(compat, api) {
  if (compat === void 0) return false;
  const offered = new Set(OFFERED_COMPAT[api]);
  return Object.keys(compat).some((key) => !offered.has(key));
}
function routeCompatFor(templateModels, api) {
  const offered = OFFERED_COMPAT[api];
  const out = {};
  if (templateModels.length === 0) return out;
  for (const field of offered) {
    const first = templateModels[0]?.compat?.[field];
    if (first === void 0) continue;
    if (templateModels.every((model) => deepEqual2(model.compat?.[field], first))) out[field] = first;
  }
  return out;
}
function hasNonOff(efforts) {
  return Object.entries(efforts).some(([level, value]) => level !== "off" && value !== null);
}
function geminiEfforts(efforts) {
  const out = {};
  if (Object.hasOwn(efforts, "off") && efforts.off === null) out.off = null;
  for (const level of GEMINI_LEVELS) {
    const value = efforts[level];
    if (value !== void 0 && value === level) out[level] = value;
  }
  return out;
}
function effortsFromThinkingLevelMap(map, api) {
  if (map === void 0) return void 0;
  const efforts = {};
  for (const level of THINKING_LEVELS) {
    if (Object.hasOwn(map, level)) {
      const value = map[level];
      if (value === null) {
        if (level === "off") efforts.off = null;
        continue;
      }
      if (typeof value === "string") efforts[level] = value;
      continue;
    }
    if (level === "off") efforts.off = null;
    else if (level === "minimal" || level === "low" || level === "medium" || level === "high") efforts[level] = level;
  }
  const final = api === "google-generative-ai" ? geminiEfforts(efforts) : efforts;
  if (!hasNonOff(final)) return false;
  return final;
}
function effortsFromSource(reasoning, api) {
  if (reasoning === void 0) return { value: void 0, inferred: false };
  if (!reasoning.supported) return { value: false, inferred: false };
  let efforts;
  let inferred = false;
  if (reasoning.kind === "effort" && reasoning.efforts !== void 0 && reasoning.efforts.length > 0) {
    efforts = {};
    for (const raw of reasoning.efforts) {
      if (raw === "none") efforts.off = "none";
      else if (THINKING_LEVELS.includes(raw)) efforts[raw] = raw;
    }
    if (api === "google-generative-ai") {
      const gemini = geminiEfforts(efforts);
      gemini.off = null;
      efforts = gemini;
    }
    if (!hasNonOff(efforts)) return { value: void 0, inferred: true };
  } else if (reasoning.kind === "budget") {
    efforts = { off: null, low: "low", medium: "medium", high: "high" };
    inferred = true;
  } else {
    efforts = { off: null, high: "high" };
    inferred = true;
  }
  const final = api === "google-generative-ai" ? geminiEfforts(efforts) : efforts;
  return { value: hasNonOff(final) ? final : void 0, inferred };
}
function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}
function sameSeries(id, family, templateModels) {
  if (family !== void 0 && family.length > 0) {
    const needle = family.toLowerCase();
    const byFamily = templateModels.filter((model) => {
      const hay = model.id.toLowerCase();
      return hay.includes(needle) || needle.includes(hay);
    });
    if (byFamily.length > 0) return byFamily;
  }
  const ranked = templateModels.map((model) => ({ model, length: commonPrefixLength(model.id, id) })).filter((entry) => entry.length >= 3);
  if (ranked.length === 0) return [];
  const best = Math.max(...ranked.map((entry) => entry.length));
  return ranked.filter((entry) => entry.length === best).map((entry) => entry.model);
}
function inferredCompat(candidates, api) {
  if (candidates.length === 0) return void 0;
  const out = {};
  for (const field of OFFERED_COMPAT[api]) {
    if (!candidates.every((model) => model.compat !== void 0 && Object.hasOwn(model.compat, field))) continue;
    const first = candidates[0]?.compat?.[field];
    if (candidates.every((model) => deepEqual2(model.compat?.[field], first))) out[field] = first;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function inputOf(value) {
  if (value === void 0) return void 0;
  const out = value.filter((kind) => kind === "text" || kind === "image");
  return out.length > 0 ? out : void 0;
}
function removeRouteCompat(compat, routeCompat) {
  if (compat === void 0) return void 0;
  const out = {};
  for (const [key, value] of Object.entries(compat)) {
    if (deepEqual2(routeCompat[key], value)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function mergePrice(source, template) {
  if (source !== void 0) return source;
  if (template !== void 0) return template;
  return void 0;
}
function planGroup(input) {
  const { api, sourceModels, templateModels } = input;
  const routeCompat = routeCompatFor(templateModels, api);
  const sourceById = new Map(sourceModels.map((model) => [model.id, model]));
  const templateById = new Map(templateModels.map((model) => [model.id, model]));
  const ids = [];
  for (const model of sourceModels) ids.push(model.id);
  for (const model of templateModels) if (!sourceById.has(model.id)) ids.push(model.id);
  const models = [];
  let withheldCompat = 0;
  let templateOnly = 0;
  let noTemplate = 0;
  for (const id of ids) {
    const source = sourceById.get(id);
    const template = templateById.get(id);
    models.push(planModel({ id, source, template, templateModels, api, routeCompat }));
    if (template !== void 0 && hasWithheldCompat(template.compat, api)) withheldCompat += 1;
    if (source === void 0) templateOnly += 1;
    if (source !== void 0 && template === void 0) noTemplate += 1;
  }
  return { routeCompat, models, withheldCompat, templateOnly, noTemplate };
}
function planModel(input) {
  const { id, source, template, api, routeCompat } = input;
  const fields = {};
  const provenance = {};
  if (source?.name !== void 0) {
    fields.name = source.name;
    provenance.name = "source";
  } else if (template?.name !== void 0) {
    fields.name = template.name;
    provenance.name = "template";
  }
  if (source?.contextWindow !== void 0) {
    fields.contextWindow = source.contextWindow;
    provenance.contextWindow = "source";
  } else if (template?.contextWindow !== void 0) {
    fields.contextWindow = template.contextWindow;
    provenance.contextWindow = "template";
  }
  if (source?.maxTokens !== void 0) {
    fields.maxTokens = source.maxTokens;
    provenance.maxTokens = "source";
  } else if (template?.maxTokens !== void 0) {
    fields.maxTokens = template.maxTokens;
    provenance.maxTokens = "template";
  }
  const modalities2 = inputOf(source?.input) ?? inputOf(template?.input);
  if (modalities2 !== void 0) {
    fields.input = modalities2;
    provenance.input = source?.input !== void 0 ? "source" : "template";
  }
  const fromTemplate = effortsFromThinkingLevelMap(template?.thinkingLevelMap, api);
  if (fromTemplate !== void 0) {
    fields.reasoningEfforts = fromTemplate;
    provenance.reasoningEfforts = "template";
  } else if (source?.reasoning !== void 0) {
    const derived = effortsFromSource(source.reasoning, api);
    if (derived.value !== void 0) {
      fields.reasoningEfforts = derived.value;
      provenance.reasoningEfforts = derived.inferred ? "inferred" : "source";
    } else if (derived.inferred) {
      provenance.reasoningEfforts = "inferred";
    }
  } else if (template?.reasoning === false) {
    fields.reasoningEfforts = false;
    provenance.reasoningEfforts = "template";
  }
  const compatFromTemplate = removeRouteCompat(offeredCompat(template?.compat, api), routeCompat);
  if (compatFromTemplate !== void 0) {
    fields.compat = compatFromTemplate;
    provenance.compat = "template";
  } else if (template === void 0) {
    const series = sameSeries(id, source?.family, input.templateModels);
    const inferred = removeRouteCompat(inferredCompat(series, api), routeCompat);
    if (inferred !== void 0) {
      fields.compat = inferred;
      provenance.compat = "inferred";
    }
  }
  const price = mergePrice(source?.cost, template?.cost);
  return {
    id,
    inTemplate: template !== void 0,
    templateOnly: source === void 0,
    fields,
    provenance,
    ...price === void 0 ? {} : { price }
  };
}

// src/host/diff.ts
function isLocked(locks, model, field) {
  return locks.has(`${model}/${field}`);
}
function addedFields(desired) {
  const fields = [];
  for (const field of MODEL_FIELDS) {
    const next = desired.fields[field];
    if (next === void 0) continue;
    fields.push({ field, new: next, provenance: desired.provenance[field] ?? "source" });
  }
  return fields;
}
function updateFields(input) {
  const { desired, current, snapshotFields, hasSnapshot, locks } = input;
  const currentFields = modelFieldsOf(current);
  const fields = [];
  let conflicts = 0;
  for (const field of MODEL_FIELDS) {
    if (isLocked(locks, desired.id, field)) continue;
    const old = currentFields[field];
    const next = desired.fields[field];
    if (deepEqual2(old, next)) continue;
    if (!hasSnapshot) {
      conflicts += 1;
      fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? "source" });
      continue;
    }
    const snap = snapshotFields?.[field];
    if (deepEqual2(old, snap)) {
      fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? "source" });
      continue;
    }
    if (deepEqual2(next, snap)) continue;
    conflicts += 1;
    fields.push({ field, old, new: next, provenance: desired.provenance[field] ?? "source" });
  }
  return { fields, conflicts };
}
function computeDiff(input) {
  const locks = new Set(input.locks);
  const currentById = new Map(input.current.map((model) => [model.id, model]));
  const desiredIds = new Set(input.desired.map((model) => model.id));
  const snapshotModels = input.snapshot?.models;
  const diff = { added: [], candidates: [], updates: [], conflicts: [], removed: [] };
  for (const desired of input.desired) {
    const current = currentById.get(desired.id);
    if (current === void 0) {
      const checked = input.autoIncludeNew;
      const row = {
        id: desired.id,
        kind: checked ? "added" : "candidate",
        defaultChecked: checked,
        fields: addedFields(desired)
      };
      if (checked) diff.added.push(row);
      else diff.candidates.push(row);
      continue;
    }
    const snapshotFields = snapshotModels?.[desired.id];
    const { fields, conflicts } = updateFields({
      desired,
      current,
      snapshotFields,
      hasSnapshot: snapshotFields !== void 0,
      locks
    });
    if (fields.length === 0) continue;
    if (conflicts > 0) {
      diff.conflicts.push({ id: desired.id, kind: "conflict", defaultChecked: false, fields });
    } else {
      diff.updates.push({ id: desired.id, kind: "update", defaultChecked: true, fields });
    }
  }
  for (const current of input.current) {
    if (desiredIds.has(current.id)) continue;
    diff.removed.push({ id: current.id, kind: "removed", defaultChecked: false, fields: [] });
  }
  return diff;
}

// src/host/store.ts
import { mkdir as mkdir2, readFile as readFile2, rename as rename2, stat as stat2, writeFile as writeFile2 } from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";
function dataDir(ctx) {
  const home = ctx.get("profileContext")?.home;
  if (home === void 0) throw new Error("profileContext service is unavailable");
  return `${home}/integrations/dsh-models-helper`;
}
function cacheDir(ctx) {
  return join3(dataDir(ctx), "cache");
}
function descriptor(ctx, ns) {
  return ctx.get("settings")?.describe().find((row) => row.ns === ns);
}
function llmDescriptor(ctx) {
  return descriptor(ctx, LLM_PI_AI_NS);
}
function selfNamespace(ctx) {
  return ctx.fiber.entry?.options.id;
}
function bindingsRecord(ctx) {
  const ns = selfNamespace(ctx);
  if (ns === void 0) return {};
  const value = descriptor(ctx, ns)?.value;
  const raw = value?.bindings;
  if (raw === void 0 || raw === null || typeof raw !== "object") return {};
  const out = {};
  for (const [route, entry] of Object.entries(raw)) {
    const binding = normalizeBinding(route, entry);
    if (binding !== void 0) out[route] = binding;
  }
  return out;
}
function readBindings(ctx) {
  return bindingsRecord(ctx);
}
function normalizeBinding(route, value) {
  if (value === null || typeof value !== "object") return void 0;
  const raw = value;
  const source = raw.source;
  if (source === void 0 || typeof source !== "object") return void 0;
  if (source.kind !== "models-dev" && source.kind !== "openrouter") return void 0;
  if (source.kind === "models-dev" && typeof source.provider !== "string") return void 0;
  if (typeof raw.template !== "string" || typeof raw.api !== "string" || typeof raw.baseURL !== "string") return void 0;
  return {
    route,
    source,
    template: raw.template,
    api: raw.api,
    baseURL: raw.baseURL,
    autoIncludeNew: raw.autoIncludeNew === true,
    ...raw.lastSync === void 0 ? {} : { lastSync: raw.lastSync },
    locks: Array.isArray(raw.locks) ? raw.locks.filter((lock) => typeof lock === "string") : [],
    priceOverrides: raw.priceOverrides !== void 0 && typeof raw.priceOverrides === "object" && raw.priceOverrides !== null ? raw.priceOverrides : {}
  };
}
async function writeBinding(ctx, binding) {
  const settings = ctx.get("settings");
  const ns = selfNamespace(ctx);
  if (settings === void 0 || ns === void 0) throw new Error("the plugin settings namespace is unavailable");
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const current = descriptor(ctx, ns);
      await settings.mutate(ns, [{ op: "set", path: ["bindings", binding.route], value: binding }], current?.revision);
      return;
    } catch (error) {
      lastError = error;
      if (!/changed since it was read/.test(error instanceof Error ? error.message : String(error))) throw error;
    }
  }
  throw lastError;
}
async function removeBinding(ctx, route) {
  const settings = ctx.get("settings");
  const ns = selfNamespace(ctx);
  if (settings === void 0 || ns === void 0) throw new Error("the plugin settings namespace is unavailable");
  await settings.mutate(ns, [{ op: "unset", path: ["bindings", route] }], descriptor(ctx, ns)?.revision);
}
var writeChains = /* @__PURE__ */ new Map();
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile2(path, "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson(path, value) {
  const previous = writeChains.get(path) ?? Promise.resolve();
  const next = previous.then(async () => {
    await mkdir2(dirname3(path), { recursive: true });
    const temp = `${path}.${process.pid}.tmp`;
    await writeFile2(temp, `${JSON.stringify(value)}
`, "utf8");
    await rename2(temp, path);
  });
  writeChains.set(path, next.catch(() => void 0));
  await next;
}
function snapshotPath(ctx) {
  return join3(dataDir(ctx), "snapshots.json");
}
function pricesPath(ctx) {
  return join3(dataDir(ctx), "prices.json");
}
async function readSnapshotFile(ctx) {
  return readJson(snapshotPath(ctx), { routes: {} });
}
async function writeSnapshotFile(ctx, file) {
  await writeJson(snapshotPath(ctx), file);
}
async function readPriceFile(ctx) {
  return readJson(pricesPath(ctx), { routes: {} });
}
async function writePriceFile(ctx, file) {
  await writeJson(pricesPath(ctx), file);
}
async function readCacheStatus(ctx) {
  const dir = cacheDir(ctx);
  const [modelsDev, openrouter] = await Promise.all([
    readCacheEntry(dir, "models-dev.json"),
    readCacheEntry(dir, "openrouter-models.json")
  ]);
  return { modelsDev, openrouter };
}

// src/host/actions.ts
var PROTOCOLS = ["anthropic-messages", "openai-completions", "openai-responses", "google-generative-ai"];
var PROTOCOL_SUFFIX = {
  "anthropic-messages": "anthropic",
  "openai-completions": "chat",
  "openai-responses": "responses",
  "google-generative-ai": "gemini"
};
var PROTOCOL_LABEL = {
  "anthropic-messages": "Anthropic",
  "openai-completions": "Chat",
  "openai-responses": "Responses",
  "google-generative-ai": "Gemini"
};
var AUTO_INCLUDE_LIMIT = 80;
var SOURCE_MEMO_MS = 9e4;
var CLONE_CACHE_MS = 15 * 6e4;
function isProtocol(value) {
  return typeof value === "string" && PROTOCOLS.includes(value);
}
function routeIdOk(value) {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}
function effectiveConfig(ctx) {
  return llmDescriptor(ctx)?.value ?? {};
}
function userConfig(ctx) {
  return llmDescriptor(ctx)?.user ?? {};
}
function effectiveProfile(ctx, route) {
  return effectiveConfig(ctx).providers?.[route];
}
function userProfile(ctx, route) {
  return userConfig(ctx).providers?.[route];
}
function routeDirectory(ctx) {
  const rows = ctx.get("llm")?.listConfigurableProviders() ?? [];
  return new Map(rows.filter((row) => row.settingsNs === LLM_PI_AI_NS).map((row) => [row.provider, row]));
}
function isDeclared(ctx, route) {
  return routeDirectory(ctx).get(route)?.declared === true;
}
function userModels(ctx, route) {
  const models = userProfile(ctx, route)?.models;
  return Array.isArray(models) ? models.filter((model) => model !== null && typeof model === "object" && typeof model.id === "string") : [];
}
function apiKeyEnvOf(ctx, route) {
  const fromRoute = effectiveProfile(ctx, route)?.apiKeyEnv;
  if (typeof fromRoute === "string" && fromRoute.length > 0) return fromRoute;
  return deriveKeyRef(route);
}
async function resolveCredential(credentials, ref) {
  try {
    const hit = await credentials.resolve(ref);
    return typeof hit?.value === "string" && hit.value.length > 0 ? hit.value : void 0;
  } catch {
    return void 0;
  }
}
function cacheDirOf(ctx) {
  return join4(dataDir(ctx), "cache");
}
async function writeBindings(ctx, bindings) {
  const settings = ctx.get("settings");
  const ns = selfNamespace(ctx);
  if (settings === void 0 || ns === void 0) throw new RpcError("models-helper/unavailable", "the plugin settings namespace is unavailable");
  const ops = bindings.map((binding) => ({ op: "set", path: ["bindings", binding.route], value: binding }));
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const current = descriptor(ctx, ns);
      await settings.mutate(ns, ops, current?.revision);
      return;
    } catch (error) {
      lastError = error;
      if (!/changed since it was read/.test(errorText(error))) throw error;
    }
  }
  throw lastError;
}
var sourceMemo = /* @__PURE__ */ new Map();
function sourceKey(source) {
  return source.kind === "openrouter" ? "openrouter" : `models-dev:${source.provider}`;
}
async function loadSource(ctx, source, options = {}) {
  const key = sourceKey(source);
  if (options.memo !== void 0 && options.memo.has(key)) return options.memo.get(key);
  const force = options.force === true;
  if (!force) {
    const memo = sourceMemo.get(key);
    if (memo !== void 0 && Date.now() - memo.at < SOURCE_MEMO_MS) return memo.value;
  }
  const dir = cacheDirOf(ctx);
  let loaded;
  try {
    if (source.kind === "openrouter") {
      const snapshot2 = await readOpenRouter(dir, { force, signal: options.signal });
      loaded = {
        source,
        label: "OpenRouter API",
        models: snapshot2.models.filter((model) => model.api !== void 0 && isProtocol(model.api)),
        fetchedAt: snapshot2.fetchedAt,
        online: snapshot2.online,
        ...snapshot2.staleReason === void 0 ? {} : { staleReason: snapshot2.staleReason }
      };
    } else {
      const doc = await readModelsDev(dir, { force, signal: options.signal });
      const entry = doc.provider(source.provider);
      if (entry === void 0) {
        throw new RpcError("models-helper/source-missing", `models.dev 中没有供应商 "${source.provider}"`, { provider: source.provider });
      }
      loaded = {
        source,
        label: entry.name ?? source.provider,
        models: entry.models.filter((model) => model.api !== void 0 && isProtocol(model.api)),
        fetchedAt: doc.fetchedAt,
        online: doc.online,
        ...doc.staleReason === void 0 ? {} : { staleReason: doc.staleReason }
      };
    }
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw new RpcError("models-helper/source-failed", `获取来源数据失败：${errorText(error)}`);
  }
  sourceMemo.set(key, { at: Date.now(), value: loaded });
  options.memo?.set(key, loaded);
  return loaded;
}
function groupSourceModels(models, api, baseURL) {
  const target = normalizeBaseURL(api, baseURL);
  return models.filter((model) => model.api === api && normalizeBaseURL(api, model.baseURL) === target);
}
function groupTemplateModels(catalog, template, api, baseURL) {
  const target = normalizeBaseURL(api, baseURL);
  return catalog.models(template).filter((model) => model.api === api && (model.baseUrl === void 0 || normalizeBaseURL(api, model.baseUrl) === target));
}
async function tryCatalog(ctx) {
  try {
    return await loadTemplateCatalog(ctx);
  } catch {
    return void 0;
  }
}
function bindingView(binding) {
  return {
    route: binding.route,
    source: binding.source,
    template: binding.template,
    api: binding.api,
    baseURL: binding.baseURL,
    autoIncludeNew: binding.autoIncludeNew,
    ...binding.lastSync === void 0 ? {} : { lastSync: binding.lastSync },
    locked: [...binding.locks]
  };
}
async function helperStatus(ctx) {
  const effective = effectiveConfig(ctx);
  const directory = routeDirectory(ctx);
  const bindings = readBindings(ctx);
  const ids = /* @__PURE__ */ new Set([...Object.keys(effective.providers ?? {}), ...directory.keys()]);
  const routes = [];
  const routeKeyEnv = /* @__PURE__ */ new Map();
  for (const id of ids) routeKeyEnv.set(id, apiKeyEnvOf(ctx, id));
  for (const id of ids) {
    const profile = effective.providers?.[id];
    const entry = directory.get(id);
    const binding = bindings[id];
    const keyEnv = routeKeyEnv.get(id);
    const declared = entry?.declared === true;
    const sharedKeyWith = keyEnv === void 0 ? [] : [...ids].filter((other) => other !== id && routeKeyEnv.get(other) === keyEnv);
    routes.push({
      id,
      displayName: profile?.displayName ?? entry?.displayName ?? id,
      declared,
      ...keyEnv === void 0 ? {} : { apiKeyEnv: keyEnv },
      ...typeof profile?.api === "string" ? { api: profile.api } : {},
      ...typeof profile?.baseURL === "string" ? { baseURL: profile.baseURL } : {},
      modelCount: Array.isArray(profile?.models) ? profile.models.length : 0,
      bound: binding !== void 0,
      ...binding === void 0 ? {} : { binding: bindingView(binding) },
      ...sharedKeyWith.length > 0 ? { sharedKeyWith } : {}
    });
  }
  const catalog = await tryCatalog(ctx);
  const template = catalog === void 0 ? { error: "已安装的 pi-ai 目录不可用" } : { ...catalog.version === void 0 ? {} : { version: catalog.version }, providers: catalog.providers() };
  let defaultSelection;
  try {
    const current = ctx.get("agentDefaultModel")?.currentSelection();
    if (current !== void 0) {
      defaultSelection = {
        provider: current.provider,
        model: current.model,
        ...current.reasoningEffort === void 0 ? {} : { reasoningEffort: String(current.reasoningEffort) }
      };
    }
  } catch {
  }
  const llm = llmDescriptor(ctx);
  return {
    routes,
    bindings: Object.values(bindings).map(bindingView),
    template,
    ...defaultSelection === void 0 ? {} : { defaultSelection },
    cache: await readCacheStatus(ctx),
    ...llm?.revision === void 0 ? {} : { llmRevision: llm.revision }
  };
}
var clonePlans = /* @__PURE__ */ new Map();
function cloneCacheKey(provider, source) {
  return `${provider}|${sourceKey(source)}`;
}
function draftGroups(sourceModels, templateModels) {
  const groups = /* @__PURE__ */ new Map();
  let skipped = 0;
  const add = (api, baseURL) => {
    const normalized = normalizeBaseURL(api, baseURL ?? "") ?? "";
    const key = `${api}\0${normalized}`;
    let group = groups.get(key);
    if (group === void 0) {
      group = { api, baseURL: normalized, sourceModels: [], templateModels: [] };
      groups.set(key, group);
    }
    return group;
  };
  for (const model of sourceModels) {
    if (!isProtocol(model.api)) {
      skipped += 1;
      continue;
    }
    add(model.api, model.baseURL).sourceModels.push(model);
  }
  for (const model of templateModels) {
    if (!isProtocol(model.api)) {
      skipped += 1;
      continue;
    }
    add(model.api, model.baseUrl).templateModels.push(model);
  }
  return { groups: [...groups.values()], skipped };
}
function uniqueId(base, used) {
  if (!used.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new RpcError("models-helper/route-id", `无法为 "${base}" 生成唯一的路由 id`);
}
async function clonePlan(ctx, args) {
  const provider = typeof args.provider === "string" ? args.provider : "";
  if (!routeIdOk(provider)) throw new RpcError("models-helper/bad-request", "provider 参数无效");
  const effective = effectiveConfig(ctx);
  if (effective.providers?.[provider] === void 0) throw new RpcError("models-helper/route-missing", `llm-pi-ai 中没有供应商 "${provider}"`);
  if (isDeclared(ctx, provider)) throw new RpcError("models-helper/not-builtin", `"${provider}" 是自定义供应商，不能克隆；请使用「绑定参数来源」`);
  const source = args.source === void 0 || args.source === null ? { kind: "models-dev", provider } : args.source;
  if (source.kind !== "models-dev" && source.kind !== "openrouter") throw new RpcError("models-helper/bad-request", "source 参数无效");
  if (source.kind === "models-dev" && !routeIdOk(source.provider)) throw new RpcError("models-helper/bad-request", "source.provider 参数无效");
  const catalog = await tryCatalog(ctx);
  if (catalog === void 0) throw new RpcError("models-helper/template-unavailable", "已安装的 pi-ai 目录不可用，无法读取模板");
  const templateModels = catalog.models(provider);
  if (templateModels.length === 0) throw new RpcError("models-helper/template-missing", `已安装目录中没有供应商 "${provider}"`);
  const loaded = await loadSource(ctx, source, { force: true });
  const drafted = draftGroups(loaded.models, templateModels);
  const drafts = drafted.groups.filter((group) => group.sourceModels.length > 0);
  const skipped = drafted.skipped + drafted.groups.length - drafts.length;
  if (drafts.length === 0) throw new RpcError("models-helper/no-groups", "来源数据中没有可用的协议分组");
  const usedIds = new Set(Object.keys(effective.providers ?? {}));
  const groups = drafts.map((draft) => {
    const plan2 = planGroup({ api: draft.api, sourceModels: draft.sourceModels, templateModels: draft.templateModels });
    const suffix = PROTOCOL_SUFFIX[draft.api];
    const suggestedId = uniqueId(`${provider}-${suffix}`, usedIds);
    usedIds.add(suggestedId);
    const displayName = effective.providers?.[provider]?.displayName ?? provider;
    return {
      api: draft.api,
      baseURL: draft.baseURL,
      suggestedId,
      suggestedName: `${displayName} · ${PROTOCOL_LABEL[draft.api]}`,
      autoIncludeNew: draft.sourceModels.length <= AUTO_INCLUDE_LIMIT,
      routeCompat: plan2.routeCompat,
      models: plan2.models,
      withheldCompat: plan2.withheldCompat,
      templateOnly: plan2.templateOnly,
      noTemplate: plan2.noTemplate
    };
  });
  groups.sort((a, b) => a.api === b.api ? a.baseURL.localeCompare(b.baseURL) : a.api.localeCompare(b.api));
  const plan = {
    provider,
    source,
    sourceName: loaded.label,
    fetchedAt: iso(loaded.fetchedAt),
    online: loaded.online,
    ...loaded.staleReason === void 0 ? {} : { staleReason: loaded.staleReason },
    ...catalog.version === void 0 ? {} : { templateVersion: catalog.version },
    groups,
    ...skipped > 0 ? { warnings: [`skipped-groups:${skipped}`] } : { warnings: [] }
  };
  clonePlans.set(cloneCacheKey(provider, source), {
    plan,
    source: loaded,
    originalDisplayName: effective.providers?.[provider]?.displayName ?? provider,
    createdAt: Date.now()
  });
  return plan;
}
async function cloneApply(ctx, args) {
  if (typeof args.provider !== "string" || !Array.isArray(args.groups)) throw new RpcError("models-helper/bad-request", "参数无效");
  const cached2 = clonePlans.get(cloneCacheKey(args.provider, args.source));
  if (cached2 === void 0 || Date.now() - cached2.createdAt > CLONE_CACHE_MS) {
    throw new RpcError("models-helper/plan-expired", "克隆计划已过期，请重新打开克隆向导");
  }
  if (args.groups.length === 0) throw new RpcError("models-helper/bad-request", "至少选择一个协议组");
  const settings = ctx.get("settings");
  const llm = llmDescriptor(ctx);
  if (settings === void 0 || llm === void 0) throw new RpcError("models-helper/unavailable", "settings 服务不可用");
  const existing = new Set(Object.keys(effectiveConfig(ctx).providers ?? {}));
  const usedIds = /* @__PURE__ */ new Set();
  const writes = [];
  for (const choice of args.groups) {
    const group = cached2.plan.groups.find((candidate) => candidate.api === choice.api && candidate.baseURL === choice.baseURL);
    if (group === void 0) throw new RpcError("models-helper/bad-request", "协议组与克隆计划不匹配，请重新打开向导");
    if (typeof choice.routeId !== "string" || !routeIdOk(choice.routeId)) throw new RpcError("models-helper/bad-request", `路由 id 无效：${String(choice.routeId)}`);
    if (existing.has(choice.routeId) || usedIds.has(choice.routeId)) throw new RpcError("models-helper/route-exists", `路由 id 已存在：${choice.routeId}`);
    usedIds.add(choice.routeId);
    const wanted = new Set(Array.isArray(choice.modelIds) ? choice.modelIds.filter((id) => typeof id === "string") : []);
    const models = group.models.filter((model) => wanted.has(model.id)).map((model) => ({ id: model.id, ...definedFields(model.fields) }));
    if (models.length === 0) throw new RpcError("models-helper/bad-request", "每个协议组至少选择一个模型");
    writes.push({ choice, group, models });
  }
  const credentials = ctx.get("credentials");
  const sourceKey2 = credentials === void 0 ? void 0 : await resolveCredential(credentials, apiKeyEnvOf(ctx, args.provider) ?? "");
  const keys = [];
  const copiedRefs = [];
  for (const { choice } of writes) {
    const ref = deriveKeyRef(choice.routeId);
    if (credentials === void 0) {
      keys.push({ route: choice.routeId, ref, status: "unavailable" });
      continue;
    }
    if (sourceKey2 === void 0) {
      keys.push({ route: choice.routeId, ref, status: "source-missing" });
      continue;
    }
    try {
      await credentials.set(ref, sourceKey2);
      copiedRefs.push(ref);
      keys.push({ route: choice.routeId, ref, status: "copied" });
    } catch {
      keys.push({ route: choice.routeId, ref, status: "copy-failed" });
    }
  }
  const keyByRoute = new Map(keys.map((key) => [key.route, key]));
  const ops = writes.map(({ choice, group, models }) => {
    const route = {
      displayName: typeof choice.displayName === "string" && choice.displayName.trim().length > 0 ? choice.displayName.trim() : group.suggestedName,
      api: group.api,
      baseURL: group.baseURL,
      models
    };
    const key = keyByRoute.get(choice.routeId);
    if (key?.status === "copied") route.apiKeyEnv = key.ref;
    if (Object.keys(group.routeCompat).length > 0) route.compat = group.routeCompat;
    return { op: "set", path: ["providers", choice.routeId], value: route };
  });
  try {
    await settings.mutate(LLM_PI_AI_NS, ops, llm.revision);
  } catch (error) {
    if (credentials !== void 0) {
      for (const ref of copiedRefs) await credentials.unset(ref).catch(() => void 0);
    }
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError("models-helper/revision", "模型配置已被其他窗口修改，请重新打开克隆向导", { reason: errorText(error) });
    }
    throw new RpcError("models-helper/write-failed", `写入 llm-pi-ai 失败：${errorText(error)}`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const bindings = writes.map(({ choice, group }) => ({
    route: choice.routeId,
    source: cached2.plan.source,
    template: args.provider,
    api: group.api,
    baseURL: group.baseURL,
    autoIncludeNew: choice.autoIncludeNew === true,
    ...cached2.plan.online ? { lastSync: now } : {},
    locks: [],
    priceOverrides: {}
  }));
  await writeBindings(ctx, bindings);
  const snapshots = await readSnapshotFile(ctx);
  const prices = await readPriceFile(ctx);
  for (const { choice, group } of writes) {
    const models = {};
    for (const model of group.models) models[model.id] = definedFields(model.fields);
    snapshots.routes[choice.routeId] = { at: now, models };
    const priceModels = {};
    for (const model of group.models) {
      if (model.price !== void 0) priceModels[model.id] = model.price;
    }
    prices.routes[choice.routeId] = {
      fetchedAt: cached2.plan.fetchedAt,
      online: cached2.plan.online,
      ...cached2.plan.staleReason === void 0 ? {} : { staleReason: cached2.plan.staleReason },
      models: priceModels
    };
  }
  await writeSnapshotFile(ctx, snapshots);
  await writePriceFile(ctx, prices);
  const warnings = [];
  const result = { routes: writes.map((entry) => entry.choice.routeId), keys, warnings };
  const selection = ctx.get("agentDefaultModel")?.currentSelection();
  if (selection !== void 0 && selection.provider === args.provider) {
    const target = writes.find((entry) => entry.group.models.some((model) => model.id === selection.model));
    if (target !== void 0) {
      result.defaultSuggestion = {
        provider: target.choice.routeId,
        model: selection.model,
        ...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: String(selection.reasoningEffort) }
      };
    }
  }
  clonePlans.delete(cloneCacheKey(args.provider, args.source));
  return result;
}
async function bindOptions(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  if (!routeIdOk(route)) throw new RpcError("models-helper/bad-request", "route 参数无效");
  const profile = effectiveProfile(ctx, route);
  if (profile === void 0) throw new RpcError("models-helper/route-missing", `llm-pi-ai 中没有供应商 "${route}"`);
  if (!isDeclared(ctx, route)) throw new RpcError("models-helper/not-declared", `"${route}" 是内置供应商；内置路由不支持绑定，请先克隆`);
  if (readBindings(ctx)[route] !== void 0) throw new RpcError("models-helper/already-bound", `"${route}" 已绑定参数来源`);
  const api = isProtocol(profile.api) ? profile.api : void 0;
  const baseURL = typeof profile.baseURL === "string" ? profile.baseURL : void 0;
  if (api === void 0 || baseURL === void 0) throw new RpcError("models-helper/not-declared", "该路由缺少 api 或 baseURL，无法匹配来源");
  const doc = await readModelsDev(cacheDirOf(ctx), { force: true });
  const sources = [];
  for (const providerId of doc.providerIds) {
    const entry = doc.provider(providerId);
    if (entry === void 0) continue;
    const count = groupSourceModels(entry.models, api, baseURL).length;
    if (count > 0) sources.push({ source: { kind: "models-dev", provider: providerId }, label: entry.name ?? providerId, modelCount: count });
  }
  sources.sort((a, b) => b.modelCount - a.modelCount);
  if (api === "openai-completions" && (baseURL.includes("openrouter.ai") || route === "openrouter")) {
    const openrouter = await loadSource(ctx, { kind: "openrouter" }, { force: false });
    const count = groupSourceModels(openrouter.models, api, baseURL).length;
    if (count > 0) sources.unshift({ source: { kind: "openrouter" }, label: "OpenRouter API", modelCount: count });
  }
  if (sources.length === 0) throw new RpcError("models-helper/no-source", "没有找到与该路由协议组匹配的来源；请检查 api 与 baseURL");
  const catalog = await tryCatalog(ctx);
  const templates = [];
  if (catalog !== void 0) {
    for (const providerId of catalog.providers()) {
      if (groupTemplateModels(catalog, providerId, api, baseURL).length > 0) templates.push(providerId);
    }
    if (templates.length === 0) {
      for (const providerId of catalog.providers()) {
        if (catalog.models(providerId).some((model) => model.api === api)) templates.push(providerId);
      }
    }
  }
  return { route, api, baseURL, sources, templates };
}
async function bindingBind(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  const option = args.option;
  if (!routeIdOk(route) || option === void 0) throw new RpcError("models-helper/bad-request", "参数无效");
  const profile = effectiveProfile(ctx, route);
  if (profile === void 0) throw new RpcError("models-helper/route-missing", `llm-pi-ai 中没有供应商 "${route}"`);
  if (!isDeclared(ctx, route)) throw new RpcError("models-helper/not-declared", "内置路由不支持绑定");
  if (readBindings(ctx)[route] !== void 0) throw new RpcError("models-helper/already-bound", "该路由已绑定参数来源");
  const api = isProtocol(option.api) ? option.api : void 0;
  if (api === void 0 || typeof option.baseURL !== "string" || typeof option.template !== "string") throw new RpcError("models-helper/bad-request", "绑定参数无效");
  if (profile.api !== void 0 && profile.api !== api) throw new RpcError("models-helper/bad-request", "绑定的协议与路由的 api 不一致");
  const binding = {
    route,
    source: option.source,
    template: option.template,
    api,
    baseURL: option.baseURL,
    autoIncludeNew: false,
    locks: [],
    priceOverrides: {}
  };
  const checked = await checkBinding(ctx, binding, { force: false });
  binding.autoIncludeNew = checked.plan.models.length <= AUTO_INCLUDE_LIMIT;
  await writeBinding(ctx, binding);
  recentDiffs.set(route, checked.context);
  await writePriceFile(ctx, checked.prices);
  return { binding: bindingView(binding), diff: checked.diff };
}
var recentDiffs = /* @__PURE__ */ new Map();
async function checkBinding(ctx, binding, options) {
  const llm = llmDescriptor(ctx);
  if (llm === void 0) throw new RpcError("models-helper/unavailable", "llm-pi-ai settings 不可用");
  const revision = llm.revision;
  const base = {
    route: binding.route,
    source: binding.source,
    template: binding.template,
    api: binding.api,
    baseURL: binding.baseURL,
    revision,
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    online: false,
    added: [],
    candidates: [],
    updates: [],
    conflicts: [],
    removed: [],
    priceChanges: [],
    locked: [...binding.locks]
  };
  const profile = effectiveProfile(ctx, binding.route);
  if (profile === void 0) {
    return {
      plan: { models: [] },
      diff: { ...base, error: "路由已不存在（可能已被删除）" },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} }
    };
  }
  let loaded;
  try {
    loaded = await loadSource(ctx, binding.source, { force: options.force !== false, ...options.memo === void 0 ? {} : { memo: options.memo } });
  } catch (error) {
    return {
      plan: { models: [] },
      diff: { ...base, error: errorText(error) },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} }
    };
  }
  const sourceModels = groupSourceModels(loaded.models, binding.api, binding.baseURL);
  if (sourceModels.length === 0) {
    return {
      plan: { models: [] },
      diff: { ...base, fetchedAt: iso(loaded.fetchedAt), online: loaded.online, ...loaded.staleReason === void 0 ? {} : { staleReason: loaded.staleReason }, error: "来源中没有与该协议组匹配的模型" },
      context: { binding, desired: [], currentRaw: [], revision, diff: { added: [], candidates: [], updates: [], conflicts: [], removed: [] } },
      prices: options.prices ?? { routes: {} }
    };
  }
  const catalog = options.catalog ?? await tryCatalog(ctx);
  const templateModels = catalog === void 0 ? [] : groupTemplateModels(catalog, binding.template, binding.api, binding.baseURL);
  const plan = planGroup({ api: binding.api, sourceModels, templateModels });
  if (catalog === void 0) base.warning = "template-missing";
  const snapshot2 = options.snapshot ?? await readSnapshotFile(ctx);
  const prices = options.prices ?? await readPriceFile(ctx);
  const currentRaw = userModels(ctx, binding.route);
  const computed = computeDiff({
    desired: plan.models,
    current: currentRaw,
    snapshot: snapshot2.routes[binding.route],
    locks: binding.locks,
    autoIncludeNew: binding.autoIncludeNew
  });
  const oldPrices = prices.routes[binding.route]?.models ?? {};
  const nextPrices = {};
  const priceChanges = [];
  for (const model of plan.models) {
    const price = model.price;
    if (price === void 0) continue;
    nextPrices[model.id] = price;
    const old = oldPrices[model.id];
    if (old !== void 0 && !deepEqual2(old, price)) {
      priceChanges.push({ id: model.id, old, new: price, overridden: binding.priceOverrides[model.id] !== void 0 });
    }
  }
  const nextPricesFile = {
    routes: {
      ...prices.routes,
      [binding.route]: {
        fetchedAt: iso(loaded.fetchedAt),
        online: loaded.online,
        ...loaded.staleReason === void 0 ? {} : { staleReason: loaded.staleReason },
        models: nextPrices
      }
    }
  };
  const diff = {
    ...base,
    fetchedAt: iso(loaded.fetchedAt),
    online: loaded.online,
    ...loaded.staleReason === void 0 ? {} : { staleReason: loaded.staleReason },
    added: computed.added,
    candidates: computed.candidates,
    updates: computed.updates,
    conflicts: computed.conflicts,
    removed: computed.removed,
    priceChanges
  };
  const context = { binding, desired: plan.models, currentRaw, revision, diff: computed };
  if (loaded.online) {
    binding.lastSync = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await writeBinding(ctx, binding);
    } catch (error) {
      ctx.logger.warn("models-helper: cannot record last sync for %s: %s", binding.route, errorText(error));
    }
  }
  return { plan, diff, context, prices: nextPricesFile };
}
async function bindingDiff(ctx, args) {
  const bindings = readBindings(ctx);
  const routeFilter = typeof args.route === "string" ? args.route : void 0;
  if (routeFilter !== void 0 && bindings[routeFilter] === void 0) {
    throw new RpcError("models-helper/not-bound", `"${routeFilter}" 尚未绑定参数来源`);
  }
  const routes = routeFilter === void 0 ? Object.keys(bindings) : [routeFilter];
  const memo = /* @__PURE__ */ new Map();
  const snapshot2 = await readSnapshotFile(ctx);
  const prices = await readPriceFile(ctx);
  const catalog = await tryCatalog(ctx);
  const results = [];
  for (const route of routes) {
    const binding = bindings[route];
    if (binding === void 0) continue;
    const checked = await checkBinding(ctx, binding, { memo, snapshot: snapshot2, prices, catalog });
    if (checked.diff.error === void 0) {
      recentDiffs.set(route, checked.context);
      const entry = checked.prices.routes[route];
      if (entry !== void 0) prices.routes[route] = entry;
    }
    results.push(checked.diff);
  }
  await writePriceFile(ctx, prices);
  return { results };
}
var APPLY_FIELDS = new Set(MODEL_FIELDS);
async function bindingApply(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  const context = recentDiffs.get(route);
  if (context === void 0) throw new RpcError("models-helper/refresh-required", "差异已失效，请重新检查更新");
  if (args.revision !== context.revision) throw new RpcError("models-helper/revision", "配置已被其他窗口修改，请重新检查更新");
  if (!Array.isArray(args.selection) || args.selection.length === 0) throw new RpcError("models-helper/bad-request", "没有选中要应用的项");
  const settings = ctx.get("settings");
  if (settings === void 0) throw new RpcError("models-helper/unavailable", "settings 服务不可用");
  const desiredById = new Map(context.desired.map((model) => [model.id, model]));
  const removed = /* @__PURE__ */ new Set();
  const additions = [];
  const updates = [];
  for (const item of args.selection) {
    if (typeof item.id !== "string") continue;
    if (item.mode === "remove") {
      removed.add(item.id);
      continue;
    }
    if (item.mode === "add") {
      const desired = desiredById.get(item.id);
      if (desired === void 0) continue;
      additions.push({ id: desired.id, ...definedFields(desired.fields) });
      continue;
    }
    const fields = Array.isArray(item.fields) ? item.fields.filter((field) => APPLY_FIELDS.has(field)) : [];
    if (fields.length > 0) updates.push({ id: item.id, fields });
  }
  const models = context.currentRaw.filter((model) => !removed.has(model.id)).map((model) => cloneJson(model));
  const byId = new Map(models.map((model) => [model.id, model]));
  for (const addition of additions) {
    if (byId.has(addition.id)) continue;
    models.push(addition);
    byId.set(addition.id, addition);
  }
  for (const update of updates) {
    const entry = byId.get(update.id);
    const desired = desiredById.get(update.id);
    if (entry === void 0 || desired === void 0) continue;
    for (const field of update.fields) {
      const value = desired.fields[field];
      if (value === void 0) delete entry[field];
      else entry[field] = value;
    }
  }
  if (models.length === 0) throw new RpcError("models-helper/empty-route", "应用后路由将没有任何模型，已取消");
  try {
    await settings.mutate(LLM_PI_AI_NS, [{ op: "set", path: ["providers", route, "models"], value: models }], context.revision);
  } catch (error) {
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError("models-helper/revision", "配置已被其他窗口修改，请重新检查更新", { reason: errorText(error) });
    }
    throw new RpcError("models-helper/write-failed", `写入失败：${errorText(error)}`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const snapshots = await readSnapshotFile(ctx);
  const snapshotModels = {};
  for (const model of models) snapshotModels[model.id] = definedFields(modelFieldsOf(model));
  snapshots.routes[route] = { at: now, models: snapshotModels };
  await writeSnapshotFile(ctx, snapshots);
  recentDiffs.delete(route);
  const revision = llmDescriptor(ctx)?.revision ?? context.revision + 1;
  return { route, changed: args.selection.length, revision };
}
async function bindingLock(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  const bindings = readBindings(ctx);
  const binding = bindings[route];
  if (binding === void 0) throw new RpcError("models-helper/not-bound", `"${route}" 尚未绑定参数来源`);
  if (typeof args.model !== "string" || !APPLY_FIELDS.has(args.field)) throw new RpcError("models-helper/bad-request", "锁参数无效");
  const key = lockKey(args.model, args.field);
  const locks = new Set(binding.locks);
  if (args.locked) locks.add(key);
  else locks.delete(key);
  binding.locks = [...locks].sort();
  await writeBinding(ctx, binding);
  recentDiffs.delete(route);
  return { locked: binding.locks };
}
async function bindingUnbind(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  if (readBindings(ctx)[route] === void 0) throw new RpcError("models-helper/not-bound", `"${route}" 尚未绑定参数来源`);
  await removeBinding(ctx, route);
  const snapshots = await readSnapshotFile(ctx);
  delete snapshots.routes[route];
  await writeSnapshotFile(ctx, snapshots);
  const prices = await readPriceFile(ctx);
  delete prices.routes[route];
  await writePriceFile(ctx, prices);
  recentDiffs.delete(route);
  return {};
}
async function separateKey(ctx, args) {
  const route = typeof args.route === "string" ? args.route : "";
  if (!routeIdOk(route)) throw new RpcError("models-helper/bad-request", "route 参数无效");
  if (!isDeclared(ctx, route)) throw new RpcError("models-helper/not-declared", "只有自定义供应商才能拆分密钥引用");
  const settings = ctx.get("settings");
  const llm = llmDescriptor(ctx);
  const credentials = ctx.get("credentials");
  if (settings === void 0 || llm === void 0) throw new RpcError("models-helper/unavailable", "settings 服务不可用");
  if (credentials === void 0) throw new RpcError("models-helper/unavailable", "credentials 服务不可用");
  const currentRef = apiKeyEnvOf(ctx, route);
  const targetRef = deriveKeyRef(route);
  if (currentRef === targetRef) return { ref: targetRef, copied: false };
  const value = currentRef === void 0 ? void 0 : await resolveCredential(credentials, currentRef);
  if (value === void 0) {
    throw new RpcError("models-helper/key-missing", `无法读取 ${currentRef ?? "当前"} 的密钥；请先在模型页为这个路由填写 API key`);
  }
  try {
    await credentials.set(targetRef, value);
  } catch (error) {
    throw new RpcError("models-helper/key-copy-failed", `复制密钥失败：${errorText(error)}`);
  }
  try {
    await settings.mutate(LLM_PI_AI_NS, [{ op: "set", path: ["providers", route, "apiKeyEnv"], value: targetRef }], llm.revision);
  } catch (error) {
    await credentials.unset(targetRef).catch(() => void 0);
    if (/changed since it was read/.test(errorText(error))) {
      throw new RpcError("models-helper/revision", "模型配置已被其他窗口修改，请重试", { reason: errorText(error) });
    }
    throw new RpcError("models-helper/write-failed", `写入 llm-pi-ai 失败：${errorText(error)}`);
  }
  return { ref: targetRef, copied: true };
}
async function cacheRefresh(ctx) {
  const dir = cacheDirOf(ctx);
  const reasons = [];
  let online = true;
  try {
    const doc = await readModelsDev(dir, { force: true });
    if (!doc.online) {
      online = false;
      reasons.push(doc.staleReason ?? "models.dev 未在线获取");
    }
  } catch (error) {
    online = false;
    reasons.push(errorText(error));
  }
  try {
    const snapshot2 = await readOpenRouter(dir, { force: true });
    if (!snapshot2.online) {
      online = false;
      reasons.push(snapshot2.staleReason ?? "OpenRouter 未在线获取");
    }
  } catch (error) {
    online = false;
    reasons.push(errorText(error));
  }
  return {
    cache: await readCacheStatus(ctx),
    online,
    ...reasons.length === 0 ? {} : { staleReason: reasons.join("；") }
  };
}
async function useDefaultModel(ctx, args) {
  const service = ctx.get("agentDefaultModel");
  if (service === void 0) throw new RpcError("models-helper/default-model-unavailable", "agentDefaultModel 服务不可用");
  if (typeof args.provider !== "string" || typeof args.model !== "string") throw new RpcError("models-helper/bad-request", "参数无效");
  await service.saveSelection({
    provider: args.provider,
    model: args.model,
    ...args.reasoningEffort === void 0 ? {} : { reasoningEffort: args.reasoningEffort }
  });
  return { applied: true };
}

// src/host/index.ts
var name = "dsh-models-helper";
var Config = Schema.object({
  bindings: Schema.dict(Schema.any()).default({}).volatile().description("Custom pi-ai routes bound to a metadata source, keyed by route id.")
});
function apply(ctx) {
  ctx.effect(() => () => {
    resetTemplateCatalog();
  }, "models-helper: template cache");
  ctx.inject(["connection"], (scoped) => {
    const connection = scoped.get("connection");
    if (connection === void 0) return;
    const dispose = registerRpc(connection, {
      "helper.status": () => helperStatus(ctx),
      "cache.refresh": () => cacheRefresh(ctx),
      "clone.plan": (args) => clonePlan(ctx, args),
      "clone.apply": (args) => cloneApply(ctx, args),
      "bind.options": (args) => bindOptions(ctx, args),
      "binding.bind": (args) => bindingBind(ctx, args),
      "binding.diff": (args) => bindingDiff(ctx, args),
      "binding.apply": (args) => bindingApply(ctx, args),
      "binding.lock": (args) => bindingLock(ctx, args),
      "binding.unbind": (args) => bindingUnbind(ctx, args),
      "route.separateKey": (args) => separateKey(ctx, args),
      "defaultModel.use": (args) => useDefaultModel(ctx, args)
    }, ctx.logger);
    scoped.effect(() => dispose, "models-helper: rpc route");
  });
}
export {
  Config,
  apply,
  name
};
