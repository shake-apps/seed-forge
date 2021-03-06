/**
 * Dependencies.
 */

var Emitter = require('evts');
var merge = require('super');
var inherits = merge.inherits;
var filtr = require('filtr');
var cyclop = require('cyclop');
var factories = require('./factories')
var clone = merge;

/**
 * The core factory class.
 *
 * @param {Function} Seed model
 * @constructor
 */

function Factory(Model) {
  Emitter.call(this);
  this.Model = Model;
  this.attributes = {};
  this.i = 0;
}

inherits(Factory, Emitter);

/**
 * Set a value for an attribute.
 *
 * @param {String} name
 * @param {Mixed} value
 * @returns `this`
 * @api public
 */

Factory.prototype.set = function(name, value) {
  this.attributes[name] = value;
  return this;
};

Factory.prototype.hook = function(key, fn) {
  this.on(key, fn);
  return this;
};

/**
 * Set a pre:build hook.
 *
 * @param {Function} fn
 * @returns `this`
 * @api public
 * @depreciated
 */

Factory.prototype.before = function(fn) {
  return this.hook('pre:build', fn);
};

/**
 * Set an post:save hook.
 *
 * @param {Function} fn
 * @returns `this`
 * @api public
 * @depreciated
 */

Factory.prototype.after = function(fn) {
  // maintain compat with old versions
  return this.hook('post:save', function(obj, next) {
    fn(next);
  });
};

/**
 * Build and save a factory.
 *
 * @param {Object} custom attributes [optional]
 * @param {Function} callback
 * @api public
 */

Factory.prototype.create = function(attrs, fn) {
  var self = this;

  this.emit('pre:build', function(err) {
    if (err) return fn(err);
    var obj = self.build(attrs)
    self.emit('pre:save', obj, function(err) {
      if (err) return fn(err);
      obj.save(function (err) {
        if (err) return fn(err);
        self.emit('post:save', obj, function(err) {
          if (err) return fn(err);
          fn(null, obj);
        });
      });
    });
  });
};

/**
 * Build a factory.
 *
 * @param {Object} custom attributes [optional]
 * @returns {Object}
 * @api public
 */

Factory.prototype.build = function(attrs) {
  attrs = merge( this.attrs(), attrs || {});
  return new this.Model(attrs);
};

/**
 * Return own and ancestor attributes.
 *
 * @returns {Object} attributes
 * @api public
 */

Factory.prototype.attrs = function() {
  var ret = {}
    , attributes = this.attributes;

  this.ancestors().forEach(function(ancestor){
    attributes = merge(ancestor.attributes, attributes);
  });

  Object.keys(attributes).forEach(function(attribute) {
    filtr.setPathValue(
      attribute,
      this.value(attribute, attributes),
      ret
    );
  }.bind(this));

  return ret;
};

/**
 * Extend the current factory.
 *
 * @param {String} Name of the parent factory
 * @returns `this`
 * @api public
 */

Factory.prototype.extend = function(name) {
  var self = this;

  self.parent = factories.get(name);

  self.ancestors().forEach(function(ancestor){
    for(key in ancestor.events){
      (ancestor.events[key] || []).forEach(function(fn){
        self.hook(key, fn);
      });
    }
  });

  return self;
};

/**
 * Compute a value for an attribute.
 *
 * @param {String} attribute
 * @param {Object} definition
 * @returns {Mixed}
 * @api private
 */

Factory.prototype.value = function(attribute, definition) {
  if (typeof definition[attribute] !== 'function') {
    return definition[attribute];
  }

  return (definition[attribute].length === 0)
    ? definition[attribute]()
    : definition[attribute](this.seq())
  ;
};

/**
 * Return an array of the factory's ancestors
 *
 * @returns {Array}
 * @api private
 */

Factory.prototype.ancestors = function() {
  var ancestors = []
    , current = this;

  while(current.parent){
    ancestors.push(current.parent);
    current = current.parent;
  }

  return ancestors;
};

/**
 * Check if the factory has any ancestor factories.
 *
 * @returns {Boolean}
 * @api private
 */

Factory.prototype.hasAncestors = function() {
  return !!this.ancestors().length;
};

/**
 * Return an integer, unique for the current factory.
 *
 * @returns {Number}
 * @api private
 */

Factory.prototype.seq = function() {
  return this.hasAncestors()
    ? this.parent.seq()
    : ++this.i;
};

/**
 * Primary export.
 */

module.exports = Factory;
