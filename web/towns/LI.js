// Towns of LI (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Vaduz",4714,952,2],["Triesenberg",4712,954,5],["Triesen",4711,953,5],["Schellenberg",4723,955,5],["Schaan",4716,951,5],["Ruggell",4724,953,5],["Planken",4719,954,5],["Mauren",4722,954,5],["Gamprin",4722,951,5],["Eschen",4721,952,5],["Balzers",4707,950,5],["Bendern",4721,951,10],["Nendeln",4720,954,11],["Mäls",4706,950,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["LI"] = T;
})(typeof window !== "undefined" ? window : globalThis);
