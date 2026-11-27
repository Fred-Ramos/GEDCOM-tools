// Towns of VG (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Road Town",1843,-6462,2],["Spanish Town",1845,-6443,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["VG"] = T;
})(typeof window !== "undefined" ? window : globalThis);
