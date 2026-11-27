// Towns of VU (1,000+ inhabitants) for the book's map: GeoNames, CC BY 4.0 (geonames.org).
// [name, lat, lon (1/100 degree), rank (smaller = more important)], most important (then most populous) first
(function (g) { const T = [["Port-Vila",-1774,16831,2],["Sola",-1388,16755,5],["Luganville",-1552,16716,5],["Lakatoro",-1610,16742,5],["Isangel",-1954,16928,5],["Saratamata",-1529,16799,5],["Norsup",-1607,16740,10],["Pango",-1778,16828,10],["Port-Olry",-1504,16707,11]];
  if (typeof module === "object" && module.exports) module.exports = T; else (g.MapTowns = g.MapTowns || {})["VU"] = T;
})(typeof window !== "undefined" ? window : globalThis);
