// Towns of MO (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Macau",2220,11355,2],["Taipa",2216,11356,5],["Sé",2219,11355,6],["Luhuan",2212,11355,6],["Zhuojiacun",2216,11356,7],["Lai Chi Van",2212,11355,7],["Cotai",2214,11356,8]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["MO"] = T;
})(typeof window !== "undefined" ? window : globalThis);
