#!/usr/bin/env node

const argv = require('yargs').argv;
const bso = require('./bounded_search_osm');

/*
bounded_search_osm --file lisbon_portugal.osm --lon0=-9.1461181640625 --lon1=-9.14337158203125 --lat0=38.732661120482334 --lat1=38.73480362521081  --summary --progress --verbose
*/

//console.log(argv);
bso(argv);
