const netconfClient = require( './testconf/netconf_client/netconf_client' );
const fs = require('fs');
const jsonxml = require( "js2xmlparser" );
const childProcess = require( 'child_process' );
const utils = require( './utils' );
const config = require( './config.json' );
const yanglint = "/home/idirect/workspace/libyang/build/yanglint";
const data = require( './inetprofile.json' );


function createCommand( type ) {
    let models = config[ type ].validation;
    let importModels = [
        "./yang/object/idirect-enum.yang",
        "./yang/object/idirect-network-version.yang",
        "./yang/object/idirect-type.yang"
    ];
    models = models.concat( importModels );
    let command = yanglint + ' -f json -d all '
    models.forEach( ( model ) => {
        command += ' ' + model;
    } );
    
    command += ' data.xml';
    return command;
}


var xmlData = utils.formatData( data );
var optionfileType = 'idirect-inet_ob_profile';

var sysrepoOptions = {
    host: "localhost",
    port: 830,
    user: "netconf",
    pass: "netconf"
};

var confdOptions = {
    host: "localhost",
    port: 2022,
    user: "admin",
    pass: "admin"
};


fs.writeFile( "./data.xml", xmlData, function( err ) {
    if( err ) {
        return console.log( err );
    }

    
    var command = createCommand( optionfileType );
    childProcess.exec( command, (err, stdout, stderr) => {
        if ( err ) {
            console.log( err );
        } else {
            // validatedData fill out defaults and some type conversion
            var validatedData = JSON.parse( stdout );
            
            transform = require( config[ optionfileType ].transformation );
            var transformedData = transform( data );
            console.log( JSON.stringify(transformedData, null, 4) );
            
            var yangData = {
              "idx": "9876",
              "data": transformedData,
              "@": {
                  "xmlns": "http://yang.idirect.net/" + optionfileType
              }
            };
                  
            var messageHeader = fs.readFileSync( 'messageheader.xml', 'utf8' );
            var dataBody = jsonxml.parse( optionfileType, yangData ).substring( 22 );
            var xmlMessage = messageHeader + dataBody + "</config>" + "</edit-config>";            
            
            netconfClient.create( confdOptions ).then( function( client ) {    
                client.send( xmlMessage ).thenDefault( function( reply ) {
                        console.log( reply );
                        client.send_close().thenDefault()
                } );
                 
            } );
            
        }
    } );
    
} ); 


