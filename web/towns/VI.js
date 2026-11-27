// Towns of VI (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Charlotte Amalie",1834,-6493,2],["Cruz Bay",1833,-6479,5],["Saint Croix",1773,-6475,5],["Tutu",1834,-6489,9],["Christiansted",1775,-6471,10],["Altona",1834,-6495,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["VI"] = T;
})(typeof window !== "undefined" ? window : globalThis);
