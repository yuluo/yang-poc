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

var netconf_server = require('../netconf_server')

var server = netconf_server.create(function(error, rpc_methods)
{
	if (error)
	{
		console.error(error)
		process.exit(1)
	}

	// add custom rpc method
	rpc_methods["power"] = function(data_in, response)
	{
		// console.log(data_in)

		// return output data as object
		response({'data' : 'test'})
	}
})

server.on('rpc', function(rpc)
{
})

server.on('error', function(error)
{
	console.log(error)
	process.exit(1)
})
