'use strict';

var array = [].constructor;

/**
 * @ngdoc function
 * @name angular.toJson
 * @function
 *
 * @description
 * Serializes input into a JSON-formatted string.
 *
 * @param {Object|Array|Date|string|number} obj Input to be serialized into JSON.
 * @param {boolean=} pretty If set to true, the JSON output will contain newlines and whitespace.
 * @returns {string} Jsonified string representing `obj`.
 */
function toJson(obj, pretty) {
  var buf = [];
  toJsonArray(buf, obj, pretty ? "\n  " : null, []);
  return buf.join('');
}

/**
 * @ngdoc function
 * @name angular.fromJson
 * @function
 *
 * @description
 * Deserializes a JSON string.
 *
 * @param {string} json JSON string to deserialize.
 * @param {boolean} [useNative=false] Use native JSON parser, if available.
 * @returns {Object|Array|Date|string|number} Deserialized thingy.
 */
function fromJson(json, useNative) {
  if (!isString(json)) return json;

  var obj;

  if (useNative && window.JSON && window.JSON.parse) {
    obj = JSON.parse(json);
  } else {
    obj = parseJson(json, true)();
  }
  return transformDates(obj);

  // TODO make forEach optionally recursive and remove this function
  // TODO(misko): remove this once the $http service is checked in.
  function transformDates(obj) {
    if (isString(obj) && 15 <= obj.length && obj.length <= 24) {
      return jsonStringToDate(obj);
    } else if (isArray(obj) || isObject(obj)) {
      forEach(obj, function(val, name) {
        obj[name] = transformDates(val);
      });
    }
    return obj;
  }
}

var R_ISO8061_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?:\:?(\d\d)(?:\:?(\d\d)(?:\.(\d{3}))?)?)?(Z|([+-])(\d\d):?(\d\d)))?$/;
function jsonStringToDate(string){
  var match;
  if (match = string.match(R_ISO8061_STR)) {
    var date = new Date(0),
        tzHour = 0,
        tzMin  = 0;
    if (match[9]) {
      tzHour = int(match[9] + match[10]);
      tzMin = int(match[9] + match[11]);
    }
    date.setUTCFullYear(int(match[1]), int(match[2]) - 1, int(match[3]));
    date.setUTCHours(int(match[4]||0) - tzHour, int(match[5]||0) - tzMin, int(match[6]||0), int(match[7]||0));
    return date;
  }
  return string;
}

function jsonDateToString(date){
  if (!date) return date;
  var isoString = date.toISOString ? date.toISOString() : '';
  return (isoString.length==24)
    ? isoString
    : padNumber(date.getUTCFullYear(), 4) + '-' +
      padNumber(date.getUTCMonth() + 1, 2) + '-' +
      padNumber(date.getUTCDate(), 2) + 'T' +
      padNumber(date.getUTCHours(), 2) + ':' +
      padNumber(date.getUTCMinutes(), 2) + ':' +
      padNumber(date.getUTCSeconds(), 2) + '.' +
      padNumber(date.getUTCMilliseconds(), 3) + 'Z';
}

function quoteUnicode(string) {
    var chars = ['"'];
    for ( var i = 0; i < string.length; i++) {
      var code = string.charCodeAt(i);
      var ch = string.charAt(i);
      switch(ch) {
        case '"': chars.push('\\"'); break;
        case '\\': chars.push('\\\\'); break;
        case '\n': chars.push('\\n'); break;
        case '\f': chars.push('\\f'); break;
        case '\r': chars.push(ch = '\\r'); break;
        case '\t': chars.push(ch = '\\t'); break;
        default:
          if (32 <= code && code <= 126) {
            chars.push(ch);
          } else {
            var encode = "000" + code.toString(16);
            chars.push("\\u" + encode.substring(encode.length - 4));
          }
      }
    }
    chars.push('"');
    return chars.join('');
  }


function toJsonArray(buf, obj, pretty, stack) {
  if (isObject(obj)) {
    if (obj === window) {
      buf.push('WINDOW');
      return;
    }

    if (obj === document) {
      buf.push('DOCUMENT');
      return;
    }

    if (includes(stack, obj)) {
      buf.push('RECURSION');
      return;
    }
    stack.push(obj);
  }
  if (obj === null) {
    buf.push('null');
  } else if (obj instanceof RegExp) {
    buf.push(quoteUnicode(obj.toString()));
  } else if (isFunction(obj)) {
    return;
  } else if (isBoolean(obj)) {
    buf.push('' + obj);
  } else if (isNumber(obj)) {
    if (isNaN(obj)) {
      buf.push('null');
    } else {
      buf.push('' + obj);
    }
  } else if (isString(obj)) {
    return buf.push(quoteUnicode(obj));
  } else if (isObject(obj)) {
    if (isArray(obj)) {
      buf.push("[");
      var len = obj.length;
      var sep = false;
      for(var i=0; i<len; i++) {
        var item = obj[i];
        if (sep) buf.push(",");
        if (!(item instanceof RegExp) && (isFunction(item) || isUndefined(item))) {
          buf.push('null');
        } else {
          toJsonArray(buf, item, pretty, stack);
        }
        sep = true;
      }
      buf.push("]");
    } else if (isElement(obj)) {
      // TODO(misko): maybe in dev mode have a better error reporting?
      buf.push('DOM_ELEMENT');
    } else if (isDate(obj)) {
      buf.push(quoteUnicode(jsonDateToString(obj)));
    } else {
      buf.push("{");
      if (pretty) buf.push(pretty);
      var comma = false;
      var childPretty = pretty ? pretty + "  " : false;
      var keys = [];
      for(var k in obj) {
        if (k!='this' && k!='$parent' && k.substring(0,2) != '$$' && obj.hasOwnProperty(k) && obj[k] !== undefined) {
          keys.push(k);
        }
      }
      keys.sort();
      for ( var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
        var key = keys[keyIndex];
        var value = obj[key];
        if (!isFunction(value)) {
          if (comma) {
            buf.push(",");
            if (pretty) buf.push(pretty);
          }
          buf.push(quoteUnicode(key));
          buf.push(":");
          toJsonArray(buf, value, childPretty, stack);
          comma = true;
        }
      }
      buf.push("}");
    }
  }
  if (isObject(obj)) {
    stack.pop();
  }
}
