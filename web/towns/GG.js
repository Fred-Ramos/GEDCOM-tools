// Towns of GG (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Saint Peter Port",4946,-254,2],["Torteval",4943,-265,5],["Saint Sampson",4948,-252,5],["St Anne",4972,-221,5],["Saint Saviour",4946,-264,5],["Castel",4947,-260,5],["Saint Andrew",4944,-258,5],["St Martin",4944,-255,5],["Forest Parish",4943,-260,5],["Saint Pierre du Bois Parish",4945,-264,5],["Vale Parish",4949,-252,8]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["GG"] = T;
})(typeof window !== "undefined" ? window : globalThis);
