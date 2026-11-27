// Towns of BQ (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Kralendijk",1215,-6827,2],["The Bottom",1763,-6325,5],["Oranjestad",1748,-6299,5],["Dorp Antriol",1217,-6827,9],["Dorp Nikiboko",1214,-6826,9],["Upper Hell's Gate",1764,-6323,10],["Dorp Rincon",1224,-6833,10],["Dorp Tera Kora",1214,-6826,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["BQ"] = T;
})(typeof window !== "undefined" ? window : globalThis);
