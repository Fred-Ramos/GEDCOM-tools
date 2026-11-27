// Towns of MS (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Plymouth",1671,-6221,2],["Saint Peters",1677,-6222,5],["Brades",1679,-6221,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["MS"] = T;
})(typeof window !== "undefined" ? window : globalThis);
