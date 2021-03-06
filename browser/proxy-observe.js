(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//     proxy-observe
//
//     Copyright (c) 2015 Simon Y. Blackwell, AnyWhichWay
//     MIT License - http://opensource.org/licenses/mit-license.php
(function() {
	"use strict";
	// Creates and returns a Proxy wrapping a target so that all changes can be trapped and forwarded to
	// a callback. The callback takes an array of changes just like the traditional original Chrome Object.observe
	// {object:<object changed>,name:<field changed>,type:add|update|delete|reconfigure|preventExtensions|setPrototype,oldValue:<old value if update | delete>}
	// The acceptlist can be add|update|delete|reconfigure|preventExtensions|setPrototype.
	 function Observer(target,callback,acceptlist) {
	    	var me = this;
	    	function deliver() {
        		if(me.changeset.length>0) {
    	    		var changes = me.changeset.filter(function(change) { return !acceptlist || acceptlist.indexOf(change.type)>=0; });
        			if(changes.length>0) {
        				callback(changes);
        			}
        			me.changeset = [];
        		}
        		setTimeout(deliver,0);
	    	}
	    	me.target = target;
	    	me.changeset = [];
	    	if(!target.__observerCallbacks__) {
	    		Object.defineProperty(target,"__observerCallbacks__",{enumerable:false,configurable:true,writable:false,value:[]});
	    		Object.defineProperty(target,"__observers__",{enumerable:false,configurable:true,writable:false,value:[]});
	    	}
	    	target.__observerCallbacks__.push(callback);
	    	target.__observers__.push(this);
	    	var proxy = new Proxy(target,me);
	    	deliver();
	    	return proxy;
	    }
	if(!Object.observe && typeof(Proxy)==="function") {
	    Observer.prototype.get = function(target, property) {
	    	if(property==="__observer__") {
	    		return this;
	    	}
	    	return target[property];
	    }
	    Observer.prototype.set = function(target, property, value) { // , receiver
	    	var oldvalue = target[property];
	    	var type = (oldvalue===undefined ? "add" : "update");
	    	target[property] = value;
	    	if(!this.acceptlist || this.acceptlist.indexOf(type)>=0) {
	        	var change = {object:this.proxy,name:property,type:type};
	        	if(type==="update") {
	        		change.oldValue = oldvalue;
	        	}
	        	this.changeset.push(change);
	    	}
	    	return true;
	    };
	    Observer.prototype.deleteProperty = function(target, property) {
	    	var oldvalue = target[property];
	    	delete target[property];
	    	if(!this.acceptlist || this.acceptlist.indexOf("delete")>=0) {
	        	var change = {object:this.proxy,name:property,type:"delete",oldValue:oldvalue};
	        	this.changeset.push(change);
	    	}
	    	return true;
	    };
	    Observer.prototype.defineProperty = function(target, property, descriptor) {
	   		Object.defineProperty(target, property, descriptor);
	    	if(!this.acceptlist || this.acceptlist.indexOf("reconfigure")>=0) {
	        	var change = {object:this.proxy,name:property,type:"reconfigure"};
	        	this.changeset.push(change);
	    	}
	    	return true;
	    };
	    Observer.prototype.setProtoypeOf = function(target, prototype) {
	    	var oldvalue = Object.getPrototypeOf(target);
	        Object.setPrototypeOf(target, prototype);
	    	if(!this.acceptlist || this.acceptlist.indexOf("setProtoype")>=0) {
	        	var change = {object:this.proxy,name:"__proto__",type:"setProtoype",oldValue:oldvalue};
	        	this.changeset.push(change);
	    	}
	    	return true;
	    };
	    Observer.prototype.preventExtensions = function(target) {
	    	//var oldvalue = Object.getPrototypeOf(target);
	        Object.preventExtensions(target);
	    	if(!this.acceptlist || this.acceptlist.indexOf("preventExtensions")>=0) {
	        	var change = {object:this.proxy,type:"preventExtensions"};
	        	this.changeset.push(change);
	    	}
	    	return true;
	    };
	    Object.observe = function(object,callback,acceptlist) {
	    	return new Observer(object,callback,acceptlist);
	    };
	    Object.unobserve = function(object,callback) {
	    	if(object.__observerCallbacks__) {
	    		object.__observerCallbacks__.forEach(function(observercallback,i) {
	    			if(callback===observercallback) {
	    				object.__observerCallbacks__.splice(i,1);
	    				delete object.__observers__[i].callback;
	    				object.__observers__.splice(i,1);
	    			}
	    		});
	    	}
	    };
	    Array.observe = function(object,callback,acceptlist) {
	    	var proxy = Object.observe(object,function(changeset) { 
	    		var changes = changeset.filter(function(change) { return change.name!=="length" && change.name!=="add" && (!acceptlist || acceptlist.indexOf(change.type)>=0); });
	    		if(changes.length>0) {
	    			callback(changes);
	    		}
	    	},acceptlist);
	    	var oldsplice = object.splice;
	    	proxy.splice = function(start,end) {
	    		var removed = this.slice(start,end);
	    		var addedCount = arguments.length - 1;
	    		var change =  {object:proxy,type:"splice",index:start,removed:removed,addedCount:addedCount};
	    		oldsplice.apply(this,arguments);
	    		if(acceptlist.indexOf("splice")>=0) {
	    			proxy.__observer__.changeset.push(change);
	    		}
	    	};
	    	object.splice.oldsplice = oldsplice;
	    	var oldpush = object.push;
	    	proxy.push = function(item) {
	    		return this.splice(this.length-1,0,item);
	    	};
	    	object.push.oldpush = oldpush;
	    	var oldpop = object.pop;
	    	proxy.pop = function() {
	    		return this.splice(this.length-1,1);
	    	};
	    	object.pop.oldpop = oldpop;
	    	var oldunshift = object.unshift;
	    	proxy.unshift = function(item) {
	    		return this.splice(0,0,item);
	    	};
	    	object.unshift.oldunshift = oldunshift;
	    	var oldshift = object.shift;
	    	proxy.shift = function() {
	    		return this.splice(0,1);
	    	};
	    	object.shift.oldshift = oldshift;
	    	return proxy;
	    };
	   //Array.unobserve(object,callback) {
		//   
	  // }
	}
	Object.deepObserve = function(object,callback,parts) {
		parts = (parts ? parts : []);
		var keys = Object.keys(object);
		object = Object.observe(object,function(changeset) {
			var changes = [];
			function recurse(name,rootObject,oldObject,newObject,path) {
				if(newObject instanceof Object) {
					var newkeys = Object.keys(newObject);
					newkeys.forEach(function(key) {
						if(!oldObject || (oldObject[key]!==newObject[key])) {
							var oldvalue = (oldObject && oldObject[key]!==undefined ? oldObject[key] : undefined);
							var change = (oldvalue===undefined ? "add" : "update");
							var keypath = path + "." + key;
							changes.push({name:name,object:rootObject,type:change,oldValue:oldvalue,newValue:newObject[key],keypath:keypath});
							recurse(name,rootObject,oldvalue,newObject[key],keypath);
						}
					});
				} else if(oldObject instanceof Object) {
					var oldkeys = Object.keys(oldObject);
					oldkeys.forEach(function(key) {
						var change = (newObject===null ? "update" : "delete");
						var keypath = path + "." + key;
						changes.push({name:name,object:rootObject,type:change,oldValue:oldObject[key],newValue:newObject,keypath:keypath});
						recurse(name,rootObject,oldObject[key],undefined,keypath);
					});
				}
			}
			changeset.forEach(function(change) {
				var keypath = (parts.length>0 ? parts.join(".") + "." : "") + change.name;
				changes.push({name:change.name,object:change.object,type:change.type,oldValue:change.oldValue,newValue:change.object[change.name],keypath:keypath});
				recurse(change.name,change.object,change.oldValue,change.object[change.name],keypath);
			});
			callback(changes);
		});
		keys.forEach(function(key) {
			if(object[key] instanceof Object) {
				var newparts = parts.slice(0);
				newparts.push(key);
				Object.deepObserve(object[key],callback,newparts);
			}
		});
		return object;
	};
})();
},{}]},{},[1]);
