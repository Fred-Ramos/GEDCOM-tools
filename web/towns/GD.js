// Towns of GD (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Saint George's",1205,-6175,2],["Victoria",1219,-6171,5],["Sauteurs",1222,-6164,5],["Saint David’s",1205,-6167,5],["Hillsborough",1248,-6146,5],["Grenville",1212,-6162,5],["Gouyave",1216,-6173,5],["Grand Roy",1213,-6175,10],["Upper La Taste",1219,-6162,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["GD"] = T;
})(typeof window !== "undefined" ? window : globalThis);
