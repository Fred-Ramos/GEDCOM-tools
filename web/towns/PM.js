// Towns of PM (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Saint-Pierre",4678,-5618,2],["Miquelon",4710,-5638,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["PM"] = T;
})(typeof window !== "undefined" ? window : globalThis);
