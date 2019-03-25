const jsonxml = require( "js2xmlparser" );
const jsonpath = require( 'jsonpath' );
const modcod = require( "./constant/modcod.json" );
const acmModcodTable = require( "./constant/acm-modcod-table.json" );
const ccmModcodTable = require( "./constant/ccm-modcod-table.json" );
const constant = require( "./constant/constant.json" );

const utils = {
        _getValue: ( map, data ) => {
            let value = jsonpath.query( data, map.key )[ 0 ];
            
            if ( map.type === 'number' ) {
                value = Number( value );
            } else if ( map.type === 'booleanint' ) {
                value = value === 'true' ? 1 : 0;
            }
            
            if ( map.math ) {
                value = eval( map.math );
            }
            
            return value;
        },
        
        translate: ( mapping, data ) => {
            Object.keys( mapping ).forEach( key => {
                if ( mapping[ key ].key ) {
                    mapping[ key ] = utils._getValue( mapping[ key ], data );
                } else if ( typeof mapping[ key ] === 'object' ) {
                    utils.translate( mapping[ key ], data );
                }
            } );
        },
        
        formatData: ( data ) => {
            var xmlData = '';
            Object.keys( data ).forEach( ( key ) => {
                let xml;
                
                if ( key === 'network_version' ) {
                    xml = jsonxml.parse( key, data[ key ] );
                    xml = xml.substring( 22 );
                    xml = xml.substring( 0, 16 ) + " xmlns='http://yang.idirect.net/networkversion'" + 
                        xml.substring( 16 );
                    
                } else if ( Array.isArray( data[ key ] ) ) {
                    xml = jsonxml.parse( key, data[ key ] );
                    xml = xml.substring( 22 );
                    xml = xml.substring( 0, key.length + 1) +
                        " xmlns='http://yang.idirect.net/" + key + "'" +
                        xml.substring( key.length + 1 );
                    xml = xml.substring( 0, xml.length - 2 ) +
                        xml.substring( xml.length - 2, xml.length - 1 ) + '>'; 

                } else {
                    data[ key ][ '@' ] = {
                            "xmlns": "http://yang.idirect.net/" + key
                    };
                    xml = jsonxml.parse( key, data[ key ] );
                    xml = xml.substring( 22 );
                }
                
                xmlData += xml + '\n';
            } );

            return xmlData;
        },
        
        generateNMSSection: (optionfile, data, version ) => {
            optionfile.NMS.element_id = data.obj_id;
            optionfile.NMS.version = 'V' + version;
            optionfile.NMS.element_parent_id = data.obj_parentid;
        },

        calculateModcodBmp: ( modulation, minmodcod, maxmodcod ) => {
            let iModCod = 0;
            let Mode_qpsk_9_10 = 10;
            let Mode_8psk_9_10 = 16;
            let Mode_16apsk_9_10 = 22;
            let Mode_32apsk_9_10 = 27;
            
            let minModCodId = modcod[ minmodcod ];
            let maxModCodId = modcod[ maxmodcod ];
            
            for ( let i = minModCodId; i <= maxModCodId; i++ ) {
                iModCod = iModCod + ( 1 << i );
            }
            
            if ( modulation === 'ACM' ) {
                iModCod = iModCod & 
                    ~( ( 1 << Mode_qpsk_9_10 ) | 
                       ( 1 << Mode_8psk_9_10 ) | 
                       ( 1 << Mode_16apsk_9_10 ) | 
                       ( 1 << Mode_32apsk_9_10 ) );
            }
            
            return iModCod;
        },
        
        calculateOutrouteBps: ( modulation, symbolrate, modcod ) => {
            if ( !utils.isDvbs2Modulation( modulation ) ) {
                return symbolrate * 1024;
            }
            
            iMaxModcod = utils.getMaxModcod( modcod );
            return utils.getOutrouteBps(
                    modulation === 'ACM', 
                    iMaxModcod,
                    symbolrate * 1000 );
        },
        
        calculateMaxqueueinginms: ( outrouteBps ) => {
            let fValue = constant.HPB_DEFAULT_MAX_QUEUING_TIME;

            if ( outrouteBps != 0 ) {
                fValue = constant.HPB_SAFETY_MARGIN / ( outrouteBps / 1000000.0 );
            }

            if ( fValue < constant.HPB_DEFAULT_MAX_QUEUING_TIME) {
                return parseInt( fValue );
            } else {
                return contant.HPB_DEFAULT_MAX_QUEUING_TIME;
            }
        },
        
        getMaxModcod: ( modcodBitmap ) => {
            if ( modcodBitmap !== 0) {
                let iMaxModcod = 32;
                do {
                    iMaxModcod--;
                } while ( !( modcodBitmap & ( 1 << iMaxModcod ) ) );
                
                return iMaxModcod;
            }
            
            return 0;
        },
        
        getOutrouteBps: ( isACM, iModcodIdx, fSymbolRate ) => {

            let iNetOutrouteBPS = fSymbolRate;
            let fSymbolToBPS = 0.0;

            if ( !utils.isValidModcod( iModcodIdx ) ) {
                return iNetOutrouteBPS;
            }

            if ( isACM ) {
                fSymbolToBPS = acmModcodTable[ iModcodIdx ][ 2 ];
            } else {
                fSymbolToBPS = ccm_modcod_table[ iModcodIdx][ 2 ];
            }

            iNetOutrouteBPS = fSymbolRate * fSymbolToBPS;
            return iNetOutrouteBPS;
        },
        
        isDvbs2Modulation: ( modulation ) => {
            return modulation === 'CCM' || modulation === 'ACM';
        },
        
        isValidModcod: ( modcodIndex ) => {
            return ( ( modcodIndex >= 0 ) && ( modcodIndex < 28 ) );
        }
        
        
};

module.exports = utils;