// Towns of EH (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Laayoune",2714,-1319,4],["Dakhla",2368,-1596,5],["Boujdour",2613,-1449,6],["El Marsa",2710,-1342,7],["Meharrize",2615,-1107,8],["Bir Ghandouz",2205,-1675,8],["Tichla",2158,-1497,9],["El Aargub",2361,-1587,9],["Bir Ganduz",2160,-1645,9],["Amgala",2629,-1114,9],["Oum Dreyga",2410,-1330,10],["Tifariti",2616,-1056,10],["Bu Craa",2635,-1278,10],["Haouza",2710,-1101,10],["Foum el Oued",2717,-1340,10],["Dchira",2703,-1305,10],["Jraifia",2491,-1482,11],["Bir Anzarane",2389,-1454,11],["Lemsid",2654,-1384,11],["Uad Damran",2746,-1299,11],["Daoura",2746,-1299,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["EH"] = T;
})(typeof window !== "undefined" ? window : globalThis);
