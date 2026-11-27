// Towns of AI (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["The Valley",1822,-6306,2],["West End Village",1817,-6315,5],["The Quarter",1821,-6304,5],["Farrington",1822,-6302,5],["Stoney Ground",1822,-6305,5],["South Hill Village",1819,-6309,5],["Sandy Ground Village",1820,-6309,5],["North Side",1823,-6304,5],["North Hill Village",1821,-6308,5],["Island Harbour",1826,-6301,5],["George Hill",1820,-6307,5],["East End Village",1823,-6300,5],["Blowing Point Village",1818,-6309,5],["Sandy Hill",1822,-6301,5]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["AI"] = T;
})(typeof window !== "undefined" ? window : globalThis);
