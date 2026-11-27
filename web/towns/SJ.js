// Towns of SJ (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Longyearbyen",7822,1565,2],["Olonkinbyen",7092,-872,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SJ"] = T;
})(typeof window !== "undefined" ? window : globalThis);
