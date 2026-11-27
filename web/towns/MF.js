// Towns of MF (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Marigot",1807,-6308,2],["Grand-Case",1810,-6305,9],["Concordia",1806,-6308,9],["Sandy Ground",1806,-6310,9],["Quartier d’Orléans",1807,-6304,9],["Colombier",1807,-6306,9],["Agrément",1808,-6308,10],["Oyster Pond",1806,-6302,10],["Saint-James",1806,-6309,10]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["MF"] = T;
})(typeof window !== "undefined" ? window : globalThis);
