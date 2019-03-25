let optionfile = require( './idirect-inet_ob_profile.json' );
const utils = require( '../../utils.js' );

function inet( data ) {
    utils.translate( optionfile, data );
    
    //need to find the satelitte.obj_id == beam.obj_parentid
    for ( let i = 0; i < data.beam.length; i++ ) {
        let beam = new Map();
        let satellite = data.satellite.find( satellite => {
            return satellite.obj_id === data.beam[ i ].obj_parentid;
        } );
     
        beam.set( 'beam_id', data.beam[ i ].beam_index );
        beam.set( 'sat_domain', satellite.domainname);
        optionfile.OUTBOUND.MATCHING_CRITERIA.GEO_SCOPE.push( beam );
    }
    
    // inet
    let downstreamcarrier = data.downstreamcarrier[ 0 ];
    let inet = optionfile.OUTBOUND.INET;
    if ( downstreamcarrier.minmodcod &&
         downstreamcarrier.maxmodcod ) {
       inet.allowed_modcod_bitmap = utils.calculateModcodBmp( 
               downstreamcarrier.modulation,
               downstreamcarrier.minmodcod,
               downstreamcarrier.maxmodcod );
    } else {
       inet.allowed_modcod_bitmap = 4127743;
    }
    inet.net_outroute_bps = utils.calculateOutrouteBps( 
            downstreamcarrier.modulation,
            downstreamcarrier.symbolrate,
            inet.allowed_modcod_bitmap );
    inet.max_queuing_msec = utils.calculateMaxqueueinginms( inet.net_outroute_bps );
    
 
    //This logic does not make sense
    if ( data.downstreamcarrier[ 0 ].modulation === 'CCM' ) {
        optionfile.OUTBOUND.DVBS2.mode = 'ccm';
    } else {
        optionfile.OUTBOUND.DVBS2.mode = 'acm';
    }
    

    return optionfile;
}



module.exports = inet;