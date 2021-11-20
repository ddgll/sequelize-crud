const isString = require('lodash').isString
const moment = require('moment')
const isValidNumber = require('libphonenumber-js').isValidNumber

module.exports = {
  /**
   * 
   * 
   * @param {*} n 
   * @param {*} options 
   * @returns 
   */
  integer: (n, options) => {
    if (isNaN(n)) return false
    if (n % 1 !== 0) return false
    if (options && options.min && n < options.min) return false
    if (options && options.max && n > options.max) return false
    return true
  },
  boolean: (n) => {
    return n === true || n === false
  },
  float: (n, options) => {
    if (isNaN(n)) return false
    if (options && options.min && n < options.min) return false
    if (options && options.max && n > options.max) return false
    return true
  },
  string: (s, options) => {
    if (!isString(s)) return false
    if (options && options.min && s.length < options.min) return false
    if (options && options.max && s.length > options.max) return false
    return true
  },
  phone: (n) => {
    const number = '+' + n.replace(/^00/, '').replace('/\+/', '')
    return number.match(/^\+[0-9]+$/) ? isValidNumber(number) : false
  },
  enum: (s, options) => options && options.values && options.values.length ? options.values.indexOf(s) > -1 : false,
  date: (s, options) => {
    const d = moment(s, options && options.format ? options.format : 'YYYY-MM-DD', true)
    if (!d.isValid()) return false
    if (options && options.min && d.isBefore(moment(options.min))) return false
    if (options && options.max && d.isAfter(moment(options.min))) return false
    return true
  },
  time: (s, options) => {
    const d = moment.unix(s)
    if (!d.isValid()) return false
    if (options && options.min && s < options.min) return false
    if (options && options.max && s > options.max) return false
  },
  datetime: (s, options) => {
    const d = moment(s, options.format ? options.format : 'YYYY-MM-DD HH:mm:ss', true)
    if (!d.isValid()) return false
    if (options && options.min && d.isBefore(moment(options.min))) return false
    if (options && options.max && d.isAfter(moment(options.min))) return false
    return true
  },
  array: (s, options) => {
    if (Array.isArray(s)) {
      if (options && options.type && this[options.type]) {
        const bads = s.filter(v => this[options.type](v, options))
        return !bads || bads.length === 0
      }
      return true
    }
    return false
  },
  regexp: (s, options) => {
    if (!options) return false
    const regexp = new RegExp(options.pattern)
    return regexp.test(s)
  },
  email: (s) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(s),
  json: (s) => {
    try {
      JSON.parse(s)
      return true
    } catch (e) {
      return false
    }
  },
  object: (s) => typeof s === "object"
}