// Towns of TK (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Fale old settlement",-939,-17125,5],["Nukunonu",-920,-17185,5],["Atafu Village",-854,-17252,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["TK"] = T;
})(typeof window !== "undefined" ? window : globalThis);
