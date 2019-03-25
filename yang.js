const YANG = require( 'yang-js' );
const fs = require( 'fs' );
const inet = require( './yang/object/idirect-inet-profile.yang' );

YANG.import('./yang/object/idirect-type.yang');
YANG.import('./yang/object/idirect-enum.yang');
YANG.import('./yang/object/idirect-network-version.yang');
YANG.import('./yang/object/idirect-beam.yang');
YANG.import('./yang/object/idirect-downstream-carrier.yang');
//YANG.import('./yang/object/idirect-inet-profile.yang');
YANG.import('./yang/object/idirect-satellite.yang');

var xml = fs.readFileSync('./data.xml', 'utf8');


var model = inet.validate( xml );

console.log(model)