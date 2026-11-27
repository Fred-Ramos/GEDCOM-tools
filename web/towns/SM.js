// Towns of SM (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["San Marino",4394,1245,2],["Serravalle",4397,1248,5],["Poggio di Chiesanuova",4390,1242,5],["Monte Giardino",4391,1248,5],["Fiorentino",4391,1246,5],["Faetano",4393,1250,5],["Domagnano",4395,1247,5],["Borgo Maggiore",4394,1245,5],["Acquaviva",4395,1242,5],["Dogana",4398,1249,8],["Valdragone",4394,1246,8],["Cailungo",4395,1245,10],["Murata",4392,1245,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SM"] = T;
})(typeof window !== "undefined" ? window : globalThis);
