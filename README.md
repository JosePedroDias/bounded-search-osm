# Bounded search OSM

## Purpose

Traverses OSM XML data directly, storing in memory nodes, ways and relations if partially inside lon/lat bounds given.

It does not do any indexing ahead of time and assumes data is listed in XML so that nodes are listed prior to ways prior to relations.

This is not suitable for most applications. It uses expat but all the serialization to JS and lack of indexing makes this unviable for
large datasets or large bounding boxes.
Tested in Lisbon, PT with a zoom 17 area, taking 30 secs in a 2016 MBP.
Bigger datasets shouldn't crash, but takes linear time with data size.
Bigger bounding boxes haven't been tested, are constrained by memory.

Why is this useful then? No hard dependencies to install and only requires the original data to be on disk!
I guess it can aid experimenting without much hassle, if you're doing one-shot extracts of data.


## How to use?

It logs resulting JSON to STDOUT. Additional info such as progress, verbose goes via STDERR.

    bounded_search_osm --file lisbon_portugal.osm --lon0=-9.1461181640625 --lon1=-9.14337158203125 --lat0=38.732661120482334 --lat1=38.73480362521081 --summary --progress --verbose > result.json


## Where can I get OSM extracts from?

* <http://download.geofabrik.de/europe.html>
* <http://wiki.openstreetmap.org/wiki/Planet.osm>
* <https://mapzen.com/data/metro-extracts/>

Expected format is OSM.bz2 files. These are Bzip2 XML files.


## Output format

A JSON object with the keys `nodes`, `ways` and `relations`. Each item has key id and relevant data as values object.

The following attributes have been ditched: version, timestamp, changeset, uid, user.

Tag elements have been merged into the tags object of node/way/rel.

Nd elements have been merged into nodeIds array of way.

Member elements have been merged into nodeIds and wayIds objects of rel (depending on type being node/way). Each k/v pair has ref/role.

```
// example node:
"26108678": {"lon":"-9.1449728", "lat":"38.7333527", "tags":{"highway":"crossing","crossing":"traffic_signals"}}

// example way:
"23659384": {"nodeIds":["221309310","3954487346","256335432","3948213154","256335427"], "tags":{"name":"Avenida Praia da Vitória","oneway":"yes","highway":"residential"}}

// example relation:
"371021": {"nodeIds":{"247051835":"stop:6","256673574":"stop:3","256673960":"stop:2","256673972":"stop:4","256674213":"stop:7","256976570":"stop:8","256976574":"stop:9","256978160":"stop:10","256978165":"stop:11","256978170":"stop:12","256978583":"stop:13","256979289":"stop:14","256981317":"stop:15","256981321":"stop:16","256981325":"stop:17","600134721":"stop:5","1696909109":"stop:1"}, "wayIds":{"23704556":""}, "tags":{"ref":"Azul","name":"Linha Azul","type":"route","route":"subway","colour":"#094FA3","name:uk":"Синя лінія","wikipedia":"de:Linha Azul"}}

```


## TODO

* read directly from bz2 instead of unzipped osm
* nodes, ways and rels could be outputted JIT instead of being cached to memory...
* possible additional filters based on way/relation data
