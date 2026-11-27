// Towns of SX (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Philipsburg",1803,-6305,2],["Cul de Sac",1805,-6307,8],["Lower Prince’s Quarter",1805,-6304,8],["Koolbaai",1804,-6308,9],["Little Bay",1803,-6306,9],["Upper Prince’s Quarter",1803,-6303,9]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["SX"] = T;
})(typeof window !== "undefined" ? window : globalThis);
