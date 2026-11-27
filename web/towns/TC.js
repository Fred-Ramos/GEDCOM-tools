// Towns of TC (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Cockburn Town",2146,-7114,2],["Providenciales",2178,-7225,7],["Five Cays Settlement",2176,-7227,9],["Wheeland",2181,-7228,9],["The Bight Settlements",2178,-7220,10],["Kew",2191,-7199,10],["Blue Hills Settlements",2181,-7228,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["TC"] = T;
})(typeof window !== "undefined" ? window : globalThis);
