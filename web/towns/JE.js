// Towns of JE (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Saint Helier",4919,-210,2],["Le Hocq",4917,-206,5],["St Lawrence",4922,-214,9],["St Martin",4922,-205,9],["Trinity",4923,-209,9],["Saint John",4925,-214,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["JE"] = T;
})(typeof window !== "undefined" ? window : globalThis);
