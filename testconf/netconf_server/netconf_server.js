/*
 * Copyright (C) 2014 Cisco Systems, Inc.
 *
 * Author: Petar Koretic <petar.koretic@sartura.hr>
 * Author: Luka Perkov <luka.perkov@sartura.hr>
 *
 * testconf is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with testconf. If not, see <http://www.gnu.org/licenses/>.
 */

var fs = require('fs');
var xml2js = require('xml2js')
var util = require('util')
var events = require("events")
var path = require('path')

var ssh2 = require('ssh2')
var utils = ssh2.utils
var crypto = require('crypto')
var inspect = util.inspect
var buffersEqual = require('buffer-equal-constant-time')
var netconf = require('../core/netconf')
var debug = require('../core/debug')
var config = require('../core/config')

var builder = new xml2js.Builder();

var session_id_counter = 0

var server = function(options, callback)
{
	var opts = options || {}

	this.name = opts.name || path.basename(module.parent.filename)
	this.host = opts.host || config.netconf.host
	this.port = opts.port || config.netconf.port
	this.user = opts.user || config.netconf.user
	this.pass = opts.pass || config.netconf.pass
	this.log_name = opts.log_name || config.server.log_name
	this.ssh_key = opts.ssh_key || null
	this.send_hello_message = opts.send_hello_message || true
	this.rpc_methods = {}
	this.log_file = null

	var self = this

	var ssh_channel = null

	events.EventEmitter.call(this);

	self.log_file = fs.openSync(self.log_name, "a+")

	if (!self.log_file)
	{
		var err_msg = "unable to create log file: '" + self.log_name + '"'
		console.error(err_msg)

		return callback(err_msg)
	}

	debug.write('. executing test named "' + this.name + '"', true, self.log_file)

	try
	{
		self.rpc_methods = require(config.server_methods_dir + "core.js")
	}
	catch(e)
	{
		debug.write(e, true, self.log_file)
	}

	debug.write('.. reading yang directory', true, self.log_file);

	var capabilities = netconf.capabilities_from_yang(config.yang_dir, self.log_file)

	processRequest = function (connection, stream, callback)
	{
		return function(request)
		{
			debug.write('<<<< msg netconf <<<<', false, self.log_file)
			debug.write(request, false, self.log_file)
			debug.write('---- msg netconf ----', false, self.log_file)

			xml2js.parseString(request, function(error, data)
			{
				if (error)
				{
					debug.write('.... xml parsing failed', true, self.log_file)
					debug.write(error, false, self.log_file)

					return self.emit('error', error)
				}

				if (data["hello"])
				{
					if (connection.netconf_ready)
					{
						debug.write('..... hello received at the wrong stage', true, self.log_file)
						return self.emit('error', 'hello received at the wrong stage')
					}

					debug.write('..... hello', true, self.log_file)
					connection.netconf_ready = 1

					var capabilities = data["hello"]["capabilities"][0].capability;

					for (var i in capabilities)
					{
						debug.write('...... capability - ' + capabilities[i], true, self.log_file)

						if (capabilities[i] == 'urn:ietf:params:netconf:base:1.1')
						{
							connection.netconf_base = 1
						}
					}

					return callback(null, self.rpc_methods)
				}

				if (data["rpc"])
				{

					var rpc_reply = {}
					var xml_message = ''

					// handle core modules
					for (var method in self.rpc_methods)
					{
						if (method in data["rpc"])
						{
							self.rpc_methods[method](data["rpc"][method][0], rpc_method_call)
							return
						}
					}

					// handle generated modules
					var files = fs.readdirSync(config.server_methods_dir)
					for (var f in files)
					{
						var file = files[f]

						// TODO: delete cache when needed
						delete require.cache[__dirname + "/methods/" + file]
						var methods = require(config.server_methods_dir + file)
						for (var method in methods)
						{
							if (method in data["rpc"])
							{
								methods[method](data["rpc"][method][0], rpc_method_call)
								return
							}
						}
					}

					function rpc_method_call(resp)
					{

						if (!resp)
						{
							resp = netconf.rpc_error("method failed", "operation-not-supported")
						}

						// raw xml message
						if (typeof resp === 'string')
						{
							xml2js.parseString(resp, function(error, data)
							{
								rpc_method_send(error ? {"rpc-error" : error} : data)
							})
						}

						// javascript object message
						else
						{
							rpc_method_send(resp)
						}
					}

					function rpc_method_send(resp)
					{
						rpc_reply = {"rpc-reply": resp}
						rpc_reply["rpc-reply"].$ = data.rpc.$

						xml_message = builder.buildObject(rpc_reply)
						if (connection.netconf_base == 1)
							xml_message = netconf.create_framing_chunk(xml_message.length) + xml_message

						xml_message += netconf.ending[connection.netconf_base]

						self.emit('rpc', data['rpc'])

						debug.write('..... sending rpc', true, self.log_file)

						stream.write(xml_message)

						debug.write('>>>> msg netconf >>>>', false, self.log_file)
						debug.write(xml_message, false, self.log_file)
						debug.write('---- msg netconf ----', false, self.log_file)
					}
				}
			})
		}
	}
	console.log('.. starting ssh server')
	var pubKey = utils.genPublicKey(utils.parseKey(fs.readFileSync(config.keys_dir + 'ssh_host_rsa_key.pub')))
	var ssh = new ssh2.Server
	({
		privateKey : fs.readFileSync(config.keys_dir + 'ssh_host_rsa_key'),
	}, function(client)
	{
		var auth_retries = 0

		client.on('authentication', function(ctx) {
			var reject = function ()
			{
				console.log('rejecting')
				if (auth_retries++ > config.server.auth_retries)
				{
					debug.write('... authentication failed', true, self.log_file)
					ctx.reject()
					return callback('error', 'authentication failed')
				}
				else
				{
					ctx.reject()
					return callback('error', 'authentication failed')
				}
			}

			if (ctx.method === 'password')
			{
				if (ctx.username === self.user
						&& ctx.password === self.pass)
				{
					debug.write('... authenticated "' + self.user + '" using password', true, self.log_file)
					ctx.accept()
				}
				else
				{
					reject()
					return callback('error', 'authentication failed')
				}
			}
			else if (ctx.method === 'publickey'
					&& ctx.key.algo === pubKey.fulltype
					&& buffersEqual(ctx.key.data, pubKey.public))
			{
				if (ctx.signature)
				{
					var verifier = crypto.createVerify(ctx.sigAlgo)
					verifier.update(ctx.blob)
					if (verifier.verify(pubKey.publicOrig, ctx.signature))
					{
						debug.write('... authenticated "' + self.user + '" using public key', true, self.log_file)
						ctx.accept()
					}
					else
					{
						reject()
						return callback('error', 'authentication failed')
					}
				}
				else
				{
					debug.write('... authenticated "' + self.user + '" using public key', true, self.log_file)
					ctx.accept()
				}
			}
			else
			{
				reject()
				return callback('error', 'authentication failed')
			}
		}).on('ready', function()
		{
			debug.write('.. received connection', true, self.log_file)

			client.on('session', function(accept, reject)
			{
				var session = accept()

				var connection = {}
				connection.buffer = ''
				connection.netconf_base = 0
				connection.netconf_ready = 0
				connection.session_id = ++session_id_counter

				session.once('subsystem', function(accept, reject, info)
				{
					if (info.name != 'netconf')
					{
						message.replyDefault()
						debug.write('... tried to request non-netconf subsytem: "' + info.name + '"', true, self.log_file)
						reject()
						return callback('error', 'tried to request non-netconf subsytem: "' + info.name + '"')
					}

					debug.write('... acquired netconf subsytem', true, self.log_file)

					var stream = accept()

					if (self.send_hello_message)
					{
						var h = netconf.hello(capabilities, connection.session_id)
						debug.write('.... sending hello message', true, self.log_file)

						stream.write(h)

						debug.write('<<<< msg netconf (hello) <<<<', false, self.log_file)
						debug.write(h, false, self.log_file)
						debug.write('---- msg netconf (hello) ----', false, self.log_file)
					}

					stream.on('data', function(data)
					{
						debug.write('.... received (partial) msg, len: ' + data.toString().length, false, self.log_file)
						debug.write('<<<< partial msg <<<<', false, self.log_file)
						debug.write(data.toString(), false, self.log_file)
						debug.write('---- partial msg ----', false, self.log_file)

						connection.buffer += data;

						debug.write('.... processing incoming request', true, self.log_file)
						netconf.process_message(connection, processRequest(connection, stream, callback))
					})
				})
			})
		}).on('end', function()
		{
			debug.write('.. ssh channel closed', true, self.log_file)
		})
	})

	ssh.listen(self.port, self.host, function()
	{
		debug.write('.. listening on ' + self.host + ":" + self.port, true, self.log_file)
	})
}

util.inherits(server, events.EventEmitter);

exports.create = function(opts, callback)
{
	if (!arguments.length)
		return

	if (typeof callback === 'undefined' && opts !== 'undefined')
		callback = opts

	if (typeof callback != 'function')
		return

	return new server(opts, callback);
}
