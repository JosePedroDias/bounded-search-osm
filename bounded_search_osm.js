'use strict';

const fs = require('fs');
const expat = require('node-expat');
const progress = require('progress-stream');



const OSM_FILE = 'lisbon_portugal.osm';
const DEBUG = false;
const SUMMARY = true;
const PROGRESS = true;

const lon0 = -9.1461181640625;
const lon1 = -9.14337158203125;
const lat0 = 38.732661120482334;
const lat1 = 38.73480362521081;



function withinBounds(lon, lat) {
  return lon > lon0 && lon < lon1 && lat > lat0 && lat < lat1;
};



const stat = fs.statSync(OSM_FILE);

const progStr = progress({
  length : stat.size,
  time   : 1000 /* ms */
});

if (PROGRESS) {
  progStr.on('progress', function(p) {
    console.error('%s % (%s s)', p.percentage.toFixed(1), p.eta);
  });
}



const storedNodes   = new Map();
const storedNodeIds = new Set();
const storedWays    = new Map();
let lastWayAttrs;
let lastWay;



const parser = new expat.Parser('UTF-8');

parser.on('startElement', function (name, attrs) {
  if (name === 'node') {
    const lon = parseFloat(attrs.lon);
    const lat = parseFloat(attrs.lat);
    if (withinBounds(lon, lat)) {
      const id = attrs.id;
      storedNodes.set(id, {lat:lat, lon:lon});
      storedNodeIds.add(id);
      if (DEBUG) {
        console.error('+ node id:%s lon:%s lat:%s (total:%s)', id, lon, lat, storedNodeIds.size);
      }
    }
  }
  else if (name === 'way') {
    lastWayAttrs = attrs;
    lastWay = {
      nodeIds : new Set(),
      tags    : new Map()
    };
  }
  else if (lastWay && name === 'nd') {
    lastWay.nodeIds.add(attrs.ref);
  }
  else if (lastWay && name === 'tag') {
    lastWay.tags.set(attrs.k, attrs.v);
  }
});

parser.on('endElement', function (name) {
  if (name === 'way') {
    let found = 0;
    
    lastWay.nodeIds.forEach(function(nodeId) {
      if (storedNodeIds.has(nodeId)) {
        ++found
      }
    });
    
    if (found > 0) {
      storedWays.set(lastWayAttrs.id, lastWay);
      if (DEBUG) {
        console.error('+way id:%s, #nodes:%s/%s, #tags:%s (total:%s)', lastWayAttrs.id, found, lastWay.nodeIds.size, lastWay.tags.size, storedWays.size);
      }
    }
    
    lastWay = undefined;
  }
});

//parser.on('text', function (text) {
//  console.log(text);
//});

parser.on('error', function (error) {
  console.error(error);
});

parser.on('end', function() { // finish:write, end:read

  if (SUMMARY) {
    console.error('stored nodes: %s', storedNodes.size);
    console.error('stored ways : %s', storedWays.size);
  }
  
  
  
  console.log('{');
  
  let sep = '';
  console.log('  "nodes": {');
  storedNodes.forEach(function(v, k) {
    console.log(`    ${sep}"${k}": ${JSON.stringify(v)}`);
    sep = ',';
  });
  console.log('  }');
  
  sep = '';
  console.log('  ,"ways": {');
  storedWays.forEach(function(v, k) {
    const nodeIds = Array.from(v.nodeIds);
    const tags = {};
    const hasTags = v.tags.size > 0;
    if (hasTags) {
      v.tags.forEach(function(v, k) {
        tags[k] = v;
      });
    }
    
    console.log(`    ${sep}"${k}": {`);
      console.log(`      "nodeIds": ${JSON.stringify(nodeIds)}`);
      if (hasTags) {
        console.log(`      ,"tags": ${JSON.stringify(tags)}`);
      }
    console.log('    }');
    sep = ',';
  });
  console.log('  }');
  
  console.log('}');
});


fs.createReadStream(OSM_FILE)
.pipe(progStr)
.pipe(parser);