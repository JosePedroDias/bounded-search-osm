'use strict';

const fs = require('fs');

const expat = require('node-expat');
const progress = require('progress-stream');



function jsonSet(s) {
  const a = Array.from(s);
  return JSON.stringify(a);
}

function jsonMap(m) {
  const o = {};
  m.forEach(function(v, k) {
    o[k] = v;
  });
  return JSON.stringify(o);
}



function boundedSearchOSM(o) {
  const OSM_FILE = o.file;
  const lon0 = o.lon0;
  const lon1 = o.lon1;
  const lat0 = o.lat0;
  const lat1 = o.lat1;

  const DEBUG    = !!o.verbose;
  const SUMMARY  = !!o.summary;
  const PROGRESS = !!o.progress;



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
  const storedWayIds  = new Set();
  const storedRels    = new Map();
  let lastNodeAttrs;
  let lastNode;
  let lastWayAttrs;
  let lastWay;
  let lastRelAttrs;
  let lastRel;
  let totalNodes = 0;
  let totalWays  = 0;
  let totalRels  = 0;



  const parser = new expat.Parser('UTF-8');

  parser.on('startElement', function (name, attrs) {
    if (name === 'node') {
      ++totalNodes;
      const lon = parseFloat(attrs.lon);
      const lat = parseFloat(attrs.lat);
      if (withinBounds(lon, lat)) {
        lastNodeAttrs = attrs;
        lastNode = {
          lon  : lon,
          lat  : lat,
          tags : new Map()
        };
      }
    } else if (name === 'way') {
      ++totalWays;
      lastWayAttrs = attrs;
      lastWay = {
        nodeIds : new Set(),
        tags    : new Map()
      };
    } else if (name === 'relation') {
      ++totalRels;
      lastRelAttrs = attrs;
      lastRel = {
        nodeIds : new Map(),
        wayIds  : new Map(),
        tags    : new Map()
      };
    } else if (lastWay && name === 'nd') {
      lastWay.nodeIds.add(attrs.ref);
    } else if (name === 'tag') {
      if      (lastNode) { lastNode.tags.set(attrs.k, attrs.v); }
      else if (lastWay) {  lastWay.tags.set(attrs.k, attrs.v);  }
      else if (lastRel) {  lastRel.tags.set(attrs.k, attrs.v);  }
    } else if (lastRel && name === 'member') {
      if      (attrs.type === 'node') { lastRel.nodeIds.set(attrs.ref, attrs.role); }
      else if (attrs.type === 'way') {  lastRel.wayIds.set(attrs.ref, attrs.role);  }
    }
  });

  parser.on('endElement', function (name) {
    if (name === 'node' && lastNode) {
        const id = lastNodeAttrs.id;
        storedNodes.set(id, lastNode);
        storedNodeIds.add(id);
        if (DEBUG) {
          console.error('+node id:%s lon:%s lat:%s, #tags:%s (total:%s)', id, lastNode.lon, lastNode.lat, lastNode.tags.size, storedNodeIds.size);
        }
        lastNode = undefined;
    } else if (name === 'way') {
      const id = lastWayAttrs.id;
      let found = 0;
      lastWay.nodeIds.forEach(function(nodeId) {
        if (storedNodeIds.has(nodeId)) { ++found; }
      });
      if (found > 0) {
        storedWays.set(id, lastWay);
        storedWayIds.add(id);
        if (DEBUG) {
          console.error('+way id:%s, #nodes:%s/%s, #tags:%s (total:%s)', id, found, lastWay.nodeIds.size, lastWay.tags.size, storedWays.size);
        }
      }
      lastWay = undefined;
    } else if (name === 'relation') {
      const id = lastRelAttrs.id;
      let foundNs = 0;
      lastRel.nodeIds.forEach(function(nodeId) {
        if (storedNodeIds.has(nodeId)) { ++foundNs; }
      });
      let foundWs = 0;
      lastRel.wayIds.forEach(function(wayId) {
        if (storedWayIds.has(wayId)) { ++foundWs; }
      });
      if (foundNs > 0 || foundWs > 0  || storedRels.size < 10) { // TODO
        storedRels.set(id, lastRel);
        if (DEBUG) {
          console.error('+rel id:%s, #nodes:%s/%s, #ways:%s/%s, #tags:%s (total:%s)', id, foundNs, lastRel.nodeIds.size, foundWs, lastRel.wayIds.size, lastRel.tags.size, storedRels.size);
        }
      }
      //else { console.error(lastRel); // TODO }
      lastWay = undefined;
    }
  });

  parser.on('error', function (error) {
    console.error(error);
  });

  parser.on('end', function() { // finish:write, end:read

    if (SUMMARY) {
      console.error('nodes: %s/%s', storedNodes.size, totalNodes);
      console.error('ways : %s/%s', storedWays.size, totalWays);
      console.error('rels : %s/%s', storedRels.size, totalRels);
    }



    console.log('{');

    let sep = '';
    console.log('  "nodes": {');
    storedNodes.forEach(function(v, k) {
      let tags = jsonMap(v.tags);
      tags = (tags === '{}') ? '' : (', "tags":' + tags);
      console.log(`    ${sep}"${k}": {"lon":"${v.lon}", "lat":"${v.lat}"${tags}}`);
      sep = ',';
    });
    console.log('  }');

    sep = '';
    console.log('  ,"ways": {');
    storedWays.forEach(function(v, k) {
      const nodeIds = jsonSet(v.nodeIds);
      let tags = jsonMap(v.tags);
      tags = (tags === '{}') ? '' : (', "tags":' + tags);
      console.log(`    ${sep}"${k}": {"nodeIds":${nodeIds}${tags}}`);
      sep = ',';
    });
    console.log('  }');

    sep = '';
    console.log('  ,"relations": {');
    storedRels.forEach(function(v, k) {
      const nodeIds = jsonMap(v.nodeIds);
      const wayIds  = jsonMap(v.wayIds);
      let tags = jsonMap(v.tags);
      tags = (tags === '{}') ? '' : (', "tags":' + tags);
      console.log(`    ${sep}"${k}": {"nodeIds":${nodeIds}, "wayIds":${wayIds}${tags}}`);
      sep = ',';
    });
    console.log('  }');

    console.log('}');
  });


  fs.createReadStream(OSM_FILE)
  .pipe(progStr)
  .pipe(parser);

}



module.exports = boundedSearchOSM;
