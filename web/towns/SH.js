// Towns of SH (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Jamestown",-1592,-572,2],["Georgetown",-793,-1441,5],["Edinburgh of the Seven Seas",-3707,-1231,5],["Half Tree Hollow",-1594,-572,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SH"] = T;
})(typeof window !== "undefined" ? window : globalThis);
