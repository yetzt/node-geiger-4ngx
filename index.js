#!/usr/bin/env node

var events = require("events");
var util = require("util");

var serialport = require("serialport");
var iconv = require("iconv-lite");

var debug = require("debug")("geiger");

function geiger(opts){
	return (this instanceof geiger) ? this.init(opts) : new geiger(opts);
};

util.inherits(geiger, events.EventEmitter);

geiger.prototype.init = function(opts){
	var self = this;
	
	// convert string argument to device
	if (typeof opts === "string") opts = { device: opts };
	
	self.opts = opts || {};
	self.device = this.opts.device || null;

	// data keys
	self.keys = ["counts","power_V","tube_V","temp_C","pressure_hPa","deviceid","radiation_nSvh"];

	// transmission buffer
	self.buffer = "";

	// connect to device and take in measurements
	self.connect();
	
	return this;
};

geiger.prototype.parse = function(data){
	var self = this;

	// check chunk
	if (!/^([0-9]+) ([0-9]+(\.[0-9]+)?)V ([0-9]+)V ([\+\-][0-9]+)°C ([0-9\.]+)hPa( ([0-9A-Z]+) ([0-9]+) nSv\/h)?$/.test(data)) return debug("invalid chunk: %s", data), this;

	// keep regex fragments, because debug will eat them
	var bits = [RegExp.$8, RegExp.$1, RegExp.$9, RegExp.$5, RegExp.$6, RegExp.$4, RegExp.$2];

	debug("parsing chunk: %s", data);

	return {
		deviceid: bits[0] || self.device.split(/[^a-z0-9\-\.]/gi).pop(),
		timestamp: Date.now(),
		cpm: (parseInt(bits[1],10)*2) || null, // measurement is 30 sec, so cpm is double
		radiation_usvh: (parseInt(bits[2],10)/1000) || (Math.round(parseInt(bits[1],10)/0.0875)/1000) || null, // µSv/h seems to be the unit of choice; calcualte if not received
		temp_c: (parseFloat(bits[3])) || null,
		pressure_hpa: (parseFloat(bits[4])) || null,
		tube_v: (parseFloat(bits[5])) || null,
		power_v: (parseFloat(bits[6])) || null
	};

};

geiger.prototype.connect = function(){
	var self = this;

	new serialport(self.device, {
		baudRate: 115200,
		dataBits: 8,
		stopBits: 1,
		parity: 'none'
	}).on("open", function(){
		debug("port open");
	}).on("close", function(){
		debug("port closed");
	}).on("disconnect", function(){
		debug("device disconnected");
	}).on("error", function(err){
		self.emit("error", err);
	}).on("data", function(data){
		debug("got %d bytes", data.length);

		// convert data to unicode and append to data buffer
		self.buffer += iconv.decode(new Buffer(data), 'iso-8859-1');

		// extract chunks from buffer
		chunks = self.buffer.split(/[\r\n]+/g);

		// fill buffer with leftover fragment
		self.buffer = chunks.pop();

		debug("found %d new data chunks", chunks.length);

		// emit data chunks
		chunks.map(function(chunk){
			return self.parse(chunk);
		}).map(function(chunk){
			self.emit("data", chunk);
		});
	
	});
	
	return this;
};

// geiger("/dev/tty.usbserial-GX1C0PY9").on("data", console.log);

module.exports = geiger;
