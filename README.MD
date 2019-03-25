# Setup
1. follow instructions to build libyang
https://github.com/CESNET/libyang
2. npm install
3. update 'yanglint' inside poc.js point it to where yanglint is installed

# Content
1. inetprofile.json is the testing data
2. All related YANG model is under yang/object, idirect-beam.yang has some advanced usage on YANG model
3. hook/inet/inet.js provides translate logic
4. config.json is the main config file, configures YANG model and hook

# Test
1. default testing data will pass
2. remove beam.radius should throw error
3. change beam.beam_type to 'Non-Circular', and remove beam.beamcontour should throw error
4. change network_version to 1.0.0.0, and remove beam.beamcontour and beam.beam_type should pass validation
5. default testing data should generate same optionfile as
https://steelers-noc.pulse.idirect.net/config/inetprofile/latest_option/1815

# Send config to netconf server
1. Follow tail-f documentation to setup confd
Or follow this to setup netopeer2/sysrepo https://jira.idirect.net/browse/STL-210
2. Install yang/optionfile/idirect-inet_ob_profile.yang on netconf server
3. Update code to use the right option for confd or sysrepo http://vault.idirect.net/projects/STL/repos/data-model/browse/poc/poc.js?at=feat/STL-222#79


