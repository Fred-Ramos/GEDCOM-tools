// Towns of CK (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Avarua",-2121,-15978,2],["Matavera",-2122,-15973,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["CK"] = T;
})(typeof window !== "undefined" ? window : globalThis);
