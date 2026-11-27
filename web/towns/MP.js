// Towns of MP (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Saipan",1521,14575,2],["San Jose Village",1497,14562,5],["Garapan",1521,14572,10],["Chalan Piao village",1514,14570,11],["Fananganan village",1521,14573,11],["Chalan Laulau Village",1518,14571,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["MP"] = T;
})(typeof window !== "undefined" ? window : globalThis);
